// SPDX-License-Identifier: GPL-2.0-or-later
// Constants: palette, screen and map sizes, tile types, car types and all the game's text tables.

export const PAL = [
  '#000000',
  '#ffffff',
  '#68372b',
  '#70a4b2',
  '#6f3d86',
  '#588d43',
  '#352879',
  '#b8c76f',
  '#6f4f25',
  '#433900',
  '#9a6759',
  '#444444',
  '#6c6c6c',
  '#9ad284',
  '#6c5eb5',
  '#959595',
];
export const RGB = PAL.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);
export const SW = 320,
  SH = 200,
  VH = 176,
  BX = 32,
  BY = 36,
  PI = Math.PI;
export const KIND = {
  sedan: { n: 'sedan', L: 20, W: 11, max: 150, acc: 120, hp: 100 },
  sports: { n: 'sports', L: 20, W: 10, max: 215, acc: 180, hp: 80 },
  van: { n: 'van', L: 22, W: 12, max: 120, acc: 85, hp: 150 },
  taxi: { n: 'taxi', L: 20, W: 11, max: 150, acc: 120, hp: 100, col: 7 },
  police: { n: 'police', L: 20, W: 11, max: 188, acc: 165, hp: 140, col: 1 },
  limo: { n: 'limo', L: 28, W: 11, max: 140, acc: 100, hp: 170, col: 1 },
};
export const CCOLS = [2, 4, 5, 8, 10, 13, 14, 3, 15];
export const T = 16,
  NB = 8,
  PB = 12,
  MW = NB * PB + 2,
  WPX = MW * T,
  BLK = PB * T;
export const ROAD = 0,
  WALK = 1,
  BLD = 2,
  GRASS = 3,
  WATER = 4,
  LOT = 5,
  PLAZA = 6,
  TREE = 7,
  FOUNT = 8;
export const SPECIAL = {
  '1,1': { col: 1, txt: 'ST. INVOICE', tc: 2, cross: 1 },
  '6,2': { col: 6, txt: 'PRECINCT 64', tc: 1 },
  '2,5': { col: 15, txt: 'CITY HALL', tc: 0 },
  '6,6': { col: 9, txt: 'CHOP SHOP', tc: 7 },
  '1,6': { col: 4, txt: 'PAINT & PRAY', tc: 1 },
};
export const SHOPS = [
  'VAPE & PRAY',
  'CRYPTO PAWN',
  'KALE HUT',
  'GYM (CLOSED)',
  'LOANS 4 U',
  'RENT: LOL',
  'ARTISAN ICE',
  'NFT OUTLET',
  'BANK OF OOPS',
  'DISCOUNT LAW',
  'WEWONTWORK',
  'AVOCADO BANK',
  'SYNERGY LTD',
  'BAIL BONDS',
  'LUXURY FLATS',
  'OAT MILK DEPOT',
  'TOTALLY A SPA',
  'HEDGE FUN',
  'PODCAST HQ',
  'THOUGHTS&PRAYERS',
];
/** The numerology cult: which crossing they meet at (counting avenues from the west and streets from the north, from 1) and how many turn up. */
export const CULT = { ave: 6, st: 7, members: 7 };
/** The districts of the city: the id used in code and saved data, and the name shown on screen. */
export const DISTRICTS = {
  gentrifia: 'GENTRIFIA',
  debt_valley: 'DEBT VALLEY',
  hoa_heights: 'HOA HEIGHTS',
  crypto_docks: 'CRYPTO DOCKS',
  the_moat: 'THE MOAT',
};
export const GOAL = 25000,
  HT = [0, 8, 25, 60, 110, 180];
