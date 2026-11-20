// SPDX-License-Identifier: GPL-2.0-or-later
//! Discord Rich Presence for the app: the game's page reports a few enumerated values through one command,
//! and a thread of its own keeps Discord in step, so the page never waits on Discord.

pub mod discord;
pub mod schema;
pub mod session;

use schema::{GameState, Schema};
use session::{Session, Status};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// The Discord application the presence appears under. It is public: every copy uses the same one, and the
/// presence bridge uses it too.
pub const APP_ID: &str = "1573107526919266335";

/// The most the page may send in one state, as JSON. A real state is well under a hundred bytes.
const MAX_STATE: usize = 1024;

pub struct Service {
    session: Arc<Mutex<Session>>,
    poke: Mutex<Sender<()>>,
}

impl Service {
    pub fn start() -> Service {
        let started = Instant::now();
        let mut seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(1) as usize;
        let session = Session::new(
            Schema::load(),
            APP_ID.into(),
            Box::new(move || started.elapsed().as_millis() as u64),
            Box::new(|| {
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0)
            }),
            Box::new(move || {
                // Which of a mode's lines to show: any will do, it need not be unpredictable.
                seed = seed
                    .wrapping_mul(6364136223846793005)
                    .wrapping_add(1442695040888963407);
                seed >> 33
            }),
            Box::new(discord::dial),
            Box::new(|line| eprintln!("presence: {line}")),
        );
        let session = Arc::new(Mutex::new(session));
        let (poke, wait) = channel::<()>();
        let worker = session.clone();
        std::thread::Builder::new()
            .name("presence".into())
            .spawn(move || loop {
                // A tick a second, and one at once whenever the game says something.
                let _ = wait.recv_timeout(Duration::from_secs(1));
                match worker.lock() {
                    Ok(mut s) => s.tick(),
                    Err(_) => return,
                }
            })
            .expect("cannot start the presence thread");
        Service {
            session,
            poke: Mutex::new(poke),
        }
    }

    /// A state from the page, or None when the game stops. Anything the schema does not list is refused.
    pub fn handle(&self, update: Option<serde_json::Value>) -> Result<Status, String> {
        let state = match update {
            None => None,
            Some(v) => {
                if v.to_string().len() > MAX_STATE {
                    return Err("state too large".into());
                }
                Some(
                    serde_json::from_value::<GameState>(v)
                        .map_err(|e| format!("not a valid state: {e}"))?,
                )
            }
        };
        let mut s = self
            .session
            .lock()
            .map_err(|_| "presence is unavailable".to_string())?;
        match state {
            None => s.stop(),
            Some(st) => {
                s.schema.check(&st)?;
                s.update(st);
            }
        }
        let status = s.status();
        drop(s);
        if let Ok(poke) = self.poke.lock() {
            let _ = poke.send(());
        }
        Ok(status)
    }

    pub fn close(&self) {
        if let Ok(mut s) = self.session.lock() {
            s.close();
        }
    }
}
