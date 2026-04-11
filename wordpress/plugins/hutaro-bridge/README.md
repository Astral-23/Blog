# Hutaro Bridge Plugin

WordPress移行時の互換レイヤーです。

## 提供機能

- Shortcodes
  - `[hutaro_latest_posts]`
  - `[hutaro_ticker]`
  - `[hutaro_counter]`
  - `[hutaro_text]`
  - `[hutaro_comments]`
- REST API
  - `GET /wp-json/hutaro/v1/health`
  - `GET /wp-json/hutaro/v1/counter?key=...`
  - `POST /wp-json/hutaro/v1/counter`
  - 互換: `GET /api/health`
  - 互換: `GET|POST /api/access-counter`
- 補助フィルタ
  - `<md-embed ...>` の shortcode 変換
  - 外部リンクへ `target="_blank" rel="noreferrer noopener"` 自動付与
- フロント資産
  - `assets/hutaro-bridge.css`
  - `assets/hutaro-bridge.js`
  - `wp_enqueue_style/script` で読込
- 隠し実績（フロント）
  - 条件達成時にレトロ風ポップアップ表示
  - 初期実装は「ページ内セッションのみ記憶（リロードでリセット）」
  - 実績定義は `assets/hutaro-bridge.js` の `definitions` 配列で拡張

## インストール

1. `hutaro-bridge.php` を `wp-content/plugins/hutaro-bridge/` に配置
2. WordPress管理画面で有効化
3. `設定 > パーマリンク` を開いて「変更を保存」を実行（rewrite反映）
