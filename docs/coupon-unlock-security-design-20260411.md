# クーポンコード入力（隠し実績解放）セキュリティ設計メモ

最終更新: 2026-04-11

## 目的
- home に「クーポンコード入力」フォームを設置する。
- 正しいコード入力時のみ、隠し実績を解放する。
- 本機能を認証・認可用途に拡張しない前提で、被害局所化と運用容易性を優先する。

## スコープ
- 対象: `wordpress/plugins/hutaro-bridge` と `content/home.md`
- 非対象:
  - 管理権限付与
  - 会員管理
  - 課金・個人情報アクセス

## 脅威モデル
1. コード総当たり（bot / スクリプト）
2. クライアント解析による正解コード漏えい
3. クロスサイト起点の不正POST（CSRF系）
4. 入力起点のXSS/SQLi/RCE（任意コード実行）
5. 設定ミス（平文コードの直置き・ログ漏えい）

## 設計方針
1. サーバー照合のみ
- 正解判定は REST API でのみ実施。
- JS 側には正解情報を一切持たせない。

2. 秘密情報の平文非保持
- 比較値は `sha256(pepper + "|" + code)` のハッシュのみ。
- `HUTARO_COUPON_CODE_HASHES`（カンマ区切り）を運用値とする。
- `HUTARO_COUPON_PEPPER` は別管理し、リポジトリに保存しない。

3. 多層防御
- 同一オリジン判定: `Origin`/`Referer` のホストが `home_url()` と一致しない場合は拒否。
- REST nonce: `X-WP-Nonce` があれば検証し、不正値を拒否。
- レート制限: IP+UA単位で失敗回数を transient 管理（5回失敗で15分ロック）。
- レスポンス: 不一致時は同一文言を返し、情報を漏らさない。

4. 被害局所化
- API の成功結果は「隠し実績表示」用途に限定。
- 重要機能へ権限昇格させない。

## 実装仕様

### Shortcode
- `[hutaro_coupon_unlock]`
- 属性:
  - `title` (default: `クーポンコード入力`)
  - `button` (default: `送信`)
  - `placeholder` (default: `コードを入力`)
  - `achievement` (default: `coupon-secret-2026`)

### REST API
- `POST /wp-json/hutaro/v1/coupon-unlock`
- request json:
  - `code: string`
  - `achievementId?: string`
- response json:
  - 成功: `{ unlocked: true, achievement: { id, title, comment } }`
  - 失敗: `{ unlocked: false, message }`
  - ロック: HTTP 429 + `retryAfterSec`

### フロント
- `hutaro-bridge.js` がフォーム submit を受ける。
- 成功時のみ `achievements.unlock(...)` を呼ぶ。
- エラー表示は定型文のみ。

## 運用手順
1. pepper を生成し `HUTARO_COUPON_PEPPER` に設定。
2. 正解コードを `sha256(pepper + "|" + code)` で事前計算。
3. 複数ハッシュを `HUTARO_COUPON_CODE_HASHES` に設定。
4. 本番反映後、home で成功/失敗/ロックを手動確認。

## 追加推奨
- Cloudflare WAF で `/wp-json/hutaro/v1/coupon-unlock` の Bot/レート制限を追加。
- 成功/失敗の集計監視（コード本文はログ禁止）。

## 受け入れ基準
1. 正しいコードでのみ実績が解放される。
2. 誤コードを連続送信すると429ロックされる。
3. コード平文がレスポンス・HTML・JS・ログに出ない。
4. 異なるオリジンからのPOSTが拒否される。
