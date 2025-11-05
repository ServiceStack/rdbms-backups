<template>
  <div class="app">
    <header class="header">
      <h1>RDBMS Backup & Restore</h1>
      <div class="header-info" v-if="config">
        <span>{{ config.database.type }}</span>
        <span>•</span>
        <span>{{ config.database.database }}@{{ config.database.host }}</span>
      </div>
    </header>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from './api';
import type { Config } from './types';

const config = ref<Config | null>(null);

onMounted(async () => {
  try {
    config.value = await api.getConfig();
  } catch (error) {
    console.error('Failed to load config:', error);
  }
});
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #2c3e50;
  color: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.header-info {
  font-size: 0.9rem;
  opacity: 0.9;
}

.header-info span {
  margin: 0 0.5rem;
}

.header-info span:first-child {
  margin-left: 0;
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

button:hover {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #229954;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c0392b;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge-success {
  background: #d5f4e6;
  color: #27ae60;
}

.badge-error {
  background: #fadbd8;
  color: #e74c3c;
}

.badge-hourly {
  background: #e3f2fd;
  color: #1976d2;
}

.badge-daily {
  background: #f3e5f5;
  color: #7b1fa2;
}

.badge-weekly {
  background: #fff3e0;
  color: #f57c00;
}

.badge-monthly {
  background: #e8f5e9;
  color: #388e3c;
}
</style>
