// SPDX-License-Identifier: GPL-2.0-or-later
//! Sleazeburg 64 as a desktop app: the browser game in the system's own web view, with Discord Rich Presence
//! built in, so there is no helper program to install and nothing listens on the network.

mod presence;

use tauri::webview::PageLoadEvent;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// The game reports what is happening in it: a few enumerated values, or nothing when it stops.
/// Runs off the main thread, so the window never waits on Discord.
#[tauri::command(async)]
fn presence(
    service: tauri::State<'_, presence::Service>,
    update: Option<serde_json::Value>,
) -> Result<presence::session::Status, String> {
    service.handle(update)
}

/// Whether a URL is the app's own page. Everything else opens in the user's browser, never in the app.
fn is_app_page(url: &tauri::Url) -> bool {
    matches!(
        (url.scheme(), url.host_str()),
        ("tauri", Some("localhost")) | ("http" | "https", Some("tauri.localhost"))
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Only its Rust side is used, to open web links in the browser; the page is given no permission for it.
        .plugin(tauri_plugin_opener::init())
        .manage(presence::Service::start())
        .invoke_handler(tauri::generate_handler![presence])
        .setup(|app| {
            let opener = app.handle().clone();
            let new_window_opener = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Sleazeburg 64")
                .inner_size(960.0, 680.0)
                .min_inner_size(480.0, 340.0)
                .on_navigation(move |url| {
                    if is_app_page(url) {
                        return true;
                    }
                    if url.scheme() == "https" {
                        let _ = opener.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                // Links that would open a window of their own (target="_blank") go to the browser too.
                .on_new_window(move |url, _features| {
                    if url.scheme() == "https" {
                        let _ = new_window_opener
                            .opener()
                            .open_url(url.as_str(), None::<&str>);
                    }
                    tauri::webview::NewWindowResponse::Deny
                })
                .on_page_load(move |window, payload| {
                    // For the automatic tests only, and only in debug builds: switch the presence setting on,
                    // as a player would by clicking it, so the whole path to Discord can be checked.
                    if cfg!(debug_assertions)
                        && payload.event() == PageLoadEvent::Finished
                        && std::env::var_os("SLEAZEBURG_SELFTEST").is_some()
                    {
                        let _ = window.eval(
                            "setTimeout(() => document.getElementById('bdrp').click(), 1500)",
                        );
                    }
                })
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Sleazeburg 64");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<presence::Service>().close();
        }
    });
}
