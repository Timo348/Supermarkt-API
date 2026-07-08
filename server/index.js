import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import * as cache from './services/cache.js';
import { startScheduler } from './services/scheduler.js';

import marketsRouter from './routes/markets.js';
import offersRouter from './routes/offers.js';
import brochuresRouter from './routes/brochures.js';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (_req, res) => {
  res.json({
    zipCodes: config.zipCodes,
    markets: config.markets.map(m => m.id),
    cacheTtlMinutes: config.cacheTtlMinutes,
    refreshCron: config.refreshCron
  });
});

app.post('/api/refresh', async (_req, res, next) => {
  try {
    cache.clear();
    await Promise.all([
      import('./services/marktguru.js').then(m => m.fetchAllOffers()),
      import('./services/marktguru.js').then(m => m.fetchAllBrochures())
    ]);
    res.json({ status: 'refreshed', timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

app.use('/api/markets', marketsRouter);
app.use('/api/offers', offersRouter);
app.use('/api/brochures', brochuresRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

async function warmup() {
  console.log('Warming up cache...');
  try {
    const { fetchAllOffers, fetchAllBrochures } = await import('./services/marktguru.js');
    await Promise.all([
      fetchAllOffers().then(o => console.log(`Cached ${o.length} offers`)),
      fetchAllBrochures().then(b => console.log(`Cached ${b.length} brochures`))
    ]);
    console.log('Warmup complete.');
  } catch (err) {
    console.error('Warmup failed:', err.message);
  }
}

app.listen(config.port, async () => {
  console.log(`Supermarkt-API listening on port ${config.port}`);
  console.log(`Monitoring ZIP codes: ${config.zipCodes.join(', ')}`);
  startScheduler();
  await warmup();
});
