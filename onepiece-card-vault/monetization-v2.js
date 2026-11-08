(function () {
  'use strict';
  if (!window.VaultCommerce || typeof CARD_MASTER === 'undefined' || typeof state === 'undefined') return;

  const gameId = STORAGE_KEY.startsWith('onePiece') ? 'one-piece-card-game' : 'pokemon-card-game';
  const gameLabel = gameId === 'one-piece-card-game' ? 'ワンピカード' : 'ポケカ';
  const supplies = [
    { id:'inner-sleeve', name:'インナースリーブ', detail:'標準カード用・寸法は購入先で確認', query:`${gameLabel} インナースリーブ` },
    { id:'deck-sleeve', name:'カードスリーブ', detail:'対応サイズと枚数を確認', query:`${gameLabel} カードスリーブ` },
    { id:'deck-case', name:'デッキケース', detail:'収容枚数を購入先で確認', query:`${gameLabel} デッキケース` },
    { id:'binder', name:'カードバインダー', detail:'ポケット寸法を購入先で確認', query:`${gameLabel} カードバインダー` },
    { id:'loader', name:'カードローダー', detail:'厚み・内寸を購入先で確認', query:`${gameLabel} カードローダー` },
  ];

  const section = document.createElement('div');
  section.className = 'section';
  section.id = 'moneyToolsSection';
  section.innerHTML = `
    <div class="section-title">手取りを比べる<span class="right muted">登録不要</span></div>
    <div class="money-tools">
      <div class="money-tool-tabs" role="tablist" aria-label="手取り計算モード">
        <button class="money-tool-tab" role="tab" aria-selected="true" data-money-tab="single">単品を計算</button>
        <button class="money-tool-tab" role="tab" aria-selected="false" data-money-tab="holdings">保有をまとめて</button>
        <button class="money-tool-tab" role="tab" aria-selected="false" data-money-tab="shopping">不足カード</button>
      </div>
      <div class="money-panel" data-money-panel="single">
        <div class="money-fields">
          <div class="money-field"><label for="moneyPrice">販売想定額 / 1枚</label><input id="moneyPrice" inputmode="numeric" type="number" min="0" max="100000000" value="10000"></div>
          <div class="money-field"><label for="moneyQty">枚数</label><input id="moneyQty" inputmode="numeric" type="number" min="1" max="999" value="1"></div>
          <div class="money-field"><label for="moneyFee">販売手数料</label><select id="moneyFee"><option value="0.10">10%（仮定）</option><option value="0.05">5%（仮定）</option><option value="0">0%</option></select></div>
          <div class="money-field"><label for="moneyShipping">送料 / 取引</label><input id="moneyShipping" inputmode="numeric" type="number" min="0" value="210"></div>
          <div class="money-field"><label for="moneyPackaging">梱包費 / 取引</label><input id="moneyPackaging" inputmode="numeric" type="number" min="0" value="50"></div>
          <div class="money-field"><label for="moneyOther">その他費用</label><input id="moneyOther" inputmode="numeric" type="number" min="0" value="0"></div>
        </div>
        <div class="money-result" id="moneySingleResult" aria-live="polite"></div>
        <div class="money-error" id="moneySingleError"></div>
      </div>
      <div class="money-panel" data-money-panel="holdings" hidden>
        <div class="holding-picks" id="moneyHoldingPicks"></div>
        <div class="money-fields">
          <div class="money-field"><label for="holdingFee">販売手数料</label><select id="holdingFee"><option value="0.10">10%（仮定）</option><option value="0.05">5%（仮定）</option><option value="0">0%</option></select></div>
          <div class="money-field"><label for="holdingShipping">同梱送料</label><input id="holdingShipping" inputmode="numeric" type="number" min="0" value="210"></div>
          <div class="money-field"><label for="holdingPackaging">梱包費</label><input id="holdingPackaging" inputmode="numeric" type="number" min="0" value="50"></div>
        </div>
        <div class="money-result" id="moneyHoldingResult" aria-live="polite"></div>
        <button class="btn btn-ghost btn-block" type="button" id="moneyCopy">概算条件をコピー</button>
        <div class="money-error" id="moneyHoldingError"></div>
      </div>
      <div class="money-panel" data-money-panel="shopping" hidden>
        <label class="money-note" for="shoppingListInput">カード名または型番と必要枚数を1行ずつ入力（最大200行）</label>
        <textarea class="shopping-input" id="shoppingListInput" placeholder="リザードンex 4枚&#10;SV2a-175 2枚"></textarea>
        <button class="btn btn-gold btn-block" type="button" id="shoppingCalculate">所持数を引いて不足を確認</button>
        <div class="shopping-results" id="shoppingResults" aria-live="polite"></div>
        <div class="money-error" id="shoppingError"></div>
      </div>
      <p class="money-note">手数料・送料は入力した仮定値です。価格未確認と0円を混同せず、最終条件は各サービスで確認してください。手取りがマイナスの場合もそのまま表示します。</p>
    </div>`;
  const guide = document.getElementById('guideSection');
  (guide?.parentNode || document.getElementById('view-home')).insertBefore(section, guide?.nextSibling || null);

  function money(value) {
    const amount = Number(value) || 0;
    const sign = amount < 0 ? '- ' : '';
    return `${sign}¥${Math.abs(amount).toLocaleString('ja-JP')}`;
  }

  function resultHtml(result) {
    return `<div class="money-result-row"><span>売却額</span><b>${money(result.gross)}</b></div>
      <div class="money-result-row"><span>手数料</span><b>- ${money(result.fee)}</b></div>
      <div class="money-result-row"><span>送料・梱包・その他</span><b>- ${money(result.costs)}</b></div>
      <div class="money-result-row total"><span>概算手取り</span><b>${money(result.net)}</b></div>`;
  }

  function emitCompare(mode, itemCount) {
    track('compare_calculate', { game_id:gameId, mode, item_count:itemCount, quote_coverage:1 });
  }

  function calculateSingle() {
    const error = document.getElementById('moneySingleError');
    try {
      const result = VaultCommerce.calculateNet({
        items:[{ unitPrice:document.getElementById('moneyPrice').value, quantity:document.getElementById('moneyQty').value }],
        feeRate:document.getElementById('moneyFee').value,
        shippingCost:document.getElementById('moneyShipping').value,
        packagingCost:document.getElementById('moneyPackaging').value,
        otherCost:document.getElementById('moneyOther').value,
      });
      document.getElementById('moneySingleResult').innerHTML = resultHtml(result);
      error.textContent = '';
      return result;
    } catch (e) {
      error.textContent = e.message;
      return null;
    }
  }

  function renderHoldingPicks() {
    const entries = Object.entries(state.holdings || {}).filter(([, holding]) => Number(holding?.qty) > 0);
    const target = document.getElementById('moneyHoldingPicks');
    if (!entries.length) {
      target.innerHTML = '<div class="empty"><h3>保有カードがありません</h3><p>カード詳細から保有を記録すると、まとめて計算できます。</p></div>';
      return;
    }
    target.innerHTML = entries.map(([id, holding]) => {
      const card = cardById(id);
      if (!card) return '';
      return `<label class="holding-pick"><input type="checkbox" data-money-holding="${escapeHtml(id)}" checked><span>${escapeHtml(card.name)}</span><small>${holding.qty}枚 × ${money(currentPrice(card))}</small></label>`;
    }).join('');
  }

  function calculateHoldings() {
    const error = document.getElementById('moneyHoldingError');
    const selected = [...document.querySelectorAll('[data-money-holding]:checked')];
    try {
      const items = selected.map((input) => {
        const card = cardById(input.dataset.moneyHolding);
        const holding = state.holdings[input.dataset.moneyHolding];
        return { unitPrice:currentPrice(card), quantity:holding.qty };
      });
      const result = VaultCommerce.calculateNet({
        items,
        feeRate:document.getElementById('holdingFee').value,
        shippingCost:document.getElementById('holdingShipping').value,
        packagingCost:document.getElementById('holdingPackaging').value,
      });
      document.getElementById('moneyHoldingResult').innerHTML = resultHtml(result);
      document.getElementById('moneyHoldingResult').dataset.copy = `保有カードまとめ売り概算\n${result.itemCount}枚 / 売却額 ${money(result.gross)} / 手数料 ${money(result.fee)} / 費用 ${money(result.costs)} / 手取り ${money(result.net)}\n※入力条件による試算`;
      error.textContent = '';
      return result;
    } catch (e) {
      document.getElementById('moneyHoldingResult').innerHTML = '<div class="money-result-row"><span>概算手取り</span><b>—</b></div>';
      error.textContent = e.message;
      return null;
    }
  }

  function normalized(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function resolveCard(query) {
    const key = normalized(query);
    const exact = CARD_MASTER.filter((card) => [card.id, card.cardNo, card.name].some((value) => normalized(value) === key));
    return exact.length === 1 ? exact[0] : null;
  }
  function calculateShoppingList() {
    const target = document.getElementById('shoppingResults');
    const error = document.getElementById('shoppingError');
    try {
      const rows = VaultCommerce.parseShoppingList(document.getElementById('shoppingListInput').value);
      if (!rows.length) throw new RangeError('カードを1行以上入力してください');
      const resolved = rows.map((row) => {
        const card = resolveCard(row.query);
        const owned = card ? Number(state.holdings?.[card.id]?.qty || 0) : 0;
        return { ...row, card, owned, missing:card ? Math.max(0, row.quantity - owned) : null };
      });
      target.innerHTML = resolved.map((row) => {
        if (!row.card) return `<div class="shopping-row shopping-unresolved"><span><strong>${escapeHtml(row.query)}</strong><small>${row.line}行目：型番または完全なカード名で修正してください</small></span><b>未同定</b></div>`;
        const href = createMercariAffiliateUrl(row.card, { soldOnly:false });
        return `<div class="shopping-row"><span><strong>${escapeHtml(row.card.name)} × ${row.missing}</strong><small>必要 ${row.quantity} / 所持 ${row.owned} / 本体参考 ${money(currentPrice(row.card) * row.missing)}</small></span>${row.missing > 0 ? `<a class="btn btn-mercari btn-sm" href="${escapeHtml(href)}" target="_blank" rel="sponsored noopener" data-mercari-affiliate="1" data-mc-id="${escapeHtml(row.card.id)}" data-mc-name="${escapeHtml(row.card.name)}" data-mc-placement="shopping_list" data-offer-purpose="buy">販売中<span class="pr-tag">PR</span></a>` : '<b>不足なし</b>'}</div>`;
      }).join('');
      localStorage.setItem(`${STORAGE_KEY}.shopping.v1`, document.getElementById('shoppingListInput').value);
      error.textContent = '';
      track('shopping_list_create', { game_id:gameId, line_count:rows.length, unresolved_count:resolved.filter((row) => !row.card).length });
    } catch (e) {
      error.textContent = e.message;
    }
  }

  section.addEventListener('input', (event) => {
    if (event.target.closest('[data-money-panel="single"]')) calculateSingle();
    if (event.target.closest('[data-money-panel="holdings"]')) calculateHoldings();
  });
  section.addEventListener('change', (event) => {
    if (event.target.matches('[data-money-holding], select')) {
      const result = event.target.closest('[data-money-panel="single"]') ? calculateSingle() : calculateHoldings();
      if (result) emitCompare(event.target.closest('[data-money-panel="single"]') ? 'single' : 'holdings', result.itemCount);
    }
  });
  section.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-money-tab]');
    if (tab) {
      section.querySelectorAll('[data-money-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
      section.querySelectorAll('[data-money-panel]').forEach((panel) => { panel.hidden = panel.dataset.moneyPanel !== tab.dataset.moneyTab; });
      if (tab.dataset.moneyTab === 'holdings') { renderHoldingPicks(); calculateHoldings(); }
      if (tab.dataset.moneyTab === 'shopping') document.getElementById('shoppingListInput').focus();
    }
    if (event.target.closest('#shoppingCalculate')) calculateShoppingList();
    if (event.target.closest('#moneyCopy')) {
      const text = document.getElementById('moneyHoldingResult').dataset.copy;
      if (!text) return;
      navigator.clipboard?.writeText(text).then(() => { toast('概算条件をコピーしました'); track('result_share', { game_id:gameId, feature_id:'net_proceeds', method:'copy_text' }); });
    }
  });

  const originalOpenDetail = openDetail;
  openDetail = function (cardId) {
    originalOpenDetail(cardId);
    const body = document.getElementById('detailBody');
    if (!body || body.querySelector('.supply-links')) return;
    const chosen = supplies.slice(0, 2);
    const block = document.createElement('div');
    block.className = 'supply-links';
    block.innerHTML = `<div class="section-title" style="margin:0">保管・プレイ用品 <span class="right muted">サイズ要確認</span></div><div class="supply-grid">${chosen.map((item) => {
      const href = createMercariAffiliateUrl({ name:item.query, cardNo:'', rarity:'' }, { soldOnly:false });
      return `<a class="supply-link" href="${escapeHtml(href)}" target="_blank" rel="sponsored noopener" data-mercari-affiliate="1" data-mc-id="supply:${item.id}" data-mc-name="${escapeHtml(item.name)}" data-mc-placement="detail_supply" data-offer-purpose="buy"><b>${escapeHtml(item.name)} <span class="pr-tag">PR</span></b><span>${escapeHtml(item.detail)}</span></a>`;
    }).join('')}</div><p class="supply-disclosure">商品価格・寸法・収容枚数は購入先で確認してください。リンクは販売中の商品検索です。</p>`;
    body.appendChild(block);
  };

  calculateSingle();
  document.getElementById('shoppingListInput').value = localStorage.getItem(`${STORAGE_KEY}.shopping.v1`) || '';
})();
