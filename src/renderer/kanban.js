// ==========================================
// MODÜL A: KANBAN GÖREV YÖNETİMİ
// ==========================================

// State
let tasks = [];
let draggedTaskId = null;
let editingTaskId = null;
let detailTaskId = null;

// ==========================================
// VERİ YÜKLEMESİ
// ==========================================

async function loadTasks() {
  tasks = await api.tasksGetAll();
  renderBoard();
  updateDashboardStats();
}

// ==========================================
// KANBAN BOARD RENDER
// ==========================================

const COLUMNS = [
  { id: 'todo',       label: '📋 Yapılacaklar', color: '#4f8ef7' },
  { id: 'inprogress', label: '⚡ Sürüyor',       color: '#f0a050' },
  { id: 'done',       label: '✅ Tamamlandı',    color: '#4caf7d' }
];

function renderBoard() {
  COLUMNS.forEach(col => {
    const container = document.getElementById(`col-${col.id}`);
    if (!container) return;
    container.innerHTML = '';
    const colTasks = tasks.filter(t => t.status === col.id);
    const counter = document.getElementById(`count-${col.id}`);
    if (counter) counter.textContent = String(colTasks.length);
    colTasks.forEach(task => container.appendChild(createTaskCard(task)));
  });
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;

  const pColors = { low: '#4caf7d', medium: '#f0a050', high: '#e05c5c' };
  const pLabels = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' };
  const fileCount = task.file_count || 0;
  const commentCount = task.comment_count || 0;

  card.innerHTML = `
    <div class="task-priority-bar" style="background:${pColors[task.priority]}"></div>
    <div class="task-body">
      <div class="task-meta-top">
        <span class="task-project">📁 ${escapeHtml(task.project || 'Genel')}</span>
      </div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
      <div class="task-footer">
        <div class="task-badges">
          <span class="task-badge" style="background:${pColors[task.priority]}22;color:${pColors[task.priority]}">${pLabels[task.priority]}</span>
          ${fileCount > 0 ? `<span class="task-badge-icon" title="${fileCount} dosya">📎 ${fileCount}</span>` : ''}
          ${commentCount > 0 ? `<span class="task-badge-icon" title="${commentCount} yorum">💬 ${commentCount}</span>` : ''}
        </div>
        <div class="task-actions">
          <button class="task-btn" data-action="start-timer" title="Zamanlayıcı Başlat">▶</button>
          <button class="task-btn" data-action="detail" data-id="${task.id}" title="Detay & Dosyalar">📎</button>
          <button class="task-btn" data-action="edit" data-id="${task.id}" title="Düzenle">✏️</button>
          <button class="task-btn task-btn-danger" data-action="delete" data-id="${task.id}" title="Sil">🗑️</button>
        </div>
      </div>
    </div>
  `;

  // Event delegation
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      const id = parseInt(btn.getAttribute('data-id'));
      if (action === 'start-timer') window.startTimerForTask?.(id, tasks.find(t=>t.id===id)?.title);
      if (action === 'detail') openTaskDetail(id);
      if (action === 'edit') openEditModal(id);
      if (action === 'delete') deleteTask(id);
    });
  });

  // Sürükle-bırak
  card.addEventListener('dragstart', (e) => {
    draggedTaskId = task.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedTaskId = null;
  });

  return card;
}

// ==========================================
// SÜRÜKLE-BIRAK
// ==========================================

document.querySelectorAll('.kanban-column').forEach(col => {
  col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
  col.addEventListener('drop', async (e) => {
    e.preventDefault();
    col.classList.remove('drag-over');
    if (draggedTaskId === null) return;
    await api.tasksUpdate(draggedTaskId, { status: col.dataset.status });
    await loadTasks();
  });
});

// ==========================================
// GÖREV OLUŞTUR / DÜZENLE MODALİ
// ==========================================

function openCreateModal() {
  editingTaskId = null;
  document.getElementById('modalTitle').textContent = '➕ Yeni Görev';
  document.getElementById('taskTitleInput').value = '';
  document.getElementById('taskDescInput').value = '';
  document.getElementById('taskProjectInput').value = 'Genel';
  document.getElementById('taskNotesInput').value = '';
  document.getElementById('taskPriorityInput').value = 'medium';
  document.getElementById('taskStatusInput').value = 'todo';
  document.getElementById('taskModal').classList.add('open');
  document.getElementById('taskTitleInput').focus();
}

function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  document.getElementById('modalTitle').textContent = '✏️ Görevi Düzenle';
  document.getElementById('taskTitleInput').value = task.title;
  document.getElementById('taskDescInput').value = task.description || '';
  document.getElementById('taskProjectInput').value = task.project || 'Genel';
  document.getElementById('taskNotesInput').value = task.notes || '';
  document.getElementById('taskPriorityInput').value = task.priority;
  document.getElementById('taskStatusInput').value = task.status;
  document.getElementById('taskModal').classList.add('open');
  document.getElementById('taskTitleInput').focus();
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
}

