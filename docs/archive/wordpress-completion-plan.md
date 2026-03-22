# WordPress移行 完了報告書

最終更新: 2026-03-22

## 1. 結論
- 移行は完了。
- 本番配信は WordPress に統一済み。
- Markdown正本運用（`content/*.md` -> `wp:publish:md`）を確立。

## 2. 完了した項目
- 見た目
  - 旧ブログ寄せの `hutaro-classic` テーマ実装
  - 上部ナビ、カード、本文、埋め込みの表示調整
- 運用
  - `npm run wp:publish:md` を追加
  - `.env.wp.local` 運用を整備
  - 管理者向け手順を `admin-guide.md` に統合
- 互換
  - `/api/health`, `/api/access-counter` の継続
  - `/blog/*`, `/blog-tech/*` の公開導線維持
  - `md-embed` 主要タイプ互換（latestPosts/ticker/counter/text）
- 品質
  - `smoke-check` を WordPress運用向けに更新
  - 移行変換テスト追加（`wp-migrate-utils.test.ts`）

## 3. 最終検証ログ
- `npm run wp:publish:md` 成功
- `BASE_URL=https://hutaroblog.com ./scripts/smoke-check.sh` 成功

## 4. 既知の差分（設計上の変更）
- 旧 Next.js の `/media/*` 動的最適化ルートは廃止（WordPressアップロード配信へ移行）。
- 旧 `demos` ルートは本番導線から除外。
- 高度なMarkdown表現（複雑表/深いネスト/数式）は簡易変換のため注意が必要。

## 5. 現行ドキュメント正本
- `docs/admin-guide.md`
- `docs/wordpress-production-runbook.md`
- `docs/conoha-vps-runbook.md`
- `docs/developer-guide.md`

## 6. Archive
- 過去の計画・手順は `docs/archive/` に退避済み。
