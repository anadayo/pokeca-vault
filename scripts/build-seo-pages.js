const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGE_LIMIT = 100;
const AFFILIATE_ID = '2427775577';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function yen(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? `${Math.round(Number(value)).toLocaleString('ja-JP')}円`
    : '確認できません';
}

function extractPokemonCards() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const match = html.match(/const CARD_MASTER = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('CARD_MASTER block not found');
  return JSON.parse(match[1]);
}

function extractUpdatedAt(file) {
  const html = fs.readFileSync(file, 'utf8');
  return html.match(/const PRICE_DATA_META = \{ updatedAt: '([^']+)' \};/)?.[1] ?? '';
}

function qualityCards(cards) {
  return cards
    .filter((card) => card.id && card.name && card.cardNo && card.rarity && card.set && Number(card.nowPrice) > 0 && /^https:\/\//.test(card.image || '') && /^https:\/\//.test(card.saleUrl || ''))
    .sort((a, b) => Number(b.nowPrice) - Number(a.nowPrice))
    .slice(0, PAGE_LIMIT);
}

function mercariUrl(card) {
  const url = new URL('https://jp.mercari.com/search');
  url.searchParams.set('keyword', [card.name, card.cardNo, card.rarity].filter(Boolean).join(' '));
  url.searchParams.set('status', 'sold_out');
  url.searchParams.set('afid', AFFILIATE_ID);
  return url.toString();
}

function structuredData(config, card, canonical, updatedAt) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `${card.name} ${card.cardNo} ${card.rarity}の価格・買取相場`,
        url: canonical,
        dateModified: updatedAt,
        inLanguage: 'ja',
        isPartOf: { '@type': 'WebSite', name: config.brand, url: config.baseUrl },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: config.brand, item: config.baseUrl },
          { '@type': 'ListItem', position: 2, name: 'カード相場一覧', item: `${config.baseUrl}cards/` },
          { '@type': 'ListItem', position: 3, name: `${card.name} ${card.cardNo}`, item: canonical },
        ],
      },
    ],
  }).replaceAll('<', '\\u003c');
}

