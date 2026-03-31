import { readFile } from 'fs/promises';
import vm from 'vm';

class FakeClassList {
  constructor(initial = []) {
    this.set = new Set(initial);
  }
  add(...names) { names.forEach((name) => this.set.add(name)); }
  remove(...names) { names.forEach((name) => this.set.delete(name)); }
  contains(name) { return this.set.has(name); }
}

class FakeElement {
  constructor(id = '', opts = {}) {
    this.id = id;
    this.value = opts.value || '';
    this.checked = Boolean(opts.checked);
    this.textContent = opts.textContent || '';
    this._innerHTML = opts.innerHTML || '';
    this.dataset = opts.dataset || {};
    this.listeners = {};
    this.attributes = {};
    this.classList = new FakeClassList(opts.classList || []);
    this.style = {};
    this.options = opts.options || [{ textContent: 'am alltagstauglichsten' }];
    this.selectedIndex = opts.selectedIndex || 0;
    this._children = opts.children || [];
  }
  set innerHTML(value) { this._innerHTML = value; }
  get innerHTML() { return this._innerHTML; }
  addEventListener(type, handler) {
    this.listeners[type] ||= [];
    this.listeners[type].push(handler);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() {}
  querySelectorAll(selector) {
    if (selector === '.card') {
      const matches = [...this._innerHTML.matchAll(/data-slug="([^"]+)"/g)];
      return matches.map((match) => new FakeElement('', { dataset: { slug: match[1] } }));
    }
    if (selector === '.preset-button' || selector === '[data-preset]' || selector === '.scenario-card' || selector === '.filter-chip') {
      return this._children.filter((child) => {
        if (selector === '.scenario-card') return child.classList.contains('scenario-card');
        if (selector === '.preset-button') return child.classList.contains('preset-button');
        if (selector === '.filter-chip') return child.classList.contains('filter-chip');
        return child.dataset?.preset;
      });
    }
    return [];
  }
  querySelector(selector) {
    if (selector === 'button') return new FakeElement();
    return null;
  }
  insertAdjacentHTML(_position, html) {
    this._innerHTML += html;
    if (/option value/.test(html) && this.options) {
      const matches = [...html.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)];
      matches.forEach((match) => this.options.push({ value: match[1], textContent: match[2] }));
    }
  }
}

const recipeDialog = new FakeElement('recipeDialog', { classList: ['hidden'] });
const searchInput = new FakeElement('searchInput');
const categoryFilter = new FakeElement('categoryFilter', { options: [{ textContent: 'Alle' }] });
const tagFilter = new FakeElement('tagFilter', { options: [{ textContent: 'Alle' }] });
const sortSelect = new FakeElement('sortSelect', { value: 'recommended', options: [
  { textContent: 'am alltagstauglichsten' },
  { textContent: 'günstigste zuerst' },
], selectedIndex: 0 });

const ids = {
  searchInput,
  categoryFilter,
  tagFilter,
  sortSelect,
  cheapToggle: new FakeElement('cheapToggle'),
  fastToggle: new FakeElement('fastToggle'),
  vegetarianToggle: new FakeElement('vegetarianToggle'),
  mealPrepToggle: new FakeElement('mealPrepToggle'),
  noImageToggle: new FakeElement('noImageToggle'),
  randomBtn: new FakeElement('randomBtn'),
  resetFiltersBtn: new FakeElement('resetFiltersBtn'),
  clearAllTopBtn: new FakeElement('clearAllTopBtn'),
  presetButtons: new FakeElement('presetButtons', { children: [
    new FakeElement('', { dataset: { preset: 'budget' }, classList: ['preset-button'] }),
  ] }),
  heroScenarios: new FakeElement('heroScenarios'),
  heroFacts: new FakeElement('heroFacts'),
  activeFilters: new FakeElement('activeFilters'),
  emptyState: new FakeElement('emptyState', { classList: ['hidden'] }),
  cardGrid: new FakeElement('cardGrid'),
  resultCount: new FakeElement('resultCount'),
  resultSubtitle: new FakeElement('resultSubtitle'),
  stats: new FakeElement('stats'),
  recipeDialog,
  dialogContent: new FakeElement('dialogContent'),
  printRecipeBtn: new FakeElement('printRecipeBtn'),
  copyLinkBtn: new FakeElement('copyLinkBtn'),
};

Object.values(ids).forEach((element) => {
  if (element.id && element.id.endsWith('Toggle')) element.setAttribute('aria-pressed', 'false');
});

const closeElements = [new FakeElement('', { dataset: { closeDialog: 'true' } }), new FakeElement('', { dataset: { closeDialog: 'true' } })];
const scenarioCard = new FakeElement('', { dataset: { preset: 'quick' }, classList: ['scenario-card'] });
ids.heroScenarios._children = [scenarioCard];

const documentStub = {
  body: new FakeElement('body'),
  activeElement: null,
  getElementById(id) { return ids[id] || new FakeElement(id); },
  querySelectorAll(selector) {
    if (selector === '[data-close-dialog="true"]') return closeElements;
    if (selector === '.scenario-card') return [scenarioCard];
    if (selector === '.preset-button') return ids.presetButtons._children;
    return [];
  },
  addEventListener() {},
};

const windowStub = {
  location: { hash: '#bruschetta-sandwich', pathname: '/', search: '', href: 'http://127.0.0.1:4173/#bruschetta-sandwich' },
  addEventListener() {},
  print() {},
  prompt() {},
  navigator: { clipboard: { writeText: async () => {} } },
};

const historyStub = {
  replaceState(_a, _b, url) {
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    windowStub.location.hash = hash;
  },
  pushState(_a, _b, url) {
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    windowStub.location.hash = hash;
  },
};

const recipes = JSON.parse(await readFile('/root/.openclaw/workspace/recipe-ui/recipes.json', 'utf8'));
const code = await readFile('/root/.openclaw/workspace/recipe-ui/app.js', 'utf8');

const context = {
  console,
  document: documentStub,
  window: windowStub,
  navigator: windowStub.navigator,
  history: historyStub,
  setTimeout,
  clearTimeout,
  fetch: async () => ({ json: async () => recipes }),
};
context.globalThis = context;

vm.runInNewContext(code, context, { filename: 'app.js' });
await new Promise((resolve) => setTimeout(resolve, 30));

if (!ids.cardGrid.innerHTML.includes('data-slug=')) {
  throw new Error('Smoke test failed: no recipe cards rendered.');
}
if (!ids.dialogContent.innerHTML.includes('Bruschetta-Sandwich')) {
  throw new Error('Smoke test failed: hash route did not open recipe detail.');
}
if (ids.recipeDialog.classList.contains('hidden')) {
  throw new Error('Smoke test failed: dialog should be visible for hash route.');
}

console.log('SMOKE_OK');
