# WordPress移行ランブック（実行手順）

最終更新: 2026-03-22

## 0. 目的

この手順は、現行 `content/` から WordPress へ記事・ホーム・画像を投入し、
埋め込み互換（`md-embed`）を維持した状態で公開可能にするための実行手順です。

## 1. このリポジトリで追加済みのもの

- WordPress互換プラグイン
  - `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`
- エクスポート/インポートスクリプト
  - `scripts/wp-export-content.mjs`
  - `scripts/wp-import-rest.mjs`
  - `scripts/wp-migrate-utils.mjs`

## 2. 事前準備（WordPress側）

1. WordPressを起動し、管理者ユーザーを作成。
2. アプリケーションパスワードを発行。
3. `hutaro-bridge.php` をインストールして有効化。
   - 配置先: `wp-content/plugins/hutaro-bridge/hutaro-bridge.php`
   - 有効化後、`設定 > パーマリンク` を一度「保存」して rewrite を再生成
4. パーマリンク設定を `/%category%/%postname%/` へ変更（`/blog/{slug}` を維持するため）。
5. 必要なら `blog-tech` 用の表示テンプレートをテーマ側で調整。

## 3. データ作成（ローカル）

```bash
npm run wp:export
```

生成物:
- `migration/wordpress/payload.json`

内容:
- `home`: ホームページHTML
- `posts`: 記事（slug, date, section, contentHtml, excerpt）
- `media`: 画像/動画のローカルパス

## 4. WordPress投入（REST API）

```bash
WP_BASE_URL=https://<your-wp-domain> \
WP_USERNAME=<wp-admin-user> \
WP_APP_PASSWORD='<application-password>' \
npm run wp:import:rest
```

処理内容:
1. メディアを `/wp-json/wp/v2/media` にアップロード
2. カテゴリ `blog`, `blog-tech` を作成（なければ）
3. 固定ページ `home` を upsert
4. `show_on_front=page` + `page_on_front=<home id>` を設定
5. 記事をカテゴリごとに upsert

## 5. 動作確認

- ホーム表示: `https://<domain>/`
- blog一覧: `https://<domain>/category/blog/` またはテーマの `/blog`
- blog-tech一覧: `https://<domain>/category/blog-tech/` またはテーマの `/blog-tech`
- ヘルスAPI: `https://<domain>/wp-json/hutaro/v1/health`
- 旧互換ヘルスAPI: `https://<domain>/api/health`
- カウンターAPI:
  - GET: `.../wp-json/hutaro/v1/counter?key=home`
  - POST: `.../wp-json/hutaro/v1/counter`
  - 旧互換: `.../api/access-counter`

## 6. URL互換の注意点

現行URLを完全互換にする場合は、テーマ/リライトルールで以下を保証します。

- `/blog/{slug}` -> category slug `blog` の投稿詳細
- `/blog-tech/{slug}` -> category slug `blog-tech` の投稿詳細
- `/blog` と `/blog-tech` の一覧ページを固定URLで表示

必要なら Web サーバー（Nginx）または WP リライトルールで補正します。

## 7. ロールバック

- 本番投入前にDBバックアップを必ず取得。
- 投入失敗時はDBスナップショットを復元。
- 失敗原因（メディア権限/API権限/パーマリンク）を切り分けて再実行。

## 8. 既知の制約

- Markdown -> HTML は `scripts/wp-migrate-utils.mjs` の簡易変換です。
- 複雑なMarkdown（ネストリスト、特殊テーブル、高度なコードハイライト）は
  変換結果の目視確認が必要です。
- `voices` 演出は属性情報を保持しますが、完全再現にはテーマ側JS/CSS追加が必要です。
