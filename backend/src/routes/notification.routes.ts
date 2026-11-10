import { FastifyInstance } from 'fastify';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/weather.controller';
import { authenticate } from '../middleware/auth';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate] }, getNotifications);
  fastify.get('/unread-count', { preHandler: [authenticate] }, getUnreadNotificationsCount);
  fastify.patch('/:id/read', { preHandler: [authenticate] }, markNotificationRead);
  fastify.post('/mark-all-read', { preHandler: [authenticate] }, markAllNotificationsRead);
}
