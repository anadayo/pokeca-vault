const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'onepiece-card-vault');
const CATALOG_FILE = path.join(OUTPUT_DIR, 'cards.json');
const REPORT_FILE = path.join(ROOT, 'onepiece-catalog-report.json');
const SEARCH_URL = 'https://wanpicagraph.com/op/cards/search.json';
const USER_AGENT = 'Mozilla/5.0 (compatible; OPCardVaultCatalog/1.0; +https://github.com/anadayo/pokeca-vault)';
const TARGET_COUNT = Number(process.env.ONEPIECE_CARD_COUNT || 200);
const CONCURRENCY = Number(process.env.ONEPIECE_CATALOG_CONCURRENCY || 8);
const REQUEST_DELAY_MS = Number(process.env.ONEPIECE_CATALOG_DELAY_MS || 200);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrice(panelHtml) {
  const text = plainText(panelHtml);
  const match = text.match(/買取最高値\s*([0-9,]+)円[\s\S]*?販売最安値\s*([0-9,]+)円/);
  if (!match) return null;
  const buyPrice = Number(match[1].replace(/,/g, ''));
  const nowPrice = Number(match[2].replace(/,/g, ''));
  if (buyPrice <= 0 || nowPrice <= 0 || buyPrice > nowPrice * 1.15) return null;
  return { buyPrice, nowPrice };
}

function variantLabels(html) {
  const nav = html.match(/<nav class="variant-tabs"[\s\S]*?<\/nav>/i)?.[0] || '';
  return [...nav.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)].map(match => {
    const rarity = plainText(match[1].match(/<span class="rarity"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const label = plainText(match[1].replace(/<span class="rarity"[\s\S]*?<\/span>/i, '')) || '通常';
    return { label, rarity };
  });
}

function currentIds() {
  if (!fs.existsSync(CATALOG_FILE)) return new Map();
  const cards = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  return new Map(cards.map(card => [`${card.cardNo}:${card.variantIndex}`, card.id]));
}

function candidateScore(card, setOrder) {
  const rarityScore = card.rarities.reduce((best, rarity) => Math.max(best, {
    'SPカード': 600, 'SP P': 590, TR: 580, SEC: 500, L: 400, SR: 300,
  }[rarity] || 0), 0);
  return rarityScore * 1000 - (setOrder.get(card.set) ?? 999);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function fetchVariants(baseCard, setName, knownIds) {
  const url = `https://wanpicagraph.com/op/cards/${baseCard.no}/`;
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${baseCard.no}: HTTP ${response.status}`);
  const html = await response.text();
  const labels = variantLabels(html);
  const panels = html.split(/<section class="variant-panel[^>]*>/i).slice(1)
    .map(panel => panel.split('</section>')[0]);

  return panels.flatMap((panel, variantIndex) => {
    const price = parsePrice(panel);
    if (!price) return [];
    const meta = labels[variantIndex] || { label: variantIndex ? `パラレル${variantIndex > 1 ? variantIndex : ''}` : '通常', rarity: baseCard.rarities[0] || '' };
    const suffix = variantIndex ? `_p${variantIndex}` : '';
    const key = `${baseCard.no}:${variantIndex}`;
    const id = knownIds.get(key) || `${baseCard.no}-V${variantIndex}`;
    const rarity = meta.label === '通常' ? (meta.rarity || baseCard.rarities[0] || '通常') : `${meta.rarity || baseCard.rarities[0] || ''} ${meta.label}`.trim();
    return [{
      id,
      name: baseCard.name,
      nameEn: '',
      set: `${baseCard.set} ${setName}`,
      setCode: baseCard.set,
      cardNo: baseCard.no,
      rarity,
      ...price,
      image: `https://optcg-api.arjunbansal-ai.workers.dev/images/${baseCard.no}${suffix}`,
      saleUrl: url,
      buyUrl: url,
      variantIndex,
      priceVariantIndex: variantIndex,
      trend: ['flat', 'up', 'hot'][hash(id) % 3],
      seed: hash(id),
    }];
  });
}

async function main() {
  const search = await fetchJson(SEARCH_URL);
  const setNames = new Map(search.sets.map(set => [set.code, set.name]));
  const setOrder = new Map(search.sets.map((set, index) => [set.code, index]));
  const priorityRarities = new Set(['SPカード', 'SP P', 'TR', 'SEC', 'L']);
  const candidates = search.cards
    .filter(card => /^(OP|EB|PRB)/.test(card.set) && card.rarities.some(rarity => priorityRarities.has(rarity)))
    .sort((a, b) => candidateScore(b, setOrder) - candidateScore(a, setOrder));
  const knownIds = currentIds();
  const variants = [];
  const failures = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const card = candidates[cursor++];
      try {
        variants.push(...await fetchVariants(card, setNames.get(card.set) || '', knownIds));
      } catch (error) {
        failures.push({ cardNo: card.no, error: error.message });
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  const selected = variants
    .sort((a, b) => b.buyPrice - a.buyPrice || b.nowPrice - a.nowPrice || a.id.localeCompare(b.id))
    .slice(0, TARGET_COUNT);
  if (selected.length < TARGET_COUNT) throw new Error(`Only ${selected.length}/${TARGET_COUNT} valid priced variants found`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(selected, null, 2)}\n`);
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    candidates: candidates.length,
    validVariants: variants.length,
    selected: selected.length,
    minimumSelectedBuyPrice: selected.at(-1)?.buyPrice || 0,
    failures,
  }, null, 2)}\n`);
  console.log(`Selected ${selected.length} cards from ${variants.length} valid variants (${failures.length} fetch failures)`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
