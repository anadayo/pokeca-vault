# 詰めポケポケ

ポケポケ(Pokémon TCG Pocket)の盤面を使った、選択式リーサルパズルサイト。
詰将棋のように1手ずつ最適解を選んでリーサルを成立させる。

## 公開URL

このリポジトリのGitHub Pagesのサブディレクトリとして公開される:

```
https://<ユーザー名>.github.io/<リポジトリ名>/tsume-pokepoke/
```

(リポジトリ直下の POKÉCA VAULT とは独立して動作する)

## 構成

```
tsume-pokepoke/
├── index.html      … SPAシェル(全画面をJSで描画)
├── css/style.css   … ダークネオンUI
├── js/app.js       … ルーター・盤面描画・進行管理
└── data/
    ├── cards.js    … カードデータ (CARDS / CARD_TYPES)
    └── puzzles.js  … 問題データ (PUZZLES / DIFFICULTIES)
```

データは `fetch` ではなくグローバル変数を定義するJSファイルにしている。
これにより `file://` で直接開いても動き、GitHub Pagesでもそのまま動く。

## 問題の追加方法

1. 使うカードが `data/cards.js` の `CARDS` になければ追加する
2. `data/puzzles.js` の `PUZZLES` 配列にオブジェクトを1つ追加する
   - `difficulty` は `beginner / intermediate / advanced / expert / master`
   - 各 `steps[n]` に盤面スナップショット(`board`)・設問・選択肢(正解1つ+罠)を書く
   - 不正解の選択肢には必ず `reason`(なぜダメか)を書く — このサイトの核
   - `ruleNotes` にどの公式ルールに基づくかをメモする
3. 一覧・今日の一問・クリア集計には自動で反映される

## 進行状況の保存 (localStorage)

キー: `tsumepoke_v1`

- `cleared` … クリア済み問題とミス回数
- `masterUnlocked / masterCelebrated` … 達人モード解放状態と演出済みフラグ
- `streak / bestStreak` … 連続正解数
- `favorites` … お気に入り問題
- `lastPlayedAt` … 最終プレイ日時

達人モードは「初級・中級・上級・超級を各1問以上クリア」で解放。

## GA4

ルートの `index.html` と同じく、測定IDはプレースホルダ(`G-XXXXXXXXXX`)。
GA4プロパティ作成後、この `index.html` 内の2箇所を実IDに差し替える。

計測イベント:

- `puzzle_clear` … 問題の初回クリア(`puzzle_id` / `difficulty` / `mistakes`)
- `master_unlock` … 達人モード解放
- `share` … Xシェアボタン(`method: x_post` / `puzzle_id`)

## 注意

- カードデータはMVP用の仮データ。実カードと数値・ワザ名が異なる場合がある
- 公式画像は使用しない(絵文字プレースホルダー)
- ルール根拠は [ポケポケ公式FAQ](https://app-ptcgpt.pokemon-support.com/hc/ja/categories/51107996419609) を参照
