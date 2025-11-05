export type DatabaseType = 'postgresql' | 'mysql';

export type BackupScheduleType = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RetentionConfig {
  count: number;
  unit: 'hours' | 'days' | 'weeks' | 'months';
}

export interface ScheduleConfig {
  cron: string;
  enabled: boolean;
  retention: RetentionConfig;
}

export interface S3Config {
  enabled: boolean;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface Config {
  database: DatabaseConfig;
  backup: {
    localPath: string;
    schedules: {
      hourly: ScheduleConfig;
      daily: ScheduleConfig;
      weekly: ScheduleConfig;
      monthly: ScheduleConfig;
    };
  };
  s3: S3Config;
  server: ServerConfig;
}

export interface BackupRecord {
  id?: number;
  type: BackupScheduleType;
  filename: string;
  filepath: string;
  size: number;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'success' | 'failed';
  error?: string;
  s3Uploaded: boolean;
  s3Key?: string;
}

export interface BackupLog {
  id?: number;
  backupId: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}
