const fs = require('fs');
const crypto = require('crypto');

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID || '552987217';
const NOTION_VERSION = '2026-03-11';
const SERVICES = [
  {
    name: 'POKÉCA VAULT',
    kind: 'card',
    notionDataSourceEnv: 'NOTION_POKECA_DATA_SOURCE_ID',
    siteUrl: 'https://anadayo.github.io/pokeca-vault/',
    pagePath: '/pokeca-vault/',
    priceFile: 'index.html',
    events: ['mercari_affiliate_click', 'mercari_click', 'card_detail_view', 'search', 'share'],
    eventNames: { mercari: ['mercari_affiliate_click', 'mercari_click'], detail: 'card_detail_view', search: 'search', share: 'share' },
  },
  {
    name: 'OP CARD VAULT',
    kind: 'card',
    notionDataSourceEnv: 'NOTION_ONEPIECE_DATA_SOURCE_ID',
    siteUrl: 'https://anadayo.github.io/onepiece-card-vault/',
    pagePath: '/onepiece-card-vault/',
    priceFile: 'onepiece-card-vault/index.html',
    events: ['onepiece_mercari_affiliate_click', 'onepiece_card_detail_view', 'onepiece_search', 'onepiece_share'],
    eventNames: { mercari: ['onepiece_mercari_affiliate_click'], detail: 'onepiece_card_detail_view', search: 'onepiece_search', share: 'onepiece_share' },
  },
  {
    name: 'TAG TOKYO',
    kind: 'dating',
    optional: true,
    notionDataSourceEnv: 'NOTION_TAG_TOKYO_DATA_SOURCE_ID',
    notionDataSourceTitle: 'TAG TOKYO｜運用・アクセス日次レポート',
    siteUrl: 'https://anadayo.github.io/tag-tokyo/',
    pagePath: '/tag-tokyo/',
    pageMatchType: 'BEGINS_WITH',
    events: [
      'tagtokyo_tag_session_started',
      'tagtokyo_cross_view',
      'tagtokyo_tag_sent',
      'tagtokyo_match',
      'tagtokyo_talk_sent',
      'tagtokyo_report_submitted',
      'tagtokyo_area_exp_contributed',
      'tagtokyo_spot_draw_preview',
      'tagtokyo_cosmetic_exchanged',
    ],
    eventNames: {
      tagOn: 'tagtokyo_tag_session_started',
      cross: 'tagtokyo_cross_view',
      tagSent: 'tagtokyo_tag_sent',
      match: 'tagtokyo_match',
      talk: 'tagtokyo_talk_sent',
      report: 'tagtokyo_report_submitted',
      areaExp: 'tagtokyo_area_exp_contributed',
      spotDraw: 'tagtokyo_spot_draw_preview',
      cosmetic: 'tagtokyo_cosmetic_exchanged',
    },
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

function jstNowIso() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
}

function reportTitle(service, date) {
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00+09:00`));
  return `${date}（${weekday}）｜${service.name}`;
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

async function findNotionDataSource(title) {
  const token = required('NOTION_TOKEN');
  const result = await notionRequest('/search', token, {
    method: 'POST',
    body: JSON.stringify({
      query: title,
      filter: { property: 'object', value: 'data_source' },
      page_size: 20,
    }),
  });
  const exact = result.results?.find(item => {
    const itemTitle = (item.title || []).map(part => part.plain_text || part.text?.content || '').join('');
    return itemTitle === title;
  });
  return exact?.id || '';
}

function number(value) {
  return { number: Number.isFinite(value) ? value : 0 };
}

function reportProperties(service, date, metrics, events, priceDate) {
  if (service.kind === 'dating') {
    return {
      '日次レポート': { title: [{ text: { content: reportTitle(service, date) } }] },
      '日付': { date: { start: date } },
      '月': { select: { name: date.slice(0, 7) } },
      'アクティブユーザー': number(metrics.activeUsers),
      '新規ユーザー': number(metrics.newUsers),
      'セッション': number(metrics.sessions),
      'PV': number(metrics.screenPageViews || 0),
      'TAG ON開始': number(events[service.eventNames.tagOn] || 0),
      'CROSS表示': number(events[service.eventNames.cross] || 0),
      'TAG送信': number(events[service.eventNames.tagSent] || 0),
      'MATCH成立': number(events[service.eventNames.match] || 0),
      'トーク送信': number(events[service.eventNames.talk] || 0),
      '通報': number(events[service.eventNames.report] || 0),
      'エリアEXP投下': number(events[service.eventNames.areaExp] || 0),
      'TAG SPOT抽選': number(events[service.eventNames.spotDraw] || 0),
      '装飾交換': number(events[service.eventNames.cosmetic] || 0),
      'サイト': { url: service.siteUrl },
      '同期日時': { date: { start: jstNowIso() } },
    };
  }
  const mercariClicks = service.eventNames.mercari.reduce((total, name) => total + (events[name] || 0), 0);
  const pageViews = metrics.screenPageViews || 0;
  return {
    '日次レポート': { title: [{ text: { content: reportTitle(service, date) } }] },
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
    '同期日時': { date: { start: jstNowIso() } },
  };
}

async function queryAllPages(dataSourceId, body = {}) {
  const token = required('NOTION_TOKEN');
  const normalizedDataSourceId = dataSourceId.replace(/-/g, '');
  const pages = [];
  let cursor;
  do {
    const query = await notionRequest(`/data_sources/${normalizedDataSourceId}/query`, token, {
      method: 'POST',
      body: JSON.stringify({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    pages.push(...(query.results || []));
    cursor = query.has_more ? query.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function archivePages(pages) {
  const token = required('NOTION_TOKEN');
  for (const page of pages) {
    await notionRequest(`/pages/${page.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    });
  }
}

