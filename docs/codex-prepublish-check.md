# Codex向け 公開前チェック指示テンプレート

このファイルは、公開前チェックをCodexへ依頼するためのテンプレートです。  
以下をそのまま送れば、毎回同じ品質でチェックできます。

## コピペ用指示

```text
公開前チェックを実行してください。

要件:
1. `npm run preview` を先に実行（`.meta` の日時ファイル生成のため）
2. `npm run publish:secure` を実行
3. セキュリティ観点でコードレビューを実施（最低限: XSS、パストラバーサル、危険な外部リンク）
4. 問題があれば修正まで実施
5. 修正後に再度 `npm run publish:secure` を実行
6. 最後に以下の形式で報告
   - 結果: PASS / FAIL
   - Findings: 重要度順（High/Medium/Low）
   - 変更ファイル一覧
   - 残リスク（あれば）
```

## このテンプレートが実行するコマンド
- `npm run preview`（`.meta/published-at.json` / `.meta/updated-at.json` 生成）
- `npm run lint`
- `npm run build`
- `npm run security` (`npm audit --audit-level=high`)

## 運用ルール
- `FAIL` の場合は公開しない。
- `PASS` でも残リスクがある場合は、管理者が公開可否を判断する。
