# POKÉCA VAULT GitHub Pages 公開メモ

## いまの状態

GitHub Pagesで公開できるように、トップページ用の `index.html` を用意済みです。

公開対象に入れるファイル:

- `index.html`
- `.nojekyll`
- `README.md`
- `PUBLICATION.md`

`pokeca-vault.html` はローカル作業用として残しています。

## GitHub Pagesで公開する手順

1. GitHubで新しいリポジトリを作る
   - 例: `pokeca-vault`
   - Public推奨
2. このフォルダのファイルをリポジトリへアップロードする
3. GitHubで `Settings > Pages` を開く
4. `Build and deployment` の `Source` を `Deploy from a branch` にする
5. `Branch` を `main`、フォルダを `/root` にして `Save`
6. 数分待つ

公開URLは通常この形です。

```text
https://ユーザー名.github.io/pokeca-vault/
```

URLが出たら、アプリ右上の `Xで宣伝` に保存してください。

## ターミナルでアップロードする場合

GitHubで空のリポジトリを作ったあと、以下を実行します。

```sh
git init
git add index.html pokeca-vault.html README.md PUBLICATION.md .nojekyll
git commit -m "Publish POKECA VAULT"
git branch -M main
git remote add origin https://github.com/あなたのGitHubユーザー名/pokeca-vault.git
git push -u origin main
```

## X投稿文

### 初回公開

```text
ポケカ投資シミュレーター「POKÉCA VAULT」を公開しました。

5万円/10万円コースで人気カード100種類を売買して、所持金・評価額・含み損益・価格推移を見ながら疑似投資できます。

{公開URL}

#ポケカ #ポケモンカード #ポケカ投資 @anaday_o
```

### 改善募集

```text
POKÉCA VAULT を公開しました。

人気カード100種類から売買シミュレーションできます。
追加してほしいカードや改善点があればリプで教えてください。

{公開URL}

#ポケカ #ポケモンカード #個人開発 @anaday_o
```
