const assert = require('assert');
const { SERVICES, reportProperties } = require('./sync-daily-analytics-to-notion');

const service = SERVICES.find(item => item.name === 'VOCALU');
assert(service, 'VOCALU service must be configured');

const properties = reportProperties(service, '2026-11-07', {
  activeUsers: 5,
  newUsers: 3,
  sessions: 8,
  screenPageViews: 20,
  userEngagementDuration: 250,
}, {
  lobby_view: 5,
  pack_open: 4,
  battle_start: 3,
  battle_complete: 2,
  game_error: 1,
}, {});

assert.equal(properties['アクティブユーザー'].number, 5);
assert.equal(properties['新規ユーザー'].number, 3);
assert.equal(properties['再訪ユーザー'].number, 2);
assert.equal(properties['平均プレイ時間秒'].number, 50);
assert.equal(properties['対戦開始'].number, 3);
assert.equal(properties['対戦完了'].number, 2);
assert.equal(properties['計測状態'].select.name, '実測');

console.log('VOCALU shared analytics sync tests passed');
