# Hutaro Blog (WordPress + Markdown)

最終更新: 2026-03-22

このリポジトリは、WordPress本番を `Markdown正本` で運用するための管理リポジトリです。

## 主要コマンド

```bash
npm run preview
npm run wp:publish:md
npm run wp:export
npm run wp:import:rest
npm run smoke:prod
```

## 事前設定

```bash
cp .env.wp.example .env.wp.local
```

`.env.wp.local`:

```dotenv
WP_BASE_URL=https://hutaroblog.com
WP_USERNAME=hutaro_admin
WP_APP_PASSWORD=<Application Password>
```

## ドキュメント
- `docs/admin-guide.md`
- `docs/wordpress-production-runbook.md`
- `docs/developer-guide.md`

## Archive
WordPress環境に不要な旧Next.js/旧デプロイ資産は以下に退避済みです。
- `archive/non-wordpress-legacy-20260322/`
