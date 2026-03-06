import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  quitApp: () => ipcRenderer.send('window-quit'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  reportActivity: () => ipcRenderer.send('user-activity'),
  onTrayStartTimer: (cb: () => void) => ipcRenderer.on('tray:start-timer', () => cb()),

  // Görevler
  tasksGetAll: () => ipcRenderer.invoke('tasks:getAll'),
  tasksCreate: (input: object) => ipcRenderer.invoke('tasks:create', input),
  tasksUpdate: (id: number, fields: object) => ipcRenderer.invoke('tasks:update', id, fields),
  tasksDelete: (id: number) => ipcRenderer.invoke('tasks:delete', id),
  dashboardStats: () => ipcRenderer.invoke('dashboard:stats'),

  // Dosyalar
  tasksGetFiles: (taskId: number) => ipcRenderer.invoke('tasks:getFiles', taskId),
  tasksAddFile: (taskId: number, project: string) => ipcRenderer.invoke('tasks:addFile', taskId, project),
  tasksDeleteFile: (fileId: number) => ipcRenderer.invoke('tasks:deleteFile', fileId),
  tasksOpenFile: (filePath: string) => ipcRenderer.invoke('tasks:openFile', filePath),

  // Yorumlar
  tasksGetComments: (taskId: number) => ipcRenderer.invoke('tasks:getComments', taskId),
  tasksAddComment: (taskId: number, content: string) => ipcRenderer.invoke('tasks:addComment', taskId, content),
  tasksDeleteComment: (commentId: number) => ipcRenderer.invoke('tasks:deleteComment', commentId),

  // Zaman
  timerStart: (description: string, taskId: number | null) => ipcRenderer.invoke('timer:start', description, taskId),
  timerStop: (logId: number, duration: number) => ipcRenderer.invoke('timer:stop', logId, duration),
  timerGetLogs: () => ipcRenderer.invoke('timer:getLogs'),
  timerDeleteLog: (logId: number) => ipcRenderer.invoke('timer:deleteLog', logId),
  timerTodayStats: () => ipcRenderer.invoke('timer:todayStats'),

  // Şifreli Kasa
  vaultGetAll: () => ipcRenderer.invoke('vault:getAll'),
  vaultGet: (id: number, masterKey: string) => ipcRenderer.invoke('vault:get', id, masterKey),
  vaultCreate: (title: string, content: string, masterKey: string) => ipcRenderer.invoke('vault:create', title, content, masterKey),
  vaultUpdate: (id: number, title: string, content: string, masterKey: string) => ipcRenderer.invoke('vault:update', id, title, content, masterKey),
  vaultDelete: (id: number) => ipcRenderer.invoke('vault:delete', id),
  vaultVerify: (masterKey: string) => ipcRenderer.invoke('vault:verify', masterKey),

  // Raporlama
  reportsGetWeekly: () => ipcRenderer.invoke('reports:getWeekly'),
  reportsSavePDF: (pdfBuffer: ArrayBuffer) => ipcRenderer.invoke('reports:savePDF', Buffer.from(pdfBuffer)),
  reportsPrintToPDF: () => ipcRenderer.invoke('reports:printToPDF'),
});