// Scraper pro StylerOM — stahuje aktuální zlevněné kousky old-money stylu
// z veřejně přístupných výprodejových stránek e-shopů dostupných v ČR.
//
// DŮLEŽITÉ: selektory níže byly psány bez možnosti ověřit živé HTML (viz
// README). Po prvním běhu v GitHub Actions zkontrolujte log — pokud zdroj
// vrátí 0 položek, HTML struktura obchodu se pravděpodobně liší od
// předpokladu a selektor je potřeba upravit podle skutečné stránky.
//
// Výstup: data/scraped-deals.json — pole objektů ve stejném tvaru jako
// ruční DEALS v js/data.js. Web (js/app.js) je při načtení stránky
// dotáhne a připojí k ručně kurátorskému seznamu.

import * as cheerio from "cheerio";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "scraped-deals.json");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; StylerOMBot/1.0; +https://github.com/singwin1/stylerom)",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};

function parsePriceCZK(text) {
  if (!text) return null;
  const match = text.replace(/ /g, " ").match(/(\d[\d\s]*)\s*Kč/);
  if (!match) return null;
  return parseInt(match[1].replace(/\s/g, ""), 10);
}

function discountFromPrices(original, current) {
  if (!original || !current || original <= current) return null;
  return Math.round((1 - current / original) * 100);
}

const SOURCES = [
  {
    store: "GANT.cz",
    url: "https://www.gant.cz/damska-saka-a-blazery-2/f/sleva-50",
    category: "saka",
    parse($) {
      const items = [];
      $(".product-tile, .product-item, li.product").each((_, el) => {
        const $el = $(el);
        const title = $el.find(".product-name, .product-title, h3").first().text().trim();
        const link = $el.find("a").first().attr("href");
        const original = parsePriceCZK($el.find(".price-old, .strike-through, del").first().text());
        const current = parsePriceCZK($el.find(".price-new, .price-sales, .price").first().text());
        if (!title || !link) return;
        items.push({ title, link, original, current });
      });
      return items;
    },
  },
  {
    store: "Answear.cz",
    url: "https://answear.cz/vyprodej",
    category: "svetry",
    parse($) {
      const items = [];
      $("[data-testid='product-card'], .product-card, .product-box").each((_, el) => {
        const $el = $(el);
        const title = $el.find("[data-testid='product-name'], .product-name, .name").first().text().trim();
        const link = $el.find("a").first().attr("href");
        const original = parsePriceCZK($el.find(".price--old, .price-old, del").first().text());
        const current = parsePriceCZK($el.find(".price--new, .price-new, .price").first().text());
        if (!title || !link) return;
        items.push({ title, link, original, current });
      });
      return items;
    },
  },
  {
    store: "Baťa.cz",
    url: "https://www.bata.cz/vyprodej/",
    category: "boty",
    parse($) {
      const items = [];
      $(".product-tile, .product, li.item").each((_, el) => {
        const $el = $(el);
        const title = $el.find(".product-title, .name, h3").first().text().trim();
        const link = $el.find("a").first().attr("href");
        const original = parsePriceCZK($el.find(".old-price, del").first().text());
        const current = parsePriceCZK($el.find(".sale-price, .price").first().text());
        if (!title || !link) return;
        items.push({ title, link, original, current });
      });
      return items;
    },
  },
];

function toAbsoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

async function scrapeSource(source) {
  const res = await fetch(source.url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} pro ${source.url}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const rawItems = source.parse($);

  return rawItems
    .filter((item) => item.title && item.link)
    .slice(0, 8)
    .map((item) => {
      const discount = discountFromPrices(item.original, item.current);
      return {
        store: source.store,
        title: item.title,
        note: item.original && item.current
          ? `Aktuálně ${item.current} Kč (z ${item.original} Kč).`
          : "Automaticky nalezená položka ve výprodejové sekci.",
        category: source.category,
        discount,
        priceNote: item.current
          ? `${item.current} Kč${item.original ? ` (z ${item.original} Kč)` : ""}`
          : "dle aktuální nabídky",
        url: toAbsoluteUrl(source.url, item.link),
        verified: Boolean(item.original && item.current),
        source: "scraper",
        scrapedAt: new Date().toISOString(),
      };
    });
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
  const previousByStore = new Map();
  for (const item of previous) {
    if (!previousByStore.has(item.store)) previousByStore.set(item.store, []);
    previousByStore.get(item.store).push(item);
  }

  const results = [];
  let anySucceeded = false;

  for (const source of SOURCES) {
    try {
      const items = await scrapeSource(source);
      if (items.length === 0) {
        console.warn(
          `[warn] ${source.store}: 0 položek nalezeno — selektory pravděpodobně neodpovídají aktuální struktuře stránky, ponechávám předchozí data.`
        );
        results.push(...(previousByStore.get(source.store) || []));
        continue;
      }
      console.log(`[ok] ${source.store}: nalezeno ${items.length} položek`);
      results.push(...items);
      anySucceeded = true;
    } catch (err) {
      console.error(`[error] ${source.store}: ${err.message}`);
      results.push(...(previousByStore.get(source.store) || []));
    }
  }

  if (!anySucceeded && previous.length > 0) {
    console.warn("[warn] Žádný zdroj se nepodařilo stáhnout, ponechávám beze změny.");
    return;
  }

  await writeFile(OUT_FILE, JSON.stringify(results, null, 2) + "\n", "utf-8");
  console.log(`Zapsáno ${results.length} položek do ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Scraper selhal:", err);
  process.exitCode = 1;
});
