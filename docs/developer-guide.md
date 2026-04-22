# 開発者向けガイド（WordPress移行後）

最終更新: 2026-04-22

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
  - `scripts/wordpress-vps-sync-content.sh`（`npm run wp:sync:content`）
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
  - 旧API互換は内部で WordPress REST (`/wp-json/hutaro/v1/*`) にプロキシ
  - 旧ルート互換 rewrite (`/blog/*`, `/blog-tech/*`)
  - CSS/JSは `assets/` 配下を `wp_enqueue_*` で読込
  - 隠し実績の表示/判定（フロントJS）
- Scripts:
  - Markdown -> WordPress REST 変換/投入
  - `wordpress/plugins/hutaro-bridge/embed-spec.json` を preview / export / 本番変換で共有

## 4. 変更時ルール
- 互換 URL を削除しない。
- `source=all` の latestPosts は `blog,blog-tech` のみ対象とする。
- `md-embed` は既存 `type`（`latestPosts`, `ticker`, `counter`, `text`）を後方互換で維持する。
- `md-embed` の `type -> shortcode -> attrs` 定義は `wordpress/plugins/hutaro-bridge/embed-spec.json` を正本にする。
- `md-embed` の `renderer` 名は preview/PHP 両方で共通に扱う。変更時は spec と両実装を同時に更新する。
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
  - `<md-embed type="box">...</md-embed>`
  - `<md-embed type="tweet" url="..."></md-embed>`
  - `<md-embed type="jokeButtons"></md-embed>`
  - `<md-embed type="comments" title="..."></md-embed>`

補足:
- 新しい `md-embed` type を追加する時は、まず `wordpress/plugins/hutaro-bridge/embed-spec.json` を更新する。
- `preview` と本番の `md-embed -> shortcode` 変換はこの spec を参照する。
- 追加・変更後は `npm run embeds:check` を実行し、preview/PHP の renderer 実装漏れがないことを確認する。

## 5.1 md-embed 実装メモ
- 正本:
  - `wordpress/plugins/hutaro-bridge/embed-spec.json`
- JS 側:
  - `scripts/embed-spec.mjs`
  - `scripts/embed-preview-renderers.mjs`
  - `scripts/preview-site.mjs`
  - `scripts/wp-migrate-utils.mjs`
- PHP 側:
  - `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`

処理の流れ:
- 原稿中の `<md-embed ...>` は `scripts/wp-migrate-utils.mjs` または `hutaro-bridge.php` で shortcode に変換される。
- shortcode 名、許可属性、body の転送先属性は `embed-spec.json` を正本にする。
- preview は `renderer` 名を見て `scripts/embed-preview-renderers.mjs` の renderer を呼ぶ。
- 本番は `renderer` 名から `render_<renderer>_shortcode` を導出して `hutaro-bridge.php` のメソッドを呼ぶ。

新しい embed を追加する手順:
1. `wordpress/plugins/hutaro-bridge/embed-spec.json` に `type`, `shortcode`, `renderer`, `attrs`, 必要なら `bodyAttr` を追加する。
2. `scripts/embed-preview-renderers.mjs` に preview 用 renderer を追加する。
3. `wordpress/plugins/hutaro-bridge/hutaro-bridge.php` に `render_<renderer>_shortcode` を追加する。
4. 必要なら `wordpress/plugins/hutaro-bridge/assets/hutaro-bridge.css` にスタイルを追加する。
5. `npm run embeds:check` と `npm run preview:build` を実行する。
6. 本番反映が必要なら `npm run wp:sync:content` を実行する。

変更時の判断基準:
- 新しい `type` を増やすだけなら、まず spec を直す。
- shortcode 名を変える変更は互換性を壊しやすいので、既存記事を確認せずに変更しない。
- `renderer` 名は preview/PHP の両側 dispatch に効くので、既存名を不用意に変更しない。
- 変換の問題なのか描画の問題なのかを切り分ける時は、まず preview 生成 HTML に shortcode が残っているかを見る。

注意:
- 移行変換は簡易パーサなので、複雑なMarkdown（高度な表・ネストリスト・数式）は崩れる可能性がある。
- 複雑表現を使う場合は `wp:publish:md` 後に実表示を必ず確認する。
- 公開日/更新日は `content/.meta/published-at.json` と `content/.meta/updated-at.json` を参照する。
- `.meta` は `preview` / `wp:export` / `wp:publish:md` 実行時に不足キーを自動補完する（Git履歴の初回コミット日時を優先、取得不可時はファイル時刻）。
- 運用上は `.meta` の差分をコミットして、公開日を固定すること。

## 6. テスト/検証手順
1. `npm run embeds:check`
2. `npm run preview:build`
3. `npm run wp:export`
4. `npm run wp:publish:md`
5. `npm run smoke:prod`

補足:
- preview や embed 実装だけを触った時でも、最低限 `embeds:check` と `preview:build` は実行する。
- `wp:publish:md` は内部で `assets:optimize` を先に実行します。
- 最適化を外した検証が必要な場合のみ `SKIP_ASSET_OPTIMIZE=1 npm run wp:publish:md` を使用します。
- Theme/Plugin 変更反映は `TARGET_HOST=<host> TARGET_USER=deploy npm run wp:sync:content` を使用します。

## 6.1 隠し実績の拡張手順（段階導入: 非保存）
- 実績定義は `wordpress/plugins/hutaro-bridge/assets/hutaro-bridge.js` の `createAchievementSystem()` 内 `definitions` に追加する。
- 1件の実績定義は `id`, `title`, `comment`, `triggerOn`, `when(state, payload)` を持つ。
- 画面イベントは `achievements.track(eventName, payload)` で発火する。
- 現在の初期イベント:
  - `joke:toggle`
  - `voice:burst`
  - `page:view`
- この段階では永続保存しない（リロードで未達成状態に戻る）。
- 将来保存へ移行する場合は `createAchievementSystem()` の `state/unlocked` を localStorage または REST API に置換する。

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
