const api = window.electronAPI;

// TITLE BAR
document.getElementById('btnMinimize')?.addEventListener('click', () => api.minimizeWindow());
document.getElementById('btnMaximize')?.addEventListener('click', () => { api.maximizeWindow(); updateMaximizeIcon(); });
document.getElementById('btnClose')?.addEventListener('click', () => api.closeWindow());

async function updateMaximizeIcon() {
  const isMax = await api.isMaximized();
  const btn = document.getElementById('btnMaximize');
  if (!btn) return;
  btn.title = isMax ? 'Geri Yükle' : 'Büyüt';
  btn.innerHTML = isMax
    ? `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor"/><rect x="0" y="2" width="8" height="8" fill="var(--bg-card)" stroke="currentColor"/></svg>`
    : `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>`;
}

// NAVİGASYON
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

function navigateTo(pageId) {
  navItems.forEach(i => i.classList.remove('active'));
  pages.forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  if (pageId === 'kanban' && window.loadKanban) window.loadKanban();
  if (pageId === 'timer' && window.loadTimer) window.loadTimer();
  if (pageId === 'dashboard') {
    if (window.loadKanban) window.loadKanban();
    if (window.loadTimer) window.loadTimer();
  }
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const pageId = item.getAttribute('data-page');
    if (pageId) navigateTo(pageId);
  });
});

// GÖREV MODALİ
document.getElementById('btnNewTask')?.addEventListener('click', () => window.openCreateModal?.());
document.getElementById('btnCloseTaskModal')?.addEventListener('click', () => window.closeTaskModal?.());
document.getElementById('btnCancelTask')?.addEventListener('click', () => window.closeTaskModal?.());
document.getElementById('btnSaveTask')?.addEventListener('click', () => window.saveTask?.());
document.getElementById('taskTitleInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.saveTask?.(); });

// DETAY MODALİ
document.getElementById('btnCloseDetailModal')?.addEventListener('click', () => window.closeDetailModal?.());
document.getElementById('btnCloseDetail')?.addEventListener('click', () => window.closeDetailModal?.());
document.getElementById('btnAddFile')?.addEventListener('click', () => window.addFile?.());
document.getElementById('btnAddComment')?.addEventListener('click', () => window.addComment?.());
document.getElementById('commentInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) window.addComment?.();
});

// ZAMANLAYICI
document.getElementById('btnStartTimer')?.addEventListener('click', () => window.startTimer?.());
document.getElementById('btnStopTimer')?.addEventListener('click', () => window.stopTimer?.());
document.getElementById('btnResetTimer')?.addEventListener('click', () => window.resetTimer?.());

navigateTo('dashboard');
updateMaximizeIcon();

// navigateTo'yu global expose et (timer.js kullanıyor)
window.navigateTo = navigateTo;

// VAULT BUTONLARI
document.getElementById('btnSubmitMasterKey')?.addEventListener('click', () => window.submitMasterKey?.());
document.getElementById('btnLockVault')?.addEventListener('click', () => {
  window.lockVault?.();
  document.getElementById('vaultHeaderBtns').style.display = 'none';
});
document.getElementById('btnNewVaultEntry')?.addEventListener('click', () => window.openNewVaultEntry?.());
document.getElementById('btnCloseVaultModal')?.addEventListener('click', () => window.closeVaultModal?.());
document.getElementById('btnCancelVault')?.addEventListener('click', () => window.closeVaultModal?.());
document.getElementById('btnSaveVault')?.addEventListener('click', () => window.saveVaultEntry?.());

// Vault açılınca header butonlarını göster
const origNavigateTo = window.navigateTo;
window.navigateTo = function(pageId) {
  origNavigateTo(pageId);
  if (pageId === 'reports' && window.loadReports) window.loadReports();
  if (pageId === 'vault' && window.loadVault) {
    window.loadVault().then(() => {
      // Kasa açıksa butonları göster
      setTimeout(() => {
        const isUnlocked = document.getElementById('vaultContent')?.classList.contains('active');
        if (document.getElementById('vaultHeaderBtns'))
          document.getElementById('vaultHeaderBtns').style.display = isUnlocked ? 'flex' : 'none';
      }, 200);
    });
  }
};

// RAPOR BUTONLARI
document.getElementById('btnRefreshReport')?.addEventListener('click', () => window.loadReports?.());
document.getElementById('btnExportPDF')?.addEventListener('click', () => window.exportPDF?.());