# ConoHa VPS Runbook（Ubuntu 24.04）

最終更新: 2026-03-16  
対象スペック: 2GB RAM / 3core / SSD 100GB

## 現在ステータス（完了）
- ConoHaでHTTP/HTTPS公開は完了
- 独自ドメイン `hutaroblog.com` で運用中
- HTTPはHTTPSへリダイレクト済み
- 証明書自動更新（certbot timer）有効

## 0. 事前決定（確定）
- SSL: Let's Encrypt（適用済み）
- SSH: `deploy` ユーザー + 公開鍵認証のみ
- ドメイン: 正規ホストは `hutaroblog.com`

## 1. 初期セットアップ
1. 管理ユーザー作成（`deploy`）
2. SSH公開鍵を登録
3. `PasswordAuthentication no` を設定
4. UFWで `22/80/443` のみ許可
5. タイムゾーンを `Asia/Tokyo` に設定
6. `deploy` ユーザーに `systemctl` 再起動権限を付与（必要最小限のsudo設定）

sudoers例（`/etc/sudoers.d/deploy-blog`）:
```text
deploy ALL=NOPASSWD: /usr/bin/systemctl restart blog-app, /usr/bin/systemctl status blog-app *, /usr/bin/systemctl status nginx *, /usr/bin/systemctl reload nginx, /usr/bin/systemctl status certbot.timer *, /usr/bin/systemctl is-active *, /usr/bin/journalctl -u blog-app *, /usr/bin/tail -n * /var/log/blog/app.error.log, /usr/bin/tail -n * /var/log/nginx/error.log, /usr/sbin/ufw status *, /usr/bin/fail2ban-client status *, /usr/bin/ss -lntp
```

## 2. ミドルウェア導入
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx fail2ban
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. ディレクトリ準備
```bash
sudo mkdir -p /opt/blog/app /opt/blog/shared /var/log/blog
sudo chown -R deploy:deploy /opt/blog /var/log/blog
```

## 4. アプリ配置
1. ローカルから `scripts/deploy.sh` で初回デプロイ
2. サーバー上で `cp env.production.example .env.production` を作成
3. 実値を設定（ドメイン、秘密鍵など）
4. アクセスカウンター永続化を設定
   - `ACCESS_COUNTER_STORE_PATH=/opt/blog/shared/access-counter.json`
   - `sudo -u deploy mkdir -p /opt/blog/shared`
   - `sudo -u deploy test -f /opt/blog/shared/access-counter.json || echo '{"version":1,"counters":{}}' | sudo -u deploy tee /opt/blog/shared/access-counter.json >/dev/null`
5. 注意:
   - `deploy.sh` は `.env.production` を同期対象から除外する
   - 環境変数ファイルはサーバー側で管理し、Git管理しない
   - `deploy.sh` は `content/.meta/access-counter.json` を同期除外し、`ACCESS_COUNTER_STORE_PATH` 未作成時は初回のみ既存値を移行する

## 5. systemd サービス設定
`ops/systemd/blog-app.service` を `/etc/systemd/system/blog-app.service` に配置

```ini
[Unit]
Description=Blog Next.js App
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/blog/app
EnvironmentFile=/opt/blog/app/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectControlGroups=true
ProtectKernelTunables=true
ProtectKernelModules=true
RestrictSUIDSGID=true
LockPersonality=true
UMask=027

[Install]
WantedBy=multi-user.target
```

反映:
```bash
sudo systemctl daemon-reload
sudo systemctl enable blog-app
sudo systemctl start blog-app
sudo systemctl status blog-app --no-pager
```

## 6. Nginx 設定
`ops/nginx/blog.conf` を `/etc/nginx/sites-available/blog` に配置

```nginx
upstream blog_upstream {
  server 127.0.0.1:3000;
  keepalive 32;
}

server {
  listen 80;
  listen [::]:80;
  server_name hutaroblog.com;

  client_max_body_size 10m;
  client_body_timeout 15s;
  send_timeout 15s;

  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_connect_timeout 5s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    proxy_pass http://blog_upstream;
  }
}
```

反映:
```bash
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
sudo nginx -t
sudo systemctl reload nginx
```

