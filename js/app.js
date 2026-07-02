(function () {
  const grid = document.getElementById("grid");
  const countLine = document.getElementById("countLine");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const filterBar = document.getElementById("filterBar");

  let activeCategory = "all";

  function buildFilterChips() {
    const allChip = makeChip("all", "Vše");
    filterBar.appendChild(allChip);
    CATEGORIES.forEach((cat) => {
      filterBar.appendChild(makeChip(cat.id, cat.label));
    });
  }

  function makeChip(id, label) {
    const btn = document.createElement("button");
    btn.className = "chip" + (id === "all" ? " active" : "");
    btn.textContent = label;
    btn.dataset.id = id;
    btn.addEventListener("click", () => {
      activeCategory = id;
      [...filterBar.children].forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
    return btn;
  }

  function initials(store) {
    return store
      .replace(/\(.*\)/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  function cardTemplate(deal) {
    const badge = deal.verified
      ? '<span class="badge verified">ověřená sleva</span>'
      : '<span class="badge unverified">aktuální nabídka</span>';
    const ribbon = deal.discount
      ? `<span class="ribbon">−${deal.discount}%</span>`
      : "";
    const sourceTag =
      deal.source === "scraper"
        ? '<span class="source-tag" title="Automaticky stažené scraperem">⟳ auto</span>'
        : "";
    return `
      <article class="card">
        ${ribbon}
        <div class="card-media">
          <span class="monogram">${escapeHtml(initials(deal.store))}</span>
        </div>
        <div class="card-body">
          <div class="card-top">
            <span class="store-name">${escapeHtml(deal.store)} ${sourceTag}</span>
            ${badge}
          </div>
          <h3 class="card-title">${escapeHtml(deal.title)}</h3>
          <p class="card-note">${escapeHtml(deal.note)}</p>
          <span class="price-note">${escapeHtml(deal.priceNote)}</span>
          <a class="card-cta" href="${deal.url}" target="_blank" rel="noopener noreferrer">
            Zobrazit nabídku <span class="arrow">→</span>
          </a>
        </div>
      </article>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getFiltered() {
    const query = searchInput.value.trim().toLowerCase();
    let list = DEALS.filter((d) => {
      const matchesCategory = activeCategory === "all" || d.category === activeCategory;
      const matchesQuery =
        !query ||
        d.store.toLowerCase().includes(query) ||
        d.title.toLowerCase().includes(query) ||
        d.note.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    const sortBy = sortSelect.value;
    if (sortBy === "discount") {
      list = list.sort((a, b) => (b.discount ?? -1) - (a.discount ?? -1));
    } else if (sortBy === "store") {
      list = list.sort((a, b) => a.store.localeCompare(b.store, "cs"));
    } else if (sortBy === "category") {
      list = list.sort((a, b) => a.category.localeCompare(b.category, "cs"));
    }
    return list;
  }

  function render() {
    const list = getFiltered();
    grid.innerHTML = list.length
      ? list.map(cardTemplate).join("")
      : '<div class="empty-state">Žádná nabídka neodpovídá filtru. Zkuste jiné hledání.</div>';
    countLine.textContent = `${list.length} ${pluralize(list.length)} · snapshot ${SNAPSHOT_DATE}`;
  }

  function pluralize(n) {
    if (n === 1) return "nabídka";
    if (n >= 2 && n <= 4) return "nabídky";
    return "nabídek";
  }

  async function loadScrapedDeals() {
    try {
      const res = await fetch("data/scraped-deals.json", { cache: "no-store" });
      if (!res.ok) return;
      const scraped = await res.json();
      if (!Array.isArray(scraped) || scraped.length === 0) return;
      DEALS = DEALS.concat(scraped);
    } catch {
      // Žádná scrapovaná data (např. lokální otevření souboru bez serveru) — jen se použije ruční seznam.
    }
  }

  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);

  (async function init() {
    buildFilterChips();
    render();
    await loadScrapedDeals();
    render();
  })();
})();
