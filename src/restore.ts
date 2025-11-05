import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { config } from './config';
import { BackupDatabase } from './database';
import { downloadFromS3 } from './s3';

export class RestoreEngine {
  private db: BackupDatabase;

  constructor(db: BackupDatabase) {
    this.db = db;
  }

  async restoreFromLocal(backupId: number): Promise<void> {
    const backup = this.db.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    if (!existsSync(backup.filepath)) {
      throw new Error(`Backup file not found: ${backup.filepath}`);
    }

    await this.executeRestore(backup.filepath);
  }

  async restoreFromS3(backupId: number, downloadPath: string): Promise<void> {
    const backup = this.db.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    if (!backup.s3Key) {
      throw new Error(`Backup ${backupId} has no S3 key`);
    }

    console.log(`Downloading backup from S3: ${backup.s3Key}`);
    await downloadFromS3(backup.s3Key, downloadPath);

    console.log('Restoring from downloaded backup');
    await this.executeRestore(downloadPath);
  }

  async restoreFromFile(filepath: string): Promise<void> {
    if (!existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    await this.executeRestore(filepath);
  }

  private executeRestore(filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { type, host, port, username, password, database } = config.database;

      let command: string;
      let args: string[];
      let env = { ...process.env };

      if (type === 'postgresql') {
        command = 'psql';
        args = [
          '-h', host,
          '-p', port.toString(),
          '-U', username,
          '-d', database,
          '-f', filepath,
        ];
        env.PGPASSWORD = password;
      } else if (type === 'mysql') {
        command = 'mysql';
        args = [
          '-h', host,
          '-P', port.toString(),
          '-u', username,
          database,
        ];
        env.MYSQL_PWD = password;

        // For MySQL, we need to pipe the file content
        const fs = require('fs');
        const readStream = fs.createReadStream(filepath);

        const process = spawn(command, args, { env });

        let stderr = '';

        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        readStream.pipe(process.stdin);

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Restore process exited with code ${code}: ${stderr}`));
          }
        });

        process.on('error', (error) => {
          reject(new Error(`Failed to start restore process: ${error.message}`));
        });

        return;
      } else {
        reject(new Error(`Unsupported database type: ${type}`));
        return;
      }

      const process = spawn(command, args, { env });

      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Restore process exited with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start restore process: ${error.message}`));
      });
    });
  }
}
