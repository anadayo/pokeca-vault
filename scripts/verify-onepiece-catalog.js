const fs = require('fs');

const CATALOG_FILE = 'onepiece-card-vault/cards.json';
const EXPECTED_COUNT = Number(process.env.ONEPIECE_CARD_COUNT || 200);
const CONCURRENCY = Number(process.env.ONEPIECE_VERIFY_CONCURRENCY || 12);

async function main() {
  const cards = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  const errors = [];
  const seen = new Set();
  let cursor = 0;

  for (const card of cards) {
    if (seen.has(card.id)) errors.push(`${card.id}: duplicate id`);
    seen.add(card.id);
    if (!(card.nowPrice > 0)) errors.push(`${card.id}: missing sale price`);
    if (!(card.buyPrice > 0)) errors.push(`${card.id}: missing buy price`);
    if (card.buyPrice > card.nowPrice * 1.15) errors.push(`${card.id}: suspicious price pair`);
    if (!/^https:\/\/wanpicagraph\.com\/op\/cards\//.test(card.saleUrl)) errors.push(`${card.id}: invalid price URL`);
  }

  async function worker() {
    while (cursor < cards.length) {
      const card = cards[cursor++];
      try {
        const response = await fetch(card.image, { method: 'HEAD' });
        if (!response.ok) errors.push(`${card.id}: image HTTP ${response.status}`);
      } catch (error) {
        errors.push(`${card.id}: image ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  if (cards.length !== EXPECTED_COUNT) errors.push(`catalog count ${cards.length}/${EXPECTED_COUNT}`);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Verified ${cards.length} cards: prices, unique IDs and images are valid`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
