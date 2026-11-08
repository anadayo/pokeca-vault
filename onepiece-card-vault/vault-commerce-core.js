(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VaultCommerce = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_AMOUNT = 100000000;

  function integer(value, { min = 0, max = MAX_AMOUNT } = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new TypeError('数値を入力してください');
    const rounded = Math.trunc(parsed);
    if (rounded < min || rounded > max) throw new RangeError(`${min}〜${max}の範囲で入力してください`);
    return rounded;
  }

  function rate(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new RangeError('手数料率は0〜100%で入力してください');
    return parsed;
  }

  function roundFee(value, method) {
    if (method === 'ceil') return Math.ceil(value);
    if (method === 'round') return Math.round(value);
    return Math.floor(value);
  }

  function calculateNet(input) {
    const items = Array.isArray(input?.items) ? input.items : [];
    if (!items.length) throw new RangeError('カードを1件以上入力してください');
    const feeRate = rate(input.feeRate ?? 0);
    const feeRounding = input.feeRounding || 'floor';
    let gross = 0;
    let fee = 0;
    let itemCount = 0;

    for (const item of items) {
      const quantity = integer(item.quantity, { min: 1, max: 999 });
      const unitPrice = integer(item.unitPrice);
      const lineGross = unitPrice * quantity;
      if (!Number.isSafeInteger(lineGross) || lineGross > MAX_AMOUNT) throw new RangeError('売却額が上限を超えています');
      gross += lineGross;
      itemCount += quantity;
      fee += roundFee(lineGross * feeRate, feeRounding);
    }

    const shipping = integer(input.shippingCost ?? 0);
    const packaging = integer(input.packagingCost ?? 0);
    const other = integer(input.otherCost ?? 0);
    const travel = integer(input.travelCost ?? 0);
    const costs = shipping + packaging + other + travel;
    return { gross, fee, shipping, packaging, other, travel, costs, net: gross - fee - costs, itemCount };
  }

  function compareOptions(options) {
    if (!Array.isArray(options) || !options.length) return [];
    return options.map((option) => ({ ...option, result: calculateNet(option) }))
      .sort((a, b) => b.result.net - a.result.net);
  }

  function freshness(value, now = new Date()) {
    const source = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
      return { label: `確認日 ${source}`, sub: '日付単位で確認した価格です', stale: false, minutes: null, precision: 'date' };
    }
    const observed = new Date(source);
    const current = now instanceof Date ? now : new Date(now);
    const diff = current.getTime() - observed.getTime();
    if (!Number.isFinite(observed.getTime()) || !Number.isFinite(current.getTime()) || diff < 0) {
      return { label: '日時確認中', sub: '価格データの日時を確認中', stale: true, minutes: null, precision: 'invalid' };
    }
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return { label: `${minutes}分前`, sub: '取得時刻を表示', stale: false, minutes, precision: 'time' };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { label: `${hours}時間前`, sub: '取得時刻を表示', stale: false, minutes, precision: 'time' };
    return { label: `${Math.floor(hours / 24)}日前`, sub: '最新価格を外部ページでも確認してください', stale: true, minutes, precision: 'time' };
  }

  function safeExternalUrl(value, allowedHosts) {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new TypeError('安全でない外部URLです');
    if (Array.isArray(allowedHosts) && allowedHosts.length && !allowedHosts.includes(parsed.hostname)) throw new TypeError('許可されていない外部URLです');
    return parsed.toString();
  }

  function parseShoppingList(value, maxLines = 200) {
    const lines = String(value || '').replace(/\r/g, '').split('\n').slice(0, maxLines);
    return lines.map((raw, index) => {
      const line = raw.normalize('NFKC').trim();
      if (!line) return null;
      let query = line;
      let quantity = 1;
      const amount = line.match(/(?:\s+(?:x|×)?(\d+)|(?:x|×)(\d+)|\s+(\d+)枚)$/i);
      if (amount) {
        quantity = integer(amount[1] || amount[2] || amount[3], { min:1, max:999 });
        query = line.slice(0, amount.index).trim();
      }
      return { line:index + 1, query, quantity };
    }).filter(Boolean);
  }

  return { MAX_AMOUNT, calculateNet, compareOptions, freshness, parseShoppingList, safeExternalUrl };
});
