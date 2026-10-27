import { Worker, Queue, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

// Setup queues
export const DataIngestionQueue = new Queue('DataIngestion', { connection: redisClient as any });
export const AIOrchestrationQueue = new Queue('AIOrchestration', { connection: redisClient as any });

// Import jobs
import { handleMandiIngestion } from './jobs/mandiIngestion';

// Orchestrator Worker
export function startOrchestrator() {
  logger.info('Starting Background Worker Orchestrator...');

  // Worker for Data Ingestion
  const dataWorker = new Worker('DataIngestion', async (job: Job) => {
    logger.info(`Processing Data Ingestion Job: ${job.name} (ID: ${job.id})`);
    
    switch(job.name) {
      case 'sync_mandi_prices':
        return await handleMandiIngestion(job.data);
      case 'sync_weather_forecast':
        // Implement weather ingestion
        return;
      case 'process_telemetry':
        // Implement telemetry buffering logic
        return;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }, { connection: redisClient as any, concurrency: 5 });

  dataWorker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  dataWorker.on('failed', (job, err) => {
    logger.error({ err }, `Job ${job?.id} failed`);
  });

  // Schedule cron jobs
  setupCronJobs();
}

async function setupCronJobs() {
  // Sync Mandi data every hour
  await DataIngestionQueue.add('sync_mandi_prices', {}, {
    repeat: { pattern: '0 * * * *' } // Every hour
  });
  logger.info('Cron jobs scheduled successfully');
}
