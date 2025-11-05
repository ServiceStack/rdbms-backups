import type { BackupRecord, BackupLog, S3Backup, Config, BackupScheduleType } from './types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Backups
  async getBackups(limit?: number): Promise<BackupRecord[]> {
    const query = limit ? `?limit=${limit}` : '';
    return fetchJson(`/backups${query}`);
  },

  async getBackupsByType(type: string): Promise<BackupRecord[]> {
    return fetchJson(`/backups/type/${type}`);
  },

  async getBackup(id: number): Promise<BackupRecord> {
    return fetchJson(`/backups/${id}`);
  },

  async getBackupLogs(id: number): Promise<BackupLog[]> {
    return fetchJson(`/backups/${id}/logs`);
  },

  async runBackup(type: BackupScheduleType): Promise<{ success: boolean; backupId: number }> {
    return fetchJson(`/backups/run/${type}`, { method: 'POST' });
  },

  async deleteBackup(id: number): Promise<{ success: boolean }> {
    return fetchJson(`/backups/${id}`, { method: 'DELETE' });
  },

  async restoreBackup(id: number): Promise<{ success: boolean }> {
    return fetchJson(`/backups/${id}/restore`, { method: 'POST' });
  },

  async restoreBackupFromS3(id: number): Promise<{ success: boolean }> {
    return fetchJson(`/backups/${id}/restore-s3`, { method: 'POST' });
  },

  // S3
  async listS3Backups(): Promise<S3Backup[]> {
    return fetchJson('/s3/backups');
  },

  async downloadFromS3(s3Key: string, filename: string): Promise<{ success: boolean; localPath: string }> {
    return fetchJson('/s3/download', {
      method: 'POST',
      body: JSON.stringify({ s3Key, filename }),
    });
  },

  // Config
  async getConfig(): Promise<Config> {
    return fetchJson('/config');
  },

  // Health
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return fetchJson('/health');
  },
};
