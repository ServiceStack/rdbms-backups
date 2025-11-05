import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import type { BackupScheduleType } from './types';
import { BackupDatabase } from './database';
import { BackupScheduler } from './scheduler';
import { RestoreEngine } from './restore';
import { listS3Backups, downloadFromS3 } from './s3';
import { config } from './config';
import { join } from 'path';
import { existsSync } from 'fs';

export function createApp(
  db: BackupDatabase,
  scheduler: BackupScheduler,
  restoreEngine: RestoreEngine
) {
  const app = new Hono();

  // Enable CORS
  app.use('/*', cors());

  // Serve static frontend files
  app.use('/assets/*', serveStatic({ root: './frontend/dist' }));
  app.get('/', serveStatic({ path: './frontend/dist/index.html' }));

  // API Routes

  // Get all backups
  app.get('/api/backups', (c) => {
    const limit = c.req.query('limit');
    const backups = db.getBackups(limit ? parseInt(limit) : undefined);
    return c.json(backups);
  });

  // Get backups by type
  app.get('/api/backups/type/:type', (c) => {
    const type = c.req.param('type');
    const backups = db.getBackupsByType(type);
    return c.json(backups);
  });

  // Get single backup
  app.get('/api/backups/:id', (c) => {
    const id = parseInt(c.req.param('id'));
    const backup = db.getBackup(id);
    if (!backup) {
      return c.json({ error: 'Backup not found' }, 404);
    }
    return c.json(backup);
  });

  // Get logs for a backup
  app.get('/api/backups/:id/logs', (c) => {
    const id = parseInt(c.req.param('id'));
    const logs = db.getLogs(id);
    return c.json(logs);
  });

  // Trigger manual backup
  app.post('/api/backups/run/:type', async (c) => {
    const type = c.req.param('type') as BackupScheduleType;

    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(type)) {
      return c.json({ error: 'Invalid backup type' }, 400);
    }

    try {
      const backupId = await scheduler.runManualBackup(type);
      return c.json({ success: true, backupId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // Delete backup
  app.delete('/api/backups/:id', (c) => {
    const id = parseInt(c.req.param('id'));
    const backup = db.getBackup(id);

    if (!backup) {
      return c.json({ error: 'Backup not found' }, 404);
    }

    // Delete from filesystem
    if (existsSync(backup.filepath)) {
      try {
        Bun.file(backup.filepath).unlink();
      } catch (error) {
        console.error('Failed to delete backup file:', error);
      }
    }

    // Delete from database
    db.deleteBackup(id);

    return c.json({ success: true });
  });

  // Restore from local backup
  app.post('/api/backups/:id/restore', async (c) => {
    const id = parseInt(c.req.param('id'));

    try {
      await restoreEngine.restoreFromLocal(id);
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // Download and restore from S3
  app.post('/api/backups/:id/restore-s3', async (c) => {
    const id = parseInt(c.req.param('id'));
    const backup = db.getBackup(id);

    if (!backup || !backup.s3Key) {
      return c.json({ error: 'Backup not found or not uploaded to S3' }, 404);
    }

    try {
      const downloadPath = join(config.backup.localPath, 'temp_' + backup.filename);
      await restoreEngine.restoreFromS3(id, downloadPath);

      // Clean up temp file
      if (existsSync(downloadPath)) {
        Bun.file(downloadPath).unlink();
      }

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // List S3 backups
  app.get('/api/s3/backups', async (c) => {
    try {
      const backups = await listS3Backups();
      return c.json(backups);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // Download backup from S3
  app.post('/api/s3/download', async (c) => {
    try {
      const body = await c.req.json();
      const { s3Key, filename } = body;

      if (!s3Key || !filename) {
        return c.json({ error: 'Missing s3Key or filename' }, 400);
      }

      const localPath = join(config.backup.localPath, filename);
      await downloadFromS3(s3Key, localPath);

      return c.json({ success: true, localPath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // Get configuration (sanitized)
  app.get('/api/config', (c) => {
    return c.json({
      database: {
        type: config.database.type,
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
      },
      backup: {
        localPath: config.backup.localPath,
        schedules: config.backup.schedules,
      },
      s3: {
        enabled: config.s3.enabled,
        bucket: config.s3.bucket,
        region: config.s3.region,
        prefix: config.s3.prefix,
      },
    });
  });

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
