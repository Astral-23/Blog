# ConoHa VPS Runbook（WordPress本番基盤）

最終更新: 2026-03-23
対象: Ubuntu 24.04 / ConoHa VPS

## 1. 目的
- WordPress本番を安定運用するための基盤手順を定義する。
- アプリ運用手順は `wordpress-production-runbook.md` を正本とする。

## 2. 現行構成
- OS: Ubuntu 24.04
- Web: Nginx
- App: WordPress + PHP-FPM
- DB: MySQL 8
- TLS: Let's Encrypt
- 監視/防御: fail2ban, ConoHaセキュリティグループ

## 3. セキュリティ基準
- SSH は `deploy` ユーザー + 公開鍵認証
- ネットワーク制御は ConoHa セキュリティグループを正本とする
- `22/tcp` は管理者IP/CIDRに限定し、`80/443` のみ公開
- fail2ban `sshd` jail 有効
- 管理画面認証情報は強固な値を使用し、Application Password を最小化

## 3.1 ファイアウォール運用ポリシー
- `ufw` は本番では `inactive` を維持する（2026-03-23の接続障害対応による）。
- 理由: `ufw` 有効時に `connect timeout` / `Resolving timed out` が再現し、可用性を毀損したため。
- 再導入する場合は検証環境で再現テストを完了してから実施する。

## 4. 日次確認
```bash
sudo systemctl status nginx --no-pager -l
sudo systemctl status php8.3-fpm --no-pager -l
sudo systemctl status mysql --no-pager -l
sudo fail2ban-client status sshd
sudo ufw status
```

## 5. 障害時の一次切り分け
```bash
sudo nginx -t
sudo journalctl -u nginx -n 200 --no-pager
sudo journalctl -u php8.3-fpm -n 200 --no-pager
sudo journalctl -u mysql -n 200 --no-pager
```

## 6. ドメイン/TLS確認
```bash
curl -I https://hutaroblog.com/
sudo certbot renew --dry-run
```

## 7. 権限整合（必要時）
```bash
sudo chown -R www-data:www-data /var/www/hutaroblog/wordpress
```

## 8. 変更反映（テーマ/プラグイン）
- リポジトリ側で修正後、サーバーにファイル配備して権限を合わせる。
- 配備後は `php -l` と `curl` で最小確認を行う。

## 9. 監査ログ
- 運用コマンド結果は必要に応じて `audit-reports/` へ保存。
- セキュリティ監査の自動化は任意（GitHub Actions等）。

## 10. 補足
- 旧 Next.js 用 `blog-app.service` 運用は Archive 扱い。
- 現行は WordPress 配信が正規経路。
