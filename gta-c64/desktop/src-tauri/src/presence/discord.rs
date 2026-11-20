// SPDX-License-Identifier: GPL-2.0-or-later
//! Discord's local IPC: frames of a little-endian opcode, a little-endian length and a JSON body, over a Unix
//! socket (Linux, macOS) or a named pipe (Windows). Whatever answers there may not be Discord, so it is opened
//! carefully and what it says is kept short.

use super::schema::Activity;
use serde_json::json;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const OP_HANDSHAKE: u32 = 0;
pub const OP_FRAME: u32 = 1;
#[cfg(all(test, unix))]
pub const OP_CLOSE: u32 = 2;
pub const OP_PING: u32 = 3;
pub const OP_PONG: u32 = 4;

pub const TIMEOUT: Duration = Duration::from_secs(5);
const MAX_REPLY: usize = 1 << 20;

pub trait Pipe: Read + Write + Send {}
impl<T: Read + Write + Send> Pipe for T {}

/// One open connection to Discord, or to whatever answered in its place.
pub struct Conn {
    pipe: Box<dyn Pipe>,
    /// Interrupts a read or write that is still waiting: on Windows a pipe has no timeouts of its own.
    cancel: Option<Box<dyn Fn() + Send + Sync>>,
}

/// Where Discord's IPC endpoint may be, most likely first. A pure function of the system and the environment,
/// so every system's rules can be tested anywhere. The same list as the bridge's.
pub fn candidates(os: &str, env: &dyn Fn(&str) -> Option<String>) -> Vec<PathBuf> {
    if os == "windows" {
        return (0..10)
            .map(|n| PathBuf::from(format!(r"\\.\pipe\discord-ipc-{n}")))
            .collect();
    }
    let base = ["XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"]
        .iter()
        .find_map(|name| env(name).filter(|v| !v.is_empty()))
        .unwrap_or_else(|| "/tmp".into());
    let mut out = Vec::new();
    // Flatpak and Snap builds of Discord keep the socket in a subdirectory.
    for sub in [
        "",
        "app/com.discordapp.Discord",
        "snap.discord",
        "app/com.discordapp.DiscordCanary",
    ] {
        for n in 0..10 {
            out.push(Path::new(&base).join(sub).join(format!("discord-ipc-{n}")));
        }
    }
    out
}

/// Opens the first endpoint that answers.
pub fn dial() -> io::Result<Conn> {
    let os = if cfg!(windows) { "windows" } else { "unix" };
    for path in candidates(os, &|name| std::env::var(name).ok()) {
        if let Ok(conn) = dial_one(&path) {
            return Ok(conn);
        }
    }
    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "Discord is not running, or its IPC endpoint was not found",
    ))
}

/// Connects to a socket only if it belongs to this user: where no per-user directory is known the search
/// reaches the shared /tmp, where another user could have put one.
#[cfg(unix)]
pub fn dial_one(path: &Path) -> io::Result<Conn> {
    use std::os::unix::fs::{FileTypeExt, MetadataExt};
    let meta = std::fs::symlink_metadata(path)?;
    // SAFETY: getuid has no preconditions and cannot fail.
    let me = unsafe { libc::getuid() };
    if !meta.file_type().is_socket() || meta.uid() != me {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "not a socket of this user's",
        ));
    }
    let stream = std::os::unix::net::UnixStream::connect(path)?;
    stream.set_read_timeout(Some(TIMEOUT))?;
    stream.set_write_timeout(Some(TIMEOUT))?;
    Ok(Conn {
        pipe: Box::new(stream),
        cancel: None,
    })
}

/// Pipe names are shared by everyone on a Windows machine, and by default whoever serves one may act as the
/// client that opened it. SecurityIdentification limits that to learning who connected, which is all Discord
/// needs; std sets SECURITY_SQOS_PRESENT along with it.
#[cfg(windows)]
pub const SECURITY_IDENTIFICATION: u32 = 1 << 16;

#[cfg(windows)]
pub fn dial_one(path: &Path) -> io::Result<Conn> {
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::AsRawHandle;
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .security_qos_flags(SECURITY_IDENTIFICATION)
        .open(path)?;
    let handle = file.as_raw_handle() as usize;
    let cancel = move || {
        // SAFETY: only called while the call that owns the handle is still running (see Conn::guarded),
        // so the handle is open; CancelIoEx with no OVERLAPPED cancels every pending I/O on it.
        unsafe {
            windows_sys::Win32::System::IO::CancelIoEx(handle as _, std::ptr::null());
        }
    };
    Ok(Conn {
        pipe: Box::new(file),
        cancel: Some(Box::new(cancel)),
    })
}

/// The start of what came back, quoted, for the log: its control characters escaped and its length capped.
pub fn brief(reply: &[u8]) -> String {
    let text = String::from_utf8_lossy(&reply[..reply.len().min(200)]).into_owned();
    let more = if reply.len() > 200 { "..." } else { "" };
    format!("{text:?}{more}")
}

