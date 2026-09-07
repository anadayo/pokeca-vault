const fs = require('fs');

const TARGET_FILES = ['index.html', 'pokeca-vault.html'];
const USER_AGENT = 'Mozilla/5.0 (compatible; PokecaVaultPriceUpdater/2.0; +https://github.com/anadayo/pokeca-vault)';
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 700);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 4000);
const TODAY_JST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractCards(html) {
  const match = html.match(/const CARD_MASTER = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('CARD_MASTER block not found');
  return Function('return ' + match[1])();
}

function replaceCards(html, cards) {
  return html
    .replace(/const PRICE_DATA_META = \{ updatedAt: '[^']+' \};/, `const PRICE_DATA_META = { updatedAt: '${TODAY_JST}' };`)
    .replace(/const CARD_MASTER = \[[\s\S]*?\n\];/, `const CARD_MASTER = ${JSON.stringify(cards, null, 2)};`);
}

function parseBuyPrice(html) {
  const meta = html.match(/property=["']product:price:amount["'][^>]*content=["']([0-9,]+)["']/i)
    || html.match(/content=["']([0-9,]+)["'][^>]*property=["']product:price:amount["']/i);
  if (meta) return Number(meta[1].replace(/,/g, '')) || null;

  const visible = html.match(/id=["']pricech["'][^>]*>\s*(?:<span[^>]*>\s*[¥￥]?\s*<\/span>)?\s*([0-9,]+)/i);
  return visible ? Number(visible[1].replace(/,/g, '')) : null;
}

function parseSalePrice(html) {
  const min = html.match(/"price_min":(\d{3,})/);
  if (min) return Math.round(Number(min[1]) / 100);

  const price = html.match(/"price":(\d{3,})/);
  if (price) return Math.round(Number(price[1]) / 100);

  const meta = html.match(/property=["']og:price:amount["'][^>]*content=["']([0-9,]+)["']/i)
    || html.match(/content=["']([0-9,]+)["'][^>]*property=["']og:price:amount["']/i);
  return meta ? Number(meta[1].replace(/,/g, '')) || null : null;
}

function parseOgImage(html) {
  const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (!og) return null;
  return og[1].replace(/^http:\/\//, 'https://');
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

async function imageWorks(url) {
  if (!url || !/^https?:\/\//.test(url)) return false;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok && String(res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    return false;
  }
}

async function updateCard(card) {
  const next = { ...card };
  const notes = [];
  let saleHtml = null;

  if (card.saleUrl) {
    try {
      saleHtml = await fetchHtml(card.saleUrl, `${card.id} sale`);
      const salePrice = parseSalePrice(saleHtml);
      if (salePrice) next.nowPrice = salePrice;
      else notes.push('sale price not found');
    } catch (error) {
      notes.push(`sale failed: ${error.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  if (card.buyUrl) {
    try {
      const buyHtml = await fetchHtml(card.buyUrl, `${card.id} buy`);
      const buyPrice = parseBuyPrice(buyHtml);
      if (buyPrice) next.buyPrice = buyPrice;
      else notes.push('buy price not found');
    } catch (error) {
      notes.push(`buy failed: ${error.message}`);
      next.buyPrice = null;
      next.buyUrl = '';
    }
    await sleep(REQUEST_DELAY_MS);
  } else {
    next.buyPrice = null;
    next.buyUrl = '';
  }

  if (!(await imageWorks(next.image)) && saleHtml) {
    const ogImage = parseOgImage(saleHtml);
    if (ogImage && await imageWorks(ogImage)) next.image = ogImage;
    else notes.push('image replacement not found');
  }

  return { next, notes };
}

async function main() {
  const html = fs.readFileSync(TARGET_FILES[0], 'utf8');
  const cards = extractCards(html);
  const updated = [];
  const report = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const { next, notes } = await updateCard(card);
    updated.push(next);
    const changed = next.nowPrice !== card.nowPrice || next.buyPrice !== card.buyPrice || next.image !== card.image || next.buyUrl !== card.buyUrl;
    if (changed || notes.length) {
      report.push({ id: card.id, name: card.name, changed, notes, before: { nowPrice: card.nowPrice, buyPrice: card.buyPrice, image: card.image }, after: { nowPrice: next.nowPrice, buyPrice: next.buyPrice, image: next.image } });
    }
    console.log(`${i + 1}/${cards.length} ${card.id} ${card.name}`);
  }

  for (const file of TARGET_FILES) {
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, replaceCards(content, updated));
  }

  fs.writeFileSync('price-update-report.json', JSON.stringify({ date: TODAY_JST, total: cards.length, report }, null, 2));
  console.log(`Updated ${cards.length} cards for ${TODAY_JST}. Report items: ${report.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
