# オセロデモ設計メモ

最終更新: 2026-04-23

## 1. 目的

`/works/othello/` に、オセロエージェントの対戦デモを追加する。

今回の前提は以下。

- 推論とゲーム進行はサーバー側で実行する
- Web 側は盤面描画と操作 UI に徹する
- 将来、`pyspiel` 以外の環境や PyTorch モデルに差し替え可能にする
- 現在の WordPress 配信基盤は維持する

## 2. 結論

WordPress/PHP の中に AI や環境実装を直接埋め込まず、別プロセスの Python サービスを追加する。

構成は以下。

- WordPress
  - `/works/othello/` の公開ページを提供
  - オセロ専用 CSS/JS を配信
  - 必要なら Python API への軽いプロキシを担当
- Python service
  - `pyspiel` ベースのオセロ環境を管理
  - MCTS ベースのエージェント推論を実行
  - 対局セッションを保持
  - JSON API を提供
- Browser
  - 盤面描画
  - 設定 UI
  - API 呼び出し

## 3. なぜこの構成か

### 3.1 WordPress/PHP に閉じない理由

現在の本番基盤は WordPress + PHP-FPM であり、`pyspiel` を PHP から直接扱うのは不自然。

問題点:

- PHP から Python 推論を直接呼ぶと実装も運用も不安定になりやすい
- リクエストごとに Python を起動する構成は遅い
- 将来 PyTorch モデルを追加した時に PHP 側との境界がさらに悪化する

### 3.2 ブラウザ推論にしない理由

今回は「サーバーで計算してよい」が明示されたため、クライアントに環境実装や探索を移植しない。

利点:

- 既存 `Agent.py` の資産を流用しやすい
- `pyspiel` の利用が素直
- Web 側は薄い実装で済む
- 将来モデルを差し替えてもフロント変更が小さい

## 4. 役割分担

### 4.1 Python service

責務:

- 新規対局作成
- 対局状態の保持
- 人間の着手受付
- AI の着手決定
- Undo/Redo
- AI vs AI の逐次進行
- 評価値や探索反復数の返却

保持するデータ:

- `pyspiel` の state
- AI エージェントインスタンス
- 対局設定
- 履歴
- セッション有効期限

### 4.2 WordPress

責務:

- `/works/othello/` ページ提供
- オセロデモのフロント資産配信
- サイトナビ上の導線管理
- 将来必要なら Python service への同一オリジン REST プロキシ

本番では `Nginx` が `/api/othello/` を Python service にプロキシする。

### 4.3 Browser

責務:

- 盤面描画
- モード選択
- 思考時間や戦略設定
- API 応答に基づく再描画
- AI vs AI の自動進行トリガ

非責務:

- 環境遷移
- 評価
- 探索

## 5. システム構成

### 5.1 推奨構成

本番想定:

- Nginx
  - `/` -> WordPress
  - `/api/othello/` -> Python service
- WordPress
  - 既存運用のまま
- Python service
  - `uvicorn` + `FastAPI` 相当を想定
  - `systemd` 管理

ローカル開発想定:

- `npm run preview` とは別に Python service を起動
- プレビュー用 HTML は既定で `http://127.0.0.1:8765/api/othello/*` を叩く
- 必要なら `HUTARO_OTHELLO_API_BASE` で上書きする

### 5.2 Python service を別プロセスにする理由

- `pyspiel` / 将来の `torch` 依存を Python 側に閉じ込められる
- 障害時に WordPress と切り離して監視できる
- 将来別デモを増やしても再利用しやすい

## 6. MVP 要件

今回の MVP は以下を全部含む。

- 人間 vs AI
- AI vs AI
- 先手後手切替
- AI 思考時間設定
- `UCT` / `EPSILON_GREEDY` 切替
- 合法手表示
- 最終手表示
- 評価値表示
- 探索反復数表示
- Undo/Redo
- Reset

## 7. API 設計

ベースパス:

- `/api/othello`

### 7.1 新規対局

`POST /api/othello/session`

request:

```json
{
  "mode": "human_black",
  "black_ai_time_limit_seconds": 1.0,
  "white_ai_time_limit_seconds": 1.0,
  "black_ai_strategy": "UCT",
  "white_ai_strategy": "UCT",
  "ai_vs_ai_delay_ms": 500
}
```

response:

```json
{
  "session_id": "c2f42d...",
  "snapshot": {}
}
```

### 7.2 現在局面取得

`GET /api/othello/session/{id}`

### 7.3 人間の着手

`POST /api/othello/session/{id}/human-move`

request:

```json
{
  "action": 19
}
```

### 7.4 AI に 1 手打たせる

