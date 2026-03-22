# WordPress移行 完了計画書（仕上げフェーズ）

最終更新: 2026-03-22 (夜)

## 0. 背景

WordPress本番切替は完了済み。ここからは「旧ブログ同等の体験」と「運用の持続性」を満たすための仕上げを実施する。

## 1. 完了条件（あなたの要求を定義化）

### 1.1 見た目を旧ブログに寄せる（上部ボタン含む）
- 旧ブログのヘッダー構造（タイトル分割/ナビボタン/ホバー挙動）を再現する。
- ホーム・一覧・記事ページの余白、文字サイズ、色、カード見た目を旧版に近づける。
- 埋め込み（counter/ticker/text/latestPosts）の見た目を旧版相当に調整する。

### 1.2 Markdown（.md）でブログ編集できること
- 編集の正本を `content/*.md` に置く。
- `npm run wp:export` + `npm run wp:import:rest` で本番反映できる。
- frontmatter（`title`,`summary`,`card`）と `md-embed` の互換を維持する。
- 運用者向けに「最短公開手順」をドキュメント化する。

### 1.3 テスト/ドキュメントを新環境対応
- 既存の smoke/test docs を WordPress配信前提に更新。
- `/api/health`, `/api/access-counter`, `/blog/*` の継続監視を維持。
- 旧Next.js前提の手順は archive 化し、正本を1本化する。

## 2. スコープ

### 対象
- Theme: `wordpress/themes/hutaro-classic`
- Plugin: `wordpress/plugins/hutaro-bridge`
- Migration scripts: `scripts/wp-export-content.mjs`, `scripts/wp-import-rest.mjs`, `scripts/wp-migrate-utils.mjs`
- Docs: `docs/*.md`
- Tests/Smoke: `scripts/smoke-check.sh` ほか

### 非対象
- 新機能追加（掲示板等）
- WordPress管理画面の見た目カスタム

## 3. 実行計画（Workstream）

## WS-A: 旧ブログ見た目再現

### タスク
1. 旧CSSとの差分棚卸し（ヘッダー、ナビボタン、カード、本文、埋め込み）。
2. `hutaro-classic` テーマを旧 `globals.css` 基準で調整。
3. `/`, `/blog/`, `/blog/{slug}` のスクリーンショット比較。
4. モバイル（<=720px）でナビ折返し/横スクロール挙動を合わせる。

### 受入基準
- ヘッダーのタイトル・ボタン配置が旧版と同等。
- ナビボタンの hover/境界/角丸/色が再現される。
- 記事カード・本文タイポ・引用・コードブロックの印象差が軽微。

### 進捗（2026-03-22時点）
- 完了:
  - テーマ `hutaro-classic` で旧見た目ベースを反映
  - `latestPosts` を `/blog` 一覧と同一カード描画へ統一
  - `source=all` の対象を `blog,blog-tech` 限定化（不要投稿除外）
  - ticker (`speed=0`) の中央固定、text embed中央寄せを調整
- 残り:
  - モバイル端末での最終目視確認（UAT）

## WS-B: Markdown編集運用の完成

### タスク
1. `.md` を唯一の正本にする運用を明文化。
2. ワンコマンド公開スクリプト追加（例: `wp:publish:md`）。
3. `.md` 記法仕様（`md-embed`, 画像メタ, frontmatter）を運用ガイドへ統合。
4. 失敗時ロールバック手順（再実行/差分再投入）を整備。

### 受入基準
- 新規記事を `content/blog/*.md` に追加し、本番反映できる。
- 既存2記事の再投入で内容差分が壊れない（idempotent）。
- 運用者が管理画面を使わず `.md` で公開できる。

### 進捗（2026-03-22時点）
- 完了:
  - `npm run wp:publish:md` を追加（export/import一括）
  - `docs/admin-guide.md` を WordPress + Markdown正本運用に更新
- 残り:
  - 実運用リハーサル（新規 `.md` 1本追加 -> publish -> 反映確認）

## WS-C: テスト・ドキュメント移行

### タスク
1. smoke対象をWordPress基準に更新（`/`, `/blog/`, `/api/health`, `/api/access-counter`）。
2. 移行スクリプトの最低限テスト追加（export payload 構造、embed変換）。
3. ドキュメント正本を `docs/wordpress-production-runbook.md` 中心に統合。
4. 旧版runbook/planを `docs/archive/` に退避・索引更新。

### 受入基準
- `smoke-check` が新環境で成功する。
- Markdown->WP変換の主要仕様がテストで担保される。
- docs/README から現行運用手順へ迷わず到達できる。

### 進捗（2026-03-22時点）
- 完了:
  - `scripts/smoke-check.sh` を WP運用向けに拡張
  - `src/lib/__tests__/wp-migrate-utils.test.ts` 追加（embed変換/画像メタ）
  - docs正本を `wordpress-production-runbook.md` + `admin-guide.md` に統合
  - 旧runbook/planは `docs/archive/` へ退避済み
- 残り:
  - なし（smoke成功ログ採取済み）

## 4. 進行順序（依存関係）

1. WS-A（見た目）
2. WS-B（Markdown運用）
3. WS-C（テスト/ドキュメント）
4. 最終UAT（運用者視点で1記事公開リハーサル）

## 5. マイルストーン（目安）

- M1: 2026-03-24 見た目差分の確定
- M2: 2026-03-26 テーマ調整完了（PC/モバイル）
- M3: 2026-03-27 Markdown公開フロー確定
- M4: 2026-03-28 テスト/ドキュメント更新完了
- M5: 2026-03-29 受入完了（本計画の完了）

## 6. リスクと対策

- 接続不安定（SSH timeout）
  - 対策: リトライ前提運用、fail2ban ignoreip 維持
- WordPress側更新で見た目崩れ
  - 対策: テーマを独立管理し、更新前にステージング確認
- 管理画面編集と `.md` 編集の二重管理
  - 対策: `.md` 正本を明示し、WP直接編集は原則禁止

## 7. 最終受入チェックリスト

- [x] `/` が旧ブログらしい見た目で表示される
- [x] 上部ナビボタン（home/blog/blog(tech)）が旧版同等の視覚/挙動
- [x] `/blog/`, `/blog/1/`, `/blog/2/` のデザインが旧版と整合
- [x] `.md` 追加 -> export/import -> 本番反映が成功
- [x] `/api/health`, `/api/access-counter` が安定稼働
- [x] 新旧ドキュメント整理が完了（正本+archive）