async function saveTask() {
  const title = document.getElementById('taskTitleInput').value.trim();
  if (!title) { alert('Görev başlığı zorunludur.'); return; }

  const input = {
    title,
    description: document.getElementById('taskDescInput').value.trim(),
    project: document.getElementById('taskProjectInput').value.trim() || 'Genel',
    notes: document.getElementById('taskNotesInput').value.trim(),
    priority: document.getElementById('taskPriorityInput').value,
    status: document.getElementById('taskStatusInput').value
  };

  if (editingTaskId) {
    await api.tasksUpdate(editingTaskId, input);
  } else {
    await api.tasksCreate(input);
  }
  closeTaskModal();
  await loadTasks();
}

async function deleteTask(taskId) {
  if (!confirm('Bu görevi silmek istiyor musunuz?')) return;
  await api.tasksDelete(taskId);
  await loadTasks();
}

// ==========================================
// DETAY MODALİ (Dosyalar + Yorumlar)
// ==========================================

async function openTaskDetail(taskId) {
  detailTaskId = taskId;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('detailTaskTitle').textContent = task.title;
  document.getElementById('detailTaskProject').textContent = `📁 ${task.project || 'Genel'}`;
  document.getElementById('detailModal').classList.add('open');
  await loadTaskFiles();
  await loadTaskComments();
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('open');
  detailTaskId = null;
}

// --- DOSYALAR ---
async function loadTaskFiles() {
  const files = await api.tasksGetFiles(detailTaskId);
  const list = document.getElementById('fileList');
  list.innerHTML = '';

  if (!files.length) {
    list.innerHTML = '<p class="no-files">Henüz dosya eklenmemiş.</p>';
    return;
  }

  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    const safePath = file.stored_path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    item.innerHTML = `
      <span class="file-icon">📄</span>
      <div class="file-info">
        <span class="file-name" title="${escapeHtml(file.stored_path)}">${escapeHtml(file.filename)}</span>
        <span class="file-size">${formatSize(file.size)} • 📁 ${escapeHtml(file.project)}</span>
      </div>
      <div class="file-actions">
        <button class="task-btn" data-path="${escapeHtml(file.stored_path)}" data-action="open-file" title="Aç">🔗</button>
        <button class="task-btn task-btn-danger" data-fileid="${file.id}" data-action="del-file" title="Kaldır">🗑️</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'open-file') api.tasksOpenFile(btn.dataset.path);
      if (btn.dataset.action === 'del-file') removeFile(parseInt(btn.dataset.fileid));
    });
  });
}

async function addFile() {
  if (!detailTaskId) return;
  const task = tasks.find(t => t.id === detailTaskId);
  const project = task?.project || 'Genel';
  const result = await api.tasksAddFile(detailTaskId, project);
  if (result) {
    await loadTaskFiles();
    await loadTasks(); // file_count güncelle
  }
}

async function removeFile(fileId) {
  await api.tasksDeleteFile(fileId);
  await loadTaskFiles();
  await loadTasks();
}

// --- YORUMLAR ---
async function loadTaskComments() {
  const comments = await api.tasksGetComments(detailTaskId);
  const list = document.getElementById('commentList');
  list.innerHTML = '';

  if (!comments.length) {
    list.innerHTML = '<p class="no-files">Henüz yorum yok.</p>';
    return;
  }

  comments.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    const date = new Date(c.created_at).toLocaleString('tr-TR');
    item.innerHTML = `
      <div class="comment-header">
        <span class="comment-date">${date}</span>
        <button class="task-btn task-btn-danger" data-cid="${c.id}" data-action="del-comment" title="Sil">🗑️</button>
      </div>
      <div class="comment-content">${escapeHtml(c.content)}</div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-action="del-comment"]').forEach(btn => {
    btn.addEventListener('click', () => deleteComment(parseInt(btn.dataset.cid)));
  });
}

async function addComment() {
  const input = document.getElementById('commentInput');
  const content = input?.value.trim();
  if (!content || !detailTaskId) return;
  await api.tasksAddComment(detailTaskId, content);
  input.value = '';
  await loadTaskComments();
  await loadTasks();
}

async function deleteComment(commentId) {
  await api.tasksDeleteComment(commentId);
  await loadTaskComments();
  await loadTasks();
}

// ==========================================
// DASHBOARD
// ==========================================

async function updateDashboardStats() {
  const stats = await api.dashboardStats();
  const el1 = document.getElementById('statTasks');
  const el2 = document.getElementById('statDone');
  if (el1) el1.textContent = stats.active;
  if (el2) el2.textContent = stats.done;
}

// ==========================================
// YARDIMCI
// ==========================================

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Modal dışına tıklayınca kapat
document.getElementById('taskModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'taskModal') closeTaskModal();
});
document.getElementById('detailModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') closeDetailModal();
});

// Enter ile kaydet
document.getElementById('taskTitleInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveTask();
});

// Global expose
window.openCreateModal = openCreateModal;
window.openEditModal = openEditModal;
window.closeTaskModal = closeTaskModal;
window.saveTask = saveTask;
window.deleteTask = deleteTask;
window.openTaskDetail = openTaskDetail;
window.closeDetailModal = closeDetailModal;
window.addFile = addFile;
window.removeFile = removeFile;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.loadKanban = loadTasks;