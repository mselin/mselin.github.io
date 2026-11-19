# Sleazeburg 64 radio

The in-game car radio reads `stations.json` in this folder. Put `.sid` files
here (subfolders are fine) and list them under a station.

```json
{
  "stations": [
    {
      "name": "HVSC FM",
      "tagline": "CLASSICS YOUR PARENTS CALLED NOISE",
      "tracks": [
        { "file": "some_tune.sid" },
        { "file": "composer/another_tune.sid", "subtune": 2, "seconds": 215 }
      ]
    }
  ]
}
```

- `name`: shown in the game, up to 20 characters. The game font has capitals,
  digits and basic punctuation only.
- `tagline`: shown when the station is selected.
- `file`: path relative to this folder. Letters, digits, spaces, `.`, `-`, `_`
  and `/` only.
- `subtune`: which tune inside the file to play, counting from 1. Default 1.
- `seconds`: how long to play before moving to the next track. Default 180.
  SID files do not store their own length.

Stations with no tracks are hidden. Add, rename or remove stations freely.
A station starts on a random track and then plays in order.

In the game: R changes station, N skips to the next track, L loads a single
`.sid` from disk into the "Tape Deck" station. The radio plays while driving.