async function normalizeNotionHistory(service, dataSourceId) {
  const token = required('NOTION_TOKEN');
  const pages = await queryAllPages(dataSourceId, {
    sorts: [{ property: '日付', direction: 'descending' }],
  });
  const byDate = new Map();
  for (const page of pages) {
    const date = page.properties?.['日付']?.date?.start?.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(page);
  }

  let updated = 0;
  let archived = 0;
  for (const [date, entries] of byDate) {
    entries.sort((a, b) => {
      const aHasManualClicks = a.properties?.['メルカリ公式クリック']?.number != null;
      const bHasManualClicks = b.properties?.['メルカリ公式クリック']?.number != null;
      return Number(bHasManualClicks) - Number(aHasManualClicks)
        || String(b.last_edited_time).localeCompare(String(a.last_edited_time));
    });
    const [canonical, ...duplicates] = entries;
    await notionRequest(`/pages/${canonical.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          '日次レポート': { title: [{ text: { content: reportTitle(service, date) } }] },
          '日付': { date: { start: date } },
          '月': { select: { name: date.slice(0, 7) } },
        },
      }),
    });
    updated += 1;
    if (duplicates.length) {
      await archivePages(duplicates);
      archived += duplicates.length;
    }
  }
  return { scanned: pages.length, updated, archived };
}

async function upsertNotion(service, dataSourceId, date, properties) {
  const token = required('NOTION_TOKEN');
  const normalizedDataSourceId = dataSourceId.replace(/-/g, '');
  const matches = await queryAllPages(dataSourceId, {
    filter: { property: '日付', date: { equals: date } },
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
  });
  const [existing, ...duplicates] = matches;
  if (existing) {
    await notionRequest(`/pages/${existing.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    if (duplicates.length) await archivePages(duplicates);
    return { action: 'updated', pageId: existing.id, duplicatesArchived: duplicates.length };
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
    let dataSourceId = process.env[service.notionDataSourceEnv];
    if (!dataSourceId && service.notionDataSourceTitle) {
      dataSourceId = await findNotionDataSource(service.notionDataSourceTitle);
    }
    if (!dataSourceId && service.optional) {
      results.push({ service: service.name, date, action: 'skipped', reason: `${service.notionDataSourceEnv} is not configured` });
      continue;
    }
    if (!dataSourceId) throw new Error(`${service.notionDataSourceEnv} is required`);
    const cleanup = process.env.NORMALIZE_HISTORY === 'true'
      ? await normalizeNotionHistory(service, dataSourceId)
      : undefined;
    const [summaryReport, eventReport] = await Promise.all([
      runGaReport(accessToken, date, {
        metrics: ['activeUsers', 'newUsers', 'sessions', 'screenPageViews'].map(name => ({ name })),
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: service.pageMatchType || 'EXACT', value: service.pagePath },
          },
        },
      }),
      runGaReport(accessToken, date, {
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  inListFilter: { values: service.events },
                },
              },
              {
                filter: {
                  fieldName: 'pagePath',
                  stringFilter: { matchType: service.pageMatchType || 'EXACT', value: service.pagePath },
                },
              },
            ],
          },
        },
      }),
    ]);
    const metrics = metricObject(summaryReport);
    const events = eventCounts(eventReport);
    const priceDate = service.priceFile ? priceDataDate(service.priceFile) : '';
    const result = await upsertNotion(service, dataSourceId, date, reportProperties(service, date, metrics, events, priceDate));
    results.push({ service: service.name, date, metrics, events, priceDate, cleanup, ...result });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
