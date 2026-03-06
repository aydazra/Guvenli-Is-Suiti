import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const DB_DIR = path.join(app.getPath('userData'), 'data');
const DB_PATH = path.join(DB_DIR, 'guvenli-is-suiti.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ==========================================
// TABLOLAR
// ==========================================

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'todo',
    priority    TEXT    NOT NULL DEFAULT 'medium',
    project     TEXT    NOT NULL DEFAULT 'Genel',
    notes       TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL,
    project     TEXT    NOT NULL DEFAULT 'Genel',
    filename    TEXT    NOT NULL,
    stored_path TEXT    NOT NULL,
    size        INTEGER NOT NULL DEFAULT 0,
    added_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS time_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER,
    description TEXT    DEFAULT '',
    started_at  TEXT    NOT NULL,
    ended_at    TEXT,
    duration    INTEGER DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
  );
`);

// Migration: Eski tabloya yeni kolonları ekle (varsa hata vermez)
try { db.exec(`ALTER TABLE tasks ADD COLUMN project TEXT NOT NULL DEFAULT 'Genel'`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE task_files ADD COLUMN project TEXT NOT NULL DEFAULT 'Genel'`); } catch {}

// ==========================================
// TİP TANIMLARI
// ==========================================

export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'inprogress' | 'done';
  priority: 'low' | 'medium' | 'high';
  project: string;
  notes: string;
  created_at: string;
  updated_at: string;
  file_count?: number;
  comment_count?: number;
}

export interface TaskFile {
  id: number;
  task_id: number;
  project: string;
  filename: string;
  stored_path: string;
  size: number;
  added_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  project?: string;
  notes?: string;
}

export interface TimeLog {
  id: number;
  task_id: number | null;
  task_title?: string;
  description: string;
  started_at: string;
  ended_at: string | null;
  duration: number;
}

// ==========================================
// TASK CRUD
// ==========================================

export function getAllTasks(): Task[] {
  return db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM task_files WHERE task_id = t.id) as file_count,
      (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) as comment_count
    FROM tasks t
    ORDER BY t.created_at DESC
  `).all() as Task[];
}

export function createTask(input: CreateTaskInput): Task {
  const result = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, project, notes)
    VALUES (@title, @description, @status, @priority, @project, @notes)
  `).run({
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    project: input.project ?? 'Genel',
    notes: input.notes ?? ''
  });
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) as Task;
}

export function updateTask(id: number, fields: Partial<CreateTaskInput>): Task | null {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  if (!task) return null;
  db.prepare(`
    UPDATE tasks SET
      title=@title, description=@description, status=@status,
      priority=@priority, project=@project, notes=@notes,
      updated_at=datetime('now')
    WHERE id=@id
  `).run({
    title: fields.title ?? task.title,
    description: fields.description ?? task.description,
    status: fields.status ?? task.status,
    priority: fields.priority ?? task.priority,
    project: fields.project ?? task.project,
    notes: fields.notes ?? task.notes,
    id
  });
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
}

export function deleteTask(id: number): boolean {
  return (db.prepare('DELETE FROM tasks WHERE id = ?').run(id)).changes > 0;
}

// ==========================================
// DOSYA İŞLEMLERİ
// ==========================================

export function getTaskFiles(taskId: number): TaskFile[] {
  return db.prepare('SELECT * FROM task_files WHERE task_id = ? ORDER BY added_at DESC').all(taskId) as TaskFile[];
}

export function addTaskFile(taskId: number, project: string, filename: string, storedPath: string, size: number): TaskFile {
  const result = db.prepare(`
    INSERT INTO task_files (task_id, project, filename, stored_path, size)
    VALUES (?, ?, ?, ?, ?)
  `).run(taskId, project, filename, storedPath, size);
  return db.prepare('SELECT * FROM task_files WHERE id = ?').get(result.lastInsertRowid) as TaskFile;
}

export function deleteTaskFile(fileId: number): boolean {
  return (db.prepare('DELETE FROM task_files WHERE id = ?').run(fileId)).changes > 0;
}

// ==========================================
// YORUM İŞLEMLERİ
// ==========================================

export function getTaskComments(taskId: number): TaskComment[] {
  return db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as TaskComment[];
}

export function addTaskComment(taskId: number, content: string): TaskComment {
  const result = db.prepare(`
    INSERT INTO task_comments (task_id, content) VALUES (?, ?)
  `).run(taskId, content);
  return db.prepare('SELECT * FROM task_comments WHERE id = ?').get(result.lastInsertRowid) as TaskComment;
}

export function deleteTaskComment(commentId: number): boolean {
  return (db.prepare('DELETE FROM task_comments WHERE id = ?').run(commentId)).changes > 0;
}

// ==========================================
// DASHBOARD
// ==========================================

export function getDashboardStats(): { active: number; done: number; secrets: number } {
  const active = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status != 'done'").get() as { cnt: number }).cnt;
  const done = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done'").get() as { cnt: number }).cnt;
  return { active, done, secrets: 0 };
}

// ==========================================
// ZAMAN LOGU
// ==========================================

