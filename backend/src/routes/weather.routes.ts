import { FastifyInstance } from 'fastify';
import {
  getCurrentWeather,
  createPriceAlert,
  getPriceAlerts,
  cancelPriceAlert,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/weather.controller';
import { authenticate } from '../middleware/auth';

export default async function weatherRoutes(fastify: FastifyInstance) {
  // Public Meteorological Telemetry
  fastify.get('/current', getCurrentWeather);

  // Protected Price Alerts (Authentic JWT Bearer Required)
  fastify.post('/price-alerts', { preHandler: [authenticate] }, createPriceAlert);
  fastify.get('/price-alerts', { preHandler: [authenticate] }, getPriceAlerts);
  fastify.delete('/price-alerts/:id', { preHandler: [authenticate] }, cancelPriceAlert);

  // Protected Notifications (Authentic JWT Bearer Required)
  fastify.get('/notifications', { preHandler: [authenticate] }, getNotifications);
  fastify.get('/notifications/unread-count', { preHandler: [authenticate] }, getUnreadNotificationsCount);
  fastify.patch('/notifications/:id/read', { preHandler: [authenticate] }, markNotificationRead);
  fastify.post('/notifications/mark-all-read', { preHandler: [authenticate] }, markAllNotificationsRead);
}
