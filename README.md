# Supermarkt-API Mannheim

REST-API für aktuelle und kommende Supermarkt-Angebote in Mannheim und Umgebung (10 km Radius, ohne Ludwigshafen). Datenquelle ist [marktguru.de](https://www.marktguru.de).

## Abgedeckte Märkte

- REWE
- PENNY
- Lidl
- ALDI NORD
- ALDI SÜD
- EDEKA
- Marktkauf
- Kaufland
- Netto Marken-Discount

## Schnellstart mit Docker

```bash
cp .env.example .env
# Optional: eigene PLZs in .env oder zipcodes.local eintragen
docker compose up --build
```

Die API ist dann unter `http://localhost:3000` erreichbar.

### Eigene PLZs hinterlegen

Um deine eigenen PLZs nicht ins Repository zu committen, gibt es drei Möglichkeiten:

1. **`.env`** – wird von Git ignoriert  
   ```env
   ZIP_CODES=68159,68161,68309,68519
   ```

2. **`.env.local`** – wird ebenfalls ignoriert und hat Vorrang vor `.env`

3. **`zipcodes.local`** – eine Zeile pro PLZ  
   ```text
   68159
   68161
   68309
   68519
   ```

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `PORT` | `3000` | Port des Servers |
| `ZIP_CODES` | kommagetrennte Liste | PLZs im 10 km Radius um Mannheim |
| `CACHE_TTL_MINUTES` | `60` | Cache-Ablaufzeit in Minuten |
| `REFRESH_CRON` | `0 */6 * * *` | Cron für automatische Datenaktualisierung |
| `API_RATE_LIMIT_PER_MINUTE` | `60` | Rate-Limit pro IP und Minute |

## API-Endpunkte

### Gesundheit / Status

- `GET /api/health` – Server-Status
- `GET /api/status` – Konfiguration (PLZs, Märkte, Cron)
- `POST /api/refresh` – Cache leeren und Daten neu laden

### Märkte

- `GET /api/markets` – Liste der unterstützten Märkte

### Angebote

- `GET /api/offers?market=rewe&search=Milch&current=true&limit=50`

Query-Parameter:

- `market` – Markt-ID, -Name oder mehrere kommagetrennt (z. B. `rewe,lidl`)
- `search` – Produktsuche (Titel, Beschreibung, Marke, Kategorie)
- `current` – `true` filtert auf aktuell gültige Angebote
- `upcoming` – `true` filtert auf Angebote, die in den nächsten 14 Tagen starten
- `limit` / `offset` – Pagination

### Prospekte

- `GET /api/brochures?market=rewe&current=true&upcoming=true`

Query-Parameter:

- `market` – Markt-ID, -Name oder mehrere kommagetrennt
- `current` – `true` für aktuelle Prospekte
- `upcoming` – `true` für Prospekte der nächsten 3 Wochen
- `limit` / `offset` – Pagination

## Entwicklung ohne Docker

Voraussetzung: Node.js ≥ 20

```bash
npm install
cp .env.example .env
npm run dev
```

## Hinweise

- Die Daten werden beim Start und per Cron aus marktguru.de geladen und in einer SQLite-Datenbank zwischengespeichert.
- Öffentliche Prospekt-Portale können ihre Struktur ändern; bei dauerhaften Fehlern muss der Scraper-Teil angepasst werden.
- Die API respektiert die Cache-Zeiten, um marktguru.de nicht unnötig zu belasten.

<details>
<summary><h2 style="display: inline-block; margin: 0;">📘 Vollständige API-Referenz</h2></summary>

### `GET /api/health`

Server-Lebenszeichen.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-08T06:27:10.668Z"
}
```

---

### `GET /api/status`

Aktuelle Konfiguration der API.

**Response:**
```json
{
  "zipCodes": ["68159", "68161", "68309", "68519"],
  "markets": ["rewe", "penny", "lidl", "aldi-nord", "aldi-sued", "edeka", "marktkauf", "kaufland", "netto"],
  "cacheTtlMinutes": 60,
  "refreshCron": "0 */6 * * *"
}
```

---

### `POST /api/refresh`

Löscht den Cache und lädt alle Angebote und Prospekte neu.

**Response:**
```json
{
  "status": "refreshed",
  "timestamp": "2026-07-08T06:37:12.245Z"
}
```

---

### `GET /api/markets`

Liste aller unterstützten Märkte.

**Response:**
```json
{
  "count": 9,
  "markets": [
    { "id": "rewe", "name": "REWE", "category": "Supermarkt" },
    { "id": "penny", "name": "PENNY", "category": "Discounter" },
    { "id": "lidl", "name": "Lidl", "category": "Discounter" },
    { "id": "aldi-nord", "name": "ALDI NORD", "category": "Discounter" },
    { "id": "aldi-sued", "name": "ALDI SÜD", "category": "Discounter" },
    { "id": "edeka", "name": "EDEKA", "category": "Supermarkt" },
    { "id": "marktkauf", "name": "Marktkauf", "category": "Supermarkt" },
    { "id": "kaufland", "name": "Kaufland", "category": "Supermarkt" },
    { "id": "netto", "name": "Netto Marken-Discount", "category": "Discounter" }
  ]
}
```

---

### `GET /api/offers`

Sucht und filtert Angebote aus Mannheim und Umgebung.

**Query-Parameter:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `market` | string | Markt-ID, -Name oder kommagetrennte Liste (z. B. `rewe,lidl`) |
| `search` | string | Suchbegriff für Titel, Beschreibung, Marke oder Kategorie |
| `current` | boolean | `true` = aktuell gültige Angebote |
| `upcoming` | boolean | `true` = Angebote, die in den nächsten 14 Tagen starten |
| `limit` | integer | Maximale Anzahl Ergebnisse (default: `100`) |
| `offset` | integer | Offset für Pagination (default: `0`) |

**Beispiel:** `GET /api/offers?market=rewe&search=Milch&current=true&limit=1`

**Response:**
```json
{
  "total": 8,
  "offset": 0,
  "limit": 1,
  "returned": 1,
  "offers": [
    {
      "id": 23903690,
      "title": "Nudelsalat",
      "description": "Schwäbische Art, je 100 g",
      "price": 0.99,
      "oldPrice": null,
      "referencePrice": 9.9,
      "unit": "kg",
      "brand": "thisisnobrand123",
      "category": "Nudelsalate",
      "retailerId": "126802",
      "retailerName": "REWE",
      "marketId": "rewe",
      "marketName": "REWE",
      "leafletFlightId": 284276,
      "validFrom": "2026-07-05T22:00:00Z",
      "validTo": "2026-07-11T21:59:59Z",
      "imageUrl": "https://cdn.marktguru.de/api/v1/offers/23903690/images/default/0/medium.webp",
      "sourceUrl": "https://www.marktguru.de"
    }
  ]
}
```

---

### `GET /api/brochures`

Sucht und filtert Prospekte.

**Query-Parameter:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `market` | string | Markt-ID, -Name oder kommagetrennte Liste |
| `current` | boolean | `true` = aktuell gültige Prospekte |
| `upcoming` | boolean | `true` = Prospekte der nächsten 3 Wochen |
| `limit` | integer | Maximale Anzahl Ergebnisse (default: `100`) |
| `offset` | integer | Offset für Pagination (default: `0`) |

**Beispiel:** `GET /api/brochures?market=lidl&current=true&limit=1`

**Response:**
```json
{
  "total": 1,
  "offset": 0,
  "limit": 1,
  "returned": 1,
  "brochures": [
    {
      "id": 284648,
      "title": "Lidl",
      "retailerId": "126679",
      "retailerName": "Lidl",
      "marketId": "lidl",
      "marketName": "Lidl",
      "validFrom": "2026-07-05T22:00:00Z",
      "validTo": "2026-07-11T21:59:00Z",
      "pageCount": 62,
      "imageUrl": "https://cdn.marktguru.de/api/v1/leaflets/284648/images/pages/0/medium.webp",
      "sourceUrl": "https://www.marktguru.de/rp/lidl-prospekte"
    }
  ]
}
```

</details>
