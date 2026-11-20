// SPDX-License-Identifier: GPL-2.0-or-later
// No console window behind the game on Windows, in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sleazeburg_64_lib::run()
}
