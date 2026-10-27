import { FastifyInstance } from 'fastify';
import { processSoilHealthCard, triggerCropLifecycleEngine, diagnoseCropFoliar, chatAgronomist } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

export default async function aiRoutes(fastify: FastifyInstance) {
  // Routes for AI processing and integrations
  
  // 1. Process Soil Health Card OCR
  fastify.post('/soil-ocr', { preHandler: [authenticate] }, processSoilHealthCard);
  
  // 2. Trigger the Crop Lifecycle Engine manually (usually hit by cron)
  fastify.post('/lifecycle/tick', { preHandler: [authenticate] }, triggerCropLifecycleEngine);

  // 3. Secure Server-Side Foliar Crop Pathology Diagnosis (Vision)
  fastify.post('/diagnose-crop', { preHandler: [authenticate] }, diagnoseCropFoliar);

  // 4. Secure Server-Side Agronomy Advisory Chat
  fastify.post('/chat', { preHandler: [authenticate] }, chatAgronomist);
}

