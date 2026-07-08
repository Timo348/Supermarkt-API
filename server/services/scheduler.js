import cron from 'node-cron';
import { config } from '../config.js';
import * as cache from './cache.js';

let isRunning = false;

async function refreshData() {
  if (isRunning) {
    console.log('Refresh already in progress, skipping...');
    return;
  }

  isRunning = true;
  console.log(`[${new Date().toISOString()}] Starting scheduled refresh...`);

  try {
    cache.clear();
    const { fetchAllOffers, fetchAllBrochures } = await import('./marktguru.js');
    const [offers, brochures] = await Promise.all([
      fetchAllOffers(),
      fetchAllBrochures()
    ]);
    console.log(`[${new Date().toISOString()}] Refresh complete: ${offers.length} offers, ${brochures.length} brochures`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Refresh failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  if (!cron.validate(config.refreshCron)) {
    console.warn('Invalid REFRESH_CRON expression, using default: 0 */6 * * *');
    config.refreshCron = '0 */6 * * *';
  }

  cron.schedule(config.refreshCron, refreshData);
  console.log(`Scheduler started with cron: ${config.refreshCron}`);
}
