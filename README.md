## melvinhogan-site

Static Astro site.

### Development

```bash
npm install
npm run dev
```

### Books page (Amazon Product Advertising API)

The `/books.html` page can render book cover/title/author using **Amazon Product Advertising API (PA-API)**.

#### 1) Add books by ASIN

Edit `src/data/books.ts` and add entries with:
- `asin` (Amazon Standard Identification Number)
- `yearRead` (used to group books by year)
- optional `note`

#### 2) Configure environment variables

Set these in **Vercel** (Project → Settings → Environment Variables) and optionally in local shell:

- `AMAZON_PAAPI_ACCESS_KEY`
- `AMAZON_PAAPI_SECRET_KEY`
- `AMAZON_PAAPI_PARTNER_TAG` (example: `yourtag-20`)
- `AMAZON_PAAPI_REGION` (recommended: `us-east-1`)
- `AMAZON_PAAPI_HOST` (recommended: `webservices.amazon.com`)

#### 3) How it works (static + cached)

- On build, a script fetches metadata via PA-API `GetItems` and writes a cache file:
  - `src/data/books.amazon.cache.json`
- If env vars are missing, the build **skips fetching** and uses the committed cache file.
- The script uses a TTL so it only refreshes stale/missing ASINs.
- On **Vercel**, once env vars are set, builds will refresh the cache automatically via the `prebuild` step.

