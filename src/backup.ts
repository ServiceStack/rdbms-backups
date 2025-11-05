import { spawn } from 'child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { BackupScheduleType } from './types';
import { config } from './config';
import { BackupDatabase } from './database';
import { uploadToS3 } from './s3';

export class BackupEngine {
  private db: BackupDatabase;

  constructor(db: BackupDatabase) {
    this.db = db;
  }

  async performBackup(type: BackupScheduleType): Promise<number> {
    const startTime = new Date().toISOString();
    const timestamp = startTime.replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    const filename = `${config.database.database}_${type}_${timestamp}.sql`;
    const filepath = join(config.backup.localPath, filename);

    // Ensure backup directory exists
    if (!existsSync(config.backup.localPath)) {
      mkdirSync(config.backup.localPath, { recursive: true });
    }

    const backupId = this.db.insertBackup({
      type,
      filename,
      filepath,
      size: 0,
      startTime,
      endTime: startTime,
      duration: 0,
      status: 'success',
      s3Uploaded: false,
    });

    this.log(backupId, 'info', `Starting ${type} backup`);

    try {
      await this.executeBackup(backupId, filepath);

      const endTime = new Date().toISOString();
      const size = statSync(filepath).size;
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      this.log(backupId, 'info', `Backup completed. Size: ${this.formatBytes(size)}`);

      // Update backup record
      const stmt = this.db.db_internal.prepare(`
        UPDATE backups
        SET size = ?, endTime = ?, duration = ?, status = ?
        WHERE id = ?
      `);
      stmt.run(size, endTime, duration, 'success', backupId);

      // Upload to S3 if enabled
      if (config.s3.enabled) {
        await this.uploadBackupToS3(backupId, filepath, filename);
      }

      return backupId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(backupId, 'error', `Backup failed: ${errorMessage}`);

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      const stmt = this.db.db_internal.prepare(`
        UPDATE backups
        SET endTime = ?, duration = ?, status = ?, error = ?
        WHERE id = ?
      `);
      stmt.run(endTime, duration, 'failed', errorMessage, backupId);

      throw error;
    }
  }

  private executeBackup(backupId: number, filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { type, host, port, username, password, database } = config.database;

      let command: string;
      let args: string[];
      let env = { ...process.env };

      if (type === 'postgresql') {
        command = 'pg_dump';
        args = [
          '-h', host,
          '-p', port.toString(),
          '-U', username,
          '-d', database,
          '-f', filepath,
          '--format=plain',
          '--clean',
          '--if-exists',
        ];
        env.PGPASSWORD = password;
      } else if (type === 'mysql') {
        command = 'mysqldump';
        args = [
          '-h', host,
          '-P', port.toString(),
          '-u', username,
          database,
          '--result-file=' + filepath,
          '--single-transaction',
          '--quick',
          '--lock-tables=false',
        ];
        env.MYSQL_PWD = password;
      } else {
        reject(new Error(`Unsupported database type: ${type}`));
        return;
      }

      this.log(backupId, 'info', `Executing ${command}`);

      const process = spawn(command, args, { env });

      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Backup process exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start backup process: ${error.message}`));
      });
    });
  }

  private async uploadBackupToS3(backupId: number, filepath: string, filename: string): Promise<void> {
    try {
      this.log(backupId, 'info', 'Uploading backup to S3');
      const s3Key = await uploadToS3(filepath, filename);

      this.log(backupId, 'info', `Successfully uploaded to S3: ${s3Key}`);

      const stmt = this.db.db_internal.prepare(`
        UPDATE backups
        SET s3Uploaded = 1, s3Key = ?
        WHERE id = ?
      `);
      stmt.run(s3Key, backupId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(backupId, 'error', `S3 upload failed: ${errorMessage}`);
      // Don't fail the backup if S3 upload fails
    }
  }

  deleteBackupFile(filepath: string): void {
    try {
      if (existsSync(filepath)) {
        unlinkSync(filepath);
      }
    } catch (error) {
      console.error(`Failed to delete backup file ${filepath}:`, error);
    }
  }

  private log(backupId: number, level: 'info' | 'warn' | 'error', message: string): void {
    this.db.insertLog({
      backupId,
      timestamp: new Date().toISOString(),
      level,
      message,
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