export function startTimeLog(description: string, taskId: number | null): number {
  const result = db.prepare(`
    INSERT INTO time_logs (task_id, description, started_at) VALUES (?, ?, datetime('now'))
  `).run(taskId, description);
  return result.lastInsertRowid as number;
}

export function stopTimeLog(logId: number, duration: number): void {
  db.prepare(`UPDATE time_logs SET ended_at=datetime('now'), duration=? WHERE id=?`).run(duration, logId);
}

export function getAllTimeLogs(): TimeLog[] {
  return db.prepare(`
    SELECT tl.*, t.title as task_title FROM time_logs tl
    LEFT JOIN tasks t ON tl.task_id = t.id
    WHERE tl.ended_at IS NOT NULL
    ORDER BY tl.started_at DESC LIMIT 100
  `).all() as TimeLog[];
}

export function deleteTimeLog(logId: number): boolean {
  return (db.prepare('DELETE FROM time_logs WHERE id = ?').run(logId)).changes > 0;
}

export function getTodayStats(): { totalSeconds: number; sessionCount: number } {
  return db.prepare(`
    SELECT COALESCE(SUM(duration),0) as totalSeconds, COUNT(*) as sessionCount
    FROM time_logs WHERE date(started_at)=date('now') AND ended_at IS NOT NULL
  `).get() as { totalSeconds: number; sessionCount: number };
}

export default db;

// ==========================================
// MODÜL C: ŞİFRELİ KASA
// ==========================================

export interface VaultEntry {
  id: number;
  title: string;
  content_encrypted: string; // AES-256 şifreli
  iv: string;                // Initialization vector
  created_at: string;
  updated_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS vault_entries (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    title             TEXT NOT NULL,
    content_encrypted TEXT NOT NULL,
    iv                TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function getAllVaultEntries(): Omit<VaultEntry, 'content_encrypted' | 'iv'>[] {
  return db.prepare(`
    SELECT id, title, created_at, updated_at FROM vault_entries ORDER BY updated_at DESC
  `).all() as Omit<VaultEntry, 'content_encrypted' | 'iv'>[];
}

export function getVaultEntry(id: number): VaultEntry | null {
  return db.prepare('SELECT * FROM vault_entries WHERE id = ?').get(id) as VaultEntry | null;
}

export function createVaultEntry(title: string, encryptedContent: string, iv: string): VaultEntry {
  const result = db.prepare(`
    INSERT INTO vault_entries (title, content_encrypted, iv) VALUES (?, ?, ?)
  `).run(title, encryptedContent, iv);
  return db.prepare('SELECT * FROM vault_entries WHERE id = ?').get(result.lastInsertRowid) as VaultEntry;
}

export function updateVaultEntry(id: number, title: string, encryptedContent: string, iv: string): boolean {
  const result = db.prepare(`
    UPDATE vault_entries SET title=?, content_encrypted=?, iv=?, updated_at=datetime('now') WHERE id=?
  `).run(title, encryptedContent, iv, id);
  return result.changes > 0;
}

export function deleteVaultEntry(id: number): boolean {
  return (db.prepare('DELETE FROM vault_entries WHERE id = ?').run(id)).changes > 0;
}

export function getVaultCount(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM vault_entries').get() as { cnt: number }).cnt;
}

// ==========================================
// MODÜL D: RAPORLAMA
// ==========================================

export interface WeeklyReport {
  days: { date: string; label: string; totalSeconds: number; sessionCount: number }[];
  totalSeconds: number;
  totalSessions: number;
  taskStats: { status: string; count: number }[];
  topTasks: { title: string; project: string; totalSeconds: number }[];
}

export function getWeeklyReport(): WeeklyReport {
  // Son 7 günün verisi
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const row = db.prepare(`
      SELECT
        date('now', '-' || ? || ' days') as date,
        COALESCE(SUM(duration), 0) as totalSeconds,
        COUNT(*) as sessionCount
      FROM time_logs
      WHERE date(started_at) = date('now', '-' || ? || ' days')
      AND ended_at IS NOT NULL
    `).get(i, i) as { date: string; totalSeconds: number; sessionCount: number };

    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
    days.push({ date: row.date, label, totalSeconds: row.totalSeconds, sessionCount: row.sessionCount });
  }

  const totals = db.prepare(`
    SELECT COALESCE(SUM(duration),0) as totalSeconds, COUNT(*) as totalSessions
    FROM time_logs
    WHERE date(started_at) >= date('now', '-6 days') AND ended_at IS NOT NULL
  `).get() as { totalSeconds: number; totalSessions: number };

  const taskStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `).all() as { status: string; count: number }[];

  const topTasks = db.prepare(`
    SELECT t.title, t.project, COALESCE(SUM(tl.duration),0) as totalSeconds
    FROM tasks t
    LEFT JOIN time_logs tl ON tl.task_id = t.id AND tl.ended_at IS NOT NULL
    GROUP BY t.id ORDER BY totalSeconds DESC LIMIT 5
  `).all() as { title: string; project: string; totalSeconds: number }[];

  return {
    days,
    totalSeconds: totals.totalSeconds,
    totalSessions: totals.totalSessions,
    taskStats,
    topTasks
  };
}