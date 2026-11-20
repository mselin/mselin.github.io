// SPDX-License-Identifier: GPL-2.0-or-later
//! What the game may report, and the words shown for it. The same table the presence bridge uses: both read
//! tools/presence-bridge/schema.json, so the profile looks the same from the browser and from the app.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SCHEMA_JSON: &str = include_str!("../../../../tools/presence-bridge/schema.json");

#[derive(Deserialize)]
pub struct Schema {
    pub v: u32,
    pub modes: Vec<String>,
    pub districts: HashMap<String, String>,
    pub transports: Vec<String>,
    pub heat: Range,
    pub details: HashMap<String, HashMap<String, Vec<String>>>,
    pub state: StateText,
    pub assets: Assets,
}

#[derive(Deserialize)]
pub struct Range {
    pub min: i64,
    pub max: i64,
}

#[derive(Deserialize)]
pub struct StateText {
    pub heat: Vec<String>,
    pub fixed: HashMap<String, String>,
}

#[derive(Deserialize)]
pub struct Assets {
    pub large_image: String,
    pub large_text: String,
    pub small_image: Vec<String>,
}

/// What the game says about itself: a handful of enumerated values, never text.
#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct GameState {
    pub v: u32,
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub district: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transport: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub heat: Option<i64>,
}

/// What Discord is asked to show.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct Activity {
    pub details: String,
    pub state: String,
    pub large_image: String,
    pub large_text: String,
    pub small_image: String,
    pub small_text: String,
}

impl Schema {
    pub fn load() -> Schema {
        serde_json::from_str(SCHEMA_JSON)
            .expect("schema.json is part of the program and must parse")
    }

    /// Checks a state against the table. Anything it does not list is refused.
    pub fn check(&self, st: &GameState) -> Result<(), String> {
        if st.v != self.v {
            return Err(format!(
                "schema version {}, this app speaks {}",
                st.v, self.v
            ));
        }
        if !self.modes.contains(&st.mode) {
            return Err("unknown mode".into());
        }
        if let Some(t) = &st.transport {
            if !self.transports.contains(t) {
                return Err("unknown transport".into());
            }
        }
        if let Some(h) = st.heat {
            if h < self.heat.min || h > self.heat.max {
                return Err("heat out of range".into());
            }
        }
        if let Some(d) = &st.district {
            if !self.districts.contains_key(d) {
                return Err("unknown district".into());
            }
        }
        Ok(())
    }

    fn variants(&self, st: &GameState) -> Vec<&str> {
        // A line that names the district is only usable when the game said which district.
        fn usable(list: Option<&Vec<String>>, district: bool) -> Vec<&str> {
            list.map(|l| {
                l.iter()
                    .filter(|line| district || !line.contains("{district}"))
                    .map(String::as_str)
                    .collect()
            })
            .unwrap_or_default()
        }
        let Some(by_transport) = self.details.get(&st.mode) else {
            return Vec::new();
        };
        let district = st.district.is_some();
        let list = usable(
            st.transport.as_ref().and_then(|t| by_transport.get(t)),
            district,
        );
        if !list.is_empty() {
            return list;
        }
        usable(by_transport.get("*"), district)
    }

    /// The text for a state. `pick` chooses among the variant lines, so the line stays put while the mode does.
    pub fn render(&self, st: &GameState, pick: usize) -> Activity {
        let mut a = Activity {
            large_image: self.assets.large_image.clone(),
            large_text: self.assets.large_text.clone(),
            ..Default::default()
        };
        let list = self.variants(st);
        if !list.is_empty() {
            let district = st
                .district
                .as_ref()
                .and_then(|d| self.districts.get(d))
                .map(String::as_str)
                .unwrap_or("");
            a.details = list[pick % list.len()].replace("{district}", district);
        }
        if let Some(fixed) = self.state.fixed.get(&st.mode) {
            a.state = fixed.clone();
            return a;
        }
        let heat = st.heat.unwrap_or(0).clamp(self.heat.min, self.heat.max) as usize;
        a.state = self.state.heat[heat].clone();
        let img = &self.assets.small_image[heat];
        if !img.is_empty() {
            a.small_image = img.clone();
            a.small_text = a.state.clone();
        }
        a
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(
        mode: &str,
        district: Option<&str>,
        transport: Option<&str>,
        heat: Option<i64>,
    ) -> GameState {
        GameState {
            v: 1,
            mode: mode.into(),
            district: district.map(Into::into),
            transport: transport.map(Into::into),
            heat,
        }
    }

    #[test]
    fn renders_the_same_lines_as_the_bridge() {
        let s = Schema::load();
        // The bridge's own test expects this line for this state and the first variant.
        let a = s.render(
            &state("chase", Some("hoa_heights"), Some("on_foot"), Some(2)),
            0,
        );
        assert_eq!(a.details, "Running from the law in HOA Heights");
        assert_eq!(a.state, "Heat level 2");
        assert_eq!(a.large_image, "logo");
        assert_eq!(a.small_image, "heat-2");
        let menu = s.render(&state("menu", None, None, None), 0);
        assert_eq!(menu.state, "On the title screen");
        assert_eq!(menu.small_image, "");
    }

    #[test]
    fn every_state_renders_to_lines_discord_accepts() {
        let s = Schema::load();
        for mode in &s.modes {
            for district in [None]
                .into_iter()
                .chain(s.districts.keys().map(|d| Some(d.as_str())))
            {
                for transport in [None]
                    .into_iter()
                    .chain(s.transports.iter().map(|t| Some(t.as_str())))
                {
                    for pick in 0..4 {
                        let a = s.render(&state(mode, district, transport, Some(5)), pick);
                        // Discord wants 2 to 128 characters in each line.
                        for line in [&a.details, &a.state] {
                            let n = line.chars().count();
                            assert!((2..=128).contains(&n), "{mode}: {line:?}");
                            assert!(!line.contains('{'), "{mode}: unfilled {line:?}");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn refuses_what_it_does_not_know() {
        let s = Schema::load();
        assert!(s.check(&state("menu", None, None, None)).is_ok());
        assert!(s.check(&state("hacking", None, None, None)).is_err());
        assert!(s
            .check(&state("roaming", Some("atlantis"), None, None))
            .is_err());
        assert!(s
            .check(&state("roaming", None, Some("jetpack"), None))
            .is_err());
        assert!(s.check(&state("roaming", None, None, Some(6))).is_err());
        assert!(s
            .check(&GameState {
                v: 2,
                ..state("menu", None, None, None)
            })
            .is_err());
        // Unknown fields are refused while parsing, before any check.
        let extra: Result<GameState, _> =
            serde_json::from_str(r#"{"v":1,"mode":"menu","details":"my own text"}"#);
        assert!(extra.is_err());
    }
}
