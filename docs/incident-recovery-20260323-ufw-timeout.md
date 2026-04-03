# 障害復旧記録（2026-03-23 / UFW起因タイムアウト）

最終更新: 2026-03-23  
対象: `hutaroblog.com`（ConoHa VPS / WordPress）

## 1. 事象
- PC / スマホ（Safari）でアクセス時に 10 秒前後待たされる。
- SSH も断続的に `Operation timed out` が発生。

## 2. 観測ログ要点
- `ufw` 有効時:
  - `curl` で `connect timeout` と `Resolving timed out` が多発。
  - 例: `code=000 total=2.00s`、`Could not resolve host`。
- `ufw` 無効時:
  - `curl` 連続計測で安定。
  - 実測: `20/20` 成功、`total` おおむね `0.06s - 0.09s`。

## 3. 切り分けで実施したこと
1. アプリ層確認
- `nginx` / `php8.3-fpm` 再起動後も症状継続（根本解決せず）。

2. TCPキュー確認
- `ListenOverflows=0`、`TCPReqQFullDrop=0`、`SYN-RECV=0`。
- 接続キュー溢れは主因ではないと判断。

3. FW切替試験
- `ufw disable` で到達性が即改善。
- `ufw enable` 後に再び不安定化。
- `ufw --force reset` 後も再発。

## 4. 根本原因（運用判断）
- 本障害のトリガーは `ufw` 有効化時の通信阻害。
- WordPress/PHP アプリ処理は主因ではない。

## 5. 復旧措置
1. `ufw` を無効化
```bash
sudo ufw disable
```
2. ConoHa セキュリティグループへ制御を集約
- `22/tcp`: 管理者IP/CIDRのみに限定
- `80/tcp`: 公開
- `443/tcp`: 公開

## 6. 復旧確認コマンド
```bash
sudo ufw status
for i in {1..20}; do
  curl -sS --connect-timeout 2 --max-time 5 -o /dev/null \
    -w "%{http_code} %{time_connect} %{time_starttransfer} %{time_total}\n" \
    https://hutaroblog.com/ || echo ERR
done
```

期待値:
- `Status: inactive`
- `20/20` 成功
- `total` が概ね `0.2s` 未満

## 7. 今後の運用
- 本番では `ufw` を再導入しない（再導入は検証環境で再現試験後）。
- ネットワーク制御は ConoHa セキュリティグループを正本とする。
- 週次で上記 `curl` 連続計測を行い、到達性を監視する。

