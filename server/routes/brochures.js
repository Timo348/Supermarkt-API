import { Router } from 'express';
import { config } from '../config.js';
import * as marktguru from '../services/marktguru.js';

const router = Router();

function isCurrent(validFrom, validTo) {
  const now = new Date();
  const from = validFrom ? new Date(validFrom) : null;
  const to = validTo ? new Date(validTo) : null;
  return (!from || from <= now) && (!to || to >= now);
}

function isUpcoming(validFrom, daysAhead = 21) {
  if (!validFrom) return false;
  const now = new Date();
  const from = new Date(validFrom);
  const ahead = new Date();
  ahead.setDate(now.getDate() + daysAhead);
  return from > now && from <= ahead;
}

router.get('/', async (req, res, next) => {
  try {
    const { market, current, upcoming, limit = '100', offset = '0' } = req.query;

    let brochures = await marktguru.fetchAllBrochures();

    if (market) {
      const marketIds = String(market).toLowerCase().split(',');
      brochures = brochures.filter(b =>
        marketIds.includes(b.marketId?.toLowerCase()) ||
        marketIds.includes(b.marketName?.toLowerCase()) ||
        marketIds.includes(b.retailerName?.toLowerCase())
      );
    }

    if (current === 'true') {
      brochures = brochures.filter(b => isCurrent(b.validFrom, b.validTo));
    }

    if (upcoming === 'true') {
      brochures = brochures.filter(b => isUpcoming(b.validFrom, 21));
    }

    const total = brochures.length;
    const start = parseInt(offset, 10) || 0;
    const count = parseInt(limit, 10) || 100;
    const paginated = brochures.slice(start, start + count);

    res.json({
      total,
      offset: start,
      limit: count,
      returned: paginated.length,
      brochures: paginated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
