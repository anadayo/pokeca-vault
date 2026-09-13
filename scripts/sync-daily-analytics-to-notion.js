const fs = require('fs');
const crypto = require('crypto');

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID || '552987217';
const NOTION_VERSION = '2026-03-11';
const SERVICES = [
  {
    name: 'POKECA VAULT',
    notionDataSourceEnv: 'NOTION_POKECA_DATA_SOURCE_ID',
    siteUrl: 'https://anadayo.github.io/pokeca-vault/',
    pagePath: '/pokeca-vault/',
    priceFile: 'index.html',
    events: ['mercari_affiliate_click', 'mercari_click', 'card_detail_view', 'search', 'share'],
    eventNames: { mercari: ['mercari_affiliate_click', 'mercari_click'], detail: 'card_detail_view', search: 'search', share: 'share' },
  },
  {
    name: 'OP CARD VAULT',
    notionDataSourceEnv: 'NOTION_ONEPIECE_DATA_SOURCE_ID',
    siteUrl: 'https://anadayo.github.io/onepiece-card-vault/',
    pagePath: '/onepiece-card-vault/',
    priceFile: 'onepiece-card-vault/index.html',
    events: ['onepiece_mercari_affiliate_click', 'onepiece_card_detail_view', 'onepiece_search', 'onepiece_share'],
    eventNames: { mercari: ['onepiece_mercari_affiliate_click'], detail: 'onepiece_card_detail_view', search: 'onepiece_search', share: 'onepiece_share' },
  },
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function jstDate(offsetDays = -1) {
  const now = Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000;
  return new Date(now).toISOString().slice(0, 10);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function googleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), serviceAccount.private_key).toString('base64url');
  const assertion = `${unsigned}.${signature}`;
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth failed: ${response.status} ${await response.text()}`);
  return (await response.json()).access_token;
}

async function runGaReport(accessToken, date, body) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ dateRanges: [{ startDate: date, endDate: date }], ...body }),
  });
  if (!response.ok) throw new Error(`GA4 report failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function metricObject(report) {
  const headers = report.metricHeaders || [];
  const values = report.rows?.[0]?.metricValues || [];
  return Object.fromEntries(headers.map((header, index) => [header.name, Number(values[index]?.value || 0)]));
}

function eventCounts(report) {
  const result = {};
  for (const row of report.rows || []) {
    result[row.dimensionValues?.[0]?.value || 'unknown'] = Number(row.metricValues?.[0]?.value || 0);
  }
  return result;
}

function priceDataDate(file) {
  const html = fs.readFileSync(file, 'utf8');
  return html.match(/const PRICE_DATA_META = \{ updatedAt: '([^']+)' \};/)?.[1] || '';
}

async function notionRequest(path, token, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'notion-version': NOTION_VERSION,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Notion API failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function number(value) {
  return { number: Number.isFinite(value) ? value : 0 };
}

function reportProperties(service, date, metrics, events, priceDate) {
  const mercariClicks = service.eventNames.mercari.reduce((total, name) => total + (events[name] || 0), 0);
  const pageViews = metrics.screenPageViews || 0;
  return {
    '日次レポート': { title: [{ text: { content: `${service.name} ${date}` } }] },
    '日付': { date: { start: date } },
    '月': { select: { name: date.slice(0, 7) } },
    'アクティブユーザー': number(metrics.activeUsers),
    '新規ユーザー': number(metrics.newUsers),
    'セッション': number(metrics.sessions),
    'PV': number(pageViews),
    'サイト計測クリック': number(mercariClicks),
    'CTR': number(pageViews ? mercariClicks / pageViews : 0),
    'カード詳細表示': number(events[service.eventNames.detail] || 0),
    '検索回数': number(events[service.eventNames.search] || 0),
    'Xシェア': number(events[service.eventNames.share] || 0),
    '価格データ日': priceDate ? { date: { start: priceDate } } : { date: null },
    '価格更新': { select: { name: priceDate >= date ? '最新' : '要確認' } },
    'サイト': { url: service.siteUrl },
    '同期日時': { date: { start: new Date().toISOString() } },
  };
}

async function upsertNotion(dataSourceId, date, reportTitle, properties) {
  const token = required('NOTION_TOKEN');
  const normalizedDataSourceId = dataSourceId.replace(/-/g, '');
  const query = await notionRequest(`/data_sources/${normalizedDataSourceId}/query`, token, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        and: [
          { property: '日付', date: { equals: date } },
          { property: '日次レポート', title: { equals: reportTitle } },
        ],
      },
      page_size: 1,
    }),
  });
  const existing = query.results?.[0];
  if (existing) {
    await notionRequest(`/pages/${existing.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    return { action: 'updated', pageId: existing.id };
  }
  const created = await notionRequest('/pages', token, {
    method: 'POST',
    body: JSON.stringify({ parent: { data_source_id: normalizedDataSourceId }, properties }),
  });
  return { action: 'created', pageId: created.id };
}

async function main() {
  const date = process.env.REPORT_DATE || jstDate(-1);
  const serviceAccount = JSON.parse(required('GA_SERVICE_ACCOUNT_JSON'));
  const accessToken = await googleAccessToken(serviceAccount);
  const results = [];

  for (const service of SERVICES) {
    const dataSourceId = required(service.notionDataSourceEnv);
    const [summaryReport, eventReport] = await Promise.all([
      runGaReport(accessToken, date, {
        metrics: ['activeUsers', 'newUsers', 'sessions', 'screenPageViews'].map(name => ({ name })),
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'EXACT', value: service.pagePath },
          },
        },
      }),
      runGaReport(accessToken, date, {
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: service.events },
          },
        },
      }),
    ]);
    const metrics = metricObject(summaryReport);
    const events = eventCounts(eventReport);
    const priceDate = priceDataDate(service.priceFile);
    const reportTitle = `${service.name} ${date}`;
    const result = await upsertNotion(dataSourceId, date, reportTitle, reportProperties(service, date, metrics, events, priceDate));
    results.push({ service: service.name, date, metrics, events, priceDate, ...result });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
