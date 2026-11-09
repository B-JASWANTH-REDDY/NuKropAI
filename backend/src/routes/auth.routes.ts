import { FastifyInstance } from 'fastify';
import { 
  register, 
  login, 
  refresh, 
  logout, 
  updateProfileDiscovery, 
  getProfileDiscovery 
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

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

  // Authenticated Owner-Only Profile Discovery Visibility Controls
  fastify.patch('/profile/discovery', { preHandler: [authenticate] }, updateProfileDiscovery);
  fastify.put('/profile/discovery', { preHandler: [authenticate] }, updateProfileDiscovery);
  fastify.get('/profile/discovery', { preHandler: [authenticate] }, getProfileDiscovery);
}
