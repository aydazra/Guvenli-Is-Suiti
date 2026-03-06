// ==========================================
// MODÜL D: RAPORLAMA & DIŞA AKTARIM
// ==========================================

let reportData = null;
let chartInstance = null;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatHours(seconds) {
  return (seconds / 3600).toFixed(1) + ' sa';
}

async function loadReport() {
  reportData = await api.reportsGetWeekly();
  if (!reportData) return;
  renderSummaryCards();
  renderChart();
  renderTopTasks();
  renderTaskStats();
}

// ==========================================
// ÖZET KARTLAR
// ==========================================

function renderSummaryCards() {
  const totalHours = (reportData.totalSeconds / 3600).toFixed(1);
  const avgHours = (reportData.totalSeconds / 3600 / 7).toFixed(1);

  document.getElementById('repTotalHours').textContent = totalHours + ' sa';
  document.getElementById('repTotalSessions').textContent = reportData.totalSessions;
  document.getElementById('repAvgHours').textContent = avgHours + ' sa/gün';

  const activeTasks = reportData.taskStats.find(s => s.status !== 'done')?.count || 0;
  const doneTasks = reportData.taskStats.find(s => s.status === 'done')?.count || 0;
  document.getElementById('repTasksDone').textContent = doneTasks;
}

// ==========================================
// GRAFİK
// ==========================================

function renderChart() {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const labels = reportData.days.map(d => d.label);
  const data = reportData.days.map(d => parseFloat((d.totalSeconds / 3600).toFixed(2)));

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Çalışma (saat)',
        data,
        backgroundColor: data.map(v => v > 0 ? 'rgba(79,142,247,0.7)' : 'rgba(79,142,247,0.2)'),
        borderColor: 'rgba(79,142,247,1)',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(2)} saat`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8892a4', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#8892a4', callback: v => v + ' sa' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true
        }
      }
    }
  });
}

// ==========================================
// EN ÇOK ÇALIŞILAN GÖREVLER
// ==========================================

function renderTopTasks() {
  const tbody = document.getElementById('topTasksBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!reportData.topTasks.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-logs">Henüz zaman kaydı yok.</td></tr>';
    return;
  }

  reportData.topTasks.forEach((task, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}. ${escapeHtml(task.title)}</td>
      <td><span class="task-project">📁 ${escapeHtml(task.project)}</span></td>
      <td><span class="duration-badge">${formatTime(task.totalSeconds)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// GÖREV DURUM İSTATİSTİĞİ
// ==========================================

function renderTaskStats() {
  const statusLabels = { todo: 'Yapılacak', inprogress: 'Sürüyor', done: 'Tamamlandı' };
  const statusColors = { todo: '#4f8ef7', inprogress: '#f0a050', done: '#4caf7d' };
  const container = document.getElementById('taskStatusStats');
  if (!container) return;
  container.innerHTML = '';

  reportData.taskStats.forEach(stat => {
    const div = document.createElement('div');
    div.className = 'status-stat-item';
    const color = statusColors[stat.status] || '#8892a4';
    const label = statusLabels[stat.status] || stat.status;
    div.innerHTML = `
      <div class="status-stat-dot" style="background:${color}"></div>
      <span class="status-stat-label">${label}</span>
      <span class="status-stat-count" style="color:${color}">${stat.count}</span>
    `;
    container.appendChild(div);
  });
}

// ==========================================
// PDF DIŞA AKTARIM
// ==========================================

async function exportPDF() {
  const btn = document.getElementById('btnExportPDF');
  if (btn) btn.textContent = '⏳ Hazırlanıyor...';

  try {
    const filePath = await api.reportsPrintToPDF();
    if (filePath) {
      if (btn) btn.textContent = '✅ Kaydedildi!';
      setTimeout(() => { if (btn) btn.textContent = '📄 PDF İndir'; }, 2000);
    } else {
      if (btn) btn.textContent = '📄 PDF İndir';
    }
  } catch (err) {
    console.error('PDF hatası:', err);
    if (btn) btn.textContent = '📄 PDF İndir';
  }
}

// ==========================================
// YARDIMCI
// ==========================================

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.loadReports = loadReport;
window.exportPDF = exportPDF;