impl Conn {
    #[cfg(all(test, unix))]
    pub fn from_pipe(pipe: Box<dyn Pipe>) -> Conn {
        Conn { pipe, cancel: None }
    }

    /// Runs one exchange; where the pipe has no timeouts of its own, a watchdog cancels it if it takes too long.
    fn guarded<T>(&mut self, f: impl FnOnce(&mut dyn Pipe) -> io::Result<T>) -> io::Result<T> {
        let Some(cancel) = self.cancel.as_deref() else {
            return f(self.pipe.as_mut());
        };
        let pipe = self.pipe.as_mut();
        std::thread::scope(|s| {
            let (done, wait) = std::sync::mpsc::channel::<()>();
            s.spawn(move || {
                if wait.recv_timeout(TIMEOUT).is_err() {
                    cancel();
                }
            });
            let out = f(pipe);
            let _ = done.send(());
            out
        })
    }

    /// Sends one frame and reads the reply. Discord answers every frame, so the exchange is strictly one at a time.
    pub fn call(&mut self, op: u32, payload: &[u8]) -> io::Result<(u32, Vec<u8>)> {
        let mut frame = Vec::with_capacity(8 + payload.len());
        frame.extend_from_slice(&op.to_le_bytes());
        frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        frame.extend_from_slice(payload);
        self.guarded(|p| {
            p.write_all(&frame)?;
            p.flush()?;
            let mut head = [0u8; 8];
            p.read_exact(&mut head)?;
            let n = u32::from_le_bytes(head[4..8].try_into().unwrap()) as usize;
            if n > MAX_REPLY {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "oversized reply",
                ));
            }
            let mut body = vec![0u8; n];
            p.read_exact(&mut body)?;
            Ok((u32::from_le_bytes(head[0..4].try_into().unwrap()), body))
        })
    }

    pub fn handshake(&mut self, app_id: &str) -> io::Result<()> {
        let body = json!({ "v": 1, "client_id": app_id }).to_string();
        let (op, reply) = self.call(OP_HANDSHAKE, body.as_bytes())?;
        if op != OP_FRAME {
            return Err(io::Error::other(format!(
                "Discord refused the application id: {}",
                brief(&reply)
            )));
        }
        Ok(())
    }

    /// Shows an activity, or clears it when `a` is None.
    pub fn set_activity(&mut self, a: Option<&Activity>, start: i64, nonce: u64) -> io::Result<()> {
        let activity = a.map(|a| {
            let mut assets = json!({ "large_image": a.large_image, "large_text": a.large_text });
            if !a.small_image.is_empty() {
                assets["small_image"] = json!(a.small_image);
                assets["small_text"] = json!(a.small_text);
            }
            json!({
                "details": a.details,
                "state": a.state,
                "assets": assets,
                "timestamps": { "start": start },
            })
        });
        let body = json!({
            "cmd": "SET_ACTIVITY",
            "nonce": nonce.to_string(),
            "args": { "pid": std::process::id(), "activity": activity },
        })
        .to_string();
        let (op, reply) = self.call(OP_FRAME, body.as_bytes())?;
        let evt = serde_json::from_slice::<serde_json::Value>(&reply)
            .ok()
            .and_then(|v| v.get("evt").cloned());
        if op != OP_FRAME || evt.is_none() || evt == Some(json!("ERROR")) {
            return Err(io::Error::other(format!(
                "Discord rejected the activity: {}",
                brief(&reply)
            )));
        }
        Ok(())
    }

    pub fn ping(&mut self) -> io::Result<()> {
        let (op, _) = self.call(OP_PING, b"{}")?;
        if op != OP_PONG {
            return Err(io::Error::other("unexpected reply to ping"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_for_each_system() {
        let none = |_: &str| None;
        let win = candidates("windows", &none);
        assert_eq!(win.len(), 10);
        assert_eq!(win[0], PathBuf::from(r"\\.\pipe\discord-ipc-0"));
        let linux = candidates("unix", &|n| {
            (n == "XDG_RUNTIME_DIR").then(|| "/run/user/1000".to_string())
        });
        assert_eq!(linux[0], PathBuf::from("/run/user/1000/discord-ipc-0"));
        assert!(linux.contains(&PathBuf::from(
            "/run/user/1000/app/com.discordapp.Discord/discord-ipc-0"
        )));
        assert_eq!(
            candidates("unix", &none)[0],
            PathBuf::from("/tmp/discord-ipc-0")
        );
    }

    #[test]
    fn what_a_fake_discord_says_is_kept_short_and_escaped() {
        let reply = [
            b"\x1b]0;pwned\x07\nsession started\n".as_slice(),
            &[b'A'; 5000],
        ]
        .concat();
        let b = brief(&reply);
        assert!(b.len() < 260, "{} bytes", b.len());
        assert!(
            !b.contains('\x1b') && !b.contains('\x07') && !b.contains('\n'),
            "{b}"
        );
    }

    #[cfg(unix)]
    #[test]
    fn only_the_users_own_socket_and_never_a_link() {
        use std::os::unix::net::UnixListener;
        let dir = std::env::temp_dir().join(format!("sb64-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let real = dir.join("real");
        let _ = std::fs::remove_file(&real);
        let _listener = UnixListener::bind(&real).unwrap();
        assert!(dial_one(&real).is_ok(), "the user's own socket");
        let file = dir.join("discord-ipc-0");
        std::fs::write(&file, b"").unwrap();
        assert!(dial_one(&file).is_err(), "a plain file");
        let link = dir.join("discord-ipc-1");
        let _ = std::fs::remove_file(&link);
        std::os::unix::fs::symlink(&real, &link).unwrap();
        assert!(dial_one(&link).is_err(), "a link to a socket");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Security::{
        GetTokenInformation, RevertToSelf, SecurityIdentification, TokenImpersonationLevel,
        TOKEN_QUERY,
    };
    use windows_sys::Win32::Storage::FileSystem::{ReadFile, PIPE_ACCESS_DUPLEX};
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, ImpersonateNamedPipeClient,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentThread, OpenThreadToken};

    /// A pipe served by the test, as anyone on the machine could serve one called discord-ipc-0.
    fn serve(name: &str) -> usize {
        let wide: Vec<u16> = std::ffi::OsStr::new(name)
            .encode_wide()
            .chain(Some(0))
            .collect();
        // SAFETY: a valid, NUL-terminated name and no security attributes.
        let h = unsafe {
            CreateNamedPipeW(
                wide.as_ptr(),
                PIPE_ACCESS_DUPLEX,
                0,
                1,
                4096,
                4096,
                0,
                std::ptr::null(),
            )
        };
        assert!(h != INVALID_HANDLE_VALUE, "CreateNamedPipeW failed");
        h as usize
    }

    /// Whoever serves the pipe may learn who connected (identification), but must not be able to act as them.
    #[test]
    fn the_pipes_server_cannot_act_as_the_apps_user() {
        let name = format!(r"\\.\pipe\sleazeburg-desktop-sqos-{}", std::process::id());
        let server = serve(&name);
        let level = std::thread::spawn(move || unsafe {
            let h = server as HANDLE;
            ConnectNamedPipe(h, std::ptr::null_mut());
            let (mut buf, mut n) = ([0u8; 1], 0u32);
            // A server can only impersonate a client it has read from.
            if ReadFile(h, buf.as_mut_ptr(), 1, &mut n, std::ptr::null_mut()) == 0 {
                return Err("read");
            }
            if ImpersonateNamedPipeClient(h) == 0 {
                return Err("ImpersonateNamedPipeClient");
            }
            let mut token: HANDLE = std::ptr::null_mut();
            let opened = OpenThreadToken(GetCurrentThread(), TOKEN_QUERY, 1, &mut token) != 0;
            let (mut level, mut size) = (-1i32, 0u32);
            let got = opened
                && GetTokenInformation(
                    token,
                    TokenImpersonationLevel,
                    &mut level as *mut i32 as *mut _,
                    4,
                    &mut size,
                ) != 0;
            RevertToSelf();
            if opened {
                CloseHandle(token);
            }
            if got {
                Ok(level)
            } else {
                Err("token")
            }
        });
        let mut conn = dial_one(Path::new(&name)).expect("opening the pipe");
        conn.pipe.write_all(&[0]).unwrap();
        let level = level.join().unwrap().expect("the server's side");
        // SAFETY: the handle came from CreateNamedPipeW and is closed once.
        unsafe { CloseHandle(server as HANDLE) };
        assert_eq!(
            level, SecurityIdentification,
            "the pipe's server may only identify the app's user"
        );
    }

    /// A server that takes the request and never answers is cut off after the timeout, not waited on for ever.
    #[test]
    fn a_pipe_that_never_answers_times_out() {
        let name = format!(r"\\.\pipe\sleazeburg-desktop-mute-{}", std::process::id());
        let server = serve(&name);
        std::thread::spawn(move || unsafe {
            ConnectNamedPipe(server as HANDLE, std::ptr::null_mut());
        });
        let mut conn = dial_one(Path::new(&name)).expect("opening the pipe");
        let started = std::time::Instant::now();
        assert!(conn.ping().is_err(), "a mute pipe answered");
        let took = started.elapsed();
        assert!(
            took >= TIMEOUT - Duration::from_millis(200) && took < TIMEOUT * 2,
            "took {took:?}"
        );
        // SAFETY: as above.
        unsafe { CloseHandle(server as HANDLE) };
    }
}
