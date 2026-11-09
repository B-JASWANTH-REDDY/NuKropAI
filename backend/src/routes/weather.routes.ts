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

export default async function weatherRoutes(fastify: FastifyInstance) {
  // Weather
  fastify.get('/current', getCurrentWeather);

  // Price Alerts
  fastify.post('/price-alerts', createPriceAlert);
  fastify.get('/price-alerts', getPriceAlerts);
  fastify.delete('/price-alerts/:id', cancelPriceAlert);

  // Notifications (mounted under /weather for existing frontend/flutter backward compatibility)
  fastify.get('/notifications', getNotifications);
  fastify.get('/notifications/unread-count', getUnreadNotificationsCount);
  fastify.patch('/notifications/:id/read', markNotificationRead);
  fastify.post('/notifications/mark-all-read', markAllNotificationsRead);
}