function cardPage(config, card, cards, updatedAt) {
  const slug = slugify(card.id);
  const canonical = `${config.baseUrl}cards/${slug}/`;
  const title = `${card.name} ${card.cardNo} ${card.rarity}の価格・買取相場｜${config.brand}`;
  const description = `${card.name}（${card.cardNo}・${card.rarity}）の販売参考価格と買取確認価格を掲載。${updatedAt}確認の${config.shortName}相場情報です。`;
  const related = cards
    .filter((item) => item.id !== card.id && (item.name === card.name || item.setCode === card.setCode))
    .slice(0, 6);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${config.ogImage}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${structuredData(config, card, canonical, updatedAt)}</script>
<style>
:root{--bg:${config.colors.bg};--surface:${config.colors.surface};--line:${config.colors.line};--gold:${config.colors.gold};--text:#f2efe6;--muted:#a6adbd;--green:#48d69d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7}a{color:inherit}.wrap{width:min(760px,100%);margin:auto;padding:18px 16px 48px}.brand{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--line);font-weight:900;color:var(--gold);text-decoration:none}.crumb{margin:18px 0;color:var(--muted);font-size:12px}.hero{display:grid;grid-template-columns:160px 1fr;gap:22px;align-items:start}.hero img{width:160px;aspect-ratio:0.716;object-fit:contain;border-radius:8px;background:#fff}.eyebrow{color:var(--gold);font-size:12px;font-weight:800}h1{margin:4px 0 8px;font-size:clamp(23px,6vw,36px);line-height:1.35;letter-spacing:0}.meta{color:var(--muted);font-size:13px}.prices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0}.price{padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}.price small{display:block;color:var(--muted)}.price strong{display:block;margin-top:5px;font-size:22px;color:var(--gold)}.notice{padding:12px;border-left:3px solid var(--gold);background:var(--surface);color:var(--muted);font-size:12px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.btn{min-height:48px;display:grid;place-items:center;padding:10px;border:1px solid var(--gold);border-radius:7px;text-align:center;text-decoration:none;font-weight:800}.btn.primary{background:var(--gold);color:#111}.btn small{margin-left:5px}.section{margin-top:28px}.section h2{font-size:18px}.facts{display:grid;gap:1px;padding:1px;background:var(--line)}.facts div{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;background:var(--surface)}.facts span{color:var(--muted)}.related{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.related a{padding:12px;border:1px solid var(--line);border-radius:7px;background:var(--surface);text-decoration:none}.related small{display:block;color:var(--muted)}footer{margin-top:32px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}@media(max-width:520px){.hero{grid-template-columns:104px 1fr;gap:14px}.hero img{width:104px}.prices,.actions{grid-template-columns:1fr}.related{grid-template-columns:1fr}}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1RKFX1HCCV"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-1RKFX1HCCV',{send_page_view:location.hostname==='anadayo.github.io'});</script>
</head>
<body><main class="wrap">
<a class="brand" href="${config.baseUrl}"><span>${config.brand}</span><small>カード相場・資産管理</small></a>
<nav class="crumb"><a href="${config.baseUrl}">ホーム</a> / <a href="${config.baseUrl}cards/">カード相場一覧</a> / ${escapeHtml(card.name)}</nav>
<article>
<div class="hero"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)} ${escapeHtml(card.cardNo)} ${escapeHtml(card.rarity)}" width="320" height="447"><div><span class="eyebrow">${escapeHtml(card.rarity)} · ${escapeHtml(card.cardNo)}</span><h1>${escapeHtml(card.name)}</h1><p class="meta">${escapeHtml(card.set)}</p><p class="meta">価格確認日：<time datetime="${updatedAt}">${updatedAt}</time></p></div></div>
<div class="prices"><div class="price"><small>販売参考価格</small><strong>${yen(card.nowPrice)}</strong></div><div class="price"><small>買取確認価格</small><strong>${yen(card.buyPrice)}</strong></div></div>
<p class="notice">価格は掲載元で確認できた参考値です。状態・在庫・査定条件で変わります。取得元は現在1件のため、複数店舗比較済みではありません。</p>
<div class="actions"><a class="btn primary" href="${config.baseUrl}#card=${encodeURIComponent(card.id)}" data-event="card_app_open">チャート・保有登録を開く</a><a class="btn" href="${escapeHtml(mercariUrl(card))}" target="_blank" rel="sponsored noopener" data-event="affiliate_click">メルカリ成約相場を見る <small>PR</small></a></div>
<section class="section"><h2>カード情報</h2><div class="facts"><div><span>カード番号</span><b>${escapeHtml(card.cardNo)}</b></div><div><span>レアリティ</span><b>${escapeHtml(card.rarity)}</b></div><div><span>収録商品</span><b>${escapeHtml(card.set)}</b></div><div><span>データ確認日</span><b>${updatedAt}</b></div><div><span>価格取得元</span><a href="${escapeHtml(card.saleUrl)}" target="_blank" rel="noopener">公開ページを確認</a></div></div></section>
${related.length ? `<section class="section"><h2>関連カード</h2><div class="related">${related.map((item) => `<a href="../${slugify(item.id)}/"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.cardNo)} · ${escapeHtml(item.rarity)}</small></a>`).join('')}</div></section>` : ''}
</article><footer>掲載価格は利益を保証するものではありません。売買前にリンク先で最新条件をご確認ください。メルカリへのリンクにはアフィリエイト広告（PR）を含みます。</footer>
</main><script>document.addEventListener('click',function(e){var a=e.target.closest('[data-event]');if(a&&typeof gtag==='function')gtag('event',a.dataset.event,{card_id:${JSON.stringify(card.id)},card_name:${JSON.stringify(card.name)},source:'seo_card_page'})});</script></body></html>`;
}

function listPage(config, cards, updatedAt) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${config.shortName} カード価格・買取相場一覧｜${config.brand}</title><meta name="description" content="${config.shortName}の注目カード${cards.length}種類について、確認できた販売参考価格・買取価格を一覧掲載。"><link rel="canonical" href="${config.baseUrl}cards/"><style>body{margin:0;background:${config.colors.bg};color:#f2efe6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(760px,100%);margin:auto;padding:24px 16px 50px}a{color:inherit}h1{letter-spacing:0}.note{color:#a6adbd}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.card{display:grid;grid-template-columns:66px 1fr;gap:10px;padding:10px;border:1px solid ${config.colors.line};border-radius:8px;background:${config.colors.surface};text-decoration:none}.card img{width:66px;height:92px;object-fit:contain;background:white;border-radius:5px}.card b,.card small{display:block}.card small{color:#a6adbd}.price{margin-top:7px;color:${config.colors.gold};font-weight:800}@media(max-width:540px){.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><a href="${config.baseUrl}">${config.brand}</a><h1>${config.shortName} カード価格・買取相場一覧</h1><p class="note">${updatedAt}確認。データ品質条件を満たす注目カード${cards.length}種類を掲載しています。</p><div class="grid">${cards.map((card) => `<a class="card" href="${slugify(card.id)}/"><img src="${escapeHtml(card.image)}" alt="" loading="lazy" width="132" height="184"><span><b>${escapeHtml(card.name)}</b><small>${escapeHtml(card.cardNo)} · ${escapeHtml(card.rarity)}</small><span class="price">買取 ${yen(card.buyPrice)}</span></span></a>`).join('')}</div></main></body></html>`;
}

