import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

// Configure Redis URL with fallback for local dev
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    // Graceful offline degradation: do not infinite-loop retry when Redis daemon is absent
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 500);
  }
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis successfully');
});

let lastRedisErrorLog = 0;
redisClient.on('error', (err: any) => {
  const now = Date.now();
  if (now - lastRedisErrorLog > 30000) {
    lastRedisErrorLog = now;
    logger.warn({ message: err?.message || 'Redis connection standby' }, 'Redis offline or unreachable. Distributed cache falling back to memory.');
  }
});

export default redisClient;
