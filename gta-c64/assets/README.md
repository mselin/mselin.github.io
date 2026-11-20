# Picture assets

Bitmap pictures the game loads. Edit them in any paint program and save over the file.

| File | Shown | Size |
|---|---|---|
| `ending-jail.png` | Game over: arrested with no money | 320 × 150 |
| `ending-office.png` | Victory: the election is bought | 320 × 150 |
| `icon-16.png`, `icon-32.png` | The browser tab | 16 × 16, 32 × 32 |
| `icon-180.png` | A phone's home screen | 180 × 180 |

The icons are drawn by [`tools/make-icons.mjs`](../tools/make-icons.mjs) from the game's own letter shapes
and colours. Change the script and run `node tools/make-icons.mjs` rather than editing them; the tests check
the files match it. The rules below are for the end screens.

The end screens add their own title, captions and "New game?" line around the picture, and the victory screen
draws the cigar smoke over it, rising from about (252, 62).

## Rules for editing the end screens

`npm run test:unit` checks all of these, and says which pixels break them.

- **Keep the size.** The game draws the picture as it is, without scaling.
- **Only the sixteen C64 colours**, exactly: `#000000` `#ffffff` `#68372b` `#70a4b2` `#6f3d86` `#588d43`
  `#352879` `#b8c76f` `#6f4f25` `#433900` `#9a6759` `#444444` `#6c6c6c` `#9ad284` `#6c5eb5` `#959595`.
  Turn off anti-aliasing and smoothing in your tools, or they will introduce in-between colours.
- **Double-wide pixels.** Every pixel is two screen pixels wide, as in C64 multicolour mode: columns 0 and 1
  always match, as do 2 and 3, and so on. The easy way is to work at 160 × 150 and stretch to double width
  with nearest-neighbour scaling when saving.
- **No transparency.**
- Save as an ordinary 8-bit PNG (RGB, RGBA or indexed), not interlaced.

These rules are what makes the pictures look like C64 graphics, and they keep the files close to something the
Commodore 64 version of the game could convert and use.