export const HEATMSG = [
  '',
  'HEAT 1: A STERN LETTER IS BEING DRAFTED',
  'HEAT 2: POLICE DISPATCHED. EVENTUALLY.',
  'HEAT 3: SHOOT FIRST, PAPERWORK NEVER',
  'HEAT 4: OVERTIME HAS BEEN APPROVED',
  'HEAT 5: THE HOMEOWNERS ASSOCIATION HAS BEEN NOTIFIED',
];
export const NEWS = [
  'NEWS: MAYOR DENIES EXISTENCE OF POTHOLES, FALLS INTO ONE',
  'NEWS: RENT UP 40%. LANDLORDS CITE "VIBES"',
  "NEWS: CITY BUDGET FOUND. IT WAS IN THE MAYOR'S OTHER JACKET",
  'NEWS: NEW BIKE LANE OPENS, IS IMMEDIATELY A PARKING SPACE',
  'NEWS: LOCAL MAN STILL ON HOLD WITH THE BANK SINCE 1986',
  'NEWS: POLICE SEIZE LEMONADE STAND, CITE "ORGANISED CITRUS"',
  'NEWS: CRYPTO DOCKS FLOODED. COINS STILL NOT LIQUID',
  'NEWS: E-SCOOTER COUNT NOW EXCEEDS POPULATION',
  'NEWS: COUNCIL VOTES 9-0 TO GIVE COUNCIL A RAISE',
  'AD: SID FM - ALL THREE VOICES, ALL THE TIME',
  'AD: PAINT & PRAY - NEW COLOUR, SAME SINS. $200',
  'NEWS: TRAFFIC TODAY IS "A PERSONAL CHOICE" SAYS TRANSPORT CHIEF',
  'NEWS: HOSPITAL INTRODUCES PREMIUM OXYGEN TIER',
  'TIP: DONUTS REDUCE HEAT. DO NOT ASK HOW.',
];
export const JACK = [
  'DRIVER: "I\'M LEAVING ONE STAR."',
  'DRIVER: "IT\'S A LEASE ANYWAY."',
  'DRIVER: "FINALLY, A REASON TO WALK."',
  'DRIVER: "MY PODCAST WILL HEAR ABOUT THIS."',
  'DRIVER: "JOKE\'S ON YOU, IT NEEDS A SERVICE."',
];
export const JOBS = [
  {
    t: 'PIZZA? SURE.',
    type: 'go',
    time: 70,
    pay: 1500,
    txt: 'DELIVER THE "PIZZA". DO NOT OPEN THE "PIZZA".',
  },
  {
    t: 'SCOOTER SEASON',
    type: 'kill',
    n: 3,
    time: 110,
    pay: 2000,
    txt: 'FLATTEN 3 E-SCOOTER BROS. THE PAVEMENT THANKS YOU.',
  },
  {
    t: 'EXECUTIVE TRANSPORT',
    type: 'steal',
    time: 160,
    pay: 4000,
    txt: "BORROW THE MAYOR'S LIMO. BRING IT TO THE CHOP SHOP.",
  },
  {
    t: 'PARKING DISPUTE',
    type: 'wreck',
    n: 3,
    time: 130,
    pay: 3000,
    txt: 'BLOW UP 3 CARS. THE INSURANCE LOBBY SENDS REGARDS.',
  },
  {
    // No arrow for this one: the player has to count streets. Timer and reward are in the cult's own numbers.
    t: 'THE CULT OF 6-7',
    type: 'find',
    time: 167,
    pay: 6700,
    txt: 'FIND THE NUMEROLOGY CULT. NO ARROW: THEY MEET WHERE AVENUE 6 CROSSES STREET 7. YOUR OWN CROSSING SHOWS NEXT TO THE TIMER.',
  },
  {
    t: 'CONSULTING FEE',
    type: 'go',
    time: 60,
    pay: 2500,
    txt: 'BRING THE ENVELOPE TO THE DROP. NO, THE OTHER ENVELOPE.',
  },
  {
    t: 'GOING VIRAL',
    type: 'survive',
    n: 30,
    time: 160,
    pay: 3500,
    txt: 'A STREAMER WANTS CONTENT: HOLD HEAT 2+ FOR 30 SECONDS.',
  },
  {
    t: 'MICROMOBILITY AUDIT',
    type: 'kill',
    n: 5,
    time: 140,
    pay: 3500,
    txt: '5 MORE SCOOTER BROS. THEY RESPAWN FASTER THAN POTHOLES.',
  },
  {
    t: 'ASSET RELOCATION',
    type: 'steal',
    time: 150,
    pay: 4500,
    txt: 'THE MAYOR BOUGHT A NEW LIMO. YOU KNOW WHAT TO DO.',
  },
];
export const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const GRIP = { sedan: 450, sports: 490, van: 370, taxi: 450, police: 510, limo: 350 };
