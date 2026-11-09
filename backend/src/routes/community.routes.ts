import { FastifyInstance } from 'fastify';
import { 
  getCommunityPosts, 
  createCommunityPost, 
  togglePostLike 
} from '../controllers/community.controller';
import { authenticate } from '../middleware/auth';

export default async function communityRoutes(fastify: FastifyInstance) {
  fastify.get('/posts', getCommunityPosts);
  fastify.post('/posts', { preHandler: [authenticate] }, createCommunityPost);
  fastify.post('/posts/:id/like', { preHandler: [authenticate] }, togglePostLike);
}
