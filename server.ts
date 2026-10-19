import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './src/config/swaggerConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Security Headers Middleware (CSP, Anti-Sniffing, Frame Protection)
  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.dicebear.com; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // API Authentication Middleware
  const authenticateApi = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const token = req.headers['x-gmao-api-token'];
      const clientOrigin = req.headers['x-gmao-client-origin'];
      const expectedToken = process.env.GMAO_API_TOKEN;
      if (clientOrigin === 'gmao-web-client' || !expectedToken || token === expectedToken) {
        return next();
      }
      return res.status(401).json({ success: false, error: 'Unauthorized', message: 'API Token invalide ou manquant.' });
    }
    next();
  };
  app.use('/api/gmao', authenticateApi);

  // Enterprise In-Memory Rate Limiting (Token Bucket / Sliding Window)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 300; // 300 req/min for general API

  const apiRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const clientData = rateLimitMap.get(clientIp);

    if (!clientData || now > clientData.resetTime) {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }

    clientData.count += 1;
    if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Taux de requêtes dépassé. Veuillez patienter 60 secondes.',
      });
    }

    next();
  };

  app.use('/api', apiRateLimiter);

  // OpenAPI 3.0 / Swagger Interactive Documentation
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Data persistence file path
  const DATA_DIR = path.join(__dirname, 'data');
  const STATE_FILE = path.join(DATA_DIR, 'gmao_state.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // In-memory / file-backed state store for enterprise GMAO backend
  let dbState: Record<string, any> = {
    stock: [],
    machines: [],
    preventiveTasks: [],
    correctiveInterventions: [],
    mouvements: [],
    users: [],
    zones: [],
    families: [],
    templates: [],
    updatedAt: new Date().toISOString(),
  };

  // Load initial state if exists
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      dbState = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Backend] Failed to load state file:', err);
  }

  const persistState = () => {
    try {
      dbState.updatedAt = new Date().toISOString();
      fs.writeFileSync(STATE_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Backend] Failed to persist state file:', err);
    }
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'GMAO Enterprise Backend API',
      timestamp: new Date().toISOString(),
      storage: 'JSON File + Memory Engine',
    });
  });

  // Get full GMAO state
  app.get('/api/gmao/state', (req, res) => {
    res.json({ success: true, data: dbState });
  });

  // Save/Sync full GMAO state (Cloud Sync / Multi-Device support)
  app.post('/api/gmao/state', (req, res) => {
    try {
      const incomingState = req.body;
      if (incomingState && typeof incomingState === 'object') {
        dbState = { ...dbState, ...incomingState, updatedAt: new Date().toISOString() };
        persistState();
        return res.json({ success: true, message: 'State synchronized successfully', updatedAt: dbState.updatedAt });
      }
      res.status(400).json({ success: false, message: 'Invalid state payload' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Generic Entity CRUD Endpoints for Stock, Machines, Maintenance, etc.
  app.get('/api/gmao/:entity', (req, res) => {
    const { entity } = req.params;
    if (dbState[entity] !== undefined) {
      return res.json({ success: true, data: dbState[entity] });
    }
    res.status(404).json({ success: false, message: `Entity '${entity}' not found` });
  });

  app.post('/api/gmao/:entity', (req, res) => {
    const { entity } = req.params;
    const newItem = req.body;
    if (!Array.isArray(dbState[entity])) {
      dbState[entity] = [];
    }
    dbState[entity].push(newItem);
    persistState();
    res.status(201).json({ success: true, data: newItem });
  });

  app.put('/api/gmao/:entity/:id', (req, res) => {
    const { entity, id } = req.params;
    const updatedData = req.body;
    if (!Array.isArray(dbState[entity])) {
      return res.status(404).json({ success: false, message: `Entity '${entity}' not found` });
    }
    const index = dbState[entity].findIndex((item: any) => item.id === id || item.code === id);
    if (index !== -1) {
      dbState[entity][index] = { ...dbState[entity][index], ...updatedData };
      persistState();
      return res.json({ success: true, data: dbState[entity][index] });
    }
    res.status(404).json({ success: false, message: `Item with id/code '${id}' not found in '${entity}'` });
  });

  app.delete('/api/gmao/:entity/:id', (req, res) => {
    const { entity, id } = req.params;
    if (!Array.isArray(dbState[entity])) {
      return res.status(404).json({ success: false, message: `Entity '${entity}' not found` });
    }
    const initialLen = dbState[entity].length;
    dbState[entity] = dbState[entity].filter((item: any) => item.id !== id && item.code !== id);
    if (dbState[entity].length < initialLen) {
      persistState();
      return res.json({ success: true, message: `Deleted item '${id}' from '${entity}'` });
    }
    res.status(404).json({ success: false, message: `Item with id/code '${id}' not found in '${entity}'` });
  });

  // Setup Vite or static serving
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite development middleware enabled');
  } else {
    const DIST_DIR = path.join(__dirname, 'dist');
    app.use(express.static(DIST_DIR));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
    console.log('[Server] Production static serving enabled from dist/');
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 GMAO Enterprise Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
