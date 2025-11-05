export type BackupScheduleType = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface BackupRecord {
  id: number;
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
  id: number;
  backupId: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface S3Backup {
  key: string;
  size: number;
  lastModified: Date;
}

export interface Config {
  database: {
    type: string;
    host: string;
    port: number;
    database: string;
  };
  backup: {
    localPath: string;
    schedules: Record<string, any>;
  };
  s3: {
    enabled: boolean;
    bucket: string;
    region: string;
    prefix: string;
  };
}
