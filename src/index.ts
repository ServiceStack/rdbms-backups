import { serve } from '@hono/node-server';
import { initializeConfig, config } from './config';
import { BackupDatabase } from './database';
import { BackupEngine } from './backup';
import { RestoreEngine } from './restore';
import { RetentionEngine } from './retention';
import { BackupScheduler } from './scheduler';
import { initializeS3 } from './s3';
import { createApp } from './api';
import { existsSync, mkdirSync } from 'fs';

async function main() {
  console.log('=== RDBMS Backup & Restore Service ===\n');

  // Load configuration
  try {
    initializeConfig();
    console.log('✓ Configuration loaded');
  } catch (error) {
    console.error('Failed to load configuration:', error);
    console.error('Please create a config.json file based on config.example.json');
    process.exit(1);
  }

  // Ensure backup directory exists
  if (!existsSync(config.backup.localPath)) {
    mkdirSync(config.backup.localPath, { recursive: true });
    console.log('✓ Created backup directory:', config.backup.localPath);
  }

  // Initialize S3
  if (config.s3.enabled) {
    initializeS3();
    console.log('✓ S3 client initialized');
  }

  // Initialize database
  const db = new BackupDatabase('./backups.db');
  console.log('✓ Database initialized');

  // Initialize engines
  const backupEngine = new BackupEngine(db);
  const restoreEngine = new RestoreEngine(db);
  const retentionEngine = new RetentionEngine(db, backupEngine);
  console.log('✓ Backup and restore engines initialized');

  // Initialize scheduler
  const scheduler = new BackupScheduler(backupEngine, retentionEngine);
  scheduler.start();
  console.log('✓ Backup scheduler started');

  // Create and start API server
  const app = createApp(db, scheduler, restoreEngine);

  const server = serve({
    fetch: app.fetch,
    port: config.server.port,
    hostname: config.server.host,
  });

  console.log(`\n✓ Server running at http://${config.server.host}:${config.server.port}`);
  console.log(`\n=== Service is ready ===\n`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    scheduler.stop();
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nShutting down gracefully...');
    scheduler.stop();
    db.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
