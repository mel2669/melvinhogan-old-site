import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "../..");
const CACHE_PATH = path.join(ROOT, "src/data/books.amazon.cache.json");

const ACCESS_KEY = process.env.AMAZON_PAAPI_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_PAAPI_SECRET_KEY;
const PARTNER_TAG = process.env.AMAZON_PAAPI_PARTNER_TAG;
const REGION = process.env.AMAZON_PAAPI_REGION || "us-east-1";
const HOST = process.env.AMAZON_PAAPI_HOST || "webservices.amazon.com";
const TTL_DAYS = Number(process.env.AMAZON_PAAPI_TTL_DAYS || 14);

function hasCreds() {
  return Boolean(ACCESS_KEY && SECRET_KEY && PARTNER_TAG);
}

function iso8601Basic(date) {
  // YYYYMMDD'T'HHMMSS'Z'
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function yyyymmdd(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate());
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmac(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(encoding);
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function buildAuthorizationHeader({ amzDate, dateStamp, canonicalRequestHash }) {
  const service = "ProductAdvertisingAPI";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${REGION}/${service}/aws4_request`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = getSigningKey(SECRET_KEY, dateStamp, REGION, service);
  const signature = hmac(signingKey, stringToSign, "hex");

  return `${algorithm} Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function readBooksAsins() {
  // Import TS via ESM by reading and simple extraction of asin strings.
  // This keeps dependencies at zero, but assumes the file contains `asin: "..."` entries.
  const booksPath = path.join(ROOT, "src/data/books.ts");
  const src = await fs.readFile(booksPath, "utf8");
  const asins = Array.from(src.matchAll(/asin:\s*["']([A-Z0-9]{10})["']/g)).map((m) => m[1]);
  return Array.from(new Set(asins));
}

async function readCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: 1, updatedAt: null, ttlDays: TTL_DAYS, items: {} };
  }
}

async function writeCache(cache) {
  const pretty = JSON.stringify(cache, null, 2) + "\n";
  await fs.writeFile(CACHE_PATH, pretty, "utf8");
}

function isStale(entry, nowMs, ttlDays) {
  if (!entry?.lastFetchedAt) return true;
  const t = Date.parse(entry.lastFetchedAt);
  if (!Number.isFinite(t)) return true;
  return nowMs - t > ttlDays * 24 * 60 * 60 * 1000;
}

async function paapiGetItems(asins) {
  const endpoint = `https://${HOST}/paapi5/getitems`;
  const amzDate = iso8601Basic(new Date());
  const dateStamp = yyyymmdd(new Date());

  const payloadObj = {
    ItemIds: asins,
    Resources: [
      "Images.Primary.Large",
      "ItemInfo.Title",
      "ItemInfo.ByLineInfo",
    ],
    PartnerTag: PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: "www.amazon.com",
  };
  const payload = JSON.stringify(payloadObj);
  const payloadHash = sha256Hex(payload);

  const method = "POST";
  const canonicalUri = "/paapi5/getitems";
  const canonicalQuery = "";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = sha256Hex(canonicalRequest);
  const authorization = buildAuthorizationHeader({ amzDate, dateStamp, canonicalRequestHash });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": "application/json; charset=utf-8",
      host: HOST,
      "x-amz-date": amzDate,
      "x-amz-target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems",
      Authorization: authorization,
    },
    body: payload,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PA-API error ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

function pickAuthor(item) {
  const byline = item?.ItemInfo?.ByLineInfo;
  const contributors = byline?.Contributors;
  if (Array.isArray(contributors) && contributors.length > 0) {
    const authors = contributors
      .filter((c) => (c?.Role || "").toLowerCase().includes("author"))
      .map((c) => c?.Name)
      .filter(Boolean);
    if (authors.length > 0) return authors.join(", ");
  }
  return byline?.Manufacturer?.DisplayValue || undefined;
}

function normalizeItem(item) {
  const asin = item?.ASIN;
  if (!asin) return null;
  const title = item?.ItemInfo?.Title?.DisplayValue || null;
  const author = pickAuthor(item) || null;
  const detailPageUrl = item?.DetailPageURL || null;
  const imageUrl = item?.Images?.Primary?.Large?.URL || null;
  return { asin, title, author, detailPageUrl, imageUrl };
}

async function main() {
  const cache = await readCache();
  cache.ttlDays = TTL_DAYS;
  cache.version = 1;

  const asins = await readBooksAsins();
  if (asins.length === 0) {
    console.log("[paapi] No ASINs found in src/data/books.ts; nothing to fetch.");
    return;
  }

  if (!hasCreds()) {
    console.log("[paapi] Missing env vars; skipping fetch and using existing cache.");
    return;
  }

  const nowMs = Date.now();
  const items = cache.items || {};
  const stale = asins.filter((asin) => isStale(items[asin], nowMs, TTL_DAYS));

  if (stale.length === 0) {
    console.log(`[paapi] Cache fresh for ${asins.length} ASIN(s); nothing to fetch.`);
    return;
  }

  console.log(`[paapi] Fetching ${stale.length} ASIN(s) from Amazon PA-API...`);

  const batchSize = 10;
  for (let i = 0; i < stale.length; i += batchSize) {
    const batch = stale.slice(i, i + batchSize);
    const json = await paapiGetItems(batch);
    const responseItems = json?.ItemsResult?.Items || [];
    for (const rawItem of responseItems) {
      const n = normalizeItem(rawItem);
      if (!n) continue;
      items[n.asin] = {
        ...items[n.asin],
        title: n.title,
        author: n.author,
        detailPageUrl: n.detailPageUrl,
        imageUrl: n.imageUrl,
        lastFetchedAt: new Date().toISOString(),
      };
    }
  }

  cache.items = items;
  cache.updatedAt = new Date().toISOString();
  await writeCache(cache);
  console.log(`[paapi] Updated cache: ${CACHE_PATH}`);
}

main().catch((err) => {
  console.error("[paapi] Failed:", err);
  process.exitCode = 1;
});

