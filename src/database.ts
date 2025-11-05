import { Database } from 'bun:sqlite';
import type { BackupRecord, BackupLog } from './types';

export class BackupDatabase {
  private db: Database;

  constructor(dbPath: string = './backups.db') {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        size INTEGER NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        s3Uploaded INTEGER NOT NULL DEFAULT 0,
        s3Key TEXT
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backupId INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        FOREIGN KEY (backupId) REFERENCES backups(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(type);
      CREATE INDEX IF NOT EXISTS idx_backups_startTime ON backups(startTime);
      CREATE INDEX IF NOT EXISTS idx_logs_backupId ON logs(backupId);
    `);
  }

  get db_internal() {
    return this.db;
  }

  insertBackup(backup: Omit<BackupRecord, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO backups (type, filename, filepath, size, startTime, endTime, duration, status, error, s3Uploaded, s3Key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      backup.type,
      backup.filename,
      backup.filepath,
      backup.size,
      backup.startTime,
      backup.endTime,
      backup.duration,
      backup.status,
      backup.error || null,
      backup.s3Uploaded ? 1 : 0,
      backup.s3Key || null
    );

    return Number(result.lastInsertRowid);
  }

  insertLog(log: Omit<BackupLog, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO logs (backupId, timestamp, level, message)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(log.backupId, log.timestamp, log.level, log.message);
    return Number(result.lastInsertRowid);
  }

  getBackups(limit?: number): BackupRecord[] {
    let query = 'SELECT * FROM backups ORDER BY startTime DESC';
    if (limit) query += ` LIMIT ${limit}`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      ...row,
      s3Uploaded: row.s3Uploaded === 1,
    }));
  }

  getBackupsByType(type: string): BackupRecord[] {
    const stmt = this.db.prepare('SELECT * FROM backups WHERE type = ? ORDER BY startTime DESC');
    const rows = stmt.all(type) as any[];

    return rows.map(row => ({
      ...row,
      s3Uploaded: row.s3Uploaded === 1,
    }));
  }

  getBackup(id: number): BackupRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM backups WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return undefined;

    return {
      ...row,
      s3Uploaded: row.s3Uploaded === 1,
    };
  }

  getLogs(backupId: number): BackupLog[] {
    const stmt = this.db.prepare('SELECT * FROM logs WHERE backupId = ? ORDER BY timestamp ASC');
    return stmt.all(backupId) as BackupLog[];
  }

  deleteBackup(id: number): void {
    const stmt = this.db.prepare('DELETE FROM backups WHERE id = ?');
    stmt.run(id);
  }

  deleteBackupsBefore(type: string, date: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM backups WHERE type = ? AND startTime < ?');
    const before = stmt.get(type, date) as any;
    const deleteStmt = this.db.prepare('DELETE FROM backups WHERE type = ? AND startTime < ?');
    deleteStmt.run(type, date);
    return before.count;
  }

  close() {
    this.db.close();
  }
}
