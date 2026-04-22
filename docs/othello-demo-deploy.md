# オセロデモ掲載手順

最終更新: 2026-04-23

`/works/othello/` を ConoHa 上の WordPress に掲載し、Python API を別プロセスで常駐させる手順です。

## 1. 前提

- リポジトリ配置先: `/var/www/hutaroblog/repo`
- WordPress 公開ディレクトリ: `/var/www/hutaroblog/wordpress`
- Python API は `127.0.0.1:8765` で待ち受け
- Nginx が `/api/othello/` を Python API にプロキシ

## 2. 反映対象

今回のデモ掲載で本番に必要なのは主に以下です。

- `content/works/othello.md`
- `wordpress/plugins/hutaro-bridge/`
- `services/othello_api/`
- `scripts/run-othello-api.sh`
- `scripts/stop-othello-api.sh`
- `ops/systemd/othello-api.service`
- `ops/nginx/wordpress/hutaroblog-wordpress.conf`

## 3. リポジトリ反映

サーバー側で最新を取得します。

```bash
cd /var/www/hutaroblog/repo
git pull
```

Markdown / WordPress 側の同期が必要なら、既存フローに合わせて実行します。

```bash
cd /var/www/hutaroblog/repo
npm run wp:sync:content
```

必要に応じて記事公開系も実行します。

```bash
cd /var/www/hutaroblog/repo
npm run wp:publish:all
```

## 4. Python API 環境

Python 仮想環境を作成します。`pyspiel` が安定して入る Python を使ってください。

```bash
cd /var/www/hutaroblog/repo
/usr/bin/python3 -m venv /var/www/hutaroblog/.venv-othello
source /var/www/hutaroblog/.venv-othello/bin/activate
pip install -U pip
pip install -r services/othello_api/requirements.txt
pip install open_spiel
```

`pyspiel` の確認:

```bash
source /var/www/hutaroblog/.venv-othello/bin/activate
python - <<'PY'
import pyspiel
s = pyspiel.load_game("othello").new_initial_state()
print(s.legal_actions())
PY
```

## 5. systemd 配置

unit ファイルを配置します。

```bash
sudo cp /var/www/hutaroblog/repo/ops/systemd/othello-api.service /etc/systemd/system/othello-api.service
sudo systemctl daemon-reload
sudo systemctl enable othello-api
sudo systemctl restart othello-api
```

状態確認:

```bash
sudo systemctl status othello-api
journalctl -u othello-api -n 100 --no-pager
```

## 6. Nginx 設定

`/api/othello/` の location を本番設定へ反映します。

```bash
sudo cp /var/www/hutaroblog/repo/ops/nginx/wordpress/hutaroblog-wordpress.conf /etc/nginx/sites-available/hutaroblog-wordpress
sudo nginx -t
sudo systemctl reload nginx
```

確認したい location はこれです。

```nginx
location /api/othello/ {
  proxy_pass http://127.0.0.1:8765;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 45s;
}
```

## 7. 動作確認

まずサーバー内で API を直接叩きます。

```bash
curl http://127.0.0.1:8765/api/othello/health
```

新規対局:

```bash
curl -X POST http://127.0.0.1:8765/api/othello/session \
  -H 'Content-Type: application/json' \
  -d '{"mode":"human_black","black_ai_time_limit_seconds":1.0,"white_ai_time_limit_seconds":1.0,"black_ai_strategy":"UCT","white_ai_strategy":"UCT","ai_vs_ai_delay_ms":500}'
```

続いて公開 URL から確認します。

```bash
curl https://hutaroblog.com/api/othello/health
```

ブラウザでは以下を確認します。

- `https://hutaroblog.com/works/`
- `https://hutaroblog.com/works/othello/`
- 新しい対局が作れる
- 人間 vs AI で着手できる
- AI vs AI が進行する
- 先手評価値が更新される

## 8. 反映後の更新

UI だけ変えた場合:

```bash
cd /var/www/hutaroblog/repo
git pull
sudo systemctl reload nginx
```

Python API を変えた場合:

```bash
cd /var/www/hutaroblog/repo
git pull
sudo systemctl restart othello-api
```

WordPress 側を更新した場合:

```bash
cd /var/www/hutaroblog/repo
npm run wp:sync:content
```

## 9. ロールバック

API 変更が原因なら、直前コミットへ戻して service だけ再起動します。

```bash
cd /var/www/hutaroblog/repo
git checkout <previous-good-commit>
sudo systemctl restart othello-api
```

Nginx 変更が原因なら、設定を戻して reload します。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 10. 手元確認

ローカルでは以下で十分です。

```bash
npm run othello:api
npm run preview
```

停止:

```bash
npm run othello:api:stop
```
