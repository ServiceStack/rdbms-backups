import { readFileSync } from 'fs';
import { z } from 'zod';
import type { Config } from './types';

const RetentionSchema = z.object({
  count: z.number().min(1),
  unit: z.enum(['hours', 'days', 'weeks', 'months']),
});

const ScheduleSchema = z.object({
  cron: z.string(),
  enabled: z.boolean(),
  retention: RetentionSchema,
});

const ConfigSchema = z.object({
  database: z.object({
    type: z.enum(['postgresql', 'mysql']),
    host: z.string(),
    port: z.number(),
    username: z.string(),
    password: z.string(),
    database: z.string(),
  }),
  backup: z.object({
    localPath: z.string(),
    schedules: z.object({
      hourly: ScheduleSchema,
      daily: ScheduleSchema,
      weekly: ScheduleSchema,
      monthly: ScheduleSchema,
    }),
  }),
  s3: z.object({
    enabled: z.boolean(),
    bucket: z.string(),
    region: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    prefix: z.string(),
  }),
  server: z.object({
    port: z.number(),
    host: z.string(),
  }),
});

export function loadConfig(path: string = './config.json'): Config {
  try {
    const content = readFileSync(path, 'utf-8');
    const json = JSON.parse(content);
    return ConfigSchema.parse(json);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw error;
  }
}

export let config: Config;

export function initializeConfig(path?: string) {
  config = loadConfig(path);
  return config;
}
