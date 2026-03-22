# WordPress 本番運用ランブック（hutaroblog.com）

最終更新: 2026-03-22

## 1. 現在状態
- `https://hutaroblog.com` は WordPress 配信
- コンテンツ移行（home / blog記事 / assets）完了
- 互換エンドポイント有効
  - `/api/health`
  - `/api/access-counter`
- 互換プラグイン
  - `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`

## 2. サーバー構成
- OS: Ubuntu 24.04 (ConoHa VPS)
- Web: Nginx
- App: WordPress (PHP-FPM)
- DB: MySQL 8
- Docroot: `/var/www/hutaroblog/wordpress`
- Nginx site: `/etc/nginx/sites-available/hutaroblog-wordpress`

## 3. 初回確認
```bash
curl -I https://hutaroblog.com/
curl -I https://hutaroblog.com/blog/
curl -I https://hutaroblog.com/blog/1/
curl -i https://hutaroblog.com/api/health
curl -i "https://hutaroblog.com/api/access-counter?key=home"
```

## 4. 検証方針
- 先にローカルで実装確認（lint/test）を行う。
- 次に本番確認（publish + smoke）を行う。
- SSH作業は `ssh blog-conoha` の対話セッションを優先する。

## 5. 日常運用
### 5.1 記事更新
- 正本は `content/*.md`（Git管理）
- WordPress管理画面で本文を直接編集しない
- 公開コマンド: `npm run wp:publish:md`

### 5.2 実行前提
`.env.wp.local` を設定:
```dotenv
WP_BASE_URL=https://hutaroblog.com
WP_USERNAME=<admin-user>
WP_APP_PASSWORD=<app-password>
```

### 5.3 公開
```bash
npm run wp:publish:md
BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh
```

## 6. テーマ/プラグイン更新
1. ローカルで修正
2. サーバーへ反映（`wp-content/themes/`, `wp-content/plugins/`）
3. 権限修正
```bash
sudo chown -R www-data:www-data /var/www/hutaroblog/wordpress/wp-content/themes /var/www/hutaroblog/wordpress/wp-content/plugins
```
4. `php -l` と `smoke-check` 実行

## 7. セキュリティ運用
1. 管理者パスワードを定期ローテーション
2. 不要な Application Password を削除
3. `wp-admin` はIP制限/2FAを検討
4. OS更新
```bash
sudo apt update && sudo apt upgrade -y
```

## 8. 障害対応
### 8.1 Nginx
```bash
sudo nginx -t
sudo systemctl status nginx --no-pager -l
sudo journalctl -u nginx -n 200 --no-pager
```

### 8.2 PHP-FPM
```bash
sudo systemctl status php8.3-fpm --no-pager -l
sudo journalctl -u php8.3-fpm -n 200 --no-pager
```

### 8.3 MySQL
```bash
sudo systemctl status mysql --no-pager -l
sudo journalctl -u mysql -n 200 --no-pager
```

### 8.4 権限
```bash
sudo chown -R www-data:www-data /var/www/hutaroblog/wordpress
```

## 9. 関連ファイル
- Nginx: `ops/nginx/wordpress/hutaroblog-wordpress.conf`
- 移行スクリプト:
  - `scripts/wp-export-content.mjs`
  - `scripts/wp-import-rest.mjs`
  - `scripts/wp-publish-md.sh`
- VPS準備: `scripts/wordpress-vps-prepare.sh`
- 切替: `scripts/wordpress-vps-cutover.sh`
- 互換プラグイン: `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`

## 10. 補足
- 旧移行手順は `docs/archive/` を参照
- 現行運用の正本は本ドキュメント
