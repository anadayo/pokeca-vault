const fs = require('fs');
const path = require('path');
const {
  toPriceRecords,
  toProductRecord,
  validatePrice,
  validateProduct,
} = require('./lib/catalog-schema');

const ROOT = path.resolve(__dirname, '..');

function extractCards(file) {
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/const CARD_MASTER = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error(`CARD_MASTER block not found: ${file}`);
  return JSON.parse(match[1]);
}

function updatedAt(file) {
  const html = fs.readFileSync(file, 'utf8');
  return html.match(/const PRICE_DATA_META = \{ updatedAt: '([^']+)' \};/)?.[1] ?? null;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function build({ gameId, htmlFile, outputDirectory }) {
  const cards = extractCards(htmlFile);
  const observedAt = updatedAt(htmlFile);
  const products = cards.map((card) => toProductRecord(card, gameId));
  const prices = cards.flatMap((card) => toPriceRecords(card, gameId, observedAt));
  const errors = [
    ...products.flatMap(validateProduct),
    ...prices.flatMap(validatePrice),
  ];
  if (errors.length) throw new Error(`${gameId} data validation failed:\n${errors.join('\n')}`);
  writeJson(path.join(outputDirectory, 'products.json'), { schema_version: 1, game_id: gameId, generated_from: observedAt, products });
  writeJson(path.join(outputDirectory, 'prices.json'), { schema_version: 1, game_id: gameId, generated_from: observedAt, prices });
  return { gameId, cards: cards.length, products: products.length, prices: prices.length, observedAt };
}

const report = [
  build({ gameId: 'pokemon-card-game', htmlFile: path.join(ROOT, 'index.html'), outputDirectory: path.join(ROOT, 'data') }),
  build({ gameId: 'one-piece-card-game', htmlFile: path.join(ROOT, 'onepiece-card-vault', 'index.html'), outputDirectory: path.join(ROOT, 'onepiece-card-vault', 'data') }),
];

writeJson(path.join(ROOT, 'data-foundation-report.json'), { schema_version: 1, generated_at: new Date().toISOString(), sites: report });
console.log(report.map((item) => `${item.gameId}: ${item.products} products / ${item.prices} price records`).join('\n'));
