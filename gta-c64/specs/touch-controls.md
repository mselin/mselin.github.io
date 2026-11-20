# Feature spec: playing on a phone

| | |
|---|---|
| Status | Implemented in [pull request 17](https://github.com/mselin/mselin.github.io/pull/17) |
| Owner | [mselin](https://github.com/mselin) |
| Applies to | The browser game in `gta-c64/`, on touch screens |
| Written | 20 November 2026 |

## Why

On a phone the game was hard to play. It showed a four-way arrow pad with text buttons, the game itself was
drawn at its smallest size in the middle of the screen, and the browser's own bars took up a fifth of the height.
The aim is a game that can be played comfortably on a phone held sideways, with one thumb steering and the other
on the action buttons.

## Scope

In scope: steering on a touch screen, the touch buttons, full screen, how big the game is drawn on a touch screen,
and every text a touch-screen player sees about controls.

Out of scope: installing the game as an app (a web app manifest and icons), vibration, controllers, and anything
that changes how the game plays with a keyboard. Desktop play must not change at all.

**Touch screen** means a device whose main pointer is coarse (the CSS media query `pointer: coarse`): phones and
tablets. The tests use an emulated Pixel 8 Pro, the closest device on Playwright's list to the Pixel 10 Pro this
was asked for.

## User stories

### Story 1: steer by holding a finger on the screen (priority 1)

As a player on a phone, I hold a finger on the screen and my character heads for it, so I can play without a
joystick drawn on the glass.

1. **Given** I am on foot, **when** I hold a finger on the screen away from my character, **then** my character
   walks in a straight line towards it at normal walking speed (or swimming speed in water).
2. **Given** I am on foot and walking to my finger, **when** I lift it, **then** my character stops.
3. **Given** I am on foot, **when** I hold my finger on my character, **then** my character stands still.
4. **Given** I am in a car, **when** I hold a finger ahead of it, **then** the car drives towards the finger,
   faster the further ahead the finger is, up to full speed.
5. **Given** I am in a car, **when** I hold a finger to one side, **then** the car turns towards it, and slows down
   for a sharp turn.
6. **Given** I am in a car, **when** I hold my finger on the car, **then** the car brakes to a stop.
7. **Given** I am in a car, **when** I hold a finger behind it, **then** the car brakes, then reverses towards the
   finger.
8. **Given** I am steering, **then** a small cross on the screen shows where my finger is pointing.

### Story 2: use the buttons while steering (priority 1)

As a player on a phone, I press the action buttons with my other thumb while still steering.

1. **Given** I am steering with one finger, **when** I press fire with another, **then** I fire and keep steering.
2. **Given** I am steering with one finger and firing with another, **when** I lift the firing finger, **then** I
   keep steering.
3. **Given** I am on foot, **then** the fire button shows a gun and there is no handbrake button.
4. **Given** I am in a car, **then** the fire button shows a horn, pressing it sounds the horn without firing, and
   a handbrake button is shown.

### Story 3: recognise the buttons by their pictures (priority 2)

As a player on a phone, I can tell what each button does from its icon, without reading text on it.

1. **Given** a touch screen, **then** every button shows an icon in the game's own colours and has no text on it.
2. **Given** a screen reader, **then** every button has a name that says what it does.

### Story 4: play full screen and large (priority 1)

As a player on a phone, I want the game to use the whole screen.

1. **Given** a touch screen, **then** the game area (320 × 200 game pixels) fills the screen's height or width,
   whichever runs out first, and the decorative border may run off the edges.
2. **Given** a browser that can go full screen, **when** I press the full-screen button, **then** the browser's own
   bars disappear and, where the browser allows, the phone turns to landscape. **When** I press it again, full
   screen ends.
3. **Given** a browser that cannot go full screen, **then** there is no full-screen button.
4. **Given** a phone held sideways at the shape of a Pixel 8 Pro or wider, **then** no button covers the game area.

### Story 5: be told how to play in touch terms (priority 2)

As a player on a phone, the texts I see describe taps and buttons, never keys I do not have.

1. **Given** a touch screen, **then** the title screen describes the touch controls and says to tap the screen to
   start.
2. **Given** a touch screen, **when** the game asks "Return to title screen?" or "New game?", **then** it says which
   buttons or taps answer yes and no.
3. **Given** a touch screen and the music off, **when** I change station, **then** the message says to tap the music
   button, not to press a key.

### Story 6: hold the phone the right way (priority 3)

As a player who opened the game with the phone upright, I am told the game is meant to be played sideways, and I
can carry on upright if I insist.

1. **Given** a touch screen held upright, **then** a notice asks me to turn the phone sideways.
2. **When** I turn the phone sideways, **then** the notice goes away.
3. **When** I tap the notice, **then** it goes away and the game plays upright.

### Story 7: nothing changes on a desktop (priority 1)

1. **Given** a mouse and keyboard, **then** there are no touch buttons, the game is sized as before, and holding the
   mouse button down on the game does not steer.

## Edge cases

- **The tap that starts the game** is not a steering touch: the player does not set off on their own.
- **Interruptions.** If the player crashes, is busted, dies or the game ends while a finger is down, steering stops,
  and it does not resume when play does until the player lifts the finger and touches again. Opening the
  information page or the "return to title" question also stops the game, so no steering happens behind them.
- **A finger outside the game area,** on the black margin or the status panel, still steers: it is simply a
  direction and a distance from the character.
- **A second finger on the screen** (not on a button) while one is already steering is ignored.
- **Narrower phones** (16:9, such as a Galaxy S24 or an iPhone 15 Pro, sideways) have less margin; the edge buttons
  may overlap the edge of the game area slightly. That is accepted.
- **Full screen refused** by the browser, or the landscape lock refused, leaves the game as it was without an error.

## Requirements

| Id | Requirement |
|---|---|
| FR-01 | On a touch screen, a finger held in the play area steers the player. Touch and pen steer; a mouse does not. |
| FR-02 | On foot, the player walks straight towards the finger at walking or swimming speed, and stands still when the finger is within 6 game pixels. |
| FR-03 | In a car, a finger ahead gives throttle from 30% (16 game pixels away) to full (50 game pixels or more), steering towards it, with throttle at most 40% when the turn is sharper than about 70°. |
| FR-04 | In a car, a finger within 16 game pixels of the car brakes it to a stop from either direction. |
| FR-05 | In a car, a finger more than about 130° off the car's heading is behind it: the car brakes in a straight line while still going forward, then reverses with its tail swinging towards the finger. |
| FR-06 | Lifting the steering finger ends steering at once. |
| FR-07 | While steering, a cross marks the finger's position on the game screen. |
| FR-08 | Steering is done by one finger at a time. Buttons take their own fingers and do not end or disturb steering. |
| FR-09 | Steering ends when play is interrupted (crashed, busted, dead, game over, back to the title) and needs a new touch to start again. The tap that starts a game does not steer. |
| FR-10 | The touch buttons are: fire, get in or out of a car, handbrake, back to title, music, next station, next tune, full screen, and information. None of them is an arrow. |
| FR-11 | Every touch button shows a 16 × 16 pixel icon in the C64 palette, has no text, has an accessible name, and is at least 44 × 44 CSS pixels. |
| FR-12 | In a car the fire button shows a horn and the handbrake button is shown; on foot the fire button shows a gun and the handbrake button is hidden. |
| FR-13 | The full-screen button toggles full screen and asks for landscape, failing silently where refused, and is hidden where full screen is not available. |
| FR-14 | On a touch screen the 320 × 200 game area is scaled to fill the screen's height or width, whichever is smaller. |
| FR-15 | On a phone sideways at 945 × 396 CSS pixels (Pixel 8 Pro) no button overlaps the game area. |
| FR-16 | On a touch screen no text about controls names a key. Prompts fit their space: 40 characters on a line of the screen, 28 in the dialog box. |
| FR-17 | On a touch screen held upright, a notice asks the player to turn the phone sideways; it disappears when the phone is turned, or for the rest of the visit once tapped. |
| FR-18 | Without a touch screen, nothing in this spec applies: no touch buttons, no notice, whole-pixel sizing as before, and the mouse does not steer. |

## Success criteria

| Id | Criterion |
|---|---|
| SC-01 | Every requirement has at least one automated test, and the tests pass in CI on every pull request. |
| SC-02 | On an emulated Pixel 8 Pro held sideways, the game area is the full height of the screen. |
| SC-03 | A player can walk, drive, brake, reverse, fire and get in and out of cars using touch alone. |
| SC-04 | Tried by hand on the owner's Pixel 10 Pro with GrapheneOS: steering and buttons feel right, and full screen works. (Manual, after merging.) |

## Tests

| Requirement | Tests |
|---|---|
| FR-01 | `touch.test.cjs`: holding a finger walks the player; on a desktop the mouse does not steer |
| FR-02 | `touch.test.js`: on foot the player walks straight at the finger. `touch.test.cjs`: walks, and stops when lifted |
| FR-03 | `touch.test.js`: a finger ahead drives; to one side steers and eases off. `touch.test.cjs`: drives, brakes, reverses |
| FR-04 | `touch.test.js`: a finger on the car brakes it. `touch.test.cjs`: drives, brakes, reverses |
| FR-05 | `touch.test.js`: a finger behind brakes, then reverses towards it. `touch.test.cjs`: drives, brakes, reverses |
| FR-06 | `touch.test.cjs`: walks, and stops when lifted |
| FR-07 | `touch.test.cjs`: the cross shows where the finger is |
| FR-08 | `touch.test.cjs`: one finger can steer while another fires; a second finger on the screen is ignored |
| FR-09 | `touch.test.cjs`: the tap that starts the game does not steer; steering stops when play is interrupted |
| FR-10, FR-11 | `touch.test.cjs`: the buttons are labelled icons of a usable size. `touch.test.js`: every icon is 16 by 16 |
| FR-12 | `touch.test.cjs`: in a car the fire button becomes the horn and the handbrake appears |
| FR-13 | `touch.test.cjs`: the full-screen button switches full screen on and off |
| FR-14, FR-15 | `touch.test.cjs`: the game fills the screen and no button covers it |
| FR-16 | `help.test.js`: touch texts name no keys and fit their space. `touch.test.cjs`: the dialogs answer to the buttons they name |
| FR-17 | `touch.test.cjs`: held upright, the game asks to be turned sideways |
| FR-18 | `touch.test.cjs`: on a desktop nothing changes |

The steering rules are checked in `tests/unit/touch.test.js` without a browser, including a short physics run that
confirms the car really reverses towards a finger behind it. The rest is checked in `tests/e2e/touch.test.cjs`
on an emulated Pixel 8 Pro in Chromium, with touches sent through the browser's own touch emulation.

## Not verified automatically

- How the steering feels under a thumb, and whether the speeds suit a real phone.
- Full screen and the landscape lock in GrapheneOS's browser (Vanadium), and on iPhone, where Safari does not offer
  full screen for pages.
- Firefox on Android.
