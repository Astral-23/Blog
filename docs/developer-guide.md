# 開発者向けガイド（Best Practices）

最終更新: 2026-03-15

## 1. このプロジェクトの設計思想
- **運用者はMarkdown中心**で更新し、開発者は「枠組み」の改善に集中する。
- **最小機能で公開可能**を優先し、複雑な機能はデモページへ隔離する。
- **将来拡張を阻害しない構造**を維持する（責務分離、命名規則、ルーティング規則）。

## 2. アーキテクチャ方針
- `content/` はデータ（記事・画像・WIP）専用。
- `src/lib/content.ts` はコンテンツ読み込みとメタ情報生成の単一責務。
- `src/components/` は再利用UIのみを置く。
- `src/app/` はルーティングとページ構成に集中させる。
- インタラクティブデモは `src/app/demos/*` に隔離し、記事描画ロジックへ混ぜない。

## 3. ディレクトリ規約
- `content/home.md`: ホーム本文
- `content/site.json`: サイト設定（タイトル/説明/ナビ）
- `content/blog/*.md`: 一般記事
- `content/blog-tech/*.md`: 技術記事
- `content/wip/`: 非公開作業中
- `content/assets/`: 記事アセット
- `src/app/media/[...path]/route.ts`: `content/assets` 配信

禁止事項:
- `content/wip/` を公開対象ルートで読むこと
- デモ用コードを `src/lib/content.ts` に混在させること
- ページ内で直接 `fs` / `git` を叩くこと（共通ロジックを経由する）

## 4. Markdown処理のベストプラクティス
- GFM/数式はレンダラ側で一括管理し、ページごとにプラグインを重複設定しない。
- ブログ名やナビは `content/site.json` を単一の設定ソースにする。
- 記事ページの`h1`は `title` Frontmatter を唯一の正本とする（SEO要件）。
- 記事ページでは本文の先頭`#`を`h2`に降格して、`h1`重複を避ける。
- 互換性のため `title` 未指定時は先頭`#`見出し、さらに未指定時はslugを使うが、公開運用では`title`必須を推奨する。
- `summary` Frontmatter があれば一覧説明文に優先し、未指定時は本文から自動生成する。
- 画像パスは `assets/...` 形式を標準とし、変換ロジックを `MarkdownContent` に集約する。
- Frontmatter必須化は現時点では行わない。将来導入時は後方互換を保つ。
- HTMLタグは `rehype-raw + rehype-sanitize` で制御する。許可タグ追加時はXSSリスク評価を先に行う。

## 5. 日付・メタ情報運用
- `publishedAt`: Git初回コミット日時
- `updatedAt`: Git最終コミット日時
- Git履歴なし環境のみファイル時刻へフォールバック
- `.meta` 日時メモは記事読み込み時に生成されるため、公開前に `npm run preview` または `npm run build` を最低1回実行する
- アクセスカウンターの本番保存先は `ACCESS_COUNTER_STORE_PATH` で `/opt/blog/shared/access-counter.json` のようなアプリ外パスを使う

実装ルール:
- 日付生成ロジックは `src/lib/content.ts` 以外に分散させない。
- パフォーマンス問題が出るまではシンプル実装を維持し、先に複雑なキャッシュを入れない。

## 6. UI/デザイン運用
- テーマの差分はCSS変数で吸収する（コンポーネント分岐を増やさない）。
- 既存テーマ:
  - `minimal`
  - `labnote`
  - `magazine`
- 新テーマ追加時は以下を必ず満たす:
  - モバイル幅でナビが崩れない
  - 見出し・本文・リンクのコントラストが確保される
  - コードブロック・数式・画像表示が既存と互換

## 7. デモ機能拡張の指針
- デモは「記事」ではなく「アプリ」として扱う。
- 追加先は `src/app/demos/<demo-name>/page.tsx` を基本とする。
- `demos` トップに概要とリンクを集約する。
- 大きいモデルファイルは遅延ロードし、初期表示をブロックしない。
- 入力デバイスはマウス/タッチの双方を最初から考慮する。

MNIST系デモを追加する場合の推奨分割:
- `components/canvas-input.tsx`（描画入力）
- `lib/model-inference.ts`（推論I/O）
- `app/demos/mnist/page.tsx`（画面構成）

## 8. 開発ワークフロー
1. `npm install`
2. `npm run dev` でローカル確認
3. 変更対象のテストを先に追加（Red）
4. 実装してテストを通す（Green）
5. 必要なリファクタを行い、テストを維持（Refactor）
6. `npm run lint`
7. `npm run test`
8. `npm run e2e`
9. `npm run build`
10. 問題なければ `npm run publish:secure`

TDD運用ルール:
- 壊れやすい重要ロジック（データ変換・並び替え・境界値・サニタイズ）はTDDを必須とする。
- 単純な文言変更やレイアウト微調整は、実装後に回帰テスト追加でも可。
- 判断に迷う場合は「先にテストを書く」を選ぶ。

テーマ比較:
- `npm run dev:minimal`
- `npm run dev:labnote`
- `npm run dev:magazine`

## 9. 品質ゲート（最低ライン）
- `lint` と `build` の両方が通る
- `home/blog/blog-tech` のリンクが有効
- `$$...$$` 数式が崩れない
- `assets` 画像が表示される
- `wip` が公開一覧に出ない

## 10. 変更時チェックリスト（PR前）
- [ ] `content.ts` の責務を超えるロジックを追加していない
- [ ] デモ機能を記事ルートに混ぜていない
- [ ] CSS変数でテーマ差分を吸収している
- [ ] 新規ルートがナビ設計と矛盾していない
- [ ] READMEまたは関連docsの更新が必要なら反映した

## 11. よくあるアンチパターン
- ページ単位でMarkdownパーサ設定をコピペする
- 画像パス変換を複数ファイルに分散させる
- 日付生成に独自ルールを追加し、Git基準と不一致にする
- MVP段階で管理画面を先に作り込み、運用フローを複雑化する

## 12. 将来拡張ロードマップ（推奨）
1. 記事検索（ビルド時インデックス）
2. タグ/カテゴリ
3. RSS/sitemap/OGP強化
4. Demoカタログ整備
5. API連携デモ（必要時）
