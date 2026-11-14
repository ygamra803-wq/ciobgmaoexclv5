import type express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from '../../config/swaggerConfig';
import { isLoopbackRemoteAddress, isWeakOrEmptyApiToken } from '../../core/security/serverRbacPolicy';
import { constantTimeEqual } from '../../core/security/nativeCrypto';
import { serverLogger } from '../serverLogger';

/**
 * Mounts OpenAPI / Swagger endpoints guarded by environment mode, loopback restriction (DEV),
 * and constant-time `GMAO_API_TOKEN` verification when explicitly enabled in production.
 */
export function mountSwaggerRoutes(app: express.Application, isProduction: boolean): void {
  const swaggerEnabled = !isProduction || process.env.GMAO_ENABLE_SWAGGER === 'true';

  const guardSwaggerAccess: express.RequestHandler = (req, res, next) => {
    if (!swaggerEnabled) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'API documentation is disabled in production mode.',
      });
    }
    if (isProduction) {
      const expected = String(process.env.GMAO_API_TOKEN || '').trim();
      const provided = String(req.headers['x-gmao-api-token'] || '').trim();
      if (isWeakOrEmptyApiToken(expected) || !constantTimeEqual(provided, expected)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Valid strong GMAO_API_TOKEN required for API docs.',
        });
      }
      return next();
    }
    if (
      process.env.GMAO_ALLOW_LAN_SWAGGER !== 'true' &&
      !isLoopbackRemoteAddress(req.socket?.remoteAddress)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Swagger documentation is restricted to localhost in development.',
      });
    }
    return next();
  };

  if (swaggerEnabled && !isProduction) {
    serverLogger.warn('[Server][SEC-LAN-P0] Swagger /api/docs active in DEV mode (restricted to localhost).');
  }

  app.get('/api/docs.json', guardSwaggerAccess, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.use('/api/docs', guardSwaggerAccess, swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}
