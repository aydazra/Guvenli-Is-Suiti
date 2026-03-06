// ==========================================
// MODÜL C: ŞİFRELİ VERİ KASASI
// ==========================================

let masterKey = null;
let vaultEntries = [];
let editingVaultId = null;

// ==========================================
// MASTER KEY GİRİŞİ
// ==========================================

async function submitMasterKey() {
  const input = document.getElementById('masterKeyInput');
  const key = input?.value.trim();
  if (!key || key.length < 4) {
    showVaultError('Master Key en az 4 karakter olmalıdır.');
    return;
  }

  // Kasa dolu mu? Varsa doğrulama yapamayız (salt aynı kalır, her key "çalışır")
  // Ama var olan bir kaydı çözmeye çalışarak doğrulayabiliriz
  const entries = await api.vaultGetAll();
  if (entries.length > 0) {
    // Var olan bir kaydı çözmeyi dene
    const test = await api.vaultGet(entries[0].id, key);
    if (test?.error) {
      showVaultError('Yanlış Master Key! Lütfen tekrar deneyin.');
      input.value = '';
      input.focus();
      return;
    }
  }

  masterKey = key;
  input.value = '';
  document.getElementById('vaultLockScreen').classList.remove('active');
  document.getElementById('vaultContent').classList.add('active');
  await loadVaultEntries();
}

function lockVault() {
  masterKey = null;
  vaultEntries = [];
  document.getElementById('vaultLockScreen').classList.add('active');
  document.getElementById('vaultContent').classList.remove('active');
  document.getElementById('masterKeyInput').value = '';
  document.getElementById('masterKeyInput').focus();
}

function showVaultError(msg) {
  const el = document.getElementById('vaultKeyError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  setTimeout(() => { if (el) el.style.display = 'none'; }, 3000);
}

// ==========================================
// KASA KAYITLARI
// ==========================================

async function loadVaultEntries() {
  vaultEntries = await api.vaultGetAll();
  renderVaultList();
  // Dashboard'u güncelle
  const stats = await api.dashboardStats();
  const el = document.getElementById('statSecrets');
  if (el) el.textContent = stats.secrets;
}

function renderVaultList() {
  const list = document.getElementById('vaultList');
  if (!list) return;
  list.innerHTML = '';

  if (!vaultEntries.length) {
    list.innerHTML = '<div class="vault-empty">🔐 Henüz şifreli not yok. Yeni ekleyin!</div>';
    return;
  }

  vaultEntries.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'vault-item';
    const date = new Date(entry.updated_at).toLocaleDateString('tr-TR');
    item.innerHTML = `
      <div class="vault-item-info">
        <div class="vault-item-title">🔒 ${escapeHtml(entry.title)}</div>
        <div class="vault-item-date">${date}</div>
      </div>
      <div class="vault-item-actions">
        <button class="task-btn vault-view-btn" data-id="${entry.id}" title="Görüntüle/Düzenle">👁️</button>
        <button class="task-btn task-btn-danger vault-del-btn" data-id="${entry.id}" title="Sil">🗑️</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.vault-view-btn').forEach(btn => {
    btn.addEventListener('click', () => openVaultEntry(parseInt(btn.dataset.id)));
  });
  list.querySelectorAll('.vault-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteVaultEntry(parseInt(btn.dataset.id)));
  });
}

// ==========================================
// KAYIT OLUŞTUR / DÜZENLE
// ==========================================

function openNewVaultEntry() {
  editingVaultId = null;
  document.getElementById('vaultModalTitle').textContent = '🔐 Yeni Şifreli Not';
  document.getElementById('vaultTitleInput').value = '';
  document.getElementById('vaultContentInput').value = '';
  document.getElementById('vaultModal').classList.add('open');
  document.getElementById('vaultTitleInput').focus();
}

async function openVaultEntry(id) {
  const entry = await api.vaultGet(id, masterKey);
  if (!entry || entry.error) {
    alert('Kayıt okunamadı: ' + (entry?.error || 'Bilinmeyen hata'));
    return;
  }
  editingVaultId = id;
  document.getElementById('vaultModalTitle').textContent = '✏️ Şifreli Notu Düzenle';
  document.getElementById('vaultTitleInput').value = entry.title;
  document.getElementById('vaultContentInput').value = entry.content;
  document.getElementById('vaultModal').classList.add('open');
  document.getElementById('vaultTitleInput').focus();
}

function closeVaultModal() {
  document.getElementById('vaultModal').classList.remove('open');
  // İçeriği hemen temizle (güvenlik)
  document.getElementById('vaultContentInput').value = '';
  document.getElementById('vaultTitleInput').value = '';
  editingVaultId = null;
}

async function saveVaultEntry() {
  const title = document.getElementById('vaultTitleInput').value.trim();
  const content = document.getElementById('vaultContentInput').value.trim();
  if (!title) { alert('Başlık zorunludur.'); return; }
  if (!content) { alert('İçerik boş olamaz.'); return; }

  if (editingVaultId) {
    await api.vaultUpdate(editingVaultId, title, content, masterKey);
  } else {
    await api.vaultCreate(title, content, masterKey);
  }
  closeVaultModal();
  await loadVaultEntries();
}

async function deleteVaultEntry(id) {
  if (!confirm('Bu şifreli notu silmek istiyor musunuz? Bu işlem geri alınamaz!')) return;
  await api.vaultDelete(id);
  await loadVaultEntries();
}

// ==========================================
// YARDIMCI
// ==========================================

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Modal dışına tıklayınca kapat
document.getElementById('vaultModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'vaultModal') closeVaultModal();
});

// Enter ile master key gönder
document.getElementById('masterKeyInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitMasterKey();
});

// Global expose
window.submitMasterKey = submitMasterKey;
window.lockVault = lockVault;
window.openNewVaultEntry = openNewVaultEntry;
window.openVaultEntry = openVaultEntry;
window.closeVaultModal = closeVaultModal;
window.saveVaultEntry = saveVaultEntry;
window.deleteVaultEntry = deleteVaultEntry;

window.loadVault = async function() {
  // Kasa kilitliyse kilit ekranını göster, açıksa listeyi yenile
  if (!masterKey) {
    document.getElementById('vaultLockScreen').classList.add('active');
    document.getElementById('vaultContent').classList.remove('active');
    setTimeout(() => document.getElementById('masterKeyInput')?.focus(), 100);
  } else {
    await loadVaultEntries();
  }
};