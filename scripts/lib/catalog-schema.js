const SOURCE_NAMES = new Map([
  ['www.hareruya2.com', '晴れる屋2'],
  ['www.hare2buy.com', '晴れる屋2買取'],
  ['wanpicagraph.com', 'WANNPI GRAPH'],
]);

function nullablePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[‐‑‒–—―ー]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[\s\-_/・.]/g, '');
}

function sourceInfo(urlValue) {
  if (!urlValue) return { id: null, name: null };
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();
    return {
      id: hostname.replace(/^www\./, ''),
      name: SOURCE_NAMES.get(hostname) ?? hostname.replace(/^www\./, ''),
    };
  } catch {
    return { id: null, name: null };
  }
}

function productId(gameId, card) {
  return `${gameId}:${String(card.id).normalize('NFKC').toLowerCase()}`;
}

function inferProductType(card) {
  return /(?:box|booster box|ボックス|パック)/i.test(`${card.name ?? ''} ${card.set ?? ''}`) ? 'sealed_box' : 'single_card';
}

function inferVariant(card) {
  const parts = [card.rarity];
  if (Number.isInteger(card.variantIndex)) parts.push(`variant_${card.variantIndex}`);
  if (/psa\s*10/i.test(`${card.name ?? ''} ${card.rarity ?? ''}`)) parts.push('PSA10');
  return parts.filter(Boolean).join(' / ') || 'standard';
}

function toProductRecord(card, gameId) {
  return {
    game_id: gameId,
    card_id: String(card.id ?? ''),
    product_id: productId(gameId, card),
    card_number: String(card.cardNo ?? ''),
    name: String(card.name ?? ''),
    set_code: String(card.setCode ?? ''),
    set_name: String(card.set ?? ''),
    rarity: String(card.rarity ?? ''),
    variant: inferVariant(card),
    release_date: card.releaseDate ?? null,
    image_url: String(card.image ?? ''),
    product_type: inferProductType(card),
    language: card.language ?? 'ja',
    market_status: card.marketStatus ?? 'active',
    search_text: normalizeSearchText([card.name, card.nameEn, card.cardNo, card.set, card.setCode, card.rarity].filter(Boolean).join(' ')),
  };
}

function priceRecord(card, gameId, updatedAt, kind) {
  const isBuy = kind === 'buy';
  const url = isBuy ? card.buyUrl : card.saleUrl;
  const source = sourceInfo(url);
  const value = nullablePrice(isBuy ? card.buyPrice : card.nowPrice);
  return {
    product_id: productId(gameId, card),
    source_shop_id: source.id,
    source_shop_name: source.name,
    price_type: isBuy ? 'buyback' : 'sale_reference',
    buy_price: isBuy ? value : null,
    sale_price: isBuy ? null : value,
    currency: 'JPY',
    condition: card.condition ?? 'ungraded_unspecified',
    grading_company: card.gradingCompany ?? null,
    grading_grade: card.gradingGrade ?? null,
    observed_at: updatedAt || null,
    source_published_at: card.sourcePublishedAt ?? null,
    source_url: url || null,
    acquisition_method: 'scheduled_public_page_check',
    confidence: value && url ? 'single_source' : 'unavailable',
    last_result: value && url ? 'success' : 'not_available',
  };
}

function toPriceRecords(card, gameId, updatedAt) {
  return [priceRecord(card, gameId, updatedAt, 'sale'), priceRecord(card, gameId, updatedAt, 'buy')];
}

function appendPriceSnapshot(card, date, { salePrice, buyPrice, sourceCount = 1 } = {}) {
  const sale = nullablePrice(salePrice);
  const buy = nullablePrice(buyPrice);
  if (!date || (sale === null && buy === null)) return { ...card };
  const history = Array.isArray(card.priceHistory) ? card.priceHistory.filter(Boolean) : [];
  const snapshot = { date, sale_price: sale, buy_price: buy, source_count: Math.max(1, Number(sourceCount) || 1) };
  const withoutToday = history.filter((item) => item.date !== date);
  return { ...card, priceHistory: [...withoutToday, snapshot].slice(-366) };
}

function validateProduct(product) {
  const required = ['game_id', 'card_id', 'product_id', 'card_number', 'name', 'set_code', 'set_name', 'rarity', 'variant', 'image_url', 'product_type', 'language', 'market_status'];
  return required.filter((key) => !product[key]).map((key) => `${product.product_id || 'unknown'}: missing ${key}`);
}

function validatePrice(record) {
  const errors = [];
  if (!record.product_id) errors.push('price: missing product_id');
  if (!['buyback', 'sale_reference'].includes(record.price_type)) errors.push(`${record.product_id}: invalid price_type`);
  if (record.buy_price === 0 || record.sale_price === 0) errors.push(`${record.product_id}: unknown price must be null`);
  if (record.last_result === 'success' && !record.source_url) errors.push(`${record.product_id}: successful price lacks source_url`);
  return errors;
}

function isIndexableCard(card) {
  const product = toProductRecord(card, 'quality-check');
  return validateProduct(product).length === 0
    && nullablePrice(card.nowPrice) !== null
    && /^https:\/\//.test(card.saleUrl || '');
}

module.exports = {
  appendPriceSnapshot,
  compactSearchText,
  isIndexableCard,
  normalizeSearchText,
  nullablePrice,
  sourceInfo,
  toPriceRecords,
  toProductRecord,
  validatePrice,
  validateProduct,
};
