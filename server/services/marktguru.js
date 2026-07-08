import { config } from '../config.js';
import * as cache from './cache.js';

const MARKTGURU_BASE_URL = 'https://api.marktguru.de/api/v1';
const MARKTGURU_WEB_URL = 'https://marktguru.de';

const RETAILER_URL_NAMES = new Map(config.markets.map(m => [m.retailerId, m.urlName]));
const RETAILER_NAMES = new Map(config.markets.map(m => [m.retailerId, m.name]));

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...options.headers
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export async function getApiKeys() {
  const cached = cache.get('marktguru:keys');
  if (cached) return cached;

  const res = await fetch(MARKTGURU_WEB_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();

  const match = html.match(/<script type="application\/json">(.*?)<\/script>/s);
  if (!match) {
    throw new Error('Could not find marktguru config in HTML');
  }

  const data = JSON.parse(match[1]);
  const keys = {
    apiKey: data?.config?.apiKey,
    clientKey: data?.config?.clientKey
  };

  if (!keys.apiKey || !keys.clientKey) {
    throw new Error('marktguru API keys missing in config');
  }

  cache.set('marktguru:keys', keys, 60 * 24); // 24 Stunden
  return keys;
}

async function fetchWithAuth(path, searchParams = {}) {
  const keys = await getApiKeys();
  const url = new URL(`${MARKTGURU_BASE_URL}/${path}`);
  url.searchParams.set('as', 'web');
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return fetchJson(url.toString(), {
    headers: {
      'x-apikey': keys.apiKey,
      'x-clientkey': keys.clientKey
    }
  });
}

export async function fetchOffersForZip(zipCode, limit = 1000, offset = 0) {
  const data = await fetchWithAuth('offers', {
    zipCode,
    limit,
    offset
  });

  return (data.results || []).map(normalizeOffer);
}

export async function fetchAllOffersForZip(zipCode, maxOffers = 5000) {
  const offers = [];
  const limit = 1000;

  while (offers.length < maxOffers) {
    const batch = await fetchOffersForZip(zipCode, limit, offers.length);
    if (batch.length === 0) break;
    offers.push(...batch);
    if (batch.length < limit) break;
  }

  return offers.slice(0, maxOffers);
}

export async function fetchAllOffers() {
  const cacheKey = 'offers:all';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const results = [];
  for (const zipCode of config.zipCodes) {
    try {
      const offers = await fetchAllOffersForZip(zipCode, 2000);
      results.push(...offers);
    } catch (err) {
      console.error(`Failed to fetch offers for ${zipCode}:`, err.message);
    }
  }

  const seen = new Set();
  const uniqueOffers = [];
  for (const offer of results) {
    if (!seen.has(offer.id)) {
      seen.add(offer.id);
      uniqueOffers.push(offer);
    }
  }

  cache.set(cacheKey, uniqueOffers);
  return uniqueOffers;
}

export async function fetchBrochuresForMarket(market) {
  const cacheKey = `brochures:${market.id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `https://www.marktguru.de/rp/${market.urlName}-prospekte`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  const html = await res.text();
  const match = html.match(/<script type="application\/json">(.*?)<\/script>/s);
  if (!match) {
    throw new Error('Could not find JSON data on brochure page');
  }

  const data = JSON.parse(match[1]);
  const leaflets = [];

  function extractLeaflets(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(extractLeaflets);
    } else if (obj && typeof obj === 'object') {
      if (Number.isInteger(obj.id) && obj.validFrom && obj.validTo && obj.advertiser) {
        leaflets.push(normalizeBrochure(obj));
      }
      Object.values(obj).forEach(extractLeaflets);
    }
  }

  extractLeaflets(data.data || data.content);

  // Nur Prospekte des gewünschten Marktes (manchmal sind auch verwandte Händler enthalten)
  const filtered = leaflets.filter(b => {
    if (!b.retailerName) return false;
    return (
      b.retailerName.toLowerCase() === market.name.toLowerCase() ||
      market.name.toLowerCase().includes(b.retailerName.toLowerCase()) ||
      b.retailerName.toLowerCase().includes(market.name.replace('Marken-Discount', '').trim().toLowerCase())
    );
  });

  // Nach Gültigkeit sortieren (aktuellste zuerst)
  filtered.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom));

  cache.set(cacheKey, filtered);
  return filtered;
}

export async function fetchAllBrochures() {
  const cacheKey = 'brochures:all';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const results = [];
  for (const market of config.markets) {
    try {
      const brochures = await fetchBrochuresForMarket(market);
      results.push(...brochures);
    } catch (err) {
      console.error(`Failed to fetch brochures for ${market.name}:`, err.message);
    }
  }

  cache.set(cacheKey, results);
  return results;
}

function normalizeOffer(raw) {
  const advertiser = raw.advertisers?.[0];
  const market = advertiser
    ? config.marketsByRetailerId.get(advertiser.id.replace('retailers/', ''))
    : null;

  return {
    id: raw.id,
    title: raw.product?.name || raw.description || 'Unbekanntes Angebot',
    description: raw.description || null,
    price: raw.price,
    oldPrice: raw.oldPrice,
    referencePrice: raw.referencePrice,
    unit: raw.unit?.shortName || null,
    brand: raw.brand?.name || null,
    category: raw.categories?.[0]?.name || null,
    retailerId: advertiser?.id?.replace('retailers/', '') || null,
    retailerName: advertiser?.name || market?.name || null,
    marketId: market?.id || null,
    marketName: market?.name || advertiser?.name || null,
    leafletFlightId: raw.leafletFlightId,
    validFrom: raw.validityDates?.[0]?.from || null,
    validTo: raw.validityDates?.[0]?.to || null,
    imageUrl: raw.id
      ? `https://cdn.marktguru.de/api/v1/offers/${raw.id}/images/default/0/medium.webp`
      : null,
    sourceUrl: 'https://www.marktguru.de'
  };
}

function normalizeBrochure(raw) {
  const advertiser = raw.advertiser;
  const advertiserName = typeof advertiser === 'string' ? advertiser : advertiser?.name;
  const advertiserId = typeof advertiser === 'object' ? advertiser?.id : null;
  const retailerId = advertiserId ? String(advertiserId).replace('retailers/', '') : null;
  const market = retailerId ? config.marketsByRetailerId.get(retailerId) : null;

  return {
    id: raw.id,
    title: raw.name || `${advertiserName || 'Prospekt'}`,
    retailerId,
    retailerName: advertiserName || null,
    marketId: market?.id || null,
    marketName: market?.name || advertiserName || null,
    validFrom: raw.validFrom,
    validTo: raw.validTo,
    pageCount: raw.pageCount || raw.pageImages?.count || null,
    imageUrl: raw.id
      ? `https://cdn.marktguru.de/api/v1/leaflets/${raw.id}/images/pages/0/medium.webp`
      : null,
    sourceUrl: `https://www.marktguru.de/rp/${market?.urlName || advertiserName?.toLowerCase()?.replace(/\s+/g, '-') || ''}-prospekte`
  };
}
