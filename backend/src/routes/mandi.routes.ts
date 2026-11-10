import { FastifyInstance } from 'fastify';
import { mandiSyncService } from '../services/MandiSyncService';
import { redisClient } from '../config/redis';

export default async function mandiRoutes(fastify: FastifyInstance) {
    fastify.get('/rates', async (request, reply) => {
        const { state, commodity } = request.query as { state: string; commodity: string };

        if (!state || !commodity) {
            return reply.status(400).send({ error: 'Missing required query parameters: state, commodity' });
        }

        const cacheKey = `cache:mandi:${state.toLowerCase()}:${commodity.toLowerCase()}`;

        try {
            // Check Redis Cache First
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                request.log.info(`Cache hit for ${cacheKey}`);
                return reply.send({ success: true, records: JSON.parse(cachedData), cached: true });
            }

            request.log.info(`Cache miss for ${cacheKey}, fetching from DB`);
            const records = await mandiSyncService.getMandiRates(state, commodity);
            
            // Cache for 1 hour
            await redisClient.set(cacheKey, JSON.stringify(records), 'EX', 3600);

            return reply.send({ success: true, records, cached: false });
        } catch (error: any) {
            request.log.error(error);
            return reply.status(502).send({ 
                success: false, 
                code: 'UPSTREAM_PROVIDER_OUTAGE',
                error: 'Upstream Ministry of Agriculture / data.gov.in provider failure', 
                details: error.message 
            });
        }

    });
}
