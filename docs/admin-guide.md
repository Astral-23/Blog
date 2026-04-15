# 管理者向け運用ガイド（WordPress本番 / Markdown正本）

最終更新: 2026-04-15

## 0. 30秒版
1. 記事を `content/blog/*.md` または `content/blog-tech/*.md` に追加・編集
2. 必要なら画像を `content/assets/` に追加
3. `npm run wp:publish:all` を実行
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

Theme/Plugin 同期までまとめて実行する場合（推奨）:
```bash
npm run wp:publish:all
```

公開前にローカルで全体プレビューしたい場合:
```bash
npm run preview
```

補足:
- `migration/wordpress/preview-site/` に静的HTMLを生成して、`http://localhost:4173` で表示します。
- 4173が使用中の場合は `npm run preview -- --port=4273` のようにポートを変更してください。

内部処理:
1. `npm run assets:optimize`（`content/assets` の画像を圧縮・必要時リサイズ）
2. `npm run wp:export`
3. `npm run wp:import:rest`
4. `content/blog/*.md` / `content/blog-tech/*.md` に存在しない投稿は WordPress 側でゴミ箱へ移動

生成ファイル:
- `migration/wordpress/payload.json`

画像最適化だけスキップしたい場合:
```bash
SKIP_ASSET_OPTIMIZE=1 npm run wp:publish:md
```

`wp:publish:all` 用の環境変数（初回のみ）:
```bash
cat > .env.deploy.local <<'EOF'
TARGET_HOST=blog-conoha
TARGET_USER=deploy
SUDO_PASSWORD=deploy
EOF
```
- `wp:publish:all` は `.env.wp.local` と `.env.deploy.local` を自動読込します。
- `TARGET_HOST` / `TARGET_USER` / `SUDO_PASSWORD` を毎回コマンドに直書きする必要はありません。

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
- `content/assets` 配下のサブフォルダも利用可能（例: `assets/blog/2026/map.png`）
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
<md-embed type="comments" title="コメントを書く"></md-embed>
```

補足:
- `type="comments"` を置いた位置にコメント欄を表示できます（記事ページのみ）。
- `title` でフォーム見出しを変更できます。

## 6. コメント機能（標準 + Anti-spam）

管理画面の開き方:
- `https://<あなたのドメイン>/wp-admin/` にログイン
- コメント全般設定: `設定 > ディスカッション`
- コメント一覧/承認: `コメント`
- プラグイン管理: `プラグイン > インストール済みプラグイン`

おすすめ初期設定（`設定 > ディスカッション`）:
- `Allow people to submit comments on new posts` を ON
- `An administrator must always approve the comment` を ON
- `Comment author must have a previously approved comment` を ON
- `Hold a comment in the queue if it contains 2 or more links`
- `Automatically close comments on articles older than 30 days`（必要なら）
- `Email me whenever` の2項目を ON（コメント投稿時 / モデレーション待ち）
- 返信を使う場合は `Enable threaded (nested) comments` を ON

Anti-spam（Akismet）:
1. `プラグイン > インストール済みプラグイン` で `Akismet Anti-spam` を有効化
2. `設定 > Akismet Anti-spam` で API キーを設定
3. 迷惑コメントを自動判定しつつ、`コメント` 画面で最終確認

補足:
- このリポジトリの `wp:publish:md` は新規/更新投稿を `comment_status=open` で同期します。
- テーマ側で記事ページ下部に標準コメントフォームを表示します。

## 7. 公開後チェック
```bash
BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh
```

期待:
- `/` 200
- `/blog/` 200
- `/blog/1/` 200（既定）
- `/category/blog/` は `/blog/` に 301
- `/api/health` 200 + `{"status":"ok"}`
- `/api/access-counter?key=home` 200 + `{"total":...}`

## 8. 失敗時の対応
1. `npm run wp:publish:md` を再実行（冪等）
2. `.env.wp.local` の3項目を確認
3. APIの挙動確認
```bash
curl -i https://hutaroblog.com/api/health
curl -i "https://hutaroblog.com/api/access-counter?key=home"
```
4. サーバー障害は `docs/wordpress-production-runbook.md` を参照

補足:
- Theme/Plugin（PHP/CSS/JS）を変更した場合は、`wp:publish:md` では反映されません。
- 反映には次を実行します（重要）:
```bash
SUDO_PASSWORD='<vpsのsudoパスワード>' \
TARGET_HOST=blog-conoha TARGET_USER=deploy \
npm run wp:sync:content
```
- まとめて実行する場合は `npm run wp:publish:all` で同等の処理を実行できます。
- `wp:sync:content` は `wordpress/themes/hutaro-classic` と `wordpress/plugins/hutaro-bridge` を本番サーバーへ同期し、`sudo` で配置・権限調整（`www-data:www-data`）まで行います。
