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

function isUpcoming(validFrom, daysAhead = 14) {
  if (!validFrom) return false;
  const now = new Date();
  const from = new Date(validFrom);
  const ahead = new Date();
  ahead.setDate(now.getDate() + daysAhead);
  return from > now && from <= ahead;
}

router.get('/', async (req, res, next) => {
  try {
    const {
      market,
      search,
      current,
      upcoming,
      limit = '100',
      offset = '0'
    } = req.query;

    let offers = await marktguru.fetchAllOffers();

    if (market) {
      const marketIds = String(market).toLowerCase().split(',');
      offers = offers.filter(o =>
        marketIds.includes(o.marketId?.toLowerCase()) ||
        marketIds.includes(o.marketName?.toLowerCase()) ||
        marketIds.includes(o.retailerName?.toLowerCase())
      );
    }

    if (search) {
      const terms = String(search).toLowerCase().split(/\s+/).filter(Boolean);
      offers = offers.filter(o =>
        terms.every(term =>
          (o.title && o.title.toLowerCase().includes(term)) ||
          (o.description && o.description.toLowerCase().includes(term)) ||
          (o.brand && o.brand.toLowerCase().includes(term)) ||
          (o.category && o.category.toLowerCase().includes(term))
        )
      );
    }

    if (current === 'true') {
      offers = offers.filter(o => isCurrent(o.validFrom, o.validTo));
    }

    if (upcoming === 'true') {
      offers = offers.filter(o => isUpcoming(o.validFrom, 14));
    }

    const total = offers.length;
    const start = parseInt(offset, 10) || 0;
    const count = parseInt(limit, 10) || 100;
    const paginated = offers.slice(start, start + count);

    res.json({
      total,
      offset: start,
      limit: count,
      returned: paginated.length,
      offers: paginated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
