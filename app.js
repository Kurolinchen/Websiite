const PRESETS = {
  budget: { label: '≤ 1 €', apply: () => ({ cheap: true, sort: 'price-asc' }) },
  quick: { label: 'Heute schnell', apply: () => ({ fast: true, sort: 'time-asc' }) },
  mealprep: { label: 'Vorkochen', apply: () => ({ mealprep: true, sort: 'mealprep-first' }) },
  vegetarian: { label: 'Vegetarisch', apply: () => ({ vegetarian: true, sort: 'recommended' }) },
  basics: { label: 'Standardzutaten', apply: () => ({ query: 'standardzutaten', sort: 'recommended' }) },
  noimage: { label: 'Ohne Bilder', apply: () => ({ noimage: true, sort: 'recommended' }) },
};

const state = {
  recipes: [],
  filtered: [],
};

const els = {
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  tagFilter: document.getElementById('tagFilter'),
  sortSelect: document.getElementById('sortSelect'),
  cheapToggle: document.getElementById('cheapToggle'),
  fastToggle: document.getElementById('fastToggle'),
  vegetarianToggle: document.getElementById('vegetarianToggle'),
  mealPrepToggle: document.getElementById('mealPrepToggle'),
  noImageToggle: document.getElementById('noImageToggle'),
  randomBtn: document.getElementById('randomBtn'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  clearAllTopBtn: document.getElementById('clearAllTopBtn'),
  presetButtons: document.getElementById('presetButtons'),
  heroScenarios: document.getElementById('heroScenarios'),
  heroFacts: document.getElementById('heroFacts'),
  activeFilters: document.getElementById('activeFilters'),
  emptyState: document.getElementById('emptyState'),
  cardGrid: document.getElementById('cardGrid'),
  resultCount: document.getElementById('resultCount'),
  resultSubtitle: document.getElementById('resultSubtitle'),
  stats: document.getElementById('stats'),
  recipeDialog: document.getElementById('recipeDialog'),
  dialogContent: document.getElementById('dialogContent'),
};

const toggleMap = {
  cheap: els.cheapToggle,
  fast: els.fastToggle,
  vegetarian: els.vegetarianToggle,
  mealprep: els.mealPrepToggle,
  noimage: els.noImageToggle,
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function euroNumber(value = '') {
  const match = String(value).match(/(\d+[\.,]?\d*)/);
  return match ? Number(match[1].replace(',', '.')) : null;
}

function minutesNumber(value = '') {
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function caloriesNumber(value = '') {
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalise(text = '') {
  return String(text).toLowerCase();
}

function allText(recipe) {
  return [
    recipe.title,
    recipe.short,
    recipe.classification,
    recipe.background,
    recipe.comment,
    recipe.occasion,
    recipe.shopping,
    recipe.seasonal,
    recipe.time,
    recipe.calories,
    ...(recipe.category || []),
    ...(recipe.tags || []),
    ...(recipe.ingredients || []),
    ...(recipe.usefulness || []),
    ...(recipe.storage || []),
    ...(recipe.tips || []),
    ...(recipe.notes || []),
  ].join(' ').toLowerCase();
}

function includesToken(recipe, token) {
  return allText(recipe).includes(normalise(token));
}

function isVegetarian(recipe) {
  return includesToken(recipe, 'vegetarisch') || includesToken(recipe, 'vegan');
}

function isMealPrep(recipe) {
  return includesToken(recipe, 'meal prep') || includesToken(recipe, 'vorkochen') || includesToken(recipe, 'aufwärm');
}

function hasNoImages(recipe) {
  return normalise(recipe.ownImages) !== 'ja';
}

function recipeSignals(recipe) {
  const price = euroNumber(recipe.pricePerPortion);
  const time = minutesNumber(recipe.time);
  return {
    cheap: price !== null && price <= 1,
    fast: time !== null && time <= 30,
    vegetarian: isVegetarian(recipe),
    mealprep: isMealPrep(recipe),
    noimage: hasNoImages(recipe),
  };
}

function shoppingScore(recipe) {
  const value = normalise(recipe.shopping);
  if (value.includes('sehr hoch')) return 3;
  if (value.includes('hoch')) return 2;
  if (value.includes('mittel')) return 1;
  return 0;
}

function recommendedScore(recipe) {
  const s = recipeSignals(recipe);
  return [
    s.cheap ? 3 : 0,
    s.fast ? 3 : 0,
    s.mealprep ? 2 : 0,
    s.vegetarian ? 1 : 0,
    shoppingScore(recipe),
    recipe.usefulness?.length ? 1 : 0,
  ].reduce((sum, part) => sum + part, 0);
}

function ingredientCount(recipe) {
  return recipe.ingredients?.length || 999;
}

function utilityLine(recipe) {
  const usefulness = recipe.usefulness || [];
  if (usefulness.length) {
    return usefulness.slice(0, 2).map((item) => escapeHtml(item)).join(' · ');
  }
  if (recipe.occasion) {
    return escapeHtml(recipe.occasion.split(',').slice(0, 2).join(' · '));
  }
  return 'Ordentlich für Alltag, Bauch und Entscheidungsgeschwindigkeit.';
}

function compactTags(recipe) {
  const preferred = [];
  const signals = recipeSignals(recipe);
  if (signals.cheap) preferred.push('günstig');
  if (signals.fast) preferred.push('schnell');
  if (signals.mealprep) preferred.push('Meal Prep');
  if (signals.vegetarian) preferred.push('vegetarisch');

  const baseTags = (recipe.tags || []).filter((tag) => !preferred.includes(tag));
  return [...new Set([...preferred, ...baseTags])].slice(0, 3);
}

function statusChips(recipe) {
  const chips = [];
  const signals = recipeSignals(recipe);
  if (recipe.status) chips.push({ label: recipe.status, alt: false });
  if (signals.mealprep) chips.push({ label: 'Vorkochen', alt: false });
  if (signals.noimage) chips.push({ label: 'ohne Bilder', alt: true });
  return chips.slice(0, 3);
}

function metaPills(recipe) {
  return [recipe.pricePerPortion, recipe.time, recipe.calories].filter(Boolean).slice(0, 3);
}

function sortRecipes(recipes) {
  const mode = els.sortSelect.value;
  const copy = [...recipes];
  const compareText = (a, b) => a.title.localeCompare(b.title, 'de');

  switch (mode) {
    case 'price-asc':
      return copy.sort((a, b) => (euroNumber(a.pricePerPortion) ?? 999) - (euroNumber(b.pricePerPortion) ?? 999) || compareText(a, b));
    case 'time-asc':
      return copy.sort((a, b) => (minutesNumber(a.time) ?? 999) - (minutesNumber(b.time) ?? 999) || compareText(a, b));
    case 'calories-asc':
      return copy.sort((a, b) => (caloriesNumber(a.calories) ?? 9999) - (caloriesNumber(b.calories) ?? 9999) || compareText(a, b));
    case 'ingredients-asc':
      return copy.sort((a, b) => ingredientCount(a) - ingredientCount(b) || compareText(a, b));
    case 'mealprep-first':
      return copy.sort((a, b) => (recipeSignals(b).mealprep - recipeSignals(a).mealprep) || compareText(a, b));
    case 'title-asc':
      return copy.sort(compareText);
    case 'recommended':
    default:
      return copy.sort((a, b) => recommendedScore(b) - recommendedScore(a) || compareText(a, b));
  }
}

function recipeMatches(recipe) {
  const q = normalise(els.searchInput.value.trim());
  const category = els.categoryFilter.value;
  const tag = els.tagFilter.value;
  const signals = recipeSignals(recipe);

  if (q && !allText(recipe).includes(q)) return false;
  if (category && !(recipe.category || []).includes(category)) return false;
  if (tag && !(recipe.tags || []).includes(tag)) return false;
  if (els.cheapToggle.getAttribute('aria-pressed') === 'true' && !signals.cheap) return false;
  if (els.fastToggle.getAttribute('aria-pressed') === 'true' && !signals.fast) return false;
  if (els.vegetarianToggle.getAttribute('aria-pressed') === 'true' && !signals.vegetarian) return false;
  if (els.mealPrepToggle.getAttribute('aria-pressed') === 'true' && !signals.mealprep) return false;
  if (els.noImageToggle.getAttribute('aria-pressed') === 'true' && !signals.noimage) return false;
  return true;
}

function renderOptions() {
  const categories = [...new Set(state.recipes.flatMap((r) => r.category || []))].sort((a, b) => a.localeCompare(b, 'de'));
  const tags = [...new Set(state.recipes.flatMap((r) => r.tags || []))].sort((a, b) => a.localeCompare(b, 'de'));

  els.categoryFilter.innerHTML = '<option value="">Alle</option>';
  els.tagFilter.innerHTML = '<option value="">Alle</option>';

  categories.forEach((category) => {
    els.categoryFilter.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`);
  });
  tags.forEach((tag) => {
    els.tagFilter.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`);
  });
}

function renderHeroFacts() {
  const total = state.recipes.length;
  const cheap = state.recipes.filter((recipe) => recipeSignals(recipe).cheap).length;
  const fast = state.recipes.filter((recipe) => recipeSignals(recipe).fast).length;
  const mealprep = state.recipes.filter((recipe) => recipeSignals(recipe).mealprep).length;

  els.heroFacts.innerHTML = `
    <div class="fact-card"><strong>${total}</strong><span>Rezepte</span></div>
    <div class="fact-card"><strong>${cheap}</strong><span>günstig ≤ 1 €</span></div>
    <div class="fact-card"><strong>${fast}</strong><span>schnell ≤ 30 min</span></div>
  `;

  els.heroScenarios.innerHTML = [
    { preset: 'quick', title: 'Heute wenig Energie?', text: 'Schnell, warm und ohne Küchendrama.' },
    { preset: 'mealprep', title: 'Morgen mitdenken', text: 'Gerichte mit Restelogik und Aufwärmqualität.' },
    { preset: 'budget', title: 'Woche vor Monatsende', text: 'Maximal alltagstauglich bei kleinem Budget.' },
  ].map((item) => `
    <button type="button" class="scenario-card" data-preset="${item.preset}">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.text)}</small>
    </button>
  `).join('');
}

function renderStats() {
  const priceValues = state.recipes.map((recipe) => euroNumber(recipe.pricePerPortion)).filter((value) => value !== null);
  const timeValues = state.recipes.map((recipe) => minutesNumber(recipe.time)).filter((value) => value !== null);
  const vegetarianCount = state.recipes.filter((recipe) => recipeSignals(recipe).vegetarian).length;
  const basicsCount = state.recipes.filter((recipe) => includesToken(recipe, 'standardzutaten') || shoppingScore(recipe) >= 2).length;

  const averagePrice = priceValues.length ? `${(priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length).toFixed(2).replace('.', ',')} €` : '—';
  const averageTime = timeValues.length ? `${Math.round(timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length)} min` : '—';

  els.stats.innerHTML = `
    <div>
      <p class="eyebrow">Sammlung auf einen Blick</p>
      <h3>Mehr System, weniger Bauchgefühl</h3>
    </div>
    <div class="stats-grid">
      <div class="kpi-card"><strong>${state.recipes.length}</strong><span>Rezepte gesamt</span></div>
      <div class="kpi-card"><strong>${state.recipes.filter((recipe) => recipeSignals(recipe).cheap).length}</strong><span>günstig ≤ 1 €</span></div>
      <div class="kpi-card"><strong>${state.recipes.filter((recipe) => recipeSignals(recipe).fast).length}</strong><span>schnell ≤ 30 min</span></div>
      <div class="kpi-card"><strong>${vegetarianCount}</strong><span>vegetarisch/vegan</span></div>
      <div class="kpi-card"><strong>${averagePrice}</strong><span>Ø Preis pro Portion</span></div>
      <div class="kpi-card"><strong>${averageTime}</strong><span>Ø Zubereitungszeit</span></div>
      <div class="kpi-card"><strong>${state.recipes.filter((recipe) => recipeSignals(recipe).mealprep).length}</strong><span>vorkochfreundlich</span></div>
      <div class="kpi-card"><strong>${basicsCount}</strong><span>mit Standardzutaten</span></div>
    </div>
  `;
}

function recipeCard(recipe) {
  const statuses = statusChips(recipe).map((chip) => `<span class="status-chip ${chip.alt ? 'alt' : ''}">${escapeHtml(chip.label)}</span>`).join('');
  const metas = metaPills(recipe).map((item) => `<span class="meta-pill">${escapeHtml(item)}</span>`).join('');
  const tags = compactTags(recipe).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('');
  const score = recommendedScore(recipe);

  return `
    <article class="card panel surface-1" data-slug="${escapeHtml(recipe.slug)}" tabindex="0" role="button" aria-label="${escapeHtml(recipe.title)} öffnen">
      ${recipe.image ? `
        <figure class="card-image-wrap">
          <img class="card-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" loading="lazy" decoding="async" />
        </figure>
      ` : ''}
      <div class="card-top">
        <div class="card-kicker-row">
          <span class="card-kicker">${escapeHtml((recipe.category || [])[0] || 'Rezept')}</span>
          <div class="card-badge-row">
            <span class="card-score">Score ${score}</span>
            ${statuses}
          </div>
        </div>
        <h4 class="card-title">${escapeHtml(recipe.title)}</h4>
        <p class="card-description">${escapeHtml(recipe.short || 'Noch ohne Kurzfazit.')}</p>
        <p class="card-utility">${utilityLine(recipe)}</p>
      </div>
      <div class="card-bottom">
        <div class="meta-strip">${metas}</div>
        <div class="card-tag-row">${tags}</div>
        <div class="card-cta">Details öffnen →</div>
      </div>
    </article>
  `;
}

function renderActiveFilters() {
  const chips = [];
  const q = els.searchInput.value.trim();
  if (q) chips.push({ label: `Suche: ${q}`, clear: () => { els.searchInput.value = ''; } });
  if (els.categoryFilter.value) chips.push({ label: `Kategorie: ${els.categoryFilter.value}`, clear: () => { els.categoryFilter.value = ''; } });
  if (els.tagFilter.value) chips.push({ label: `Tag: ${els.tagFilter.value}`, clear: () => { els.tagFilter.value = ''; } });

  Object.entries(toggleMap).forEach(([key, element]) => {
    if (element.getAttribute('aria-pressed') === 'true') {
      chips.push({ label: PRESETS[key]?.label || element.textContent.trim(), clear: () => element.setAttribute('aria-pressed', 'false') });
    }
  });

  if (els.sortSelect.value !== 'recommended') {
    const label = els.sortSelect.options[els.sortSelect.selectedIndex]?.textContent || els.sortSelect.value;
    chips.push({ label: `Sortiert: ${label}`, clear: () => { els.sortSelect.value = 'recommended'; } });
  }

  els.activeFilters.className = `active-filter-row${chips.length ? '' : ' empty'}`;
  els.activeFilters.innerHTML = chips.map((chip, index) => `
    <span class="filter-chip is-active" data-chip-index="${index}">
      ${escapeHtml(chip.label)}
      <button type="button" aria-label="${escapeHtml(chip.label)} entfernen">×</button>
    </span>
  `).join('');

  els.activeFilters.querySelectorAll('.filter-chip').forEach((chip, index) => {
    chip.querySelector('button')?.addEventListener('click', () => {
      chips[index].clear();
      renderEverything();
    });
  });
}

function renderEmptyState() {
  const hasFilters = Boolean(
    els.searchInput.value.trim() ||
    els.categoryFilter.value ||
    els.tagFilter.value ||
    Object.values(toggleMap).some((element) => element.getAttribute('aria-pressed') === 'true')
  );

  if (state.filtered.length > 0) {
    els.emptyState.classList.add('hidden');
    return;
  }

  els.emptyState.classList.remove('hidden');
  els.emptyState.innerHTML = hasFilters
    ? `
      <p class="eyebrow">Keine Treffer</p>
      <h4>Gerade passt kein Rezept auf diese Kombination.</h4>
      <p class="muted">Lockere einen Filter oder nimm ein Szenario, das breiter sucht. Die Sammlung ist nicht leer, du hast sie nur gerade sehr streng zusammengestaucht.</p>
      <div class="empty-actions">
        <button class="button ghost small" data-empty-action="reset">Filter lockern</button>
        <button class="button ghost small" data-preset="budget">≤ 1 €</button>
        <button class="button ghost small" data-preset="quick">Heute schnell</button>
        <button class="button ghost small" data-preset="mealprep">Vorkochen</button>
      </div>
    `
    : `
      <p class="eyebrow">Leerstand</p>
      <h4>Noch kein Rezept sichtbar.</h4>
      <p class="muted">Das sollte eigentlich nicht passieren. Wenn doch, lade einmal neu oder prüf den Datenimport.</p>
    `;

  els.emptyState.querySelector('[data-empty-action="reset"]')?.addEventListener('click', resetFilters);
  els.emptyState.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });
}

function renderCards() {
  const filtered = state.recipes.filter(recipeMatches);
  state.filtered = sortRecipes(filtered);

  els.cardGrid.innerHTML = state.filtered.map(recipeCard).join('');
  els.resultCount.textContent = `${state.filtered.length} Treffer`;
  els.resultSubtitle.textContent = state.filtered.length
    ? `Sortierung: ${els.sortSelect.options[els.sortSelect.selectedIndex].textContent}`
    : 'Nichts passt auf die aktuelle Kombination.';

  els.cardGrid.querySelectorAll('.card').forEach((card) => {
    const slug = card.dataset.slug;
    card.addEventListener('click', () => openRecipe(slug));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRecipe(slug);
      }
    });
  });

  renderEmptyState();
}

