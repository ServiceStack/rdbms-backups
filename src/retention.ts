import type { BackupScheduleType, RetentionConfig } from './types';
import { BackupDatabase } from './database';
import { BackupEngine } from './backup';
import { config } from './config';
import { deleteFromS3 } from './s3';

export class RetentionEngine {
  private db: BackupDatabase;
  private backupEngine: BackupEngine;

  constructor(db: BackupDatabase, backupEngine: BackupEngine) {
    this.db = db;
    this.backupEngine = backupEngine;
  }

  async enforceRetention(type: BackupScheduleType): Promise<void> {
    const schedule = config.backup.schedules[type];
    if (!schedule.enabled) return;

    const { count, unit } = schedule.retention;
    const cutoffDate = this.calculateCutoffDate(count, unit);

    console.log(`Enforcing retention for ${type}: keeping ${count} ${unit}, deleting before ${cutoffDate.toISOString()}`);

    const backups = this.db.getBackupsByType(type);
    const backupsToDelete = backups.filter(
      backup => new Date(backup.startTime) < cutoffDate && backup.status === 'success'
    );

    console.log(`Found ${backupsToDelete.length} ${type} backups to delete`);

    for (const backup of backupsToDelete) {
      console.log(`Deleting backup ${backup.id}: ${backup.filename}`);

      // Delete from S3 if uploaded
      if (backup.s3Uploaded && backup.s3Key) {
        try {
          await deleteFromS3(backup.s3Key);
          console.log(`Deleted from S3: ${backup.s3Key}`);
        } catch (error) {
          console.error(`Failed to delete from S3: ${backup.s3Key}`, error);
        }
      }

      // Delete local file
      this.backupEngine.deleteBackupFile(backup.filepath);

      // Delete from database
      this.db.deleteBackup(backup.id!);
    }
  }

  async enforceHierarchicalCleanup(type: BackupScheduleType): Promise<void> {
    // When a higher-level backup is created, delete lower-level backups before it
    const hierarchy: BackupScheduleType[] = ['hourly', 'daily', 'weekly', 'monthly'];
    const currentIndex = hierarchy.indexOf(type);

    if (currentIndex <= 0) return; // hourly has no lower level

    // Get the latest backup of this type
    const backups = this.db.getBackupsByType(type);
    if (backups.length === 0) return;

    const latestBackup = backups[0]; // Already ordered by startTime DESC
    const cutoffDate = new Date(latestBackup.startTime);

    console.log(`Hierarchical cleanup for ${type}: deleting lower-level backups before ${cutoffDate.toISOString()}`);

    // Delete all lower-level backups before this timestamp
    for (let i = 0; i < currentIndex; i++) {
      const lowerType = hierarchy[i];
      const lowerBackups = this.db.getBackupsByType(lowerType);

      const backupsToDelete = lowerBackups.filter(
        backup => new Date(backup.startTime) < cutoffDate
      );

      console.log(`Found ${backupsToDelete.length} ${lowerType} backups to delete due to ${type} backup`);

      for (const backup of backupsToDelete) {
        console.log(`Deleting backup ${backup.id}: ${backup.filename}`);

        // Delete from S3 if uploaded
        if (backup.s3Uploaded && backup.s3Key) {
          try {
            await deleteFromS3(backup.s3Key);
          } catch (error) {
            console.error(`Failed to delete from S3: ${backup.s3Key}`, error);
          }
        }

        // Delete local file
        this.backupEngine.deleteBackupFile(backup.filepath);

        // Delete from database
        this.db.deleteBackup(backup.id!);
      }
    }
  }

  private calculateCutoffDate(count: number, unit: 'hours' | 'days' | 'weeks' | 'months'): Date {
    const now = new Date();
    const cutoff = new Date(now);

    switch (unit) {
      case 'hours':
        cutoff.setHours(now.getHours() - count);
        break;
      case 'days':
        cutoff.setDate(now.getDate() - count);
        break;
      case 'weeks':
        cutoff.setDate(now.getDate() - count * 7);
        break;
      case 'months':
        cutoff.setMonth(now.getMonth() - count);
        break;
    }

    return cutoff;
  }
}
