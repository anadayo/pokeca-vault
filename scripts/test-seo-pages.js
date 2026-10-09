const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name, 'index.html'))
    .filter((file) => fs.existsSync(file));
}

function checkSite({ directory, baseUrl, appFile }) {
  const cardDirectory = path.join(ROOT, directory, 'cards');
  const pages = filesIn(cardDirectory);
  assert.strictEqual(pages.length, 100, `${directory || 'pokemon'} should have 100 card pages`);

  const sitemap = fs.readFileSync(path.join(ROOT, directory, 'sitemap.xml'), 'utf8');
  const canonicalUrls = new Set();
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    assert(!html.includes('undefined'), `${file} contains undefined`);
    assert(!html.includes('NaN'), `${file} contains NaN`);
    assert(html.includes('取得元は現在1件'), `${file} must disclose source count`);
    assert(html.includes(`afid=2427775577`), `${file} must use affiliate id`);
    assert(!html.includes('7日変動'), `${file} must not publish simulated trends`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    assert(canonical?.startsWith(`${baseUrl}cards/`), `${file} canonical is invalid`);
    assert(!canonicalUrls.has(canonical), `${file} canonical is duplicated`);
    canonicalUrls.add(canonical);
    assert(sitemap.includes(`<loc>${canonical}</loc>`), `${file} missing from sitemap`);
  }

  const appHtml = fs.readFileSync(path.join(ROOT, appFile), 'utf8');
  assert(appHtml.includes('normalizeSearchText'), `${appFile} must normalize search text`);
  assert(appHtml.includes('data-track-seo-list'), `${appFile} must link to card pages`);
  assert(appHtml.includes('search_no_result'), `${appFile} must measure empty search results`);
  for (const script of appHtml.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (script[1].trim()) new Function(script[1]);
  }
}

checkSite({ directory: '.', baseUrl: 'https://anadayo.github.io/pokeca-vault/', appFile: 'index.html' });
checkSite({ directory: 'onepiece-card-vault', baseUrl: 'https://anadayo.github.io/onepiece-card-vault/', appFile: 'onepiece-card-vault/index.html' });
console.log('SEO page checks passed: 200 card pages and 2 app shells');
