import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const markets = JSON.parse(readFileSync(join(__dirname, 'data', 'markets.json'), 'utf8'));

// PLZs im 10km-Radius um Mannheim (ohne Ludwigshafen), inkl. Viernheim
const DEFAULT_ZIP_CODES = [
  // Mannheim
  '68159', '68161', '68163', '68165', '68167', '68169', '68199',
  '68219', '68229', '68239', '68259', '68305', '68307', '68309',
  // Umgebung
  '68519', // Viernheim
  '68549', // Ilvesheim
  '68535', // Edingen-Neckarhausen
  '68526', // Ladenburg
  '69198', // Schriesheim
  '69221', // Dossenheim
  '69214', // Eppelheim
  '68723', // Schwetzingen / Plankstadt / Oftersheim
  '68782', // Brühl
  '68775', // Ketsch
  '68804', // Altlußheim
  '68809', // Neulußheim
  '68766'  // Hockenheim
];

function parseZipCodes() {
  const raw = process.env.ZIP_CODES || DEFAULT_ZIP_CODES.join(',');
  return raw.split(',').map(z => z.trim()).filter(Boolean);
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
