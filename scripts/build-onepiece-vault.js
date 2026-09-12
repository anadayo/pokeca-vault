const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'index.html');
const OUTPUT_DIR = path.join(ROOT, 'onepiece-card-vault');
const OUTPUT = path.join(OUTPUT_DIR, 'index.html');
const CATALOG_FILE = path.join(OUTPUT_DIR, 'cards.json');
const TODAY_JST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const seedCards = [
  card('OP13-118-RSP', 'モンキー・D・ルフィ', 'Monkey D. Luffy', 'OP-13 受け継がれる意志', 'OP13-118', 'レッドスーパーパラレル', 398000, 300000, 3, 'up', null),
  card('OP09-004-SP', 'シャンクス', 'Shanks', 'OP-09 新たなる皇帝', 'OP09-004', 'スペシャル（銀）', 95800, 70000, 3, 'hot', null),
  card('OP13-119-RP', 'ポートガス・D・エース', 'Portgas D. Ace', 'OP-13 受け継がれる意志', 'OP13-119', 'レッドパラレル', 15800, 10000, 2, 'up', null),
  card('OP13-001-P2', 'モンキー・D・ルフィ', 'Monkey D. Luffy', 'OP-13 受け継がれる意志', 'OP13-001', 'リーダーパラレル2', 5980, 3200, 2, 'hot', 1),
  card('OP13-007-P', 'エース＆サボ＆ルフィ', 'Ace & Sabo & Luffy', 'OP-13 受け継がれる意志', 'OP13-007', 'SRパラレル', 4980, 2500, 1, 'up'),
  card('OP13-076-P', '神避', 'Divine Departure', 'OP-13 受け継がれる意志', 'OP13-076', 'パラレル', 3980, 2200, 1, 'hot'),
  card('OP13-120-P', 'サボ', 'Sabo', 'OP-13 受け継がれる意志', 'OP13-120', 'SECパラレル', 3280, 1900, 1, 'flat'),
  card('OP13-002-P', 'ポートガス・D・エース', 'Portgas D. Ace', 'OP-13 受け継がれる意志', 'OP13-002', 'リーダーパラレル', 2980, 1700, 1, 'up'),
  card('OP13-051-P', 'ボア・ハンコック', 'Boa Hancock', 'OP-13 受け継がれる意志', 'OP13-051', 'パラレル', 2980, 1700, 1, 'hot'),
  card('OP13-079-P', 'イム', 'Imu', 'OP-13 受け継がれる意志', 'OP13-079', 'リーダーパラレル', 2580, 1400, 1, 'flat'),
  card('OP13-003-P', 'ゴール・D・ロジャー', 'Gol D. Roger', 'OP-13 受け継がれる意志', 'OP13-003', 'リーダーパラレル', 1980, 1100, 1, 'flat'),
  card('OP13-042-P', 'エドワード・ニューゲート', 'Edward Newgate', 'OP-13 受け継がれる意志', 'OP13-042', 'パラレル', 1800, 1000, 1, 'up'),
  card('OP13-016-P', 'モンキー・D・ガープ', 'Monkey D. Garp', 'OP-13 受け継がれる意志', 'OP13-016', 'パラレル', 1800, 1000, 1, 'flat'),
  card('OP13-054-P', 'ヤマト', 'Yamato', 'OP-13 受け継がれる意志', 'OP13-054', 'パラレル', 1680, 900, 1, 'hot'),
  card('OP13-080-P', 'イーザンバロン・V・ナス寿郎聖', 'Ethanbaron V. Nusjuro', 'OP-13 受け継がれる意志', 'OP13-080', 'パラレル', 1580, 850, 1, 'flat'),
  card('OP13-083-P', 'ジェイガルシア・サターン聖', 'Jaygarcia Saturn', 'OP-13 受け継がれる意志', 'OP13-083', 'パラレル', 1580, 850, 1, 'flat'),
  card('OP13-089-P', 'トップマン・ウォーキュリー聖', 'Topman Warcury', 'OP-13 受け継がれる意志', 'OP13-089', 'パラレル', 1580, 850, 1, 'flat'),
  card('OP13-004-P', 'サボ', 'Sabo', 'OP-13 受け継がれる意志', 'OP13-004', 'リーダーパラレル', 1480, 800, 1, 'flat'),
  card('OP13-082-P', '五老星', 'The Five Elders', 'OP-13 受け継がれる意志', 'OP13-082', 'パラレル', 1480, 800, 1, 'up'),
  card('OP13-028-P', 'シャンクス', 'Shanks', 'OP-13 受け継がれる意志', 'OP13-028', 'パラレル', 1280, 700, 1, 'flat'),
];

