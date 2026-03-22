# Codex向け 公開前チェック指示テンプレート（WordPress移行後）

最終更新: 2026-03-22

## 1. コンテンツ公開（Markdown -> WordPress）

```text
公開前チェックを実行してください（コンテンツ公開）。

要件:
1. `npm run wp:export` を実行
2. `npm run wp:publish:md` を実行
3. `BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh` を実行
4. 失敗があれば原因を修正し、再実行
5. 最後に以下を報告
   - 結果: PASS / FAIL
   - Findings: 重要度順（High/Medium/Low）
   - 変更ファイル一覧
   - 残リスク（あれば）
```

## 2. コード公開（テーマ/プラグイン/スクリプト変更）

```text
公開前チェックを実行してください（コード公開）。

要件:
1. 変更したPHPファイルに `php -l` を実行
2. 必要なら `npm run wp:publish:md` を実行
3. `BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh` を実行
4. セキュリティ観点レビュー（XSS、URL/入力検証、権限）
5. 最後に以下を報告
   - 結果: PASS / FAIL
   - Findings
   - 変更ファイル一覧
   - 残リスク
```

## 3. 運用ルール
- `FAIL` の場合は公開しない。
- `PASS` でも残リスクがある場合は、管理者が公開可否を判断する。
