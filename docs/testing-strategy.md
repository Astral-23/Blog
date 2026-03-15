# テスト戦略（基盤）

最終更新: 2026-03-16

## 0. TDD方針
- このプロジェクトは **ハイブリッドTDD** を標準とする。
- 原則:
  - 壊れやすいロジック（変換・並び替え・境界値・セキュリティ）は Red→Green→Refactor で実装する。
  - UI微調整や単純リファクタは通常実装後に回帰テストを追加してよい。
- 位置づけ:
  - TDDは業界全体で唯一のやり方ではないが、品質重視開発では現在も有効で実務的。
  - 本プロジェクトでは「重要ロジックはTDD」を継続する。

## 1. 目的
- 仕様変更時の回帰を早期検出する。
- Markdown埋め込み・コンテンツ読み込みの壊れやすい境界を守る。
- `lint/build` だけでは検出できない挙動不一致を防ぐ。

## 2. テストピラミッド
1. Unit（最優先）
- 純ロジックや境界条件の検証。
- 例: 記事抽出・設定パース・embed属性処理。

2. Integration
- Reactコンポーネントと周辺モジュールの連携を検証。
- 例: `MarkdownContent` が `<md-embed>` を解釈して `renderEmbed` を呼ぶ。

3. E2E（スモーク）
- ユーザー導線の最低保証。
- 例: `/` 表示、`latestPosts` 表示、記事遷移。

## 3. 現在の実装
- Unit/Integration: Vitest + Testing Library + jsdom
- E2E: Playwright（Chromium）
- カバレッジ: V8
- スクリプト:
  - `npm run test`
  - `npm run test:watch`
  - `npm run test:coverage`
  - `npm run e2e`
  - `npm run e2e:headed`
  - `npm run e2e:install`

## 4. 実装済みスコープ
- `renderEmbed`:
  - セクション横断で最新順になること
  - 未知embedでフォールバック表示になること
- `MarkdownContent`:
  - `<md-embed>` の payload が正しく渡ること
  - `javascript:` リンクが無効化されること
- `site-config`:
  - 設定ファイル未存在時のデフォルト
  - `titleSegments` のサイズ補正（0.5〜2）と legacy値変換
  - JSON破損時のデフォルト復帰
- `content`:
  - `home.md` 不在時フォールバック
  - Frontmatter優先と見出し推論
  - Git履歴不在時のファイル時刻フォールバック
- E2Eスモーク:
  - `/` で latestPosts が表示される
  - `/blog` でカード全体クリック遷移できる

## 5. 次フェーズ（推奨）
1. Integration
- `latestPosts` の `source=blog|blog-tech|all` と `count` 境界を拡充
- `ticker` の `speed` バリエーション（slow/normal/fast/0/小数）

2. E2E
- `/blog-tech` に記事追加後、一覧/記事遷移テスト追加
- モバイルビューポートでヘッダー・ナビ・カード押下を確認

## 6. CIゲート
- 基本ゲート:
  - `npm run lint`
  - `npm run test`
  - `npm run e2e`
  - `npm run build`
- 公開前:
  - `npm run publish:secure`
