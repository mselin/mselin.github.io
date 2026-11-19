# Sleazeburg 64 radio

The in-game radio reads `stations.json` in this folder. Each station is a list
of SID tunes. Tunes are streamed on demand from the
[High Voltage SID Collection](https://www.hvsc.c64.org/) (HVSC), so no music
files are stored in this repository.

```json
{
  "hvscBase": "https://www.hvsc.c64.org/download/C64Music",
  "stations": [
    {
      "name": "HUBBARD FM",
      "tagline": "ROB HUBBARD AROUND THE CLOCK",
      "tracks": [
        { "hvsc": "/MUSICIANS/H/Hubbard_Rob/Sanxion.sid", "id": 104543,
          "title": "Sanxion", "author": "Rob Hubbard", "released": "1986 Thalamus",
          "subtune": 1, "seconds": 334 }
      ]
    }
  ]
}
```

## Adding a tune

1. Find it on https://www.hvsc.c64.org/ . The number in the address
   (`search?sid=104543`) is the `id`.
2. Open `https://www.hvsc.c64.org/api/v1/sids/<id>`. It returns `filePath`,
   `filename`, `title`, `author`, `released` and `startSong`.
3. Add a track: `hvsc` is `filePath` + `filename`, `subtune` is `startSong`.

## Fields

- `name`: station name, up to 20 characters. The game font has capitals,
  digits and basic punctuation; accents are dropped in the game but kept on
  the information page.
- `tagline`: shown when the station is selected.
- `hvsc`: path inside HVSC, starting with `/`.
- `file`: use instead of `hvsc` for a `.sid` stored in this folder.
- `id`: HVSC id. Used for the "view on HVSC" links on the information page.
- `title`, `author`, `released`: the credits shown in the game. If left out,
  the game reads them from the SID file itself.
- `subtune`: which tune in the file to play, counting from 1. Defaults to the
  file's own start tune.
- `seconds`: play time before the next track. SID files do not store their
  length; HVSC lists them in `DOCUMENTS/Songlengths.md5`. Default 180.

Stations with no tracks are hidden. Each station is shuffled when the game
loads and reshuffled every time it has played through.

`hvscBase` can point at a folder in this site instead (for example
`radio/hvsc`) if you would rather serve your own copies of the files.

## In the game

Music starts off. M turns it on, R changes station, N skips to the next tune,
I opens the information page with the credits and playlist. The radio plays on
the title screen and while driving.
