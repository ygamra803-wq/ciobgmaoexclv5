import { SwaggerOptions } from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CIOB GMAO API',
      version: '4.0.0',
      description: `
# CIOB GMAO Industrial Enterprise Engine API

**GMAO (Gestion de Maintenance Assistée par Ordinateur)** — محرك إدارة الصيانة الصناعية والمخزون (Offline-First & Relational SSOT).

## الميزات الرئيسية
- **إدارة المخزون (Stock Management):** حساب فوري للأرصدة وحالات \`RUPTURE\` / \`ALERTE\`.
- **إدارة الآلات (Machine Management):** شجرة الأصول الصناعية وربط قطع الغيار.
- **الصيانة الوقائية (Preventive Maintenance):** خطط الصيانة الدورية والمهام المجدولة.
- **الصيانة العلاجية (Corrective Maintenance - DI/BT):** أوامر العمل الأعطال ومؤشرات \`MTBF\` / \`MTTR\`.
- **إدارة الحركات (Movement Management):** تتبع حركات الإدخال والإخراج الداخلي والخارجي.
- **المزامنة الصريحة (Explicit State Sync):** حفظ واستعادة اللقطة الكاملة \`gmao_state.json\` مع فض التعارض.
      `.trim(),
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'CIOB GMAO Engineering Team',
        email: 'support@ciob-gmao.com',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Current Active GMAO Server (/api)',
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-GMAO-API-TOKEN',
          description: 'Token de sécurité pour les opérations d’écriture (POST, PUT, DELETE)',
        },
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            service: { type: 'string', example: 'GMAO Enterprise Backend API' },
            timestamp: { type: 'string', format: 'date-time' },
            storage: { type: 'string', example: 'JSON File + Memory Engine' },
          },
        },
        GmaoStatePayload: {
          type: 'object',
          properties: {
            stock: { type: 'array', items: { type: 'object' } },
            machines: { type: 'array', items: { type: 'object' } },
            preventiveTasks: { type: 'array', items: { type: 'object' } },
            correctiveInterventions: { type: 'array', items: { type: 'object' } },
            mouvements: { type: 'array', items: { type: 'object' } },
            users: { type: 'array', items: { type: 'object' } },
            zones: { type: 'array', items: { type: 'object' } },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['System & Health'],
          summary: 'Vérifier l’état de santé du serveur GMAO',
          responses: {
            '200': {
              description: 'Serveur opérationnel',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      '/gmao/state': {
        get: {
          tags: ['State Synchronization'],
          summary: 'Récupérer l’état complet GMAO (Snapshot SSOT)',
          responses: {
            '200': {
              description: 'État complet récupéré avec succès',
            },
          },
        },
        post: {
          tags: ['State Synchronization'],
          summary: 'Synchroniser et sauvegarder l’état complet GMAO sur le serveur',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GmaoStatePayload' },
              },
            },
          },
          responses: {
            '200': {
              description: 'État synchronisé avec succès',
            },
            '400': {
              description: 'Payload invalide',
            },
            '401': {
              description: 'Non autorisé (Token API manquant ou invalide)',
            },
          },
        },
      },
      '/gmao/{entity}': {
        get: {
          tags: ['Entities CRUD'],
          summary: 'Lister les enregistrements d’une entité (stock, machines, preventiveTasks, correctiveInterventions, mouvements, users, zones)',
          parameters: [
            {
              name: 'entity',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: [
                  'stock',
                  'machines',
                  'preventiveTasks',
                  'correctiveInterventions',
                  'mouvements',
                  'users',
                  'zones',
                  'families',
                  'templates',
                ],
              },
            },
          ],
          responses: {
            '200': { description: 'Liste des enregistrements' },
            '404': { description: 'Entité introuvable' },
          },
        },
        post: {
          tags: ['Entities CRUD'],
          summary: 'Ajouter un enregistrement dans une entité GMAO',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'entity',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            '201': { description: 'Enregistrement créé' },
          },
        },
      },
      '/gmao/{entity}/{id}': {
        put: {
          tags: ['Entities CRUD'],
          summary: 'Mettre à jour un enregistrement par ID ou Code',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'entity', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            '200': { description: 'Enregistrement mis à jour' },
            '404': { description: 'Enregistrement introuvable' },
          },
        },
        delete: {
          tags: ['Entities CRUD'],
          summary: 'Supprimer un enregistrement par ID ou Code',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'entity', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Enregistrement supprimé' },
            '404': { description: 'Enregistrement introuvable' },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerUiOptions: SwaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CIOB GMAO API Documentation',
  customfavIcon: '/pwa-192x192.png',
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
  },
};

export { swaggerSpec, swaggerUiOptions };