### 6.1 HTTPS化（実施済み）
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hutaroblog.com
sudo certbot renew --dry-run
```

注意:
- `Could not automatically find a matching server block` が出た場合は、
  `server_name hutaroblog.com;` を確認後に `sudo certbot install --cert-name hutaroblog.com` を実行します。
- DNS伝播中に一部端末で名前解決できない場合があります。
  `dig @1.1.1.1 hutaroblog.com A +short` / `dig @8.8.8.8 hutaroblog.com A +short` で外部到達を確認します。

## 7. ヘルスチェック
- `GET /api/health` が `200` と `{"status":"ok"}` を返すこと
- `GET /` と `GET /blog` が `200` を返すこと

## 8. 運用手順（最小）
- デプロイ:
  - `TARGET_HOST=<host> TARGET_USER=deploy ./scripts/deploy.sh`
  - 自動ロールバック有効: `TARGET_HOST=<host> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 ./scripts/deploy.sh`
  - ロールバック + セキュリティスモーク有効:
    `TARGET_HOST=<host> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 SECURITY_SMOKE_AFTER_DEPLOY=1 SMOKE_URL=http://<host> ./scripts/deploy.sh`
  - リモート監査まで有効:
    `TARGET_HOST=<host> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 SECURITY_SMOKE_AFTER_DEPLOY=1 REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 SMOKE_URL=http://<host> ./scripts/deploy.sh`
  - JSON監査出力:
    `TARGET_HOST=<host> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 REMOTE_SECURITY_AUDIT_FORMAT=json SMOKE_URL=http://<host> ./scripts/deploy.sh`
  - JSON監査をファイル保存:
    `TARGET_HOST=<host> TARGET_USER=deploy AUTO_ROLLBACK_ON_FAILURE=1 REMOTE_SECURITY_AUDIT_AFTER_DEPLOY=1 REMOTE_SECURITY_AUDIT_FORMAT=json REMOTE_SECURITY_AUDIT_REPORT_PATH=./audit-reports/latest.json SMOKE_URL=http://<host> ./scripts/deploy.sh`
  - `.env.production` の必須キー検証を追加済み（`NODE_ENV PORT NEXT_PUBLIC_SITE_URL`）
  - `.env.production` の形式検証（空値/URL/PORT/NODE_ENV）を追加済み
  - 前提: ローカルに `rsync` が入っていること
  - 追加:
    - 起動直後の一時的な `502` を吸収するため、smoke-checkはリトライ付き
    - `AUTO_ROLLBACK_ON_FAILURE=1` 時は、restart/smoke失敗で前回バックアップへ自動復旧
    - `SECURITY_SMOKE_AFTER_DEPLOY=1` 時はヘッダ/メディア配信の検証まで実行
- デプロイ前チェックのみ実行:
  - `./scripts/release-preflight.sh`
- デプロイ後スモークのみ実行:
  - `BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh`
  - セキュリティ確認: `BASE_URL=https://hutaroblog.com ./scripts/security-smoke.sh`
- ログ確認:
  - `journalctl -u blog-app -n 200 --no-pager`
  - `sudo tail -n 200 /var/log/nginx/error.log`
- 状態スナップショット（ローカルから）:
  - `TARGET_HOST=<host> TARGET_USER=deploy ./scripts/remote-status.sh`
  - セキュリティ状態確認（ローカルから）:
    - `TARGET_HOST=<host> TARGET_USER=deploy ./scripts/remote-security-status.sh`
    - または `TARGET_HOST=<host> TARGET_USER=deploy npm run ops:security-status`
  - セキュリティ監査（判定付き）:
    - `TARGET_HOST=<host> TARGET_USER=deploy ./scripts/remote-security-audit.sh`
    - または `TARGET_HOST=<host> TARGET_USER=deploy npm run ops:security-audit`
    - JSON出力: `TARGET_HOST=<host> TARGET_USER=deploy npm run ops:security-audit:json`
    - JSON保存+要約: `TARGET_HOST=<host> TARGET_USER=deploy npm run ops:security-audit:report`
    - 保存済みJSONの要約表示: `npm run ops:security-audit:summary`
    - 保存済みJSONからMarkdown生成: `npm run ops:security-audit:summary:md`
    - 直近2回の回帰判定: `npm run ops:security-audit:regression`
    - 日次ワンショット（監査+要約+回帰+古いレポート整理）:
      `TARGET_HOST=<host> TARGET_USER=deploy npm run ops:security-audit:daily`
- 簡易復旧（ローカルから）:
  - `TARGET_HOST=<host> TARGET_USER=deploy ./scripts/remote-recover.sh`
  - または `npm run ops:recover`
- 再起動:
  - `sudo systemctl restart blog-app`

## 9. スケールアップ判断
- 次のどれかが継続したら 4GB へ増強:
  - メモリ使用率 > 75%
  - CPU使用率 > 70%
  - ディスク残量 < 30%

## 10. 障害時ロールバック
1. 直前リリースへアプリディレクトリを戻す
2. `sudo systemctl restart blog-app`
3. `GET /api/health` で復旧確認
4. 障害内容を記録（原因、再発防止）

## 11. 初回当日チェックリスト
1. `curl -i https://hutaroblog.com/api/health` が 200 になる
2. `curl -i https://hutaroblog.com/blog` が 200 になる
3. `journalctl -u blog-app -n 100 --no-pager` に致命的エラーがない
4. `df -h` でディスク使用率を確認

## 12. GitHub Actions（任意）
### 12.1 CI
- ワークフロー: `.github/workflows/ci.yml`
- トリガー: push / pull_request
- 実行内容: `lint` / `test` / `build` / `e2e`
- 追加の運用健全性チェック: `npm run ops:sanity`

### 12.2 日次セキュリティ監査
- ワークフロー: `.github/workflows/security-audit.yml`
- トリガー:
  - schedule: `15 21 * * *`（UTC）= 毎日 06:15 JST
  - workflow_dispatch（手動実行）
- 必須Secrets:
  - `CONOHA_HOST`（VPSホスト）
  - `CONOHA_SSH_KEY`（監査用秘密鍵）
- 任意Secrets:
  - `CONOHA_USER`（未設定時は `deploy`）
  - `REQUIRE_CERTBOT_TIMER`（`1` で certbot.timer の稼働を必須化）
- 出力:
  - `audit-reports/` を artifact としてアップロード
