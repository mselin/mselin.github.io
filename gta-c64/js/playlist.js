// SPDX-License-Identifier: GPL-2.0-or-later
// Reads radio/stations.json into station lists. Pure, so it runs without a browser.
import { R } from './util.js';

export const HVSC = 'https://www.hvsc.c64.org',
  HVSC_BASE = HVSC + '/download/C64Music';
export const fontSafe = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
export const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function parseStations(j) {
  const out = [];
  let base = HVSC_BASE;
  if (
    j &&
    typeof j.hvscBase === 'string' &&
    (/^https:\/\/(www\.)?hvsc\.c64\.org\/download\/C64Music$/.test(j.hvscBase) ||
      (/^[\w][\w.\/-]*$/.test(j.hvscBase) && !j.hvscBase.includes('..')))
  )
    base = j.hvscBase.replace(/\/$/, '');
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  for (const s of (j && j.stations) || []) {
    const tr = [];
    for (const t of (s && s.tracks) || []) {
      if (!t) continue;
      let url = null;
      if (typeof t.hvsc === 'string' && /^\/[\w][\w .\/-]*\.sid$/i.test(t.hvsc) && !t.hvsc.includes('..'))
        url = base + encodeURI(t.hvsc);
      else if (typeof t.file === 'string' && /^\w[\w .\/-]*\.sid$/i.test(t.file) && !t.file.includes('..'))
        url = 'radio/' + encodeURI(t.file);
      if (url)
        tr.push({
          url,
          sub: t.subtune > 0 ? (t.subtune | 0) - 1 : null,
          secs: t.seconds > 0 ? +t.seconds : 180,
          title: str(t.title, 80),
          author: str(t.author, 80),
          released: str(t.released, 80),
          id: Number.isInteger(t.id) && t.id > 0 ? t.id : 0,
        });
    }
    if (tr.length)
      out.push({
        name: fontSafe(str(s && s.name, 20) || 'UNNAMED FM'),
        tagline: fontSafe(str(s && s.tagline, 80)),
        tracks: tr,
        i: 0,
      });
  }
  return out;
}
