const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png'
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file;
  if (pathname === '/' || pathname === '/index.html') {
    file = path.join(root, 'src', 'index.html');
  } else {
    file = path.resolve(root, '.' + pathname);
    if (!fs.existsSync(file)) file = path.resolve(root, 'src', '.' + pathname);
  }
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }).end(data);
  });
});

let port = 8000;
function listenNextPort() {
  server.once('error', (err) => {
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && port < 8010) {
      port += 1;
      listenNextPort();
      return;
    }
    console.error(`Could not start server: ${err.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Blockframe is ready at ${url}`);
    if (process.platform === 'win32') {
      require('node:child_process').exec(`start "" "${url}"`);
    }
  });
}
listenNextPort();
