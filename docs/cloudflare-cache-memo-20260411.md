# Cloudflare キャッシュ検討メモ（2026-04-11）

最終更新: 2026-04-11

## 1. 背景（観測値）
- Cloudflare ダッシュボード（直近24h）: `Unique Visitors 115`, `Total Requests 2.76k`, `Percent Cached 9.93%`。
- `curl` 確認で `/` と `/blog/` は `CF-Cache-Status: DYNAMIC`（HTML未キャッシュ）。
- 静的アセットは Nginx 設定で `Cache-Control: public, max-age=604800`（7日）。
- `/api/health` と `/api/access-counter` は `Cache-Control: no-store`（動的APIとして未キャッシュ）。

## 2. 検討した「バランスプラン」の要点
- 公開HTMLのみ Cloudflare で短TTL（5〜15分）キャッシュ。
- 以下は必ず Bypass:
  - `/wp-admin/*`, `/wp-login.php*`, `/wp-json/*`, `/api/*`, `*preview*`, `*s=*`
  - Cookie: `wordpress_logged_in_*`, `wp-postpass_*`, `comment_author_*`
  - メソッド: `GET/HEAD` 以外
- `wp:publish:md` 後に Cloudflare purge（URL単位またはprefix）を運用に組み込む前提。

## 3. 期待効果（概算）
- キャッシュ率: `9.93% -> 25〜40%` を目標レンジ。
- 追加でキャッシュに乗る量: `約420〜830 req/日`（`2.76k req/日` 基準）。
- オリジン到達リクエスト: `約15〜30%削減` の見込み。

## 4. 主なリスク
- Cookie除外漏れによる認証ページ誤配信（最重要）。
- purge漏れで公開直後に古いHTMLが残る。
- コメント/プレビュー表示の不整合。
- 既存Cloudflareルールとの優先順位競合。

## 5. 運用判断（2026-04-11時点）
- 現在のトラフィック規模では「即時必須」ではないため、導入は見送り可。
- 将来アクセス増や負荷上昇時に再検討する。

再開条件の目安:
1. オリジン負荷やTTFB悪化が観測されたとき
2. 公開頻度が増え、短TTLキャッシュの恩恵が大きくなったとき
3. デプロイ後purgeを安定運用できる準備が整ったとき
