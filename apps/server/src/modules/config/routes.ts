import { FastifyInstance } from 'fastify';

export async function registerConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/config', async () => {
    return {
      baseUrl: process.env.APP_BASE_URL || '',
    };
  });
}
