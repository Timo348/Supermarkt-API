import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

dotenv.config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const markets = JSON.parse(readFileSync(join(__dirname, 'data', 'markets.json'), 'utf8'));

// Beispiel-PLZs im Mannheimer Raum (keine echten Privat-PLZs).
// Für eigene PLZs .env, .env.local oder zipcodes.local verwenden (siehe .gitignore).
const DEFAULT_ZIP_CODES = ['68159', '68161', '68309', '68519'];

function readLocalZipCodes() {
  const localFile = join(process.cwd(), 'zipcodes.local');
  if (existsSync(localFile)) {
    const content = readFileSync(localFile, 'utf8');
    return content.split(/\r?\n/).map(z => z.trim()).filter(Boolean);
  }
  return null;
}

function parseZipCodes() {
  if (process.env.ZIP_CODES) {
    return process.env.ZIP_CODES.split(',').map(z => z.trim()).filter(Boolean);
  }

  const local = readLocalZipCodes();
  if (local && local.length > 0) {
    return local;
  }

  return DEFAULT_ZIP_CODES;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  zipCodes: parseZipCodes(),
  cacheTtlMinutes: parseInt(process.env.CACHE_TTL_MINUTES || '60', 10),
  refreshCron: process.env.REFRESH_CRON || '0 */6 * * *',
  rateLimitPerMinute: parseInt(process.env.API_RATE_LIMIT_PER_MINUTE || '60', 10),
  dbPath: process.env.DB_PATH || join(__dirname, 'database', 'cache.db'),
  markets,
  marketsById: new Map(markets.map(m => [m.id, m])),
  marketsByRetailerId: new Map(markets.map(m => [m.retailerId, m]))
};
