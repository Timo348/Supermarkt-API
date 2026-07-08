import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    count: config.markets.length,
    markets: config.markets.map(m => ({
      id: m.id,
      name: m.name,
      category: m.category
    }))
  });
});

export default router;
