# RDBMS Backup & Restore

A comprehensive Docker-based backup and restore solution for PostgreSQL and MySQL databases with automated scheduling, retention policies, S3 integration, and a web UI.

## Features

- **Multi-Database Support**: Works with both PostgreSQL and MySQL
- **Automated Scheduling**: Cron-based scheduling for hourly, daily, weekly, and monthly backups
- **Intelligent Retention**: Hierarchical retention policies that automatically clean up old backups
- **S3 Integration**: Automatic upload to S3 with support for downloading and restoring from S3
- **Web UI**: Vue-based interface for managing backups, viewing logs, and performing restores
- **SQLite Logging**: Complete backup history and logs stored in SQLite
- **Docker Ready**: Fully containerized with Docker and Docker Compose support

## Technology Stack

- **Backend**: Bun + TypeScript + Hono
- **Frontend**: Vue 3 + TypeScript + Vite
- **Database**: Bun's built-in SQLite
- **Backup Tools**: `pg_dump`/`psql` for PostgreSQL, `mysqldump`/`mysql` for MySQL
- **Cloud Storage**: AWS S3 via official SDK
- **Scheduler**: node-cron

## Quick Start

### 1. Configuration

Copy the example configuration and customize it:

```bash
cp config.example.json config.json
```

Edit `config.json` with your database and S3 credentials:

```json
{
  "database": {
    "type": "postgresql",
    "host": "postgres",
    "port": 5432,
    "username": "postgres",
    "password": "password",
    "database": "mydb"
  },
  "backup": {
    "localPath": "/backups",
    "schedules": {
      "hourly": {
        "cron": "0 * * * *",
        "enabled": true,
        "retention": {
          "count": 6,
          "unit": "hours"
        }
      },
      "daily": {
        "cron": "0 2 * * *",
        "enabled": true,
        "retention": {
          "count": 7,
          "unit": "days"
        }
      },
      "weekly": {
        "cron": "0 3 * * 0",
        "enabled": true,
        "retention": {
          "count": 4,
          "unit": "weeks"
        }
      },
      "monthly": {
        "cron": "0 4 1 * *",
        "enabled": true,
        "retention": {
          "count": 12,
          "unit": "months"
        }
      }
    }
  },
  "s3": {
    "enabled": true,
    "bucket": "my-backup-bucket",
    "region": "us-east-1",
    "accessKeyId": "YOUR_ACCESS_KEY",
    "secretAccessKey": "YOUR_SECRET_KEY",
    "prefix": "database-backups/"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  }
}
```

### 2. Run with Docker Compose

The easiest way to get started is with Docker Compose, which includes example PostgreSQL and MySQL databases:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- MySQL database on port 3306
- Backup service with web UI on port 3000

Access the web UI at: `http://localhost:3000`

### 3. Run Standalone

If you prefer to run the backup service standalone:

```bash
# Install dependencies
bun install

# Build frontend
cd frontend
bun install
bun run build
cd ..

# Run the service
bun run src/index.ts
```

## Retention Policy

The retention system uses a **hierarchical approach**:

1. **Hourly backups**: Keep the last 6 hours
2. **Daily backups**: Keep the last 7 days
3. **Weekly backups**: Keep the last 4 weeks
4. **Monthly backups**: Keep the last 12 months

### Hierarchical Cleanup

When a higher-level backup is created, it triggers cleanup of lower-level backups:

- When a **daily** backup runs → deletes all hourly backups before it
- When a **weekly** backup runs → deletes all hourly and daily backups before it
- When a **monthly** backup runs → deletes all hourly, daily, and weekly backups before it

This ensures efficient storage usage while maintaining appropriate recovery points.

## Web UI

The web interface provides:

- **Dashboard**: View all backups with status, size, and timestamps
- **Manual Backups**: Trigger backups on-demand
- **Restore**: Restore from local or S3 backups
- **Log Viewer**: Inspect detailed logs for each backup
- **Real-time Status**: See backup job status and history

