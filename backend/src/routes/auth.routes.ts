import { FastifyInstance } from 'fastify';
import { register, login, refresh, logout } from '../controllers/auth.controller';

/**
 * Route-specific rate limits to prevent brute-force attacks on sensitive auth endpoints.
 */
const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
};

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', authRateLimit, register);
  fastify.post('/login', authRateLimit, login);
  fastify.post('/refresh', authRateLimit, refresh);
  fastify.post('/logout', logout);
}
