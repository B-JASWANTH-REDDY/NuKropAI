import { FastifyInstance } from 'fastify';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/weather.controller';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/', getNotifications);
  fastify.get('/unread-count', getUnreadNotificationsCount);
  fastify.patch('/:id/read', markNotificationRead);
  fastify.post('/mark-all-read', markAllNotificationsRead);
}