const cards = fs.existsSync(CATALOG_FILE)
  ? JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  : seedCards;

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function card(id, name, nameEn, set, cardNo, rarity, nowPrice, buyPrice, variantIndex, trend, priceVariantIndex = variantIndex) {
  const code = cardNo.replace('-', '-');
  const suffix = variantIndex > 0 ? `_p${variantIndex}` : '';
  return {
    id,
    name,
    nameEn,
    set,
    setCode: cardNo.split('-')[0],
    cardNo,
    rarity,
    nowPrice,
    buyPrice,
    image: `https://optcg-api.arjunbansal-ai.workers.dev/images/${code}${suffix}`,
    saleUrl: `https://wanpicagraph.com/op/cards/${code}/`,
    buyUrl: `https://wanpicagraph.com/op/cards/${code}/`,
    variantIndex,
    priceVariantIndex,
    trend,
    seed: hash(id),
  };
}

function replaceCardMaster(html) {
  return html.replace(
    /const CARD_MASTER = \[[\s\S]*?\n\];/,
    `const CARD_MASTER = ${JSON.stringify(cards, null, 2)};`,
  );
}

function build() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  html = replaceCardMaster(html)
    .replaceAll('https://anadayo.github.io/pokeca-vault/', 'https://anadayo.github.io/pokeca-vault/onepiece-card-vault/')
    .replaceAll('POKÉCA VAULT', 'ONE PIECE CARD VAULT')
    .replaceAll('POKECA VAULT', 'ONE PIECE CARD VAULT')
    .replaceAll('POKECAVAULT', 'OPCARDVAULT')
    .replaceAll('ポケモンカード', 'ONE PIECEカードゲーム')
    .replaceAll('ポケカ', 'ワンピカード')
    .replaceAll('pokecaVault', 'onePieceCardVault')
    .replaceAll('POKECA_ANALYTICS_ENABLED', 'ONEPIECE_ANALYTICS_ENABLED')
    .replaceAll("track('card_detail_view'", "track('onepiece_card_detail_view'")
    .replaceAll("track('mercari_affiliate_click'", "track('onepiece_mercari_affiliate_click'")
    .replaceAll("track('search'", "track('onepiece_search'")
    .replaceAll("track('share'", "track('onepiece_share'")
    .replace("const context = { source_view: activeView || 'unknown', ...(params || {}) };", "const context = { service: 'onepiece_card_vault', source_view: activeView || 'unknown', ...(params || {}) };")
    .replace(/const PRICE_DATA_META = \{ updatedAt: '[^']+' \};/, `const PRICE_DATA_META = { updatedAt: '${TODAY_JST}' };`)
    .replace('<div class="brand">ONE PIECE CARD VAULT<small>CARD MARKET SIMULATOR</small></div>', '<div class="brand">OP CARD VAULT<small>ONE PIECE CARD MARKET</small></div>')
    .replaceAll('人気カード200種類', `買取注目カード${cards.length}種類`)
    .replaceAll('人気カード100種類', `買取注目カード${cards.length}種類`)
    .replace('<option value="hot">急騰順</option>', '<option value="buyDesc">買取価格が高い順</option>\n          <option value="hot">急騰順</option>')
    .replace("let marketFilter = { q:'', rarity:'すべて', sort:'hot' };", "let marketFilter = { q:'', rarity:'すべて', sort:'buyDesc' };")
    .replace("const sorters = {\n    hot:", "const sorters = {\n    buyDesc:   (a,b) => effectiveBuyPrice(b) - effectiveBuyPrice(a),\n    hot:")
    .replace('placeholder="カード名で検索（例：リザードン）"', 'placeholder="カード名で検索（例：ルフィ）"')
    .replace('<p style="margin-top:8px">姉妹サイト:', '<p style="margin-top:8px">姉妹サイト: <a href="../" style="color:var(--muted)">POKÉCA VAULT</a> ・ ')
    .replace(/ ・\s+<a href="onepiece-card-vault\/" style="color:var\(--muted\)">OP CARD VAULT<\/a>/, '')
    .replace('href="tsume-pokepoke/"', 'href="../tsume-pokepoke/"')
    .replace('--bg:        #0B0C10;', '--bg:        #0D1117;')
    .replace('--surface:   #13151C;', '--surface:   #171A20;')
    .replace('--raised:    #1B1F2A;', '--raised:    #222833;')
    .replace('--line:      #272D3B;', '--line:      #353C48;')
    .replace('--gold:      #E8C15A;', '--gold:      #F2C14E;')
    .replace('--gold-deep: #B98A2F;', '--gold-deep: #B66A26;')
    .replace('--blue:      #5BC8FF;', '--blue:      #35C0CD;')
    .replace('--green:     #34E8A0;', '--green:     #48C78E;')
    .replace('--red:       #FF5470;', '--red:       #EF476F;')
    .replace('background:rgba(11,12,16,.88)', 'background:rgba(13,17,23,.92)')
    .replace("x.fillText('ONE PIECE CARD VAULT', 70, 110);", "x.font = '800 48px \\\"Shippori Mincho B1\\\", serif';\n  x.fillText('OP CARD VAULT', 70, 110);")
    .replace("x.fillText('ワンピカード資産ポートフォリオ', 74, 150);", "x.fillText('ONE PIECEカード資産ポートフォリオ', 74, 150);");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, html);
  console.log(`Built ${path.relative(ROOT, OUTPUT)} with ${cards.length} cards`);
}

build();
