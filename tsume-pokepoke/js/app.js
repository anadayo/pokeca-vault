// =====================================================
// 詰めポケポケ アプリ本体 (SPA / ハッシュルーティング)
// =====================================================

/* ---------- 進行状況 (localStorage) ---------- */
const STORAGE_KEY = "tsumepoke_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* 破損時は初期化 */ }
  return defaultState();
}
function defaultState() {
  return {
    cleared: {},          // { puzzleId: { clearedAt, mistakes } }
    masterUnlocked: false,
    masterCelebrated: false,
    lastPlayedAt: null,
    streak: 0,            // 連続正解数(選択肢単位)
    bestStreak: 0,
    favorites: [],
  };
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode等 */ }
}
let state = loadState();

/* ---------- ヘルパー ---------- */
function track(event, params) {
  // GA4計測(未設定環境では何もしない)
  if (typeof gtag === "function") gtag("event", event, params || {});
}

const $app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function puzzlesOf(diff) {
  return PUZZLES.filter((p) => p.difficulty === diff);
}
function clearCount(diff) {
  return puzzlesOf(diff).filter((p) => state.cleared[p.puzzleId]).length;
}
function totalCleared() {
  return Object.keys(state.cleared).filter((id) => PUZZLES.some((p) => p.puzzleId === id)).length;
}
function masterConditions() {
  return ["beginner", "intermediate", "advanced", "expert"].map((d) => ({
    diff: d, label: DIFFICULTIES[d].label, done: clearCount(d) >= 1,
  }));
}
function isMasterUnlocked() {
  return state.masterUnlocked || masterConditions().every((c) => c.done);
}
function findPuzzle(id) {
  return PUZZLES.find((p) => p.puzzleId === id);
}
function dailyPuzzle() {
  // 日付から決定的に1問選ぶ「今日の一問」
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const pool = PUZZLES.filter((p) => p.difficulty !== "master" || isMasterUnlocked());
  return pool[seed % pool.length];
}

/* ---------- ポケモン/盤面の描画 ---------- */
function hpFillClass(ratio) {
  if (ratio <= 0.3) return "low";
  if (ratio <= 0.6) return "mid";
  return "";
}

function renderMon(slot, isActive) {
  if (!slot) return `<div class="empty-slot">なし</div>`;
  const card = CARDS[slot.cardId] || { name: slot.cardId, type: "無", hp: slot.hp, icon: "❓" };
  const type = CARD_TYPES[card.type] || CARD_TYPES["無"];
  const maxHp = card.hp || slot.hp || 1;
  const ratio = Math.max(0, slot.hp / maxHp);
  return `
    <div class="mon ${isActive ? "active-mon" : ""} ${card.ex ? "ex-mon" : ""} ${slot.ko ? "ko" : ""}" style="--tc:${type.color}">
      <div class="mon-name"><span>${type.icon}</span>${esc(card.name)}${card.ex ? `<span class="ex-badge">ex</span>` : ""}</div>
      <div class="mon-art">${card.icon || type.icon}</div>
      <div class="mon-hpbar"><div class="mon-hpfill ${hpFillClass(ratio)}" style="width:${ratio * 100}%"></div></div>
      <div class="mon-hp"><span>HP</span><b>${slot.hp}<span style="font-weight:500">/${maxHp}</span></b></div>
      <div class="mon-energy"><span>${(slot.energy || []).join("")}</span>${card.weak ? `<span class="mon-weak">弱点${(CARD_TYPES[card.weak] || {}).icon || card.weak}</span>` : ""}</div>
      ${slot.ko ? `<div class="ko-stamp">きぜつ!</div>` : ""}
    </div>`;
}

function renderPoints(n) {
  return `<span class="points">${[0, 1, 2].map((i) => `<span class="pt ${i < n ? "on" : ""}"></span>`).join("")}</span>`;
}

function renderHand(hand) {
  if (!hand || !hand.length) return `<div class="hand-row"><span class="hand-chip" style="color:var(--text-dim)">なし</span></div>`;
  return `<div class="hand-row">${hand.map((id) => {
    const c = CARDS[id] || { name: id, icon: "❓" };
    return `<span class="hand-chip">${c.icon || "🃏"} ${esc(c.name)}${c.sub ? `<span class="chip-sub">${esc(c.sub)}</span>` : ""}</span>`;
  }).join("")}</div>`;
}

function renderBoard(board) {
  const opp = board.opp, me = board.me;
  return `
  ${board.note ? `<div class="board-note">⚠️ ${esc(board.note)}</div>` : ""}
  <div class="board">
    <div class="board-side">
      <div class="side-head">
        <span class="side-name-opp">あいて ${renderPoints(opp.points)}</span>
        <span class="side-extra">手札 ${opp.handCount ?? "?"}枚</span>
      </div>
      <div class="zone-label">ベンチ</div>
      <div class="mon-row">${opp.bench && opp.bench.length ? opp.bench.map((m) => renderMon(m)).join("") : `<div class="empty-slot">なし</div>`}</div>
      <div class="zone-label">バトル場</div>
      <div class="mon-row">${renderMon(opp.active, true)}</div>
    </div>
    <div class="board-divider">VS</div>
    <div class="board-side">
      <div class="zone-label">バトル場</div>
      <div class="mon-row">${renderMon(me.active, true)}</div>
      <div class="zone-label">ベンチ</div>
      <div class="mon-row">${me.bench && me.bench.length ? me.bench.map((m) => renderMon(m)).join("") : `<div class="empty-slot">なし</div>`}</div>
      <div class="side-head" style="margin-top:10px">
        <span class="side-name-me">じぶん ${renderPoints(me.points)}</span>
      </div>
      <div class="zone-label">手札</div>
      ${renderHand(me.hand)}
      <div class="me-extras">
        <span class="ez">エネルギーゾーン: ${me.energyZone ? me.energyZone + " (未使用)" : "使用済み"}</span>
        ${me.deckInfo ? `<span>📚 ${esc(me.deckInfo)}</span>` : ""}
      </div>
      ${(me.effects || []).map((e) => `<span class="effect-chip">✨ ${esc(e)}</span>`).join("")}
    </div>
  </div>`;
}

/* ---------- 共通パーツ ---------- */
function diffTag(diffKey) {
  const d = DIFFICULTIES[diffKey];
  return `<span class="tag" style="color:${d.color}">${d.label}</span>`;
}

/* ---------- 画面: トップ ---------- */
function viewHome() {
  const daily = dailyPuzzle();
  const dailyCleared = !!state.cleared[daily.puzzleId];
  const unlocked = isMasterUnlocked();
  document.title = "詰めポケポケ | このターン、勝ち切れる？";
  $app.innerHTML = `
    <section class="hero">
      <div class="hero-eyebrow">POKÉ-POCKET LETHAL PUZZLE</div>
      <h1 class="hero-title">詰めポケポケ</h1>
      <p class="hero-catch">このターン、勝ち切れる？</p>
      <p class="hero-sub">ポケポケの盤面を読み切れ。詰将棋式・選択型リーサルパズル。</p>
      <div class="hero-actions">
        <a class="btn" href="#/levels">▶ 問題に挑戦する</a>
        <a class="btn btn-ghost" href="#/rules">📘 ルール早見表</a>
      </div>
      <div class="stat-strip">
        <div class="stat-box card-panel"><div class="stat-num">${totalCleared()}<span style="font-size:.8rem;color:var(--text-dim)">/${PUZZLES.length}</span></div><div class="stat-label">クリア問題</div></div>
        <div class="stat-box card-panel"><div class="stat-num">${state.bestStreak}</div><div class="stat-label">最高連続正解</div></div>
        <div class="stat-box card-panel"><div class="stat-num">${unlocked ? "👑" : "🔒"}</div><div class="stat-label">達人モード</div></div>
      </div>
    </section>

    <h2 class="section-title">📅 今日の一問</h2>
    <div class="card-panel daily-card">
      <div class="daily-inner">
        <div class="daily-label">DAILY PUZZLE — ${new Date().getMonth() + 1}/${new Date().getDate()}</div>
        <div class="daily-title">${esc(daily.title)} ${dailyCleared ? "✅" : ""}</div>
        <div class="daily-meta">
          ${diffTag(daily.difficulty)}
          <span class="tag" style="color:var(--text-dim)">想定 ${daily.estimatedSteps}手</span>
          <span class="tag" style="color:var(--text-dim)">${esc(daily.theme)}</span>
        </div>
        <a class="btn btn-sm" href="#/play/${daily.puzzleId}">挑戦する</a>
      </div>
    </div>

    <h2 class="section-title">🎮 難易度をえらぶ</h2>
    ${renderDiffGrid(true)}
  `;
}

/* ---------- 画面: ルール早見表 ---------- */
function ruleCategory(note) {
  // ruleNotes の文面からカテゴリを自動判定(問題追加時もメンテ不要)
  const cats = [
    { key: "エネルギー", match: /エネルギー|にげる/ },
    { key: "サポート・グッズ", match: /サポート|グッズ|モンスターボール|ナツメ|サカキ/ },
    { key: "ベンチ・バトル場", match: /ベンチ|バトル場/ },
    { key: "ダメージ計算", match: /弱点|ダメージ|\+20|\+10/ },
    { key: "進化・特性", match: /進化|特性/ },
    { key: "勝利条件・ターン", match: /ポイント|番が終わる|ex/ },
  ];
  for (const c of cats) if (c.match.test(note)) return c.key;
  return "その他";
}

function viewRules() {
  document.title = "ルール早見表 | 詰めポケポケ";
  // 全問題の ruleNotes を重複なしで集約し、出典問題を紐づける
  const map = new Map(); // note -> [puzzle...]
  for (const p of PUZZLES) {
    for (const note of p.ruleNotes || []) {
      if (!map.has(note)) map.set(note, []);
      map.get(note).push(p);
    }
  }
  const groups = {};
  for (const [note, sources] of map) {
    const cat = ruleCategory(note);
    (groups[cat] = groups[cat] || []).push({ note, sources });
  }
  const order = ["ダメージ計算", "エネルギー", "サポート・グッズ", "ベンチ・バトル場", "進化・特性", "勝利条件・ターン", "その他"];
  const unlocked = isMasterUnlocked();

  $app.innerHTML = `
    <a class="back-link" href="#/">← トップへ</a>
    <div class="page-head">
      <h1 class="page-title">📘 ルール早見表</h1>
      <p class="page-desc">問題に登場したポケポケの重要ルールまとめ。各ルールは出典の問題で実際に体験できる。</p>
    </div>
    <div class="card-panel" style="margin-bottom:16px;font-size:.8rem;color:var(--text-dim)">
      正確なルール・裁定は必ず <a href="https://app-ptcgpt.pokemon-support.com/hc/ja/categories/51107996419609" target="_blank" rel="noopener">ポケポケ公式FAQ</a> を確認してください。このページは学習用の要約です。
    </div>
    ${order.filter((cat) => groups[cat]).map((cat) => `
      <h2 class="section-title">${esc(cat)}</h2>
      <div class="rule-notes" style="margin-top:0">
        ${groups[cat].map(({ note, sources }) => `
          <div class="rule-note rule-note-lg">
            ${esc(note)}
            <div class="rule-sources">
              ${sources.map((p) => {
                const locked = p.difficulty === "master" && !unlocked;
                const d = DIFFICULTIES[p.difficulty];
                return locked
                  ? `<span class="rule-src" style="color:var(--text-dim)">🔒 達人問題</span>`
                  : `<a class="rule-src" style="color:${d.color}" href="#/play/${p.puzzleId}">${d.label}「${esc(p.title)}」</a>`;
              }).join("")}
            </div>
          </div>`).join("")}
      </div>
    `).join("")}
  `;
  window.scrollTo({ top: 0 });
}

/* ---------- 画面: 難易度選択 ---------- */
function renderDiffGrid(compact) {
  const unlocked = isMasterUnlocked();
  const conds = masterConditions();
  const keys = Object.keys(DIFFICULTIES).sort((a, b) => DIFFICULTIES[a].order - DIFFICULTIES[b].order);
  return `<div class="diff-grid">${keys.map((key) => {
    const d = DIFFICULTIES[key];
    const total = puzzlesOf(key).length;
    const cleared = clearCount(key);
    const isMaster = key === "master";
    const locked = isMaster && !unlocked;
    const inner = `
      <div class="diff-head">
        <span class="diff-name">${d.label}</span>
        <span class="diff-sub">${esc(d.sub)}</span>
      </div>
      <div class="diff-desc">${esc(d.desc)}</div>
      <div class="diff-stats">
        <span class="${cleared >= total && total > 0 ? "diff-clear-ok" : ""}">クリア ${cleared}/${total}</span>
        ${cleared >= total && total > 0 ? `<span class="diff-clear-ok">★ 全制覇</span>` : ""}
      </div>
      ${locked ? `
        <div class="lock-overlay">🔒 各難易度を1問以上クリアで解放</div>
        ${compact ? "" : `<div class="lock-conditions">${conds.map((c) =>
          `<div class="lock-cond ${c.done ? "done" : ""}">${c.done ? "✅" : "⬜"} ${c.label}を1問クリア</div>`).join("")}</div>`}
      ` : ""}
      ${isMaster && unlocked ? `<div class="lock-overlay">👑 解放済み — 最終試練へ</div>` : ""}
    `;
    if (locked) {
      return `<div class="diff-card locked master-card" style="--dc:${d.color}">${inner}</div>`;
    }
    return `<a class="diff-card ${isMaster ? "master-card master-unlocked" : ""}" style="--dc:${d.color}" href="#/list/${key}">${inner}</a>`;
  }).join("")}</div>`;
}

function viewLevels() {
  document.title = "難易度をえらぶ | 詰めポケポケ";
  $app.innerHTML = `
    <a class="back-link" href="#/">← トップへ</a>
    <div class="page-head">
      <h1 class="page-title">難易度をえらぶ</h1>
      <p class="page-desc">初級から順に解いていくと、最後に「達人」への道が開く。</p>
    </div>
    ${renderDiffGrid(false)}
  `;
}

/* ---------- 画面: 問題一覧 ---------- */
function viewList(diffKey) {
  const d = DIFFICULTIES[diffKey];
  if (!d) return navigate("#/levels");
  if (diffKey === "master" && !isMasterUnlocked()) return navigate("#/levels");
  const list = puzzlesOf(diffKey);
  document.title = `${d.label}の問題一覧 | 詰めポケポケ`;
  $app.innerHTML = `
    <a class="back-link" href="#/levels">← 難易度選択へ</a>
    <div class="page-head">
      <h1 class="page-title" style="color:${d.color}">${d.label}の問題</h1>
      <p class="page-desc">${esc(d.desc)}</p>
    </div>
    <div class="puzzle-list" style="--dc:${d.color}">
      ${list.length ? list.map((p) => {
        const done = !!state.cleared[p.puzzleId];
        const faved = state.favorites.includes(p.puzzleId);
        return `
        <a class="puzzle-row" href="#/play/${p.puzzleId}">
          <span class="puzzle-status">${done ? "✅" : "🧩"}</span>
          <span class="puzzle-info">
            <span class="puzzle-title">${esc(p.title)}</span>
            <span class="puzzle-meta">
              <span>想定 ${p.estimatedSteps}手</span>
              <span>テーマ: ${esc(p.theme)}</span>
              <span>${esc(p.deckType)}デッキ</span>
            </span>
          </span>
          <button class="fav-btn ${faved ? "faved" : ""}" aria-label="お気に入り" onclick="toggleFav(event,'${p.puzzleId}')">${faved ? "★" : "☆"}</button>
        </a>`;
      }).join("") : `<div class="card-panel" style="text-align:center;color:var(--text-dim)">問題は準備中です。</div>`}
    </div>
  `;
}

function toggleFav(ev, id) {
  ev.preventDefault();
  ev.stopPropagation();
  const i = state.favorites.indexOf(id);
  if (i >= 0) state.favorites.splice(i, 1);
  else state.favorites.push(id);
  saveState();
  router(); // 再描画
}

/* ---------- 画面: プレイ ---------- */
const play = { puzzle: null, step: 0, mistakes: 0, answered: false };

function viewPlay(puzzleId) {
  const p = findPuzzle(puzzleId);
  if (!p) return navigate("#/levels");
  if (p.difficulty === "master" && !isMasterUnlocked()) return navigate("#/levels");
  if (play.puzzle?.puzzleId !== puzzleId) {
    play.puzzle = p; play.step = 0; play.mistakes = 0; play.answered = false;
  }
  state.lastPlayedAt = new Date().toISOString();
  saveState();
  renderPlayStep();
}

function renderPlayStep() {
  const p = play.puzzle;
  const d = DIFFICULTIES[p.difficulty];
  const step = p.steps[play.step];
  play.answered = false;
  document.title = `${p.title} | 詰めポケポケ`;
  $app.innerHTML = `
    <a class="back-link" href="#/list/${p.difficulty}">← ${d.label}の問題一覧へ</a>
    <div class="play-top">
      <div>
        ${diffTag(p.difficulty)}
        <strong style="margin-left:6px">${esc(p.title)}</strong>
      </div>
      <div class="step-indicator">
        ${p.steps.map((_, i) => `<span class="step-dot ${i < play.step ? "done" : i === play.step ? "now" : ""}"></span>`).join("")}
        <span class="step-count">${play.step + 1}/${p.steps.length}手</span>
      </div>
    </div>
    ${play.step === 0 ? `<div class="card-panel" style="margin-bottom:10px;font-size:.84rem;white-space:pre-line">${esc(p.intro)}</div>` : ""}
    ${renderBoard(step.board)}
    <div class="question-box">Q. ${esc(step.question)}</div>
    <div class="choices" id="choices">
      ${step.choices.map((c, i) => `
        <button class="choice-btn" data-key="${"ABC"[i] || i + 1}" id="choice-${c.id}" onclick="pickChoice('${c.id}')">${esc(c.label)}</button>
      `).join("")}
    </div>
    <div id="feedback-area"></div>
  `;
  window.scrollTo({ top: 0 });
}

function pickChoice(choiceId) {
  if (play.answered) return;
  const p = play.puzzle;
  const step = p.steps[play.step];
  const choice = step.choices.find((c) => c.id === choiceId);
  if (!choice) return;
  play.answered = true;

  document.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));
  const btn = document.getElementById(`choice-${choiceId}`);
  const area = document.getElementById("feedback-area");
  const isLast = play.step === p.steps.length - 1;

  if (choice.correct) {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    saveState();
    btn.classList.add("picked-correct");
    const flash = document.createElement("div");
    flash.className = "flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 650);
    area.innerHTML = `
      <div class="feedback good">
        <div class="feedback-head">⭕ 正解！</div>
        <div class="feedback-reason">${esc(choice.reason)}</div>
        <button class="btn btn-block" onclick="nextStep()">${isLast ? "🏆 リーサル成立！結果を見る" : "次の一手へ ▶"}</button>
      </div>`;
  } else {
    play.mistakes += 1;
    state.streak = 0;
    saveState();
    btn.classList.add("picked-wrong");
    area.innerHTML = `
      <div class="feedback bad">
        <div class="feedback-head">❌ 不正解…</div>
        <div class="feedback-reason">${esc(choice.reason)}</div>
        <button class="btn btn-ghost btn-block" onclick="retryStep()">もう一度考える</button>
      </div>`;
  }
  area.scrollIntoView({ behavior: "smooth", block: "end" });
}

function retryStep() {
  renderPlayStep();
  // 設問位置までスクロール
  document.querySelector(".question-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function nextStep() {
  const p = play.puzzle;
  if (play.step < p.steps.length - 1) {
    play.step += 1;
    renderPlayStep();
  } else {
    finishPuzzle();
  }
}

function finishPuzzle() {
  const p = play.puzzle;
  const firstClear = !state.cleared[p.puzzleId];
  state.cleared[p.puzzleId] = { clearedAt: new Date().toISOString(), mistakes: play.mistakes };
  saveState();
  if (firstClear) track("puzzle_clear", { puzzle_id: p.puzzleId, difficulty: p.difficulty, mistakes: play.mistakes });
  navigate(`#/result/${p.puzzleId}`);
  // 達人解放チェック(初達成時のみ演出)
  if (!state.masterCelebrated && isMasterUnlocked()) {
    state.masterUnlocked = true;
    state.masterCelebrated = true;
    saveState();
    track("master_unlock", {});
    setTimeout(showMasterModal, 700);
  }
}

/* ---------- 画面: 結果 ---------- */
function viewResult(puzzleId) {
  const p = findPuzzle(puzzleId);
  if (!p || !state.cleared[p.puzzleId]) return navigate(`#/play/${puzzleId}`);
  const d = DIFFICULTIES[p.difficulty];
  const rec = state.cleared[p.puzzleId];
  const route = p.steps.map((s) => s.choices.find((c) => c.correct));
  const sameList = puzzlesOf(p.difficulty);
  const idx = sameList.indexOf(p);
  const next = sameList[idx + 1] || null;
  document.title = `クリア: ${p.title} | 詰めポケポケ`;

  $app.innerHTML = `
    <div class="result-hero">
      <div class="result-burst">🏆</div>
      <div class="result-title">リーサル成立！</div>
      <div class="result-puzzle">${diffTag(p.difficulty)} ${esc(p.title)}</div>
      <div class="result-stats">
        <span>手数 <b>${p.steps.length}</b></span>
        <span>ミス <b>${rec.mistakes}</b>回</span>
        <span>連続正解 <b>${state.streak}</b></span>
      </div>
    </div>

    ${p.result?.board ? renderBoard(p.result.board) : ""}

    <h2 class="section-title">🧭 正解手順</h2>
    <div class="route-list">
      ${route.map((c, i) => `
        <div class="route-item"><span class="route-num">${i + 1}</span><span><b>${esc(c.label)}</b><br><span style="color:var(--text-dim);font-size:.78rem">${esc(c.reason)}</span></span></div>
      `).join("")}
    </div>

    <h2 class="section-title">📖 解説</h2>
    <div class="card-panel explain-box">
      ${esc(p.explanation)}
      ${p.ruleNotes?.length ? `
        <div class="rule-notes">
          ${p.ruleNotes.map((r) => `<div class="rule-note">📘 ${esc(r)}</div>`).join("")}
        </div>
        <p style="font-size:.72rem;color:var(--text-dim);margin-top:10px">ルールの詳細は <a href="https://app-ptcgpt.pokemon-support.com/hc/ja/categories/51107996419609" target="_blank" rel="noopener">公式FAQ</a> を確認</p>
      ` : ""}
    </div>

    <div class="result-actions">
      ${next ? `<a class="btn" href="#/play/${next.puzzleId}">次の問題へ ▶</a>` : `<a class="btn" href="#/levels">他の難易度へ ▶</a>`}
      <a class="btn btn-ghost" href="#/list/${p.difficulty}">${d.label}の一覧へ</a>
      <button class="btn btn-x" onclick="shareX('${p.puzzleId}')">𝕏 で結果をシェア</button>
    </div>
  `;
  window.scrollTo({ top: 0 });
}

function shareX(puzzleId) {
  const p = findPuzzle(puzzleId);
  const d = DIFFICULTIES[p.difficulty];
  const rec = state.cleared[puzzleId] || { mistakes: 0 };
  const noMiss = rec.mistakes === 0 ? "ノーミスで" : "";
  const url = location.href.split("#")[0] + `#/play/${puzzleId}`;
  const text = `詰めポケポケ【${d.label}】「${p.title}」を${noMiss}クリア！🏆\nこの盤面、キミは読み切れる？\n#詰めポケポケ #ポケポケ`;
  track("share", { method: "x_post", puzzle_id: puzzleId });
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
}

/* ---------- 達人解放モーダル ---------- */
function showMasterModal() {
  document.getElementById("master-modal").hidden = false;
}
function closeMasterModal(go) {
  document.getElementById("master-modal").hidden = true;
  if (go) {
    const m = puzzlesOf("master")[0];
    navigate(m ? `#/play/${m.puzzleId}` : "#/levels");
  } else {
    router(); // 解放状態を再描画
  }
}

/* ---------- ルーター ---------- */
function navigate(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

function router() {
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/([^/]*)\/?([^/]*)/);
  const page = m ? m[1] : "";
  const param = m ? m[2] : "";
  switch (page) {
    case "":        viewHome(); break;
    case "levels":  viewLevels(); break;
    case "rules":   viewRules(); break;
    case "list":    viewList(param); break;
    case "play":    viewPlay(param); break;
    case "result":  viewResult(param); break;
    default:        viewHome();
  }
}

window.addEventListener("hashchange", router);
router();