function renderEverything() {
  renderActiveFilters();
  renderCards();
}

function detailFact(label, value) {
  return `
    <div class="meta-box">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value || '—')}</span>
    </div>
  `;
}

function renderList(title, items, ordered = false, primary = false) {
  if (!items || items.length === 0) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `
    <section class="detail-section ${primary ? 'primary' : ''}">
      <h4>${escapeHtml(title)}</h4>
      <${tag} class="detail-list-compact">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>
    </section>
  `;
}

function renderTextSection(title, text) {
  if (!text) return '';
  return `
    <section class="detail-section">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

function renderDataRows(recipe) {
  const rows = [
    ['Kurzfazit', recipe.short],
    ['Anlass / Einsatztyp', recipe.occasion],
    ['Einkaufsfreundlichkeit', recipe.shopping],
    ['Makros pro Portion', recipe.macros],
    ['Saisonal günstig', recipe.seasonal],
    ['Quelle', recipe.source],
    ['Status', recipe.status],
    ['Rezeptpfad', recipe.sourcePath],
  ].filter(([, value]) => value);

  if (!rows.length) return '';
  return `
    <section class="detail-section">
      <h4>Zusatzdaten</h4>
      <dl class="detail-data-list">
        ${rows.map(([label, value]) => `
          <div class="detail-data-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join('')}
      </dl>
    </section>
  `;
}

function copyCurrentLink(button) {
  const url = new URL(window.location.href);
  const text = url.toString();
  const flash = (label) => {
    const original = button.textContent;
    button.textContent = label;
    setTimeout(() => { button.textContent = original; }, 1400);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => flash('Kopiert')).catch(() => {
      if (window.prompt) window.prompt('Direktlink kopieren:', text);
    });
    return;
  }

  if (window.prompt) window.prompt('Direktlink kopieren:', text);
}

function closeRecipe({ clearHash = true } = {}) {
  els.recipeDialog.classList.add('hidden');
  els.recipeDialog.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (clearHash && window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function openRecipe(slug, { updateHash = true } = {}) {
  const recipe = state.recipes.find((entry) => entry.slug === slug);
  if (!recipe) return;

  const statuses = statusChips(recipe).map((chip) => `<span class="status-chip ${chip.alt ? 'alt' : ''}">${escapeHtml(chip.label)}</span>`).join('');
  const whyItWorks = recipe.usefulness?.length ? recipe.usefulness : recipe.occasion ? recipe.occasion.split(',').map((item) => item.trim()).filter(Boolean) : [];

  els.dialogContent.innerHTML = `
    <article class="recipe-detail">
      <header class="recipe-header">
        <div class="detail-topline">
          <div class="detail-kicker-group">
            <span class="card-kicker">${escapeHtml((recipe.category || []).join(' · ') || 'Rezept')}</span>
            ${statuses}
          </div>
          <div class="detail-actions no-print">
            <button type="button" class="button secondary print-button" id="printRecipeBtn">🖨️ Drucken</button>
            <button type="button" class="button ghost small" id="copyLinkBtn">🔗 Link kopieren</button>
          </div>
        </div>
        ${recipe.image ? `
          <figure class="detail-image-wrap">
            <img class="detail-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" loading="eager" decoding="async" />
          </figure>
        ` : ''}
        <h2 class="detail-title">${escapeHtml(recipe.title)}</h2>
        <p class="detail-intro">${escapeHtml(recipe.short || 'Kein Kurzfazit hinterlegt.')}</p>
        <div class="detail-fact-grid">
          ${detailFact('Preis / Portion', recipe.pricePerPortion)}
          ${detailFact('Zeit', recipe.time)}
          ${detailFact('Kalorien', recipe.calories)}
          ${detailFact('Schwierigkeit', recipe.difficulty)}
          ${detailFact('Portionen', recipe.portions)}
          ${detailFact('Einkauf', recipe.shopping)}
        </div>
      </header>

      <div class="detail-layout">
        <div class="detail-column">
          ${renderList('Warum es taugt', whyItWorks, false, true)}
          ${renderList('Zutaten', recipe.ingredients, false, true)}
          ${renderList('Zubereitung', recipe.preparation, true, true)}
          ${renderList('Tipps / Varianten', recipe.tips)}
          ${renderList('Top 10 Upgrades', recipe.upgrades, true)}
        </div>

        <div class="detail-column">
          ${renderTextSection('Einordnung', recipe.classification)}
          ${renderTextSection('Hintergrund', recipe.background)}
          ${renderTextSection('Claws Kommentar', recipe.comment)}
          ${renderList('Aufbewahrung / Restetauglichkeit', recipe.storage)}
          ${renderList('Saison / günstige Kaufzeit', recipe.seasonNotes)}
          ${renderList('Eigene Notizen', recipe.notes)}
          ${renderDataRows(recipe)}
        </div>
      </div>
    </article>
  `;

  els.recipeDialog.classList.remove('hidden');
  els.recipeDialog.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  if (updateHash && window.location.hash !== `#${recipe.slug}`) {
    history.pushState(null, '', `#${recipe.slug}`);
  }

  document.getElementById('printRecipeBtn')?.addEventListener('click', () => window.print());
  document.getElementById('copyLinkBtn')?.addEventListener('click', (event) => copyCurrentLink(event.currentTarget));
}

function openFromHash() {
  const slug = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
  if (!slug) {
    closeRecipe({ clearHash: false });
    return;
  }
  if (state.recipes.some((recipe) => recipe.slug === slug)) {
    openRecipe(slug, { updateHash: false });
  }
}

function setToggle(name, value) {
  const element = toggleMap[name];
  if (!element) return;
  element.setAttribute('aria-pressed', value ? 'true' : 'false');
}

function resetFilters() {
  els.searchInput.value = '';
  els.categoryFilter.value = '';
  els.tagFilter.value = '';
  els.sortSelect.value = 'recommended';
  Object.keys(toggleMap).forEach((key) => setToggle(key, false));
  els.presetButtons.querySelectorAll('.preset-button').forEach((button) => button.classList.remove('is-active'));
  document.querySelectorAll('.scenario-card').forEach((button) => button.classList.remove('is-active'));
  renderEverything();
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  resetFilters();
  const config = preset.apply();
  if (config.query) els.searchInput.value = config.query;
  if (config.sort) els.sortSelect.value = config.sort;
  Object.entries(config).forEach(([key, value]) => {
    if (toggleMap[key]) setToggle(key, Boolean(value));
  });
  els.presetButtons.querySelectorAll(`[data-preset="${name}"]`).forEach((button) => button.classList.add('is-active'));
  document.querySelectorAll(`.scenario-card[data-preset="${name}"]`).forEach((button) => button.classList.add('is-active'));
  renderEverything();
}

function chooseRandomRecipe() {
  const pool = state.filtered.length ? state.filtered : state.recipes;
  const preferred = pool.filter((recipe) => recipeSignals(recipe).noimage);
  const source = preferred.length ? preferred : pool;
  const choice = source[Math.floor(Math.random() * source.length)];
  if (choice) openRecipe(choice.slug);
}

function bindEvents() {
  [
    els.searchInput,
    els.categoryFilter,
    els.tagFilter,
    els.sortSelect,
  ].forEach((element) => {
    element.addEventListener('input', renderEverything);
    element.addEventListener('change', renderEverything);
  });

  Object.entries(toggleMap).forEach(([name, element]) => {
    element.addEventListener('click', () => {
      const next = element.getAttribute('aria-pressed') !== 'true';
      setToggle(name, next);
      renderEverything();
    });
  });

  els.randomBtn.addEventListener('click', chooseRandomRecipe);
  els.resetFiltersBtn.addEventListener('click', resetFilters);
  els.clearAllTopBtn.addEventListener('click', resetFilters);

  els.presetButtons.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });
  document.querySelectorAll('.scenario-card').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  document.querySelectorAll('[data-close-dialog="true"]').forEach((element) => {
    element.addEventListener('click', () => closeRecipe());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeRecipe();
    if (event.key === '/' && document.activeElement !== els.searchInput) {
      event.preventDefault();
      els.searchInput.focus();
    }
  });

  window.addEventListener('hashchange', openFromHash);
}

async function init() {
  const response = await fetch(`./recipes.json?t=${Date.now()}`);
  const data = await response.json();
  state.recipes = data.recipes || [];

  renderOptions();
  renderHeroFacts();
  renderStats();
  bindEvents();
  renderEverything();
  openFromHash();
}

init().catch((error) => {
  console.error(error);
  els.cardGrid.innerHTML = '<div class="empty-state panel surface-1"><h4>Fehler beim Laden der Rezepte</h4><p class="muted">Der Frontend-Start ist sauber abgefangen. Bitte einmal neu laden. Wenn es dann noch klemmt, ist es ein echter Fehler und kein stilles Sterben.</p></div>';
});
