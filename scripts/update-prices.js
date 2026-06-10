const fs = require('fs');
const vm = require('vm');

const INDEX_PATH = 'index.html';
const USER_AGENT = 'Mozilla/5.0 (compatible; PokecaVaultPriceUpdater/1.0; +https://github.com/anadayo/pokeca-vault)';
const REQUEST_DELAY_MS = 900;
const RETRY_DELAY_MS = 5000;
const TODAY_JST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const q = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const jsValue = value => value === null || value === undefined ? 'null' : String(value);

function extractCards(html) {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('script block not found');

  const script = scriptMatch[1];
  const marker = '/* ═══════════════════════════════════════\n   RARITY CONFIG';
  const markerIndex = script.indexOf(marker);
  if (markerIndex < 0) throw new Error('catalog marker not found');

  const setup = script.slice(0, markerIndex) + '\nglobalThis.__cards = cardCatalog;';
  const ctx = { console, globalThis: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(setup, ctx);
  if (!Array.isArray(ctx.__cards)) throw new Error('cardCatalog not found');
  return ctx.__cards;
}

function parseSalePrice(html) {
  const meta = html.match(/<meta\s+property=["']og:price:amount["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:price:amount["']/i);
  if (meta) return Number(meta[1].replace(/[^0-9]/g, '')) || null;

  const visible = html.match(/販売価格:\s*<\/span>\s*<span[^>]*class=["']figure["'][^>]*>\s*[¥￥]?\s*([0-9,]+)/i);
  return visible ? Number(visible[1].replace(/,/g, '')) : null;
}

function parseBuyPrice(html) {
  const meta = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']product:price:amount["']/i);
  if (meta) return Number(meta[1].replace(/[^0-9]/g, '')) || null;

  const visible = html.match(/id=["']pricech["'][^>]*>\s*(?:<span[^>]*>\s*[¥￥]?\s*<\/span>)?\s*([0-9,]+)/i);
  return visible ? Number(visible[1].replace(/,/g, '')) : null;
}

async function fetchHtml(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      if (res.status === 429 && attempt === 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      if (attempt === 1) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function updateCard(card) {
  const next = {
    rarity: card.rarity,
    nowPrice: card.nowPrice,
    buyPrice: Number(card.buyPrice) > 0 ? Number(card.buyPrice) : null,
    saleUrl: card.saleUrl || '',
    buyUrl: card.buyUrl || '',
  };

  if (card.saleUrl) {
    try {
      const html = await fetchHtml(card.saleUrl, `${card.id} sale`);
      const price = parseSalePrice(html);
      if (price) next.nowPrice = price;
      else console.warn(`[sale] price not found: ${card.id} ${card.name}`);
    } catch (error) {
      console.warn(`[sale] ${card.id} ${card.name}: ${error.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (card.buyUrl) {
    try {
      const html = await fetchHtml(card.buyUrl, `${card.id} buy`);
      const price = parseBuyPrice(html);
      if (price) next.buyPrice = price;
      else console.warn(`[buy] price not found: ${card.id} ${card.name}`);
    } catch (error) {
      console.warn(`[buy] ${card.id} ${card.name}: ${error.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  } else {
    next.buyPrice = null;
    next.buyUrl = '';
  }

  return next;
}

function buildOverrideBlock(cards, updates) {
  const lines = [`const VERIFIED_PRICE_DATE = '${TODAY_JST}';`, 'const verifiedMarketOverrides = {'];
  for (const card of cards) {
    const u = updates[card.id];
    lines.push(`  '${q(card.id)}':{rarity:'${q(u.rarity)}',nowPrice:${jsValue(u.nowPrice)},buyPrice:${jsValue(u.buyPrice)},saleUrl:'${q(u.saleUrl)}',buyUrl:'${q(u.buyUrl)}'},`);
  }
  lines.push('};');
  return lines.join('\n');
}

async function main() {
  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const cards = extractCards(html);
  const updates = {};
  let changed = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    updates[card.id] = await updateCard(card);
    if (updates[card.id].nowPrice !== card.nowPrice || updates[card.id].buyPrice !== card.buyPrice) changed++;
    console.log(`${i + 1}/${cards.length} ${card.id} ${card.name} sale:${card.nowPrice}->${updates[card.id].nowPrice} buy:${card.buyPrice}->${updates[card.id].buyPrice}`);
  }

  const overrideBlock = buildOverrideBlock(cards, updates);
  html = html.replace(/const SOURCE_DATE = '[^']+';/, `const SOURCE_DATE = '${TODAY_JST}';`);
  const replaced = html.replace(
    /const VERIFIED_PRICE_DATE = '[^']+';\nconst verifiedMarketOverrides = \{[\s\S]*?\n\};(?=\ncardCatalog\.forEach\(c => \{\n  const override = verifiedMarketOverrides\[c\.id\];)/,
    overrideBlock,
  );
  if (replaced === html) throw new Error('verifiedMarketOverrides block not replaced');
  fs.writeFileSync(INDEX_PATH, replaced);
  console.log(`Updated ${cards.length} cards. Changed candidates: ${changed}. Date: ${TODAY_JST}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
