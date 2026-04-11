# ジョーク一覧カタログ

最終更新: 2026-04-11

## 目的
- ジョーク案を一元管理する
- 「未実装」を明確にして、実装依頼を出しやすくする

## 運用ルール
- `status` は `idea` / `ready` / `implemented` / `dropped` を使う
- `id` は重複禁止（英小文字・ハイフン推奨）
- 実装済みになったら `implemented_in` にファイルパスを追記する

## ジョーク一覧
| id | title | condition | output | status | implemented_in | note |
| --- | --- | --- | --- | --- | --- | --- |
| osawari-fuko | 伊吹風子にお触りする | トップページの `fuko_top_home.jpg` をタップする | 俺の風子に触るんじゃねぇ！ | implemented | `wordpress/plugins/hutaro-bridge/assets/hutaro-bridge.js` | `voice:burst` で `path=/` + `src` を判定 |
| even-register | 偶数回チャンネル登録する | 同一記事で、チャンネル登録ボタンを2回押す | 「感動したのでチャンネル登録2回押しました！」 | implemented | `wordpress/plugins/hutaro-bridge/assets/hutaro-bridge.js` | `joke:toggle` の `label=チャンネル登録` を同一 `path` で2回検知 |
| ten-register | 10回チャンネル登録する | 同一記事で、チャンネル登録ボタンを10回押す | チャンネル登録10回記念です！ | implemented | `wordpress/plugins/hutaro-bridge/assets/hutaro-bridge.js` | 同一 `path` で10回検知 |
| hundred-register | 100回チャンネル登録する | 同一記事で、チャンネル登録ボタンを100回押す | こんなボタンにマジになってどうするの | implemented | `wordpress/plugins/hutaro-bridge/assets/hutaro-bridge.js` | 同一 `path` で100回検知 |


## 未実装テンプレ
`## ジョーク一覧` の表の末尾に、次の1行だけを追記してください。
区切り行 `| --- |` は既にあるため、追加不要です。

```md
| your-joke-id | タイトル | 条件 | 出力 | idea |  | メモ |
```
