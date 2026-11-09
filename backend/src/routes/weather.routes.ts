import { FastifyInstance } from 'fastify';
import {
  getCurrentWeather,
  createPriceAlert,
  getUnreadNotificationsCount
} from '../controllers/weather.controller';

export default async function weatherRoutes(fastify: FastifyInstance) {
  fastify.get('/current', getCurrentWeather);
  fastify.post('/price-alerts', createPriceAlert);
  fastify.get('/notifications/unread-count', getUnreadNotificationsCount);
}

