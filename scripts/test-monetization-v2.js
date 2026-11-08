const assert = require('assert');
const { calculateNet, compareOptions, freshness, parseShoppingList, safeExternalUrl } = require('../assets/vault-commerce-core');

assert.deepStrictEqual(
  calculateNet({ items:[{ unitPrice:10000, quantity:1 }], feeRate:0.1, shippingCost:210, packagingCost:50 }),
  { gross:10000, fee:1000, shipping:210, packaging:50, other:0, travel:0, costs:260, net:8740, itemCount:1 },
);

const ranked = compareOptions([
  { id:'one-store', items:[{ unitPrice:5000, quantity:2 }], feeRate:0, shippingCost:210 },
  { id:'split-stores', items:[{ unitPrice:5100, quantity:2 }], feeRate:0, shippingCost:420 },
]);
assert.strictEqual(ranked[0].id, 'one-store');
assert.strictEqual(ranked[0].result.net, 9790);
assert.strictEqual(ranked[1].result.net, 9780);

assert.strictEqual(calculateNet({ items:[{ unitPrice:0, quantity:1 }], feeRate:0, shippingCost:210 }).net, -210);
assert.throws(() => calculateNet({ items:[{ unitPrice:1000, quantity:0 }] }), /1〜999/);
assert.throws(() => calculateNet({ items:[{ unitPrice:1000, quantity:1 }], shippingCost:-1 }), /0〜100000000/);

const dateOnly = freshness('2026-10-15', new Date('2026-10-15T12:00:00+09:00'));
assert.strictEqual(dateOnly.label, '確認日 2026-10-15');
assert.strictEqual(dateOnly.minutes, null);
assert.strictEqual(freshness('2026-10-15T10:00:00+09:00', new Date('2026-10-15T10:30:00+09:00')).label, '30分前');
assert.strictEqual(freshness('2026-10-16T10:00:00+09:00', new Date('2026-10-15T10:00:00+09:00')).label, '日時確認中');

assert.strictEqual(safeExternalUrl('https://jp.mercari.com/search?keyword=test', ['jp.mercari.com']).startsWith('https://jp.mercari.com/'), true);
assert.throws(() => safeExternalUrl('javascript:alert(1)', ['jp.mercari.com']), /安全でない/);
assert.throws(() => safeExternalUrl('https://example.com/', ['jp.mercari.com']), /許可されていない/);

assert.deepStrictEqual(parseShoppingList('リザードンex 4枚\nSV2a-175 x2\nポケギア3.0'), [
  { line:1, query:'リザードンex', quantity:4 },
  { line:2, query:'SV2a-175', quantity:2 },
  { line:3, query:'ポケギア3.0', quantity:1 },
]);
assert.throws(() => parseShoppingList('リザードンex 0枚'), /1〜999/);

console.log('monetization v2 tests passed: 17 assertions');
