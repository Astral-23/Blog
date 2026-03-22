# WordPress on ConoHa VPS 切替手順（hutaroblog.com）

最終更新: 2026-03-22

## 0. 方針

- 既存 `hutaroblog.com`（Next.js運用中）を保持したまま、同一VPSで WordPress を構築。
- WordPress の動作確認が完了してから Nginx の向き先を切替。
- 切替失敗時は Nginx 設定を戻して即ロールバック可能な状態にする。

## 1. サーバー準備（Ubuntu 24.04）

```bash
sudo apt update
sudo apt install -y nginx mysql-server php-fpm php-mysql php-xml php-mbstring php-curl php-zip php-gd php-intl unzip
```

## 2. DB作成

```bash
sudo mysql
```

```sql
CREATE DATABASE hutaro_wp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hutaro_wp'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON hutaro_wp.* TO 'hutaro_wp'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. WordPress設置

```bash
sudo mkdir -p /var/www/hutaroblog
cd /tmp
curl -LO https://wordpress.org/latest.tar.gz
tar xf latest.tar.gz
sudo rsync -a wordpress/ /var/www/hutaroblog/wordpress/
sudo chown -R www-data:www-data /var/www/hutaroblog/wordpress
```

`wp-config.php` を作成:

```bash
cd /var/www/hutaroblog/wordpress
sudo cp wp-config-sample.php wp-config.php
sudo sed -i "s/database_name_here/hutaro_wp/" wp-config.php
sudo sed -i "s/username_here/hutaro_wp/" wp-config.php
sudo sed -i "s/password_here/STRONG_PASSWORD/" wp-config.php
```

## 4. Nginx切替準備

- このリポジトリの設定例を使用:
  - `ops/nginx/wordpress/hutaroblog-wordpress.conf`

```bash
sudo cp /path/to/repo/ops/nginx/wordpress/hutaroblog-wordpress.conf /etc/nginx/sites-available/hutaroblog-wordpress
sudo ln -s /etc/nginx/sites-available/hutaroblog-wordpress /etc/nginx/sites-enabled/hutaroblog-wordpress
# 旧blog設定を無効化する直前までは残す
sudo nginx -t
```

## 5. 本番切替

```bash
# 旧Next.js向けサイトを無効化
sudo rm -f /etc/nginx/sites-enabled/blog

# 新WordPressサイトを有効化（未有効なら）
sudo ln -s /etc/nginx/sites-available/hutaroblog-wordpress /etc/nginx/sites-enabled/hutaroblog-wordpress

sudo systemctl reload nginx
```

## 6. 初期設定（WordPress管理画面）

1. `https://hutaroblog.com` にアクセスして初期セットアップを完了
2. プラグイン配置
   - `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`
3. 管理画面で有効化
4. `設定 > パーマリンク` で `/%category%/%postname%/` に設定し保存
5. アプリケーションパスワードを作成

## 7. データ投入（ローカル）

```bash
npm run wp:export
WP_BASE_URL=https://hutaroblog.com \
WP_USERNAME=<admin-user> \
WP_APP_PASSWORD='<app-password>' \
npm run wp:import:rest
```

## 8. 動作確認

```bash
curl -I https://hutaroblog.com
curl -i https://hutaroblog.com/api/health
curl -i "https://hutaroblog.com/api/access-counter?key=home"
```

確認URL:
- `/`
- `/blog`
- `/blog/1`
- `/blog/2`
- `/blog-tech`（将来記事用）

## 9. ロールバック

切替直後に問題が出た場合:

```bash
sudo rm -f /etc/nginx/sites-enabled/hutaroblog-wordpress
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
sudo systemctl reload nginx
```

## 10. 注意点

- 既存SSL証明書は `hutaroblog.com` のまま流用可能。
- `php8.3-fpm.sock` が存在しない場合はバージョンに合わせて修正（例: `php8.2-fpm.sock`）。
- 高性能化は、切替後にページキャッシュ + CDN を段階導入する。

