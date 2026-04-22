# Othello API Service

`/works/othello/` 用の Python サービス置き場です。

このディレクトリでは以下を分離して実装します。

- `contracts.py`
  - フロントとサーバーで共有する JSON 契約
- `session.py`
  - 1 対局の状態管理
- `store.py`
  - セッションストア
- `app.py`
  - HTTP エントリポイント

このサービスの責務は以下です。

- `pyspiel` ベースのオセロ環境を管理する
- AI 推論を実行する
- フロントに snapshot JSON を返す

ブラウザ側は盤面描画と操作だけを担当します。

本番掲載手順は [docs/othello-demo-deploy.md](/Users/kojimanozomi/blog/docs/othello-demo-deploy.md:1) を参照してください。

## ローカル起動例

```bash
python3 -m venv .venv-othello
source .venv-othello/bin/activate
pip install -r services/othello_api/requirements.txt
# pyspiel は別途 OpenSpiel の導入が必要
uvicorn services.othello_api.app:app --reload --port 8765
```

またはリポジトリルートから:

```bash
./scripts/run-othello-api.sh
```

補足:

- `.venv-othello39/` が存在する場合、起動スクリプトはそれを優先して使います
- ローカルでは `pyspiel` が入っている Python 3.9 系 venv を使う前提です

停止:

```bash
./scripts/stop-othello-api.sh
```

サービス用 Python を切り替える場合:

```bash
OTHELLO_PYTHON_BIN=/usr/bin/python3 ./scripts/run-othello-api.sh
```

## preview との接続

`npm run preview` で生成される `/works/othello/` は、既定で `http://127.0.0.1:8765/api/othello` を参照します。

ローカル preview の `localhost:4173` / `127.0.0.1:4173` からのアクセスは、API 側で CORS を許可しています。

接続先を変える場合:

```bash
HUTARO_OTHELLO_API_BASE=http://127.0.0.1:9000/api/othello npm run preview
```
