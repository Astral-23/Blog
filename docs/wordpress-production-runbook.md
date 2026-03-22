# WordPress 本番運用ランブック（hutaroblog.com）

最終更新: 2026-03-22

## 0. 現在状態

- `https://hutaroblog.com` は WordPress 配信に切替済み。
- コンテンツ移行（home / blog記事 / assets）完了。
- 互換エンドポイント有効:
  - `/api/health`
  - `/api/access-counter`
- 互換プラグイン:
  - `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`

## 1. サーバー構成（本番）

- OS: Ubuntu 24.04 (ConoHa VPS)
- Web: Nginx
- App: WordPress (PHP-FPM)
- DB: MySQL 8
- Docroot: `/var/www/hutaroblog/wordpress`
- Nginx site: `/etc/nginx/sites-available/hutaroblog-wordpress`

## 2. 初回確認チェック

```bash
curl -I https://hutaroblog.com/
curl -I https://hutaroblog.com/blog/
curl -I https://hutaroblog.com/blog/1/
curl -i https://hutaroblog.com/api/health
curl -i "https://hutaroblog.com/api/access-counter?key=home"
```

期待:
- HTTP 200（リダイレクトを含む正常遷移）
- `/api/health` は JSON 応答

## 2.1 検証方針（重要）

- まずローカル実装確認（コード差分・テスト）を行い、その後に本番確認を行う。
- 本番確認がネットワーク要因で不安定な場合、実装未完了と混同しないようにする。
- SSH作業は `ssh blog-conoha` の対話セッションを優先し、ワンショット実行は補助扱いにする。

## 3. 日常運用

### 3.1 記事更新
- 正本は `content/*.md`（Git管理）とする。
- WordPress管理画面で本文を直接編集しない。
- 公開は `npm run wp:publish:md` を使用する。

### 3.2 プラグイン更新
- `hutaro-bridge` を更新する場合:
  1. ローカルで修正
  2. サーバーへ反映（`wp-content/plugins/hutaro-bridge/`）
  3. 権限修正: `chown -R www-data:www-data`
  4. 動作確認

### 3.3 再移行（コンテンツ再投入）
```bash
WP_BASE_URL=https://hutaroblog.com \
WP_USERNAME=<admin-user> \
WP_APP_PASSWORD='<app-password>' \
npm run wp:publish:md
```

上記が使えない場合のみ手動で実行:
```bash
npm run wp:export
WP_BASE_URL=https://hutaroblog.com \
WP_USERNAME=<admin-user> \
WP_APP_PASSWORD='<app-password>' \
npm run wp:import:rest
```

## 4. セキュリティ運用（必須）

1. 管理者パスワードは強固な値へ変更し、定期ローテーション。
2. 不要な Application Password を削除。
3. `wp-admin` へのアクセス制限（IP制限/2FA）を検討。
4. OS/パッケージ更新:
```bash
sudo apt update && sudo apt upgrade -y
```

## 5. 障害対応

### 5.1 Nginx確認
```bash
sudo nginx -t
sudo systemctl status nginx --no-pager -l
sudo journalctl -u nginx -n 200 --no-pager
```

### 5.2 PHP-FPM確認
```bash
sudo systemctl status php8.3-fpm --no-pager -l
sudo journalctl -u php8.3-fpm -n 200 --no-pager
```

### 5.3 MySQL確認
```bash
sudo systemctl status mysql --no-pager -l
sudo journalctl -u mysql -n 200 --no-pager
```

### 5.4 WordPress権限確認
```bash
sudo chown -R www-data:www-data /var/www/hutaroblog/wordpress
```

## 6. ロールバック（緊急）

WordPress切替前の Next.js サイトに戻す場合:

```bash
sudo rm -f /etc/nginx/sites-enabled/hutaroblog-wordpress
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 関連ファイル

- Nginx例: `ops/nginx/wordpress/hutaroblog-wordpress.conf`
- 移行スクリプト: `scripts/wp-export-content.mjs`, `scripts/wp-import-rest.mjs`
- VPS準備: `scripts/wordpress-vps-prepare.sh`
- 切替: `scripts/wordpress-vps-cutover.sh`
- 互換プラグイン: `wordpress/plugins/hutaro-bridge/hutaro-bridge.php`

## 8. 補足

- 過去の移行計画/移行手順は `docs/archive/` に退避済み。
- 新規メンテナは本ドキュメントを正本として扱う。
