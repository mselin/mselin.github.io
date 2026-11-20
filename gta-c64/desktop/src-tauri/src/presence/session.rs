// SPDX-License-Identifier: GPL-2.0-or-later
//! One play session, kept in step with Discord. The same rules as the presence bridge (bridge.go): changes of
//! text wait their turn, every send counts against one limit, and a game that goes quiet is cleared.

use super::discord::Conn;
use super::schema::{Activity, GameState, Schema};
use serde::Serialize;
use std::io;

pub const MIN_UPDATE_GAP: u64 = 15_000; // ms: Discord's own limit on changes of text
pub const HEARTBEAT_TIMEOUT: u64 = 30_000; // no word from the game for this long: it has gone
pub const PAUSED_TIMEOUT: u64 = 300_000; // paused for this long: stop showing
pub const PING_EVERY: u64 = 10_000; // how often to check Discord is still there
pub const REDIAL_EVERY: u64 = 5_000; // while Discord cannot be reached
pub const SEND_BURST: usize = 5; // every send, clears included: at most this many...
pub const SEND_WINDOW: u64 = 20_000; // ...in this long
pub const LOG_BURST: usize = 6; // session starts and ends logged, at most this many...
pub const LOG_WINDOW: u64 = 30_000; // ...in this long; past that only counted

pub type Dial = Box<dyn FnMut() -> io::Result<Conn> + Send>;

#[derive(Serialize, Debug)]
pub struct Status {
    pub ok: bool,
    pub name: &'static str,
    pub version: &'static str,
    pub schema: u32,
    pub app_id_configured: bool,
    pub discord_connected: bool,
    pub showing: bool,
}

pub struct Session {
    pub schema: Schema,
    app_id: String,
    clock: Box<dyn Fn() -> u64 + Send>, // milliseconds, for the timers
    wall: Box<dyn Fn() -> i64 + Send>,  // seconds since 1970, for the elapsed time Discord shows
    random: Box<dyn FnMut() -> usize + Send>,
    dial: Dial,
    log: Box<dyn FnMut(String) + Send>,

    active: bool,
    hidden: bool, // paused for too long; shows again when play resumes
    start: i64,
    last_beat: u64,
    state: Option<GameState>,
    pick: usize, // which variant line, chosen when the mode is entered
    paused_since: Option<u64>,

    conn: Option<Conn>,
    sent: Option<Activity>, // what Discord is showing
    last_send: Option<u64>,
    last_ping: u64,
    down_logged: bool,
    last_dial: Option<u64>,
    nonce: u64,
    sends: Vec<u64>,
    logged: Vec<u64>,
    unlogged: u32,
}

impl Session {
    pub fn new(
        schema: Schema,
        app_id: String,
        clock: Box<dyn Fn() -> u64 + Send>,
        wall: Box<dyn Fn() -> i64 + Send>,
        random: Box<dyn FnMut() -> usize + Send>,
        dial: Dial,
        log: Box<dyn FnMut(String) + Send>,
    ) -> Session {
        Session {
            schema,
            app_id,
            clock,
            wall,
            random,
            dial,
            log,
            active: false,
            hidden: false,
            start: 0,
            last_beat: 0,
            state: None,
            pick: 0,
            paused_since: None,
            conn: None,
            sent: None,
            last_send: None,
            last_ping: 0,
            down_logged: false,
            last_dial: None,
            nonce: 0,
            sends: Vec::new(),
            logged: Vec::new(),
            unlogged: 0,
        }
    }

    /// A state from the game, already checked against the schema. It also counts as a heartbeat. What Discord
    /// is told follows at the next tick.
    pub fn update(&mut self, st: GameState) {
        let now = (self.clock)();
        let resumed = self.hidden && st.mode != "paused";
        if !self.active || resumed {
            self.active = true;
            self.hidden = false;
            self.start = (self.wall)();
            self.pick = (self.random)();
            self.paused_since = None;
            self.session_log("session started".into());
        }
        if self.state.as_ref().map(|s| s.mode.as_str()) != Some(st.mode.as_str()) {
            self.pick = (self.random)();
            self.paused_since = (st.mode == "paused").then_some(now);
        }
        self.state = Some(st);
        self.last_beat = now;
    }

