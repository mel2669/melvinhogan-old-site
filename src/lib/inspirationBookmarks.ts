import fs from "node:fs";
import path from "node:path";

export type InspirationBookmark = {
  category: string;
  title: string;
  url: string;
};

/** CSV columns: category, title, url (URL is last; may contain commas only if encoded in source) */
export function parseInspirationBookmarksCsv(csv: string): InspirationBookmark[] {
  const rows: InspirationBookmark[] = [];
  for (const line of csv.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lastComma = trimmed.lastIndexOf(",");
    if (lastComma === -1) continue;
    const url = trimmed.slice(lastComma + 1).trim();
    if (!url.startsWith("http")) continue;
    const rest = trimmed.slice(0, lastComma);
    const firstComma = rest.indexOf(",");
    if (firstComma === -1) continue;
    const category = rest.slice(0, firstComma).trim();
    const title = rest.slice(firstComma + 1).trim();
    rows.push({ category, title, url });
  }
  return rows;
}

export function groupBookmarksByCategory(
  items: InspirationBookmark[],
): Map<string, InspirationBookmark[]> {
  const map = new Map<string, InspirationBookmark[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export function loadInspirationBookmarksFromRepo(): InspirationBookmark[] {
  const csvPath = path.join(process.cwd(), "src/data/inspiration_bookmarks.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  return parseInspirationBookmarksCsv(csv);
}
