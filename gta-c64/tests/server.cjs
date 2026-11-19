// SPDX-License-Identifier: GPL-2.0-or-later
// A minimal static file server for the game folder. Used by the browser tests, and by `npm start`.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json',
  wasm: 'application/wasm',
  png: 'image/png',
  md: 'text/plain; charset=utf-8',
};

/** Start serving the game folder. Resolves to { url, close }. Port 0 picks a free port. */
function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://localhost:${server.address().port}/`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { serve };

if (require.main === module) {
  serve(Number(process.argv[2]) || 8064).then((s) => console.log(`Sleazeburg 64 at ${s.url}`));
}