function sitemap(config, cards, updatedAt) {
  const urls = [`${config.baseUrl}`, `${config.baseUrl}cards/`, ...(config.extraUrls ?? []), ...cards.map((card) => `${config.baseUrl}cards/${slugify(card.id)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url, index) => `  <url><loc>${url}</loc><lastmod>${updatedAt}</lastmod><changefreq>${index < 2 ? 'daily' : 'weekly'}</changefreq><priority>${index === 0 ? '1.0' : index === 1 ? '0.9' : '0.7'}</priority></url>`).join('\n')}\n</urlset>\n`;
}

function buildSite(config, allCards, updatedAt) {
  const cards = qualityCards(allCards);
  const cardsDir = path.join(ROOT, config.outputDir, 'cards');
  fs.mkdirSync(cardsDir, { recursive: true });
  fs.writeFileSync(path.join(cardsDir, 'index.html'), listPage(config, cards, updatedAt));
  for (const card of cards) {
    const output = path.join(cardsDir, slugify(card.id));
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'index.html'), cardPage(config, card, cards, updatedAt));
  }
  fs.writeFileSync(path.join(ROOT, config.outputDir, 'sitemap.xml'), sitemap(config, cards, updatedAt));
  fs.writeFileSync(path.join(ROOT, config.outputDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${config.baseUrl}sitemap.xml\n`);
  console.log(`${config.brand}: generated ${cards.length} card pages (${updatedAt})`);
}

const pokemonConfig = {
  brand: 'POKÉCA VAULT', shortName: 'ポケカ', baseUrl: 'https://anadayo.github.io/pokeca-vault/', outputDir: '.',
  ogImage: 'https://anadayo.github.io/pokeca-vault/assets/ogp.png',
  extraUrls: ['https://anadayo.github.io/pokeca-vault/tsume-pokepoke/'],
  colors: { bg: '#0b0c10', surface: '#13151c', line: '#272d3b', gold: '#e8c15a' },
};
const onePieceConfig = {
  brand: 'OP CARD VAULT', shortName: 'ワンピースカード', baseUrl: 'https://anadayo.github.io/onepiece-card-vault/', outputDir: 'onepiece-card-vault',
  ogImage: 'https://anadayo.github.io/onepiece-card-vault/ogp.png',
  colors: { bg: '#0d1117', surface: '#171a20', line: '#353c48', gold: '#f2c14e' },
};

buildSite(pokemonConfig, extractPokemonCards(), extractUpdatedAt(path.join(ROOT, 'index.html')));
buildSite(onePieceConfig, JSON.parse(fs.readFileSync(path.join(ROOT, 'onepiece-card-vault/cards.json'), 'utf8')), extractUpdatedAt(path.join(ROOT, 'onepiece-card-vault/index.html')));
