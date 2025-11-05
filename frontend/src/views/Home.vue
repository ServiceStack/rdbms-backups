<template>
  <div class="home">
    <div class="actions">
      <h2>Manual Backup</h2>
      <div class="backup-buttons">
        <button class="btn-success" @click="runBackup('hourly')" :disabled="loading">
          Hourly Backup
        </button>
        <button class="btn-success" @click="runBackup('daily')" :disabled="loading">
          Daily Backup
        </button>
        <button class="btn-success" @click="runBackup('weekly')" :disabled="loading">
          Weekly Backup
        </button>
        <button class="btn-success" @click="runBackup('monthly')" :disabled="loading">
          Monthly Backup
        </button>
      </div>
      <p v-if="message" :class="['message', messageType]">{{ message }}</p>
    </div>

    <div class="backups-section">
      <div class="section-header">
        <h2>Recent Backups</h2>
        <button class="btn-secondary" @click="loadBackups">Refresh</button>
      </div>

      <div v-if="loading && backups.length === 0" class="loading">
        Loading backups...
      </div>

      <div v-else-if="backups.length === 0" class="empty">
        No backups found
      </div>

      <div v-else class="backups-grid">
        <div
          v-for="backup in backups"
          :key="backup.id"
          class="backup-card card"
          @click="selectBackup(backup)"
        >
          <div class="backup-header">
            <span :class="['badge', `badge-${backup.type}`]">{{ backup.type }}</span>
            <span :class="['badge', `badge-${backup.status}`]">{{ backup.status }}</span>
          </div>

          <div class="backup-info">
            <div class="backup-filename">{{ backup.filename }}</div>
            <div class="backup-details">
              <span>{{ formatDate(backup.startTime) }}</span>
              <span>•</span>
              <span>{{ formatSize(backup.size) }}</span>
              <span>•</span>
              <span>{{ formatDuration(backup.duration) }}</span>
            </div>
            <div v-if="backup.s3Uploaded" class="backup-s3">
              <span class="s3-badge">☁ S3</span>
            </div>
          </div>

          <div class="backup-actions">
            <button
              class="btn-primary"
              @click.stop="restoreBackup(backup)"
              :disabled="backup.status !== 'success'"
            >
              Restore
            </button>
            <button
              v-if="backup.s3Uploaded"
              class="btn-primary"
              @click.stop="restoreFromS3(backup)"
            >
              Restore from S3
            </button>
            <button class="btn-danger" @click.stop="deleteBackup(backup)">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedBackup" class="modal" @click="selectedBackup = null">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Backup Logs: {{ selectedBackup.filename }}</h3>
          <button class="btn-secondary" @click="selectedBackup = null">Close</button>
        </div>

        <div class="logs">
          <div v-if="logs.length === 0" class="empty">No logs available</div>
          <div
            v-for="log in logs"
            :key="log.id"
            :class="['log-entry', `log-${log.level}`]"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span :class="['log-level', `level-${log.level}`]">{{ log.level }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';
import type { BackupRecord, BackupLog, BackupScheduleType } from '../types';

const backups = ref<BackupRecord[]>([]);
const selectedBackup = ref<BackupRecord | null>(null);
const logs = ref<BackupLog[]>([]);
const loading = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

onMounted(() => {
  loadBackups();
});

async function loadBackups() {
  try {
    loading.value = true;
    backups.value = await api.getBackups(50);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Failed to load backups', 'error');
  } finally {
    loading.value = false;
  }
}

async function runBackup(type: BackupScheduleType) {
  try {
    loading.value = true;
    message.value = `Running ${type} backup...`;
    messageType.value = 'success';

    await api.runBackup(type);
    showMessage(`${type} backup completed successfully`, 'success');

    setTimeout(loadBackups, 1000);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Backup failed', 'error');
  } finally {
    loading.value = false;
  }
}

async function restoreBackup(backup: BackupRecord) {
  if (!confirm(`Are you sure you want to restore backup "${backup.filename}"? This will overwrite the current database.`)) {
    return;
  }

  try {
    loading.value = true;
    await api.restoreBackup(backup.id);
    showMessage('Backup restored successfully', 'success');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Restore failed', 'error');
  } finally {
    loading.value = false;
  }
}

async function restoreFromS3(backup: BackupRecord) {
  if (!confirm(`Are you sure you want to restore backup "${backup.filename}" from S3? This will overwrite the current database.`)) {
    return;
  }

  try {
    loading.value = true;
    await api.restoreBackupFromS3(backup.id);
    showMessage('Backup restored from S3 successfully', 'success');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Restore from S3 failed', 'error');
  } finally {
    loading.value = false;
  }
}

async function deleteBackup(backup: BackupRecord) {
  if (!confirm(`Are you sure you want to delete backup "${backup.filename}"?`)) {
    return;
  }

  try {
    await api.deleteBackup(backup.id);
    showMessage('Backup deleted successfully', 'success');
    backups.value = backups.value.filter(b => b.id !== backup.id);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Delete failed', 'error');
  }
}

async function selectBackup(backup: BackupRecord) {
  selectedBackup.value = backup;
  try {
    logs.value = await api.getBackupLogs(backup.id);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Failed to load logs', 'error');
  }
}

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 5000);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString();
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.actions {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.actions h2 {
  margin-bottom: 1rem;
}

.backup-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
}

.message.success {
  background: #d5f4e6;
  color: #27ae60;
}

.message.error {
  background: #fadbd8;
  color: #e74c3c;
}

.backups-section h2 {
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.loading, .empty {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
}

.backups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.backup-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.backup-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.backup-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.backup-info {
  margin-bottom: 1rem;
}

.backup-filename {
  font-weight: 600;
  margin-bottom: 0.5rem;
  word-break: break-all;
}

.backup-details {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.backup-details span {
  margin: 0 0.25rem;
}

.backup-s3 {
  margin-top: 0.5rem;
}

.s3-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.backup-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.backup-actions button {
  flex: 1;
  min-width: 80px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #ecf0f1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
}

.logs {
  padding: 1.5rem;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  border-bottom: 1px solid #ecf0f1;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.log-time {
  color: #7f8c8d;
  white-space: nowrap;
}

.log-level {
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.level-info {
  color: #3498db;
}

.level-warn {
  color: #f39c12;
}

.level-error {
  color: #e74c3c;
}

.log-message {
  flex: 1;
}
</style>