    /// The game switched the setting off, or is closing.
    pub fn stop(&mut self) {
        self.end("stopped by the game");
    }

    /// Runs about once a second, and at once after each update.
    pub fn tick(&mut self) {
        let now = (self.clock)();
        if self.active && now.saturating_sub(self.last_beat) > HEARTBEAT_TIMEOUT {
            self.end("no heartbeat from the game");
        }
        if self.active && !self.hidden {
            if let Some(since) = self.paused_since {
                if now.saturating_sub(since) > PAUSED_TIMEOUT {
                    self.hidden = true;
                    (self.log)("paused for a long time: hiding".into());
                }
            }
        }
        if self.conn.is_some() && now.saturating_sub(self.last_ping) >= PING_EVERY {
            self.last_ping = now;
            if let Err(e) = self.conn.as_mut().unwrap().ping() {
                self.lost(e);
            }
        }
        self.flush();
    }

    /// The app is closing: clear, and let go of Discord, which also clears anything still shown.
    pub fn close(&mut self) {
        self.end("app closing");
        self.conn = None;
    }

    pub fn status(&self) -> Status {
        Status {
            ok: true,
            name: "sleazeburg-64-desktop",
            version: env!("CARGO_PKG_VERSION"),
            schema: self.schema.v,
            app_id_configured: !self.app_id.is_empty(),
            discord_connected: self.conn.is_some(),
            showing: self.sent.is_some(),
        }
    }

    fn end(&mut self, why: &str) {
        if !self.active {
            return;
        }
        self.active = false;
        self.hidden = false;
        self.state = None;
        self.session_log(format!("session ended: {why}"));
        self.flush();
    }

    fn lost(&mut self, err: io::Error) {
        self.conn = None;
        self.sent = None; // whatever Discord was showing went with the connection
        self.last_send = None;
        if !self.down_logged {
            self.down_logged = true;
            (self.log)(format!("lost Discord ({err}); will keep trying"));
        }
    }

    fn session_log(&mut self, line: String) {
        let now = (self.clock)();
        self.logged.retain(|&t| now.saturating_sub(t) < LOG_WINDOW);
        if self.logged.len() >= LOG_BURST {
            self.unlogged += 1;
            return;
        }
        let line = if self.unlogged > 0 {
            format!(
                "{line} (and {} more starts and ends not logged)",
                self.unlogged
            )
        } else {
            line
        };
        self.logged.push(now);
        self.unlogged = 0;
        (self.log)(line);
    }

