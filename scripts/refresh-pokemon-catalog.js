const fs = require('fs');

const TARGET_FILES = ['index.html', 'pokeca-vault.html'];
const REPORT_FILE = 'pokemon-catalog-report.json';
const CATALOG_URL = 'https://www.hareruya2.com/products.json';
const USER_AGENT = 'Mozilla/5.0 (compatible; PokecaVaultCatalog/1.0; +https://github.com/anadayo/pokeca-vault)';
const TARGET_COUNT = Number(process.env.POKEMON_CARD_COUNT || 500);
const MAX_PAGES = Number(process.env.POKEMON_CATALOG_PAGES || 24);
const PAGE_SIZE = 250;

function extractCards(html) {
  const match = html.match(/const CARD_MASTER = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('CARD_MASTER block not found');
  return Function(`return ${match[1]}`)();
}

function replaceCards(html, cards) {
  return html.replace(/const CARD_MASTER = \[[\s\S]*?\n\];/, `const CARD_MASTER = ${JSON.stringify(cards, null, 2)};`);
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function parseProduct(product) {
  if (/【(?:PSA|ARS|BGS|CGC|状態)|未開封BOX|デッキ|スリーブ|プレイマット|ファイル/.test(product.title)) return null;
  const match = product.title.match(/^(.+?)\(([^)]+)\)\{[^}]*\}〈([^〉]+)〉\[([^\]]+)\]/);
  if (!match) return null;
  const [, name, rarity, cardNo, setCode] = match;
  const variant = product.variants?.find(item => Number(item.price) > 0) || product.variants?.[0];
  const image = product.images?.[0]?.src || product.image?.src || '';
  if (!variant || !image || Number(variant.price) <= 0) return null;
  const id = `PKM-${product.handle}`;
  return {
    id,
    name: name.trim(),
    set: setCode,
    setCode,
    cardNo,
    rarity: rarity.trim(),
    nowPrice: Math.round(Number(variant.price)),
    buyPrice: null,
    image: image.replace(/^http:\/\//, 'https://'),
    saleUrl: `https://www.hareruya2.com/products/${product.handle}`,
    buyUrl: '',
    trend: ['flat', 'up', 'hot'][hash(id) % 3],
    seed: hash(id),
    priceHistory: [],
  };
}

function signature(card) {
  return `${card.name}|${String(card.cardNo).toUpperCase()}|${String(card.rarity).toUpperCase()}`;
}

function score(card) {
  const rarity = String(card.rarity).toUpperCase();
  const rarityScore = [
    ['SAR', 1000], ['UR', 900], ['SSR', 850], ['CSR', 825], ['SR', 800],
    ['HR', 760], ['AR', 700], ['CHR', 680], ['PROMO', 620], ['RRR', 500], ['RR', 450],
  ].find(([label]) => rarity.includes(label))?.[1] || 100;
  return rarityScore * 1000000 + Math.min(card.nowPrice, 999999);
}

async function fetchPage(page) {
  const url = `${CATALOG_URL}?limit=${PAGE_SIZE}&page=${page}`;
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()).products || [];
}

async function main() {
  const originalHtml = fs.readFileSync(TARGET_FILES[0], 'utf8');
  const current = extractCards(originalHtml);
  const products = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(page);
    products.push(...batch);
    console.log(`Catalog page ${page}: ${batch.length} products`);
    if (batch.length < PAGE_SIZE) break;
  }

  const fetched = products.map(parseProduct).filter(Boolean);
  const currentBySignature = new Map(current.map(card => [signature(card), card]));
  const merged = fetched.map(card => {
    const previous = currentBySignature.get(signature(card));
    if (!previous) return card;
    return {
      ...card,
      id: previous.id,
      buyPrice: previous.buyPrice ?? null,
      buyUrl: previous.buyUrl || '',
      trend: previous.trend || card.trend,
      seed: previous.seed ?? card.seed,
      priceHistory: previous.priceHistory || [],
    };
  });

  const unique = new Map();
  const retainedCurrent = current.filter(card => !/^【(?:PSA|ARS|BGS|CGC|状態)/.test(card.name));
  for (const card of [...retainedCurrent, ...merged]) {
    const key = signature(card);
    const existing = unique.get(key);
    if (!existing || score(card) > score(existing)) unique.set(key, card);
  }

  const selected = [...unique.values()]
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
    .slice(0, TARGET_COUNT);
  if (selected.length < TARGET_COUNT) throw new Error(`Only ${selected.length}/${TARGET_COUNT} valid cards found`);

  for (const file of TARGET_FILES) {
    const html = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, replaceCards(html, selected));
  }
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    requested: TARGET_COUNT,
    fetchedProducts: products.length,
    validCards: fetched.length,
    selected: selected.length,
    retainedBuyLinks: selected.filter(card => card.buyUrl).length,
    source: CATALOG_URL,
  }, null, 2)}\n`);
  console.log(`Selected ${selected.length} cards from ${fetched.length} valid card products`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
