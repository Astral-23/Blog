# 開発者向けガイド（WordPress移行後）

最終更新: 2026-03-22

## 1. 開発方針
- 配信基盤は WordPress、編集正本は `content/*.md`。
- 「表示機能」は WordPress テーマ/プラグインで担い、「原稿/資産」は Git 管理で担う。
- 既存 URL 互換（`/blog/*`, `/blog-tech/*`, `/api/health`, `/api/access-counter`）を壊さない。

## 2. 現行アーキテクチャ
- Markdown正本: `content/home.md`, `content/blog/*.md`, `content/blog-tech/*.md`
- 変換/投入:
  - `scripts/wp-export-content.mjs`
  - `scripts/wp-import-rest.mjs`
  - `scripts/wp-migrate-utils.mjs`
  - `scripts/wp-publish-md.sh`（`npm run wp:publish:md`）
- WordPress実装:
  - Theme: `wordpress/themes/hutaro-classic/`
  - Plugin: `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`

## 3. 実装責務
- Theme (`hutaro-classic`):
  - レイアウト、カード、タイポ、ナビ、ページ構造
  - ナビは `wp_nav_menu(theme_location=global)` で管理（未設定時フォールバックあり）
  - 記事一覧はメインクエリ + ページネーション（`pre_get_posts` で件数/並びを統制）
- Plugin (`hutaro-bridge`):
  - `md-embed` 互換ショートコード
  - 旧API互換 (`/api/health`, `/api/access-counter`)
  - 旧ルート互換 rewrite (`/blog/*`, `/blog-tech/*`)
  - CSS/JSは `assets/` 配下を `wp_enqueue_*` で読込
- Scripts:
  - Markdown -> WordPress REST 変換/投入

## 4. 変更時ルール
- 互換 URL を削除しない。
- `source=all` の latestPosts は `blog,blog-tech` のみ対象とする。
- `md-embed` は既存 `type`（`latestPosts`, `ticker`, `counter`, `text`）を後方互換で維持する。
- 見た目改修は Theme 優先、機能改修は Plugin 優先で責務を混ぜない。

## 5. Markdown仕様（移行後）
- 推奨 frontmatter:
  - `title`
  - `summary`
  - `card`
- 埋め込み:
  - `<md-embed type="latestPosts" ...>`
  - `<md-embed type="ticker" ...>`
  - `<md-embed type="counter" ...>`
  - `<md-embed type="text" ...>`

注意:
- 移行変換は簡易パーサなので、複雑なMarkdown（高度な表・ネストリスト・数式）は崩れる可能性がある。
- 複雑表現を使う場合は `wp:publish:md` 後に実表示を必ず確認する。

## 6. テスト/検証手順
1. `npm run wp:export`
2. `npm run wp:publish:md`
3. `npm run smoke:prod`

## 7. 禁止事項
- WordPress管理画面を正本にする運用。
- ThemeにAPIロジックを埋めること。
- Pluginに大規模レイアウトCSSを埋めること（最小限のみ可）。
- 旧Archive文書を現行手順として参照すること。

## 8. 将来拡張の推奨順
1. Markdown変換の強化（GFM table/list/math対応）
2. `content/site.json` と Theme の設定連携
3. 画像配信最適化（CDN or WP最適化プラグイン）
4. 掲示板機能（別途 `forum-feature-draft.md`）
