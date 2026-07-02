# StylerOM — Old Money Výprodej

Statická stránka s ručně sestaveným přehledem aktuálních slev na oblečení
v old money stylu (saka, tvíd, kašmír, camel kabáty, penny loafers, hedvábné
doplňky) z e-shopů dostupných v České republice.

## Proč statická data, ne živé vyhledávání

Většina českých a evropských módních e-shopů (Zoot, GANT, Answear, Massimo
Dutti…) blokuje automatizované stahování stránek a nemá veřejné API pro
vyhledávání produktů. Karty na stránce proto neobsahují konkrétní kus zboží
s pevnou cenou, ale odkazují přímo na živou výprodejovou/kategorijní stránku
obchodu — tam uživatel vidí aktuální skladovou dostupnost a cenu.

## Struktura

- `index.html` — struktura stránky
- `css/style.css` — old money vizuální styl (krémová, jedlová zeleň, mosaz, serif)
- `js/data.js` — pole `DEALS` s jednotlivými nabídkami a `CATEGORIES`
- `js/app.js` — filtrování podle kategorie, fulltextové hledání, řazení

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
