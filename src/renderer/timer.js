// ==========================================
// MODÜL B: ZAMAN TAKİBİ & AKTİVİTE LOGU
// ==========================================

let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let currentLogId = null;

// ==========================================
// ZAMANLAYICI
// ==========================================

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (el) el.textContent = formatTime(timerSeconds);
}

async function startTimer(taskId = null, taskTitle = null) {
  if (timerRunning) return;

  // Eğer görev ID gelirse seç
  if (taskId) {
    const select = document.getElementById('timerTaskSelect');
    if (select) select.value = String(taskId);
    const desc = document.getElementById('timerDesc');
    if (desc && taskTitle) desc.value = taskTitle;
  }

  const desc = document.getElementById('timerDesc')?.value.trim() || '';
  const selectedTaskId = document.getElementById('timerTaskSelect')?.value || null;

  currentLogId = await api.timerStart(desc, selectedTaskId ? parseInt(selectedTaskId) : null);

  timerRunning = true;
  timerSeconds = 0;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
    // Hareketsizlik sayacını sıfırla (aktif zamanlayıcı = aktivite)
    const hours = (timerSeconds / 3600).toFixed(1);
    const el = document.getElementById('statHours');
    if (el) el.textContent = hours;
  }, 1000);

  document.getElementById('btnStartTimer')?.classList.add('hidden');
  document.getElementById('btnStopTimer')?.classList.remove('hidden');
  document.getElementById('timerStatus')?.classList.add('running');
  document.getElementById('timerStatusText').textContent = '⏱️ Zamanlayıcı çalışıyor...';
}

async function stopTimer() {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;

  if (currentLogId) {
    await api.timerStop(currentLogId, timerSeconds);
    currentLogId = null;
  }

  document.getElementById('btnStartTimer')?.classList.remove('hidden');
  document.getElementById('btnStopTimer')?.classList.add('hidden');
  document.getElementById('timerStatus')?.classList.remove('running');
  document.getElementById('timerStatusText').textContent = '⏸️ Durduruldu';

  await loadTimeLogs();
  await updateTodayStats();
}

function resetTimer() {
  if (timerRunning) stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  document.getElementById('timerStatusText').textContent = '⏸️ Hazır';
}

// ==========================================
// ZAMAN LOGLARI
// ==========================================

async function loadTimeLogs() {
  const logs = await api.timerGetLogs();
  const tbody = document.getElementById('timeLogBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-logs">Henüz kayıt yok.</td></tr>';
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    const date = new Date(log.started_at);
    const dateStr = date.toLocaleDateString('tr-TR');
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    tr.innerHTML = `
      <td>${dateStr} ${timeStr}</td>
      <td>${escapeHtml(log.description || '-')}</td>
      <td>${log.task_title ? escapeHtml(log.task_title) : '-'}</td>
      <td><span class="duration-badge">${formatTime(log.duration || 0)}</span></td>
      <td><button class="task-btn task-btn-danger" data-lid="${log.id}" data-action="del-log" title="Sil">🗑️</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-action="del-log"]').forEach(btn => {
    btn.addEventListener('click', () => deleteLog(parseInt(btn.dataset.lid)));
  });
}

async function deleteLog(logId) {
  if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
  await api.timerDeleteLog(logId);
  await loadTimeLogs();
  await updateTodayStats();
}

// ==========================================
// BUGÜNÜN İSTATİSTİKLERİ
// ==========================================

async function updateTodayStats() {
  const stats = await api.timerTodayStats();
  document.getElementById('todayTotal').textContent = formatTime(stats.totalSeconds || 0);
  document.getElementById('todaySessions').textContent = stats.sessionCount || 0;
  const hours = ((stats.totalSeconds || 0) / 3600).toFixed(1);
  const el = document.getElementById('statHours');
  if (el) el.textContent = hours;
}

// ==========================================
// GÖREV SEÇİCİSİ
// ==========================================

async function loadTasksForTimer() {
  const tasks = await api.tasksGetAll();
  const select = document.getElementById('timerTaskSelect');
  if (!select) return;
  select.innerHTML = '<option value="">— Göreve bağla (opsiyonel) —</option>';
  tasks.forEach(task => {
    if (task.status !== 'done') {
      const opt = document.createElement('option');
      opt.value = task.id;
      opt.textContent = `[${task.project || 'Genel'}] ${task.title}`;
      select.appendChild(opt);
    }
  });
}

// ==========================================
// TRAY'DEN BAŞLATMA
// ==========================================

api.onTrayStartTimer(() => {
  // Timer sayfasına git ve başlat
  if (window.navigateTo) window.navigateTo('timer');
  setTimeout(() => startTimer(), 300);
});

// ==========================================
// HAREKETSİZLİK TAKİBİ (Renderer tarafı)
// ==========================================

let activityTimeout = null;

function reportActivity() {
  api.reportActivity();
  // 10 dakika içinde tekrar bildirmemek için throttle
  if (activityTimeout) return;
  activityTimeout = setTimeout(() => { activityTimeout = null; }, 60000);
}

document.addEventListener('mousemove', reportActivity);
document.addEventListener('keydown', reportActivity);
document.addEventListener('click', reportActivity);

// ==========================================
// YARDIMCI
// ==========================================

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Global expose
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.resetTimer = resetTimer;
window.deleteLog = deleteLog;

window.loadTimer = async function() {
  await loadTasksForTimer();
  await loadTimeLogs();
  await updateTodayStats();
  updateTimerDisplay();
};

// Görev kartından timer başlatma
window.startTimerForTask = function(taskId, taskTitle) {
  if (window.navigateTo) window.navigateTo('timer');
  setTimeout(() => startTimer(taskId, taskTitle), 300);
};