    /// Brings Discord into line with the session, within the limits.
    fn flush(&mut self) {
        let want = if self.active && !self.hidden && !self.app_id.is_empty() {
            self.state
                .as_ref()
                .map(|s| self.schema.render(s, self.pick))
        } else {
            None
        };
        if want == self.sent {
            return;
        }
        let now = (self.clock)();
        // Changes of text wait their turn, and the latest one wins.
        if want.is_some()
            && self.sent.is_some()
            && self
                .last_send
                .is_some_and(|t| now.saturating_sub(t) < MIN_UPDATE_GAP)
        {
            return;
        }
        if self.conn.is_none() {
            if want.is_none() {
                self.sent = None;
                return;
            }
            if self
                .last_dial
                .is_some_and(|t| now.saturating_sub(t) < REDIAL_EVERY)
            {
                return;
            }
            self.last_dial = Some(now);
            let app_id = self.app_id.clone();
            match (self.dial)().and_then(|mut c| c.handshake(&app_id).map(|_| c)) {
                Ok(c) => {
                    self.conn = Some(c);
                    self.last_ping = now;
                    if self.down_logged {
                        (self.log)("Discord is back".into());
                    }
                    self.down_logged = false;
                }
                Err(e) => {
                    if !self.down_logged {
                        self.down_logged = true;
                        (self.log)(format!("cannot reach Discord ({e}); will keep trying"));
                    }
                    return;
                }
            }
        }
        self.sends.retain(|&t| now.saturating_sub(t) < SEND_WINDOW);
        if self.sends.len() >= SEND_BURST {
            return; // held back: a later tick sends whatever is wanted by then
        }
        self.sends.push(now);
        self.nonce += 1;
        let result =
            self.conn
                .as_mut()
                .unwrap()
                .set_activity(want.as_ref(), self.start, self.nonce);
        if let Err(e) = result {
            self.lost(e);
            return;
        }
        match &want {
            None => (self.log)("cleared".into()),
            Some(a) => (self.log)(format!("showing: {} | {}", a.details, a.state)),
        }
        self.sent = want;
        self.last_send = Some(now);
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::super::discord::{Conn, OP_CLOSE, OP_FRAME, OP_HANDSHAKE, OP_PING, OP_PONG};
    use super::*;
    use std::io::{Read, Write};
    use std::os::unix::net::UnixStream;
    use std::sync::{Arc, Mutex};

    /// A stand-in for the Discord client on the other end of a socket pair. It records each activity it is
    /// asked to show ("null" for a clear), or refuses the handshake with `refusal`.
    #[derive(Default, Clone)]
    struct Fake {
        seen: Arc<Mutex<Vec<String>>>,
        refusal: Option<Vec<u8>>,
        down: Arc<Mutex<bool>>,
    }

    impl Fake {
        fn serve(&self, mut s: UnixStream) {
            let seen = self.seen.clone();
            let refusal = self.refusal.clone();
            std::thread::spawn(move || loop {
                let mut head = [0u8; 8];
                if s.read_exact(&mut head).is_err() {
                    return;
                }
                let n = u32::from_le_bytes(head[4..8].try_into().unwrap()) as usize;
                let mut body = vec![0u8; n];
                if s.read_exact(&mut body).is_err() {
                    return;
                }
                let send = |s: &mut UnixStream, op: u32, b: &[u8]| {
                    let mut f = op.to_le_bytes().to_vec();
                    f.extend_from_slice(&(b.len() as u32).to_le_bytes());
                    f.extend_from_slice(b);
                    s.write_all(&f)
                };
                let op = u32::from_le_bytes(head[0..4].try_into().unwrap());
                let r = match op {
                    OP_HANDSHAKE => match &refusal {
                        Some(r) => {
                            let _ = send(&mut s, OP_CLOSE, r);
                            return;
                        }
                        None => send(&mut s, OP_FRAME, br#"{"cmd":"DISPATCH","evt":"READY"}"#),
                    },
                    OP_PING => send(&mut s, OP_PONG, &body),
                    _ => {
                        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
                        seen.lock().unwrap().push(v["args"]["activity"].to_string());
                        send(&mut s, OP_FRAME, br#"{"cmd":"SET_ACTIVITY","evt":null}"#)
                    }
                };
                if r.is_err() {
                    return;
                }
            });
        }
        fn seen(&self) -> Vec<String> {
            self.seen.lock().unwrap().clone()
        }
    }

    struct Rig {
        s: Session,
        fake: Fake,
        clock: Arc<Mutex<u64>>,
        logs: Arc<Mutex<Vec<String>>>,
    }

    fn rig(fake: Fake) -> Rig {
        let clock = Arc::new(Mutex::new(1_000_000u64));
        let logs = Arc::new(Mutex::new(Vec::new()));
        let (c, l, f) = (clock.clone(), logs.clone(), fake.clone());
        let s = Session::new(
            Schema::load(),
            "123456789012345678".into(),
            Box::new(move || *c.lock().unwrap()),
            Box::new(|| 1_800_000_000),
            Box::new(|| 0),
            Box::new(move || {
                if *f.down.lock().unwrap() {
                    return Err(io::Error::new(
                        io::ErrorKind::NotFound,
                        "fake Discord is not running",
                    ));
                }
                let (mine, theirs) = UnixStream::pair()?;
                mine.set_read_timeout(Some(std::time::Duration::from_secs(5)))?;
                f.serve(theirs);
                Ok(Conn::from_pipe(Box::new(mine)))
            }),
            Box::new(move |line| l.lock().unwrap().push(line)),
        );
        Rig {
            s,
            fake,
            clock,
            logs,
        }
    }

    impl Rig {
        fn pass(&mut self, seconds: u64) {
            for _ in 0..seconds {
                *self.clock.lock().unwrap() += 1000;
                self.s.tick();
            }
        }
        fn send(&mut self, mode: &str) {
            self.s.update(GameState {
                v: 1,
                mode: mode.into(),
                district: None,
                transport: None,
                heat: None,
            });
            self.s.tick();
        }
        fn logs(&self) -> Vec<String> {
            self.logs.lock().unwrap().clone()
        }
    }

    #[test]
    fn a_state_reaches_discord_and_stopping_clears_it() {
        let mut r = rig(Fake::default());
        r.send("menu");
        let seen = r.fake.seen();
        assert_eq!(seen.len(), 1);
        assert!(seen[0].contains("On the title screen"), "{}", seen[0]);
        assert!(seen[0].contains(r#""start":1800000000"#));
        assert!(r.s.status().showing && r.s.status().discord_connected);
        r.s.stop();
        assert_eq!(r.fake.seen().last().unwrap(), "null");
        assert!(!r.s.status().showing);
    }

    #[test]
    fn changes_of_text_wait_their_turn_and_the_latest_wins() {
        let mut r = rig(Fake::default());
        r.send("menu");
        r.send("roaming");
        r.send("paused");
        assert_eq!(r.fake.seen().len(), 1, "held back");
        r.pass(16);
        let seen = r.fake.seen();
        assert_eq!(seen.len(), 2);
        assert!(seen[1].contains("Paused"), "{}", seen[1]);
    }

    #[test]
    fn showing_and_clearing_in_a_loop_is_held_to_one_limit() {
        let mut r = rig(Fake::default());
        for _ in 0..1000 {
            r.send("menu");
            r.s.stop();
        }
        assert!(
            r.fake.seen().len() <= SEND_BURST,
            "{} sends",
            r.fake.seen().len()
        );
        assert!(r.logs().len() <= LOG_BURST + SEND_BURST, "{:?}", r.logs());
        r.pass(35);
        assert_eq!(
            r.fake.seen().last().unwrap(),
            "null",
            "the last word was a stop"
        );
    }

    #[test]
    fn a_silent_game_and_a_long_pause_are_cleared() {
        let mut r = rig(Fake::default());
        r.send("menu");
        r.pass(31);
        assert_eq!(r.fake.seen().last().unwrap(), "null", "no heartbeat");
        r.send("paused");
        for _ in 0..31 {
            r.pass(10);
            r.send("paused");
        }
        assert_eq!(
            r.fake.seen().last().unwrap(),
            "null",
            "paused for over five minutes"
        );
        r.send("roaming");
        r.pass(1);
        assert!(
            r.fake.seen().last().unwrap().contains("No heat"),
            "shows again on resuming"
        );
    }

    #[test]
    fn a_fake_discord_cannot_flood_or_garble_the_log() {
        let refusal = [
            b"\x1b]0;pwned\x07\nsession started\n".as_slice(),
            &vec![b'A'; (1 << 20) - 40],
        ]
        .concat();
        let mut r = rig(Fake {
            refusal: Some(refusal),
            ..Default::default()
        });
        for _ in 0..60 {
            r.send("menu");
            r.pass(1);
        }
        let logs = r.logs();
        let total: usize = logs.iter().map(String::len).sum();
        assert!(total < 4000, "{total} bytes of log in a minute");
        assert!(
            logs.iter()
                .all(|l| !l.contains('\x1b') && !l.contains('\n')),
            "{logs:?}"
        );
        assert_eq!(
            logs.iter()
                .filter(|l| l.contains("cannot reach Discord"))
                .count(),
            1
        );
    }

    #[test]
    fn discord_coming_and_going_is_followed() {
        let fake = Fake::default();
        *fake.down.lock().unwrap() = true;
        let mut r = rig(fake);
        r.send("menu");
        assert!(r.fake.seen().is_empty());
        assert!(!r.s.status().discord_connected);
        *r.fake.down.lock().unwrap() = false;
        r.pass(6);
        assert_eq!(r.fake.seen().len(), 1, "redialled and shown");
        assert!(r.logs().iter().any(|l| l == "Discord is back"));
    }
}
