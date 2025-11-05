import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { config } from './config';

let s3Client: S3Client;

export function initializeS3() {
  if (!config.s3.enabled) return;

  s3Client = new S3Client({
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });
}

export async function uploadToS3(filepath: string, filename: string): Promise<string> {
  if (!config.s3.enabled) {
    throw new Error('S3 is not enabled');
  }

  const fileContent = readFileSync(filepath);
  const key = `${config.s3.prefix}${filename}`;

  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: fileContent,
  });

  await s3Client.send(command);
  return key;
}

export async function downloadFromS3(s3Key: string, localPath: string): Promise<void> {
  if (!config.s3.enabled) {
    throw new Error('S3 is not enabled');
  }

  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: s3Key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('No body in S3 response');
  }

  const stream = response.Body as Readable;
  const fileStream = createWriteStream(localPath);

  await pipeline(stream, fileStream);
}

export async function listS3Backups(): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  if (!config.s3.enabled) {
    return [];
  }

  const command = new ListObjectsV2Command({
    Bucket: config.s3.bucket,
    Prefix: config.s3.prefix,
  });

  const response = await s3Client.send(command);

  return (response.Contents || []).map(item => ({
    key: item.Key!,
    size: item.Size || 0,
    lastModified: item.LastModified || new Date(),
  }));
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  if (!config.s3.enabled) {
    throw new Error('S3 is not enabled');
  }

  const command = new DeleteObjectCommand({
    Bucket: config.s3.bucket,
    Key: s3Key,
  });

  await s3Client.send(command);
}
