// Electron shell for the Steam build: a window around the client's app bundle
// (packages/client/dist-app). All game logic stays on the server.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const SMOKE = process.argv.includes('--smoke');
const webDir = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'client', 'dist-app');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: !SMOKE,
    autoHideMenuBar: true,
    backgroundColor: '#f3e9d2',
    title: 'Cờ Tỷ Phú Hà Nội',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  // Links leave the game window for the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  void win.loadFile(path.join(webDir, 'index.html'));
  return win;
}

// `--smoke`: load the bundle hidden, report whether the app rendered, exit.
async function smoke(win) {
  const errors = [];
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error') errors.push(e.message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => errors.push(`load failed: ${code} ${desc}`));
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  await new Promise((r) => setTimeout(r, 3000));
  const text = await win.webContents.executeJavaScript('document.getElementById("root").innerText.slice(0, 300)');
  console.log(JSON.stringify({ rendered: text.length > 0, text, errors }));
  app.exit(text.length > 0 && errors.length === 0 ? 0 : 1);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    const win = createWindow();
    if (SMOKE) void smoke(win);
  });
  app.on('window-all-closed', () => app.quit());
}
