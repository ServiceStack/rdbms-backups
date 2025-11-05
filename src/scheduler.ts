import cron from 'node-cron';
import type { BackupScheduleType } from './types';
import { config } from './config';
import { BackupEngine } from './backup';
import { RetentionEngine } from './retention';

export class BackupScheduler {
  private backupEngine: BackupEngine;
  private retentionEngine: RetentionEngine;
  private tasks: Map<BackupScheduleType, cron.ScheduledTask> = new Map();

  constructor(backupEngine: BackupEngine, retentionEngine: RetentionEngine) {
    this.backupEngine = backupEngine;
    this.retentionEngine = retentionEngine;
  }

  start() {
    const schedules = config.backup.schedules;

    for (const [type, schedule] of Object.entries(schedules)) {
      if (!schedule.enabled) {
        console.log(`Scheduler: ${type} backups are disabled`);
        continue;
      }

      if (!cron.validate(schedule.cron)) {
        console.error(`Scheduler: Invalid cron expression for ${type}: ${schedule.cron}`);
        continue;
      }

      const task = cron.schedule(schedule.cron, async () => {
        console.log(`\n=== Running scheduled ${type} backup ===`);
        try {
          const backupId = await this.backupEngine.performBackup(type as BackupScheduleType);
          console.log(`Backup completed: ID ${backupId}`);

          // Enforce hierarchical cleanup
          await this.retentionEngine.enforceHierarchicalCleanup(type as BackupScheduleType);

          // Enforce retention policy
          await this.retentionEngine.enforceRetention(type as BackupScheduleType);

          console.log(`=== ${type} backup completed successfully ===\n`);
        } catch (error) {
          console.error(`Scheduled ${type} backup failed:`, error);
        }
      });

      this.tasks.set(type as BackupScheduleType, task);
      console.log(`Scheduler: ${type} backups scheduled with cron: ${schedule.cron}`);
    }

    console.log('Backup scheduler started');
  }

  stop() {
    for (const [type, task] of this.tasks.entries()) {
      task.stop();
      console.log(`Scheduler: ${type} backups stopped`);
    }
    this.tasks.clear();
  }

  async runManualBackup(type: BackupScheduleType): Promise<number> {
    console.log(`\n=== Running manual ${type} backup ===`);
    const backupId = await this.backupEngine.performBackup(type);
    console.log(`Backup completed: ID ${backupId}`);

    // Enforce hierarchical cleanup
    await this.retentionEngine.enforceHierarchicalCleanup(type);

    // Enforce retention policy
    await this.retentionEngine.enforceRetention(type);

    console.log(`=== ${type} backup completed successfully ===\n`);
    return backupId;
  }
}
