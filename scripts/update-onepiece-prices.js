const fs = require('fs');

const TARGET_FILE = 'onepiece-card-vault/index.html';
const USER_AGENT = 'Mozilla/5.0 (compatible; OPCardVaultPriceUpdater/1.0; +https://github.com/anadayo/pokeca-vault)';
const REQUEST_DELAY_MS = Number(process.env.ONEPIECE_REQUEST_DELAY_MS || 1200);
const TODAY_JST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractCards(html) {
  const match = html.match(/const CARD_MASTER = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('CARD_MASTER block not found');
  return Function(`return ${match[1]}`)();
}

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
}

function pricePair(panelHtml) {
  const text = plainText(panelHtml);
  const pattern = /買取最高値\s*([0-9,]+)円[\s\S]*?販売最安値\s*([0-9,]+)円/g;
  const match = pattern.exec(text);
  if (!match) return null;
  return { buyPrice: Number(match[1].replace(/,/g, '')), nowPrice: Number(match[2].replace(/,/g, '')) };
}

function pricePairs(html) {
  return html
    .split(/<section class="variant-panel[^>]*>/i)
    .slice(1)
    .map(panel => pricePair(panel.split('</section>')[0]))
    .filter(Boolean);
}

async function fetchCard(card) {
  if (card.priceVariantIndex === null) throw new Error('manual-only variant');
  const response = await fetch(card.saleUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const pairs = pricePairs(await response.text());
  const priceVariantIndex = Number(card.priceVariantIndex ?? card.variantIndex) || 0;
  const selected = pairs[priceVariantIndex];
  if (!selected) throw new Error(`variant ${priceVariantIndex} not found`);
  if (selected.nowPrice <= 0 || selected.buyPrice <= 0 || selected.buyPrice > selected.nowPrice * 1.15) {
    throw new Error(`rejected suspicious prices sale=${selected.nowPrice} buy=${selected.buyPrice}`);
  }
  return { ...card, ...selected };
}

async function main() {
  const html = fs.readFileSync(TARGET_FILE, 'utf8');
  const cards = extractCards(html);
  const updated = [];
  const report = [];

  for (const card of cards) {
    try {
      const next = await fetchCard(card);
      updated.push(next);
      report.push({ id: card.id, ok: true, before: [card.nowPrice, card.buyPrice], after: [next.nowPrice, next.buyPrice] });
    } catch (error) {
      updated.push(card);
      report.push({ id: card.id, ok: false, error: error.message });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const output = html
    .replace(/const PRICE_DATA_META = \{ updatedAt: '[^']+' \};/, `const PRICE_DATA_META = { updatedAt: '${TODAY_JST}' };`)
    .replace(/const CARD_MASTER = \[[\s\S]*?\n\];/, `const CARD_MASTER = ${JSON.stringify(updated, null, 2)};`);
  fs.writeFileSync(TARGET_FILE, output);
  fs.writeFileSync('onepiece-price-update-report.json', JSON.stringify({ date: TODAY_JST, report }, null, 2));
  console.log(`Updated ${report.filter(item => item.ok).length}/${cards.length} ONE PIECE cards`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
