# StylerOM — Old Money Výprodej

Statická stránka s ručně sestaveným přehledem aktuálních slev na oblečení
v old money stylu (saka, tvíd, kašmír, camel kabáty, penny loafers, hedvábné
doplňky) z e-shopů dostupných v České republice.

## Zdroje dat: ruční seznam + automatický scraper

Základ tvoří ručně kurátorský seznam v `js/data.js` (`DEALS`) — stabilní
a vždy funkční, i kdyby scraper přestal fungovat.

K němu se navíc při načtení stránky dotahuje `data/scraped-deals.json`,
který jednou denně (6:00 UTC) generuje `scripts/scrape.js` přes GitHub
Actions workflow (`.github/workflows/scrape.yml`). Scraper stahuje veřejně
přístupné výprodejové stránky několika obchodů a parsuje z nich název,
cenu a odkaz.

**Křehkost scraperu:** selektory v `scripts/scrape.js` byly psány bez
možnosti ověřit živé HTML obchodů (síťová politika vývojového prostředí
odchozí požadavky blokovala). Po prvním běhu ve workflow zkontrolujte log
v GitHub Actions — pokud u některého zdroje hlásí „0 položek nalezeno“,
znamená to, že se skutečná HTML struktura liší od předpokladu a je potřeba
selektor v `SOURCES` upravit podle reálné stránky. Scraper je navržený
defenzivně: pokud se zdroj nepodaří stáhnout nebo vrátí 0 položek, ponechá
poslední známá data z předchozího běhu místo jejich smazání.

Většina českých a evropských módních e-shopů (Zoot, Massimo Dutti…) navíc
blokuje automatizované stahování úplně nebo nemá veřejné API — proto karty
u neověřených nabídek odkazují přímo na živou výprodejovou/kategorijní
stránku obchodu, ne na konkrétní kus zboží, který může být vyprodaný.

## Struktura

- `index.html` — struktura stránky
- `css/style.css` — old money vizuální styl (krémová, jedlová zeleň, mosaz, serif)
- `js/data.js` — pole `DEALS` s ručně přidanými nabídkami a `CATEGORIES`
- `js/app.js` — filtrování podle kategorie, fulltextové hledání, řazení; při načtení dotáhne i `data/scraped-deals.json`
- `scripts/scrape.js` — Node scraper generující `data/scraped-deals.json`
- `.github/workflows/scrape.yml` — denní cron, který scraper spouští a commituje výsledek

## Spuštění scraperu lokálně

```sh
npm install
npm run scrape
```

Výstup se zapíše do `data/scraped-deals.json`.

## Jak aktualizovat nabídku

Přidejte/upravte položku v poli `DEALS` v `js/data.js`:

```js
{
  store: "Název obchodu",
  title: "Krátký popis nabídky",
  note: "Doplňující detail (co je slevněné, jaké procento, poznámka).",
  category: "saka" | "svetry" | "kosile" | "kabaty" | "boty" | "doplnky",
  discount: 50,       // číslo v % pro řazení, nebo null pokud neznámé
  priceNote: "sleva až −50 %",
  url: "https://…",   // odkaz přímo na výprodejovou stránku obchodu
  verified: true,      // true = ověřená konkrétní cena/sleva, false = obecná nabídka
}
```

Aktualizujte také `SNAPSHOT_DATE` na začátku souboru.

## Spuštění lokálně

Stránka nemá žádné závislosti ani build krok — stačí otevřít `index.html`
v prohlížeči, nebo spustit jednoduchý statický server:

```sh
python3 -m http.server 8000
```

a otevřít `http://localhost:8000`.
