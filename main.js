const { app, BrowserWindow, ipcMain, shell } = require('node:electron');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');

const REPO_OWNER = '6nmsb4mvzs-ui';
const REPO_NAME = 'mc';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#10120f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const root = __dirname;
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.webm': 'video/webm'
  };

  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file;
    if (pathname === '/' || pathname === '/index.html') {
      file = path.join(root, 'src', 'index.html');
    } else {
      file = path.join(root, pathname.startsWith('/src/') || pathname.startsWith('/assets/') ? '' : 'src', pathname);
      if (!fs.existsSync(file)) file = path.join(root, pathname);
    }
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      }).end(data);
    });
  });

  let port = 18700;
  function tryListen() {
    server.once('error', () => { if (++port < 18720) tryListen(); });
    server.listen(port, '127.0.0.1', () => {
      mainWindow.loadURL(`http://127.0.0.1:${port}/`);
      mainWindow.once('ready-to-show', () => mainWindow.show());
    });
  }
  tryListen();

  mainWindow.on('closed', () => { mainWindow = null; server.close(); });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, { timeout: 8000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
  });
}

ipcMain.handle('check-update', async () => {
  try {
    const local = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
    const remoteText = await fetchText(`${RAW_BASE}/version.json`);
    const remote = JSON.parse(remoteText);
    const hasUpdate = remote.version !== local.version;
    return {
      current: local.version,
      latest: remote.version,
      hasUpdate,
      changelog: remote.changelog || '',
      downloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('get-version', () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
  } catch { return { version: '?.?.?' }; }
});

ipcMain.on('open-external', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
