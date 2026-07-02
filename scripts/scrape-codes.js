// Scraper pro slevové kódy — stahuje veřejně přístupné kupónové agregátory
// a hledá aktivní kódy pro obchody, které StylerOM sleduje (GANT, Answear,
// Reserved, Peek & Cloppenburg, Zalando, Baťa…).
//
// STEJNÉ OMEZENÍ jako u scripts/scrape.js: selektory byly psány bez
// možnosti ověřit živé HTML (síťová politika vývojového prostředí odchozí
// požadavky blokovala). Po prvním běhu v GitHub Actions zkontrolujte log —
// pokud zdroj hlásí „0 kódů nalezeno“, HTML struktura se liší a je potřeba
// selektor upravit.
//
// Výstup: data/discount-codes.json — pole { store, code, discount,
// description, expiry, url, source, scrapedAt }. Web (js/app.js) je
// zobrazuje v samostatné sekci „Ověřené slevové kódy“, odděleně od
// ručního seznamu produktů — kódy totiž nejde spolehlivě spárovat
// s konkrétní kategorií/kouskem oblečení.

import * as cheerio from "cheerio";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "discount-codes.json");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; StylerOMBot/1.0; +https://github.com/singwin1/stylerom)",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};

// Obchody, pro které nás kódy zajímají — filtr, aby scraper na
// agregátorech nesbíral kódy pro nesouvisející e-shopy.
const TRACKED_STORES = [
  "gant",
  "answear",
  "reserved",
  "peek",
  "cloppenburg",
  "zalando",
  "bata",
  "wojas",
  "massimo dutti",
  "c&a",
  "c & a",
  "marks",
  "spencer",
];

function isTrackedStore(name) {
  const n = name.toLowerCase();
  return TRACKED_STORES.some((s) => n.includes(s));
}

function parseDiscountPercent(text) {
  if (!text) return null;
  const match = text.match(/(\d{1,3})\s*%/);
  return match ? parseInt(match[1], 10) : null;
}

const SOURCES = [
  {
    name: "Kupon.cz",
    url: "https://www.kupon.cz/",
    parse($, baseUrl) {
      const items = [];
      $(".coupon, .coupon-item, .voucher-item, li.coupon-list-item").each((_, el) => {
        const $el = $(el);
        const store = $el.find(".shop-name, .merchant, .store-name").first().text().trim();
        const code = $el.find(".coupon-code, .code, [data-code]").first().text().trim() ||
          $el.attr("data-code");
        const description = $el.find(".coupon-title, .title, .description").first().text().trim();
        const expiry = $el.find(".expiry, .valid-until, .date").first().text().trim() || null;
        if (!store || !code) return;
        items.push({ store, code, description, expiry });
      });
      return items;
    },
  },
  {
    name: "Slevovekupony.cz",
    url: "https://www.slevovekupony.cz/",
    parse($, baseUrl) {
      const items = [];
      $(".voucher, .coupon-box, li.voucher-item").each((_, el) => {
        const $el = $(el);
        const store = $el.find(".shop, .brand, .store").first().text().trim();
        const code = $el.find(".code, .voucher-code").first().text().trim();
        const description = $el.find(".headline, .title, h3").first().text().trim();
        const expiry = $el.find(".valid, .expiry").first().text().trim() || null;
        if (!store || !code) return;
        items.push({ store, code, description, expiry });
      });
      return items;
    },
  },
];

async function scrapeSource(source) {
  const res = await fetch(source.url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} pro ${source.url}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const rawItems = source.parse($, source.url);

  return rawItems
    .filter((item) => item.store && item.code && isTrackedStore(item.store))
    .slice(0, 15)
    .map((item) => ({
      store: item.store,
      code: item.code.trim(),
      discount: parseDiscountPercent(item.description) || parseDiscountPercent(item.code),
      description: item.description || "Slevový kód nalezený automaticky.",
      expiry: item.expiry || null,
      url: source.url,
      source: "scraper",
      sourceSite: source.name,
      scrapedAt: new Date().toISOString(),
    }));
}

async function loadPrevious() {
  try {
    const raw = await readFile(OUT_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const previous = await loadPrevious();
  const previousBySite = new Map();
  for (const item of previous) {
    if (!previousBySite.has(item.sourceSite)) previousBySite.set(item.sourceSite, []);
    previousBySite.get(item.sourceSite).push(item);
  }

  const results = [];
  let anySucceeded = false;

  for (const source of SOURCES) {
    try {
      const items = await scrapeSource(source);
      if (items.length === 0) {
        console.warn(
          `[warn] ${source.name}: 0 kódů nalezeno pro sledované obchody — selektory pravděpodobně neodpovídají aktuální struktuře stránky, ponechávám předchozí data.`
        );
        results.push(...(previousBySite.get(source.name) || []));
        continue;
      }
      console.log(`[ok] ${source.name}: nalezeno ${items.length} kódů`);
      results.push(...items);
      anySucceeded = true;
    } catch (err) {
      console.error(`[error] ${source.name}: ${err.message}`);
      results.push(...(previousBySite.get(source.name) || []));
    }
  }

  if (!anySucceeded && previous.length > 0) {
    console.warn("[warn] Žádný zdroj se nepodařilo stáhnout, ponechávám beze změny.");
    return;
  }

  await writeFile(OUT_FILE, JSON.stringify(results, null, 2) + "\n", "utf-8");
  console.log(`Zapsáno ${results.length} kódů do ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Scraper kódů selhal:", err);
  process.exitCode = 1;
});
