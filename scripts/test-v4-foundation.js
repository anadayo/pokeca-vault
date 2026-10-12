const assert = require('assert');
const {
  appendPriceSnapshot,
  compactSearchText,
  normalizeSearchText,
  nullablePrice,
  toPriceRecords,
  toProductRecord,
  validatePrice,
  validateProduct,
} = require('./lib/catalog-schema');

const card = {
  id: 'OP01-001-V2', name: 'モンキー・D・ルフィ', nameEn: 'Monkey D. Luffy', set: 'OP01 ROMANCE DAWN', setCode: 'OP01',
  cardNo: 'OP01-001', rarity: 'リーダーパラレル', variantIndex: 2, nowPrice: 12000, buyPrice: null,
  image: 'https://example.com/card.jpg', saleUrl: 'https://example.com/sale', buyUrl: '',
};

assert.strictEqual(normalizeSearchText('ＯＰ０１　ルフィ'), 'op01 ルフィ');
assert.strictEqual(compactSearchText('OP01-001 / L'), 'op01001l');
assert.strictEqual(nullablePrice(0), null);
assert.strictEqual(nullablePrice('12,000'), null);
assert.strictEqual(nullablePrice(12000), 12000);

const product = toProductRecord(card, 'one-piece-card-game');
assert.deepStrictEqual(validateProduct(product), []);
assert.strictEqual(product.product_id, 'one-piece-card-game:op01-001-v2');
assert(product.variant.includes('variant_2'));

const prices = toPriceRecords(card, 'one-piece-card-game', '2026-10-12');
assert.strictEqual(prices[0].sale_price, 12000);
assert.strictEqual(prices[1].buy_price, null);
assert.strictEqual(prices[1].last_result, 'not_available');
assert.deepStrictEqual(prices.flatMap(validatePrice), []);

const withFirstSnapshot = appendPriceSnapshot(card, '2026-10-12', { salePrice: 12000, buyPrice: null });
const withReplacement = appendPriceSnapshot(withFirstSnapshot, '2026-10-12', { salePrice: 12500, buyPrice: 8000 });
assert.strictEqual(withReplacement.priceHistory.length, 1);
assert.deepStrictEqual(withReplacement.priceHistory[0], { date: '2026-10-12', sale_price: 12500, buy_price: 8000, source_count: 1 });
assert.strictEqual(card.priceHistory, undefined, 'input card must not be mutated');

console.log('v4 foundation tests passed: 15 assertions');
