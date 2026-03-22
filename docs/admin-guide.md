# 管理者向け運用ガイド（WordPress本番 / Markdown正本）

最終更新: 2026-03-22

## 0. 30秒版
1. 記事を `content/blog/*.md` または `content/blog-tech/*.md` に追加・編集
2. 必要なら画像を `content/assets/` に追加
3. `npm run wp:publish:md` を実行
4. `BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh` で確認

重要:
- 正本は `.md`（Git管理）です。
- WordPress管理画面で本文を直接編集しない運用にしてください。

## 1. 初回準備
```bash
cp .env.wp.example .env.wp.local
```

`.env.wp.local` を編集:
```dotenv
WP_BASE_URL=https://hutaroblog.com
WP_USERNAME=hutaro_admin
WP_APP_PASSWORD=<WordPress Application Password>
```

ナビゲーション編集:
- `外観 > メニュー` で `Global Navigation` を編集すると、ヘッダーリンクが反映されます。
- 未設定時は `home / blog / blog(tech)` のフォールバックを自動表示します。

## 2. 日常の公開手順（Markdown -> WordPress）
```bash
npm run wp:publish:md
```

内部処理:
1. `npm run assets:optimize`（`content/assets` の画像を圧縮・必要時リサイズ）
2. `npm run wp:export`
3. `npm run wp:import:rest`

生成ファイル:
- `migration/wordpress/payload.json`

画像最適化だけスキップしたい場合:
```bash
SKIP_ASSET_OPTIMIZE=1 npm run wp:publish:md
```

## 3. 手動実行（必要時のみ）
```bash
npm run wp:export
WP_BASE_URL=https://hutaroblog.com \
WP_USERNAME=hutaro_admin \
WP_APP_PASSWORD='<app-password>' \
npm run wp:import:rest
```

## 4. 記事の書き方

```md
---
title: "記事タイトル"
summary: "一覧用の説明"
card: "assets/your-card-image.jpg"
---

## 見出し
本文
```

ルール:
- `title` は必須推奨
- 見出しは `##` から開始推奨
- 画像は `assets/...` 参照を使う
- 先頭の大きい画像は `loading=eager; fetchpriority=high` を使うと体感速度改善に有効

画像メタ例（タイトル文字列で指定）:
```md
![hero](assets/hero.jpg "caption=説明; width=100%; loading=eager; fetchpriority=high; decoding=async")
```

## 5. 埋め込み（md-embed）
WordPress側で互換変換されます。

```md
<md-embed type="latestPosts" source="all" count="5"></md-embed>
<md-embed type="ticker" text="WELCOME TO MY BLOG" speed="0.08" color="rainbow"></md-embed>
<md-embed type="counter"></md-embed>
<md-embed type="text" position="center" size="lg" color="accent">見出しテキスト</md-embed>
```

## 6. 公開後チェック
```bash
BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh
```

期待:
- `/` 200
- `/blog/` 200
- `/blog/1/` 200（既定）
- `/api/health` 200 + `{"status":"ok"}`
- `/api/access-counter?key=home` 200 + `{"total":...}`

## 7. 失敗時の対応
1. `npm run wp:publish:md` を再実行（冪等）
2. `.env.wp.local` の3項目を確認
3. APIの挙動確認
```bash
curl -i https://hutaroblog.com/api/health
curl -i "https://hutaroblog.com/api/access-counter?key=home"
```
4. サーバー障害は `docs/wordpress-production-runbook.md` を参照
