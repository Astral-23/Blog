# Markdown Blog Framework

このリポジトリの入口です。  
詳細は `docs/` を見てください。

## どれを読めばいいか

- 運用者（記事を書く人）: `docs/admin-guide.md` だけ読めばOK
- 開発者（機能を直す人）: `docs/developer-guide.md`
- Codexへ公開前チェック依頼: `docs/codex-prepublish-check.md`

## 最短コマンド

```bash
npm install
npm run dev
npm run ops:sanity
npm run ops:validate-env:example
```

ConoHa公開:

```bash
./scripts/deploy-prod.sh
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy ./scripts/deploy.sh
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 ./scripts/deploy.sh
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 SECURITY_SMOKE_AFTER_DEPLOY=1 SMOKE_URL=http://<ip-or-domain> ./scripts/deploy.sh
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 SECURITY_SMOKE_AFTER_DEPLOY=1 REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 SMOKE_URL=http://<ip-or-domain> ./scripts/deploy.sh
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 REMOTE_SECURITY_AUDIT_FORMAT=json SMOKE_URL=http://<ip-or-domain> ./scripts/deploy.sh
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 REMOTE_SECURITY_AUDIT_FORMAT=json REMOTE_SECURITY_AUDIT_REPORT_PATH=./audit-reports/latest.json SMOKE_URL=http://<ip-or-domain> ./scripts/deploy.sh
# 必須キー上書き例:
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy REQUIRED_ENV_KEYS="NODE_ENV PORT NEXT_PUBLIC_SITE_URL SENSOR_API_KEY" ./scripts/deploy.sh
BASE_URL=http://<ip-or-domain> ./scripts/smoke-check.sh
BASE_URL=http://<ip-or-domain> npm run security:smoke
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy npm run ops:status
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy npm run ops:security-status
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy npm run ops:security-audit
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy npm run ops:security-audit:json
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy npm run ops:security-audit:report
npm run ops:security-audit:summary
npm run ops:security-audit:summary:md
npm run ops:security-audit:regression
TARGET_HOST=<ip-or-domain> TARGET_USER=deploy npm run ops:security-audit:daily
```

本番確認（hutaroblog.com）:

```bash
curl -I https://hutaroblog.com
curl -I http://hutaroblog.com
```

画像最適化:

```bash
npm run assets:optimize
```

補足:
- 本番運用は ConoHa VPS 前提です。
- ランタイム設定はサーバー側 `.env.production` を使用します（Git管理しません）。
- アクセスカウンター永続化のため、本番 `.env.production` に `ACCESS_COUNTER_STORE_PATH=/opt/blog/shared/access-counter.json` を設定してください。
- GitHub Actions は `.github/workflows/ci.yml`（CI）と `.github/workflows/security-audit.yml`（日次監査）を用意しています。