## API Endpoints

### Backups

- `GET /api/backups` - List all backups
- `GET /api/backups/type/:type` - List backups by type
- `GET /api/backups/:id` - Get single backup
- `GET /api/backups/:id/logs` - Get backup logs
- `POST /api/backups/run/:type` - Trigger manual backup
- `DELETE /api/backups/:id` - Delete backup
- `POST /api/backups/:id/restore` - Restore from local backup
- `POST /api/backups/:id/restore-s3` - Restore from S3 backup

### S3

- `GET /api/s3/backups` - List S3 backups
- `POST /api/s3/download` - Download backup from S3

### System

- `GET /api/config` - Get sanitized configuration
- `GET /api/health` - Health check

## Cron Schedule Examples

```
0 * * * *      # Every hour at minute 0
0 2 * * *      # Every day at 2:00 AM
0 3 * * 0      # Every Sunday at 3:00 AM
0 4 1 * *      # First day of every month at 4:00 AM
*/30 * * * *   # Every 30 minutes
0 */6 * * *    # Every 6 hours
```

## Docker Configuration

### Environment Variables

The service can be configured via environment variables or `config.json`. Mount your config file:

```yaml
volumes:
  - ./config.json:/app/config.json
  - ./backups:/backups
  - ./backups.db:/app/backups.db
```

### Network Configuration

The backup service needs network access to your database. In Docker Compose, use a shared network:

```yaml
networks:
  - backup-network
```

## Security Considerations

1. **Credentials**: Never commit `config.json` with real credentials
2. **S3 Access**: Use IAM roles with minimal required permissions
3. **Database Access**: Use read-only users when possible for backups
4. **Network**: Restrict backup service access in production environments
5. **Backups**: Encrypt sensitive backups at rest and in transit

## Backup Best Practices

1. **Test Restores**: Regularly test backup restores to ensure they work
2. **Monitor Space**: Monitor local disk space for backup storage
3. **S3 Lifecycle**: Configure S3 lifecycle rules for long-term archival
4. **Multiple Regions**: Consider cross-region S3 replication for disaster recovery
5. **Retention Tuning**: Adjust retention policies based on RPO/RTO requirements

## Troubleshooting

### Backup Fails

Check the logs in the web UI. Common issues:
- Database connection failed: Verify host, port, credentials
- Disk space: Ensure sufficient space in `/backups`
- Permissions: Verify the user has database dump permissions

### S3 Upload Fails

- Verify S3 credentials and bucket permissions
- Check network connectivity to S3
- Ensure bucket exists and region is correct

### Container Issues

```bash
# View logs
docker-compose logs backup

# Restart service
docker-compose restart backup

# Check health
docker-compose ps
```

## Development

### Running Locally

```bash
# Backend
bun install
bun run dev

# Frontend (separate terminal)
cd frontend
bun install
bun run dev
```

Frontend will be available at `http://localhost:5173` with API proxy to `http://localhost:3000`

### Project Structure

```
.
├── src/                    # Backend TypeScript code
│   ├── index.ts           # Main entry point
│   ├── api.ts             # Hono API routes
│   ├── backup.ts          # Backup engine
│   ├── restore.ts         # Restore engine
│   ├── retention.ts       # Retention policy engine
│   ├── scheduler.ts       # Cron scheduler
│   ├── database.ts        # SQLite database
│   ├── s3.ts              # S3 integration
│   ├── config.ts          # Configuration loader
│   └── types.ts           # TypeScript types
├── frontend/              # Vue frontend
│   ├── src/
│   │   ├── App.vue       # Main app component
│   │   ├── views/        # Page components
│   │   ├── api.ts        # API client
│   │   └── types.ts      # TypeScript types
│   └── vite.config.ts
├── Dockerfile
├── docker-compose.yml
└── config.example.json
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
