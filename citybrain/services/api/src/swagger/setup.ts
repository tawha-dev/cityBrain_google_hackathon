import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi.js';

// swagger-ui-express accepts a plain OpenAPI 3 object
const spec = openApiSpec as Record<string, unknown>;

export function setupSwagger(app: Express) {
  app.get('/api-docs.json', (_req, res) => {
    res.json(spec);
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {      customSiteTitle: 'CityBrain API — Swagger UI',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
      },
    })
  );

  console.log('[swagger] UI → http://localhost:' + (process.env.PORT ?? 4000) + '/api-docs');
}
