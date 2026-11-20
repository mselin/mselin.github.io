// SPDX-License-Identifier: GPL-2.0-or-later
// Everything the game says about its controls, in two versions: for a keyboard, and for a touch screen, where
// it never names a key the player does not have (FR-16 in specs/touch-controls.md). Data only, so it runs in tests.

/** Whether the main pointer is a finger: phones and tablets. False where there is no browser, as in the tests. */
export const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;

export const HELP = {
  keys: {
    // The title screen: five lines, each at most 34 characters from where they start.
    controls: [
      'ARROWS / WASD   WALK - DRIVE',
      'SPACE           FIRE - HORN',
      'E / ENTER       "BORROW" CAR',
      'P PAUSE         I INFO - CREDITS',
      'M MUSIC ON/OFF  R STATION  N NEXT',
    ],
    start: 'PRESS FIRE TO COMMIT CRIMES',
    musicOff: 'MUSIC IS OFF - PRESS M TO TURN IT ON',
    radioMusicOff: ' (MUSIC IS OFF - PRESS M)',
    confirm: 'Y = YES    N = NO',
    newGame: 'NEW GAME?   Y = YES   N = NO',
  },
  touch: {
    controls: [
      'HOLD A FINGER   WALK OR DRIVE',
      'ON THE SCREEN   TOWARDS IT',
      'GUN BUTTON      FIRE - HORN',
      'CAR BUTTON      "BORROW" CAR',
      'I BUTTON        INFO - CREDITS',
    ],
    start: 'TAP THE SCREEN TO COMMIT CRIMES',
    musicOff: 'MUSIC IS OFF - TAP THE NOTE BUTTON',
    radioMusicOff: ' (MUSIC IS OFF - TAP THE NOTE BUTTON)',
    confirm: 'GUN = YES    CAR = NO',
    newGame: 'NEW GAME?  TAP = YES  CAR = NO',
  },
};

/** The texts for this device. */
export const help = () => (TOUCH ? HELP.touch : HELP.keys);
