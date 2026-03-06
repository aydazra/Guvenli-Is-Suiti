import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let dbModule: typeof import('../database/db') | null = null;

// Hareketsizlik takibi
let inactivityTimer: NodeJS.Timeout | null = null;
const INACTIVITY_LIMIT = 10 * 60 * 1000;

function resetInactivityTimer(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Güvenli İş Suiti',
        body: '10 dakikadır hareketsizsiniz. Zamanlayıcınız çalışıyor olabilir.',
      }).show();
    }
    tray?.setToolTip('⚠️ 10 dk hareketsizlik - Güvenli İş Suiti');
    setTimeout(() => tray?.setToolTip('Güvenli İş Suiti'), 5000);
  }, INACTIVITY_LIMIT);
}

// ==========================================
// AES-256-GCM ŞİFRELEME
// ==========================================

const ALGORITHM = 'aes-256-gcm';
const KEY_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_FILE = path.join(app.getPath('userData'), 'vault.salt');

function getOrCreateSalt(): Buffer {
  if (fs.existsSync(SALT_FILE)) {
    return fs.readFileSync(SALT_FILE);
  }
  const salt = crypto.randomBytes(32);
  fs.writeFileSync(SALT_FILE, salt);
  return salt;
}

function deriveKey(masterKey: string): Buffer {
  const salt = getOrCreateSalt();
  return crypto.pbkdf2Sync(masterKey, salt, KEY_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptText(plainText: string, masterKey: string): { encrypted: string; iv: string; tag: string } {
  const key = deriveKey(masterKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

function decryptText(encrypted: string, ivHex: string, tagHex: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#1a1a2e', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
  mainWindow.once('ready-to-show', () => { mainWindow?.show(); resetInactivityTimer(); });
  mainWindow.on('close', (e) => { e.preventDefault(); mainWindow?.hide(); });
}

function createTray(): void {
  const iconB64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAdUlEQVR4nGOQktL7P5CYYdQBow4YdcCQdIB/33esmOYOwGUxJQ4h2gHEWk6qI4hyADEWkOsIgg4g1VBS1ZPkAHKia9QBZDuA1FRPbq4YdQBRDpAL2EIWpqkD0NWPOmBkO2DAEyHNHUAoXw//gmhAHEAvPOoAABa7/6lHjqdGAAAAAElFTkSuQmCC';
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconB64}`);
  tray = new Tray(icon);
  tray.setToolTip('Güvenli İş Suiti');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '🔒 Güvenli İş Suiti', enabled: false },
    { type: 'separator' },
    { label: '▶ Zamanlayıcıyı Başlat', click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('tray:start-timer'); } },
    { type: 'separator' },
    { label: 'Aç', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Çıkış', click: () => { app.exit(0); } }
  ]));
  tray.on('click', () => { if (mainWindow?.isVisible()) mainWindow.hide(); else { mainWindow?.show(); mainWindow?.focus(); } });
}

// PENCERE
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
ipcMain.on('window-close', () => mainWindow?.hide());
ipcMain.on('window-quit', () => app.exit(0));
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.on('user-activity', () => resetInactivityTimer());

// GÖREVLER
ipcMain.handle('tasks:getAll', () => dbModule?.getAllTasks() ?? []);
ipcMain.handle('tasks:create', (_e, input) => dbModule?.createTask(input) ?? null);
ipcMain.handle('tasks:update', (_e, id, fields) => dbModule?.updateTask(id, fields) ?? null);
ipcMain.handle('tasks:delete', (_e, id) => dbModule?.deleteTask(id) ?? false);
ipcMain.handle('dashboard:stats', async () => {
  const base = dbModule?.getDashboardStats() ?? { active: 0, done: 0 };
  const secrets = dbModule?.getVaultCount() ?? 0;
  return { ...base, secrets };
});

// DOSYALAR
ipcMain.handle('tasks:getFiles', (_e, taskId) => dbModule?.getTaskFiles(taskId) ?? []);
ipcMain.handle('tasks:addFile', async (_e, taskId: number, project: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Dosya Ekle', properties: ['openFile'] });
  if (result.canceled || !result.filePaths.length) return null;
  const srcPath = result.filePaths[0];
  const filename = path.basename(srcPath);
  const fileSize = fs.statSync(srcPath).size;
  const safeProject = project.replace(/[^a-zA-Z0-9_\-\u00C0-\u017E]/g, '_');
  const destDir = path.join(app.getPath('userData'), 'attachments', safeProject, `task_${taskId}`);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);
  fs.copyFileSync(srcPath, destPath);
  return dbModule?.addTaskFile(taskId, project, filename, destPath, fileSize) ?? null;
});
ipcMain.handle('tasks:deleteFile', (_e, fileId) => dbModule?.deleteTaskFile(fileId) ?? false);
ipcMain.handle('tasks:openFile', (_e, filePath) => { shell.openPath(filePath); return true; });

// YORUMLAR
ipcMain.handle('tasks:getComments', (_e, taskId) => dbModule?.getTaskComments(taskId) ?? []);
ipcMain.handle('tasks:addComment', (_e, taskId, content) => dbModule?.addTaskComment(taskId, content) ?? null);
ipcMain.handle('tasks:deleteComment', (_e, commentId) => dbModule?.deleteTaskComment(commentId) ?? false);

// ZAMAN LOGU
ipcMain.handle('timer:start', (_e, description, taskId) => dbModule?.startTimeLog(description, taskId) ?? null);
ipcMain.handle('timer:stop', (_e, logId, duration) => { dbModule?.stopTimeLog(logId, duration); return true; });
ipcMain.handle('timer:getLogs', () => dbModule?.getAllTimeLogs() ?? []);
ipcMain.handle('timer:deleteLog', (_e, logId) => dbModule?.deleteTimeLog(logId) ?? false);
ipcMain.handle('timer:todayStats', () => dbModule?.getTodayStats() ?? { totalSeconds: 0, sessionCount: 0 });

// ŞİFRELİ KASA
ipcMain.handle('vault:getAll', () => dbModule?.getAllVaultEntries() ?? []);

ipcMain.handle('vault:get', (_e, id: number, masterKey: string) => {
  const entry = dbModule?.getVaultEntry(id);
  if (!entry) return null;
  try {
    // iv formatı: "ivHex:tagHex"
    const [ivHex, tagHex] = entry.iv.split(':');
    const content = decryptText(entry.content_encrypted, ivHex, tagHex, masterKey);
    return { id: entry.id, title: entry.title, content, created_at: entry.created_at, updated_at: entry.updated_at };
  } catch {
    return { error: 'Yanlış Master Key veya veri bozuk.' };
  }
});

ipcMain.handle('vault:create', (_e, title: string, content: string, masterKey: string) => {
  const { encrypted, iv, tag } = encryptText(content, masterKey);
  return dbModule?.createVaultEntry(title, encrypted, `${iv}:${tag}`) ?? null;
});

ipcMain.handle('vault:update', (_e, id: number, title: string, content: string, masterKey: string) => {
  const { encrypted, iv, tag } = encryptText(content, masterKey);
  return dbModule?.updateVaultEntry(id, title, encrypted, `${iv}:${tag}`) ?? false;
});

ipcMain.handle('vault:delete', (_e, id: number) => dbModule?.deleteVaultEntry(id) ?? false);

ipcMain.handle('vault:verify', (_e, masterKey: string) => {
  // Test amaçlı: bir deneme şifreleyip çözmeye çalış
  try {
    const { encrypted, iv, tag } = encryptText('test', masterKey);
    const result = decryptText(encrypted, iv, tag, masterKey);
    return result === 'test';
  } catch {
    return false;
  }
});


// RAPORLAMA
ipcMain.handle('reports:getWeekly', () => dbModule?.getWeeklyReport() ?? null);
ipcMain.handle('reports:printToPDF', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Raporu Kaydet',
    defaultPath: `GIS-Rapor-${new Date().toISOString().slice(0,10)}.pdf`,
    filters: [{ name: 'PDF Dosyası', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;
   // Canvas'ın render tamamlanması için bekle
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const pdfData = await mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
  });
  fs.writeFileSync(result.filePath, pdfData);
  shell.openPath(result.filePath);
  return result.filePath;
});

app.whenReady().then(async () => {
  dbModule = await import('../database/db');
  createWindow();
  createTray();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => {});