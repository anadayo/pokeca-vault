// =====================================================
// 詰めポケポケ カードデータ
// -----------------------------------------------------
// ※ MVP用の仮データです。実カードと数値・ワザ名が
//    異なる場合があります。新カード追加時はここに追記。
// 項目: cardId, name, kind(pokemon/trainer), type, hp,
//        stage, ex, attacks, ability, icon, description, ruleNotes
// =====================================================

const CARD_TYPES = {
  "雷":   { color: "#facc15", icon: "⚡" },
  "水":   { color: "#38bdf8", icon: "💧" },
  "超":   { color: "#c084fc", icon: "🔮" },
  "炎":   { color: "#fb7185", icon: "🔥" },
  "闘":   { color: "#f59e0b", icon: "✊" },
  "悪":   { color: "#818cf8", icon: "🌑" },
  "無":   { color: "#94a3b8", icon: "⭐" },
};

const CARDS = {
  // ---------- 雷 ----------
  "pikachu-ex": {
    name: "ピカチュウex", kind: "pokemon", type: "雷", hp: 120, stage: "たね", ex: true, icon: "⚡", weak: "闘",
    attacks: [{ name: "エレキサークル", cost: "⚡⚡", text: "自分のベンチの雷ポケモンの数×30ダメージ" }],
  },
  "pikachu": {
    name: "ピカチュウ", kind: "pokemon", type: "雷", hp: 60, stage: "たね", icon: "⚡", weak: "闘",
    attacks: [{ name: "でんきショック", cost: "⚡", text: "20ダメージ" }],
  },
  "pichu": {
    name: "ピチュー", kind: "pokemon", type: "雷", hp: 40, stage: "たね", icon: "⚡", weak: "闘",
    attacks: [{ name: "なかまをよぶ", cost: "無", text: "山札からたねポケモンを1匹ベンチに出す" }],
  },
  "elebuu": {
    name: "エレブー", kind: "pokemon", type: "雷", hp: 80, stage: "たね", icon: "⚡", weak: "闘",
    attacks: [{ name: "つきとばす", cost: "⚡⚡", text: "40ダメージ" }],
  },
  "emonga": {
    name: "エモンガ", kind: "pokemon", type: "雷", hp: 60, stage: "たね", icon: "⚡", weak: "闘",
    attacks: [{ name: "スピードボルト", cost: "⚡", text: "20ダメージ" }],
  },
  "thunder-ex": {
    name: "サンダーex", kind: "pokemon", type: "雷", hp: 130, stage: "たね", ex: true, icon: "🌩", weak: "闘",
    attacks: [
      { name: "ピークスパーク", cost: "⚡⚡", text: "60ダメージ" },
      { name: "らいめいスナイプ", cost: "⚡⚡⚡", text: "相手のベンチポケモン1匹に50ダメージ" },
    ],
  },
  // ---------- 水 ----------
  "koiking": {
    name: "コイキング", kind: "pokemon", type: "水", hp: 30, stage: "たね", icon: "🐟", weak: "雷",
    attacks: [{ name: "はねる", cost: "⭐", text: "10ダメージ" }],
  },
  "gyarados-ex": {
    name: "ギャラドスex", kind: "pokemon", type: "水", hp: 180, stage: "1進化", ex: true, icon: "🌊", weak: "雷",
    attacks: [{ name: "ハイドロポンプ", cost: "💧💧💧💧", text: "140ダメージ" }],
  },
  "freezer-ex": {
    name: "フリーザーex", kind: "pokemon", type: "水", hp: 140, stage: "たね", ex: true, icon: "❄️", weak: "雷",
    attacks: [{ name: "ブリザード", cost: "💧💧💧", text: "80ダメージ" }],
  },
  // ---------- 超 ----------
  "mewtwo-ex": {
    name: "ミュウツーex", kind: "pokemon", type: "超", hp: 150, stage: "たね", ex: true, icon: "🌀", weak: "悪",
    attacks: [
      { name: "ねんどう", cost: "🔮", text: "50ダメージ" },
      { name: "サイコドライブ", cost: "🔮🔮🔮🔮", text: "150ダメージ。このポケモンから🔮エネルギーを2個トラッシュ" },
    ],
  },
  "ralts": {
    name: "ラルトス", kind: "pokemon", type: "超", hp: 60, stage: "たね", icon: "💫", weak: "悪",
    attacks: [{ name: "ねんりき", cost: "🔮", text: "10ダメージ" }],
  },
  "kirlia": {
    name: "キルリア", kind: "pokemon", type: "超", hp: 70, stage: "1進化", icon: "💫", weak: "悪",
    attacks: [{ name: "サイケこうせん", cost: "🔮🔮", text: "30ダメージ" }],
  },
  "sirnight": {
    name: "サーナイト", kind: "pokemon", type: "超", hp: 110, stage: "2進化", icon: "✨", weak: "悪",
    ability: { name: "サイコチャージ", text: "自分の番に1回使える。エネルギーゾーンから🔮エネルギーを1個、自分の超ポケモンにつける。" },
    attacks: [{ name: "サイコショット", cost: "🔮🔮", text: "60ダメージ" }],
  },
  // ---------- 炎 ----------
  "lizardon-ex": {
    name: "リザードンex", kind: "pokemon", type: "炎", hp: 180, stage: "2進化", ex: true, icon: "🔥", weak: "水",
    attacks: [{ name: "かえんだんりゅう", cost: "🔥🔥🔥🔥", text: "200ダメージ" }],
  },
  "hitokage": {
    name: "ヒトカゲ", kind: "pokemon", type: "炎", hp: 60, stage: "たね", icon: "🔥", weak: "水",
    attacks: [{ name: "ひのこ", cost: "🔥", text: "30ダメージ" }],
  },
  // ---------- 闘・無 ----------
  "kairiky": {
    name: "カイリキー", kind: "pokemon", type: "闘", hp: 90, stage: "1進化", icon: "💪", weak: "超",
    attacks: [{ name: "かわらわり", cost: "✊✊", text: "70ダメージ" }],
  },
  "kabigon": {
    name: "カビゴン", kind: "pokemon", type: "無", hp: 120, stage: "たね", icon: "😴", weak: "闘",
    attacks: [{ name: "のしかかり", cost: "⭐⭐⭐", text: "50ダメージ" }],
  },

  // ---------- トレーナーズ ----------
  "sakaki": {
    name: "サカキ", kind: "trainer", sub: "サポート", icon: "👤",
    description: "この番、自分のポケモンが相手のポケモンに与えるワザのダメージを+10する。",
    ruleNotes: "ベンチポケモンへのワザダメージにも+10が適用される。サポートは1ターンに1枚しか使えない。",
  },
  "natsume": {
    name: "ナツメ", kind: "trainer", sub: "サポート", icon: "👤",
    description: "相手のバトルポケモンをベンチポケモンと入れ替える。(新しいバトルポケモンは相手が選ぶ)",
    ruleNotes: "入れ替え先を選ぶのは「相手」。狙ったポケモンを前に出せるとは限らない。",
  },
  "hakase": {
    name: "博士の研究", kind: "trainer", sub: "サポート", icon: "🧪",
    description: "自分の山札を2枚引く。",
    ruleNotes: "サポートは1ターンに1枚しか使えない。",
  },
  "irekae": {
    name: "ポケモンいれかえ", kind: "trainer", sub: "グッズ", icon: "🔄",
    description: "自分のバトルポケモンをベンチポケモンと入れ替える。",
    ruleNotes: "「にげる」と違いエネルギーをトラッシュしない。",
  },
  "monsterball": {
    name: "モンスターボール", kind: "trainer", sub: "グッズ", icon: "🔴",
    description: "自分の山札から「たねポケモン」をランダムに1枚、手札に加える。",
    ruleNotes: "対象は「たねポケモン」のみ。進化ポケモンは持ってこられない。山札のたねが1種類なら確定サーチになる。",
  },
  "kizugusuri": {
    name: "きずぐすり", kind: "trainer", sub: "グッズ", icon: "🧴",
    description: "自分のポケモン1匹のHPを20回復する。",
  },
};
