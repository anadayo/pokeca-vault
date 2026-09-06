# POKÉCA VAULT

ポケカの人気カードを検索して、5万円/10万円コースで売買シミュレーションできる静的Webアプリです。

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
- `PUBLICATION.md`: 公開手順とX投稿文

## GA4の設定

アクセス解析はGoogleアナリティクス(GA4)を使います。

- 測定ID: `G-1RKFX1HCCV`
- 対象URL: `https://anadayo.github.io/pokeca-vault/`
- デプロイ後、GA4の「リアルタイム」レポートに自分のアクセスが映れば設定完了

計測しているイベント:

- `mercari_click` … メルカリ成約相場リンクのクリック（`card_name` 付き）
- `share` … シェア操作（`method`: `x_post` / `copy_text` / `save_image`）

## X

投稿・告知用アカウント: `@anaday_o`
