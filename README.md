# POKÉCA VAULT

ポケカの人気カードを検索して、5万円/10万円コースで売買シミュレーションできる静的Webアプリです。姉妹サービスとして、同じ仕組みを使ったワンピースカードゲーム版も運用します。

- POKÉCA VAULT: `https://anadayo.github.io/pokeca-vault/`
- OP CARD VAULT: `https://anadayo.github.io/pokeca-vault/onepiece-card-vault/`

## 公開方法

GitHub Pagesで公開できます。

1. このフォルダをGitHubリポジトリにアップロード
2. GitHubの `Settings > Pages` を開く
3. `Build and deployment` の `Source` を `Deploy from a branch` にする
4. `Branch` を `main` / `/root` にして `Save`
5. 数分後に `https://ユーザー名.github.io/リポジトリ名/` で公開

## ファイル

- `index.html`: GitHub Pagesで公開される本体
- `pokeca-vault.html`: ローカル作業用の元ファイル
- `onepiece-card-vault/index.html`: ワンピースカードゲーム版
- `scripts/build-onepiece-vault.js`: ポケカ版のUIを基にワンピース版を再生成
- `scripts/update-onepiece-prices.js`: ワンピース版の販売・買取参考価格を更新
- `PUBLICATION.md`: 公開手順とX投稿文

## GA4の設定

アクセス解析はGoogleアナリティクス(GA4)を使います。

- 測定ID: `G-1RKFX1HCCV`
- 対象URL: `https://anadayo.github.io/pokeca-vault/`
- デプロイ後、GA4の「リアルタイム」レポートに自分のアクセスが映れば設定完了

計測しているイベント:

- `mercari_affiliate_click` … メルカリアフィリエイトリンクのクリック。`card_id`、`card_name`、`placement`、`device_type`、`event_timestamp`、`event_id`を送信
- `card_detail_view` … カード詳細の表示（`placement`付き）
- `share` … シェア操作（`method`: `x_post` / `copy_text` / `save_image`）

ワンピース版はイベント名を `onepiece_*`、ブラウザ保存キーを `onePieceCardVault.*` に分け、ポケカ版の計測・保有データと混ざらない構成です。

メルカリURLは `createMercariAffiliateUrl()` だけで生成し、すべてのリンクにアンバサダーIDを付与します。開発者画面では、この端末について今日・昨日・7日・30日のクリック数、CTR、カード別・ページ別・導線別・直近ログを確認できます。GA4送信は公開ドメインだけで有効になり、localhostでのテストは本番集計に入りません。

## Notion日次レポート

`.github/workflows/daily-analytics-to-notion.yml` は毎朝9:15（JST）に前日のGA4指標、メルカリアフィリエイトクリック、価格データ更新日をNotionへ保存します。設定方法は `NOTION_ANALYTICS_SETUP.md` を参照してください。

## X

投稿・告知用アカウント: `@ana_wasborn`