`POST /api/othello/session/{id}/ai-move`

用途:

- 人間 vs AI の AI 応答
- AI vs AI の逐次進行

### 7.5 Undo

`POST /api/othello/session/{id}/undo`

### 7.6 Redo

`POST /api/othello/session/{id}/redo`

### 7.7 Reset

`POST /api/othello/session/{id}/reset`

### 7.8 共通 snapshot 形式

```json
{
  "board": [
    ".", ".", ".", ".", ".", ".", ".", ".",
    ".", ".", ".", ".", ".", ".", ".", ".",
    ".", ".", ".", ".", ".", ".", ".", ".",
    ".", ".", ".", "x", "o", ".", ".", ".",
    ".", ".", ".", "o", "x", ".", ".", ".",
    ".", ".", ".", ".", ".", ".", ".", ".",
    ".", ".", ".", ".", ".", ".", ".", ".",
    ".", ".", ".", ".", ".", ".", ".", "."
  ],
  "current_player": 0,
  "legal_actions": [19, 26, 37, 44],
  "is_terminal": false,
  "last_action": null,
  "status_message": "あなたの番です。",
  "black_count": 2,
  "white_count": 2,
  "evaluation": null,
  "iterations": null,
  "can_undo": false,
  "can_redo": false,
  "mode": "human_black",
  "player_types": {
    "0": "human",
    "1": "ai"
  },
  "ai_config": {
    "black": {
      "time_limit_seconds": 1.0,
      "strategy": "UCT"
    },
    "white": {
      "time_limit_seconds": 1.0,
      "strategy": "UCT"
    }
  }
}
```

## 8. Python 側クラス設計

### 8.1 `OthelloSession`

責務:

- 1 対局の状態を持つ
- `pyspiel` state と AI エージェントを管理
- JSON snapshot を返す

主なメソッド:

- `from_settings(...)`
- `to_snapshot()`
- `apply_human_move(action)`
- `apply_ai_move()`
- `undo()`
- `redo()`
- `reset()`

### 8.2 `OthelloSessionStore`

責務:

- 複数セッション管理
- TTL 管理
- 取得/破棄

最初はインメモリでよい。

### 8.3 `OthelloSnapshotSerializer`

責務:

- `pyspiel` state をフロント向け JSON に整形
- 盤面文字列化
- カウント集計
- 合法手列挙

## 9. `Agent.py` / `test.py` の取り扱い

### 9.1 `Agent.py`

再利用方針:

- `SearchResult`
- `MTTreeNode`
- `OthelloAgent`

必要な見直し:

- Web 用に import しやすい場所へ移す
- 名前を用途ベースに整理する
- セッション管理から独立させる

### 9.2 `test.py`

再利用しない部分:

- `tkinter` GUI
- Canvas 描画
- ダイアログ

再利用したい考え方:

- 人間/AI モード設定
- Undo/Redo の意味
- 状態表示項目

## 10. フロント設計

ページ:

- `/works/othello/`

構成:

- 左: 盤面
- 右: コントロールパネル

コントロールパネル項目:

- 対局モード
- 先手/後手
- 黒 AI 設定
- 白 AI 設定
- AI vs AI 速度
- 新しい対局
- Undo / Redo / Reset
- ステータス
- 石数
- 評価値
- 探索反復数

フロントの流れ:

1. ページ読込
2. `POST /api/othello/session`
3. snapshot を描画
4. 人間操作または `ai-move`
5. 新 snapshot を再描画

## 11. セキュリティ・運用

### 11.1 セッション

- セッション ID はランダム生成
- 一定時間アクセスがなければ破棄
- 初期実装は未認証でよいが TTL は必須

### 11.2 負荷制御

- 思考時間上限を設ける
- AI vs AI は 1 手ずつ API を叩く
- セッション数に上限を設けやすい実装にする

### 11.3 障害分離

- Python service が落ちても WordPress 本体は落とさない
- `/works/othello/` では API エラーを明示表示する

## 12. 実装フェーズ

### Phase 1

- Python service の最小骨組み
- `Agent.py` の流用整理
- セッション生成と snapshot 取得

### Phase 2

- 人間着手
- AI 着手
- 基本 UI

### Phase 3

- Undo/Redo
- AI vs AI
- 表示改善

### Phase 4

- 本番反映用の Nginx / systemd 設計
- WordPress からの導線仕上げ

## 13. 次にやること

直近の実装順は以下。

1. Python service の配置ディレクトリを決める
2. `Agent.py` を service から再利用できる形に整理する
3. `OthelloSession` と snapshot serializer を実装する
4. `/works/othello/` の専用フロントを作る
5. `systemd` / `nginx` を反映して疎通確認する
