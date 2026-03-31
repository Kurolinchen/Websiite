import { promises as fs } from 'fs';
import path from 'path';

const sourceDir = '/root/.openclaw/workspace/rezepte';
const outDir = '/root/.openclaw/workspace/recipe-ui';
const outFile = path.join(outDir, 'recipes.json');
const imageOutDir = path.join(outDir, 'recipe-images');

function stripMd(text = '') {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function parseSections(md = '') {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const sections = {};
  let current = '__top__';
  sections[current] = [];

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, value.join('\n').trim()])
  );
}

function parseMeta(section = '') {
  const meta = {};
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    const m = line.match(/^-\s+\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) continue;
    meta[m[1].trim()] = stripMd(m[2]);
  }
  return meta;
}

function parseBullets(section = '') {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => stripMd(line.replace(/^[-*]\s+/, '')));
}

function parseOrdered(section = '') {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => stripMd(line.replace(/^\d+\.\s+/, '')));
}

async function detectImage(recipeDir) {
  const imageDir = path.join(recipeDir, 'bilder');
  try {
    const files = await fs.readdir(imageDir);
    return files.find((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)) || null;
  } catch {
    return null;
  }
}

await fs.rm(imageOutDir, { recursive: true, force: true });
await fs.mkdir(imageOutDir, { recursive: true });

const entries = await fs.readdir(sourceDir, { withFileTypes: true });
const recipes = [];

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name === 'vorlagen') continue;
  const recipePath = path.join(sourceDir, entry.name, 'rezept.md');
  try {
    const md = await fs.readFile(recipePath, 'utf8');
    const sections = parseSections(md);
    const meta = parseMeta(sections['Metadaten'] || '');
    const image = await detectImage(path.join(sourceDir, entry.name));
    const title = stripMd((md.match(/^#\s+(.+)$/m) || [])[1] || entry.name);

    if (image) {
      const sourceImagePath = path.join(sourceDir, entry.name, 'bilder', image);
      const targetImageDir = path.join(imageOutDir, entry.name, 'bilder');
      await fs.mkdir(targetImageDir, { recursive: true });
      await fs.copyFile(sourceImagePath, path.join(targetImageDir, image));
    }

    recipes.push({
      slug: meta['Slug'] || entry.name,
      title,
      status: meta['Status'] || '',
      category: (meta['Kategorie'] || '').split(',').map((s) => s.trim()).filter(Boolean),
      tags: (meta['Tags'] || '').split(',').map((s) => s.trim()).filter(Boolean),
      occasion: meta['Anlass / Einsatztyp'] || '',
      portions: meta['Portionen'] || '',
      priceTotal: meta['Preis gesamt ca.'] || '',
      pricePerPortion: meta['Preis pro Portion ca.'] || '',
      calories: meta['Kalorien pro Portion ca.'] || '',
      macros: meta['Makros pro Portion ca.'] || '',
      seasonal: meta['Saisonal günstig'] || '',
      shopping: meta['Einkaufsfreundlichkeit'] || '',
      time: meta['Zeit'] || '',
      difficulty: meta['Schwierigkeit'] || '',
      source: meta['Quelle'] || '',
      ownImages: (meta['Eigene Bilder'] || '').toLowerCase(),
      short: sections['Kurzfazit'] || '',
      classification: sections['Einordnung'] || '',
      background: sections['Hintergrund'] || '',
      comment: sections['Claws Kommentar'] || '',
      usefulness: parseBullets(sections['Wofür taugt das wirklich?'] || ''),
      ingredients: parseBullets(sections['Zutaten'] || ''),
      preparation: parseOrdered(sections['Zubereitung'] || ''),
      tips: parseBullets(sections['Tipps / Varianten'] || ''),
      storage: parseBullets(sections['Aufbewahrung / Restetauglichkeit'] || ''),
      seasonNotes: parseBullets(sections['Saison / günstige Kaufzeit'] || ''),
      upgrades: parseOrdered(sections['Top 10 Upgrades'] || ''),
      notes: parseBullets(sections['Eigene Notizen'] || ''),
      image: image ? `./recipe-images/${entry.name}/bilder/${image}` : null,
      sourcePath: recipePath,
    });
  } catch (err) {
    console.error('Failed parsing', recipePath, err.message);
  }
}

recipes.sort((a, b) => a.title.localeCompare(b.title, 'de'));
await fs.writeFile(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), count: recipes.length, recipes }, null, 2));
console.log(`Wrote ${recipes.length} recipes to ${outFile}`);
