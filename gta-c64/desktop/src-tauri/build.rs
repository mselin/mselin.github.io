// SPDX-License-Identifier: GPL-2.0-or-later
fn main() {
    // The page may call one command of the app's own, and only because the capability file allows it.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["presence"])),
    )
    .expect("tauri build step failed");
}
