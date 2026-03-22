# WordPress移行計画書（Hutaro Blog）

最終更新: 2026-03-22

## 1. 目的と成功条件

### 1.1 目的
- 現行 Next.js + Markdown + VPS 自前運用から WordPress へ移行し、以下を同時達成する。
- 低運用コスト: デプロイ/監視/障害対応の運用負担を削減する。
- 低実装コスト: 既存機能を短期間で移行する。
- 高パフォーマンス: 体感速度とCWVを現行同等以上に保つ。

### 1.2 成功条件（KPI）
- 機能互換: 現行公開機能の 100% が利用可能。
- URL互換: 既存URLを維持。変更が必要なものは 301 リダイレクトで補完。
- 性能:
  - 匿名ユーザーのHTML配信はエッジ/ページキャッシュ命中時に TTFB p75 <= 300ms
  - キャッシュミス時 TTFB p75 <= 900ms
  - LCP p75 <= 2.5s（モバイル）
- 可用性: 本番切替後30日で重大障害（P1）ゼロ。
- 運用:
  - 緊急時以外の本番更新を GUI または定型コマンドだけで実施可能
  - OS/Node 更新作業が運用定常タスクから外れる

### 1.3 非目的
- 既存デザインの完全ピクセル一致（必要箇所のみ再現）。
- 旧実装（Next.js 内部構造）の温存。

## 2. 現行システム（As-Is）

### 2.1 配信・運用
- フレームワーク: Next.js 16（App Router）
- コンテンツ: `content/*.md` + `content/assets/*`
- サーバー: ConoHa VPS + Nginx + systemd + deploy script
- ビルド結果:
  - 静的: `/`, `/blog`, `/blog/[slug]`, `/blog-tech`, `/blog-tech/[slug]`
  - 動的: `/api/access-counter`, `/api/health`, `/media/[...path]`

### 2.2 コンテンツ構造
- ホーム: `content/home.md`
- 記事: `content/blog/*.md`（将来 `content/blog-tech/*.md`）
- メタ: frontmatter `title`, `summary`, `card`
- 日付: Git履歴/メモファイルから `publishedAt`, `updatedAt`

### 2.3 独自機能
- `<md-embed>` 拡張
  - `latestPosts`, `ticker`, `counter`, `text`
- Markdown拡張
  - GFM, 数式（KaTeX）, 一部生HTML, `details/summary`, `video/source`
- メディア最適化
  - `/media/...` で `w/q/fm` クエリ変換（sharp）
- アクセスカウンター
  - `/api/access-counter` + JSONファイル永続化
- セキュリティヘッダ
  - CSP, XFO, Referrer-Policy 等

## 3. To-Be アーキテクチャ（推奨）

### 3.1 方針
- WordPress を主システム化（CMS + 配信）。
- 低運用を優先し、可能ならマネージドWordPress基盤を採用。
- 高性能の主軸は「多層キャッシュ + CDN/Edge + 画像最適化」。

### 3.2 構成
- アプリ: WordPress（Block Theme or Classic Theme）
- キャッシュ:
  - ページキャッシュ（必須）
  - オブジェクトキャッシュ（Redis等、可能なら導入）
  - ブラウザキャッシュ（静的ファイル長期化）
- CDN/Edge:
  - 静的配信 + HTMLキャッシュ（APO等を含む選択肢）
- 画像:
  - WP標準のレスポンシブ画像機能を利用
- カスタム実装:
  - Embed群は「ショートコード」または「独自ブロック」で提供

## 4. 機能移行マトリクス（全機能）

| No | 現行機能 | 現行仕様 | WordPress実現案 | 受入条件 |
|---|---|---|---|---|
| 1 | ホーム本文 | `home.md` をMarkdown描画 | 固定ページ `home` に移行。Markdownは変換して投入 | 既存表示と意味等価 |
| 2 | blog一覧 | `/blog` で日付順カード | 投稿タイプ `post` + カテゴリ `blog` | 同一URL/順序/抜粋 |
| 3 | blog-tech一覧 | `/blog-tech` | カテゴリ `blog-tech` もしくは CPT | 同一URLで表示 |
| 4 | 記事詳細 | `/blog/{slug}` | パーマリンクを現行互換設定 | 既存slugが全件到達 |
| 5 | title/summary/card | frontmatter | タイトル/抜粋/アイキャッチへマッピング | SEOメタ反映 |
| 6 | published/updated | Git由来日付 | インポート時に post_date/post_modified 設定 | 日付一致 |
| 7 | latestPosts embed | `<md-embed type="latestPosts">` | `[hutaro_latest_posts]` or block | 件数・並び一致 |
| 8 | ticker embed | countdown置換 + アニメ | `[hutaro_ticker]` or block + JS | 文言/色/速度一致 |
| 9 | counter embed | API POSTで加算表示 | `[hutaro_counter]` + REST endpoint + DB保存 | リロードで増分 |
| 10 | text embed | 位置/色/サイズ可変 | `[hutaro_text]` or block attributes | 主要属性互換 |
| 11 | 画像キャプション | `caption=...` | Gutenberg caption or shortcode属性 | キャプション表示 |
| 12 | 画像回転/サイズ | `rotate/width/maxwidth` | カスタムブロック属性 or style展開 | 指定が反映 |
| 13 | voices演出画像 | クリックで文字演出 | カスタムブロック（JS）で再現 | 動作・アクセシビリティ |
| 14 | 動画埋め込み | Markdown img/video対応 | core/video + 許可属性整備 | MP4/WebM再生 |
| 15 | 数式 | KaTeX | Math対応プラグイン or server-side render | 式崩れなし |
| 16 | details/summary | 生HTML許可 | ブロック化 or KSES許可調整 | 開閉動作一致 |
| 17 | 外部リンク安全化 | `target=_blank` + rel | コンテンツ変換/フィルタで付与 | 全外部リンク適用 |
| 18 | セキュリティヘッダ | CSP等 | Webサーバ設定 + WP整合 | 主要ヘッダ一致 |
| 19 | メディア最適化 | `/media?w=&q=&fm=` | WP標準画像サイズ + WebP/AVIF戦略 | 実効転送量維持 |
| 20 | health API | `/api/health` | WP REST route `/wp-json/hutaro/v1/health` + Nginx rewrite（任意） | 監視が継続 |
| 21 | ナビ/タイトル設定 | `content/site.json` | テーマ設定 or optionsページ | GUI更新可能 |
| 22 | WIP非公開運用 | `content/wip` | 下書きステータス運用 | 公開漏れゼロ |

## 5. 実装方式（方法不問の前提での最短案）

### 5.1 コンテンツ移行
- 方針: 自動インポートスクリプトを作る。
- 入力: `content/home.md`, `content/blog/*.md`, `content/assets/*`, `.meta/*.json`
- 処理:
  - frontmatter抽出
  - Markdown中 `<md-embed ...>` を暫定ショートコードへ変換
  - 画像パス `assets/...` を WP メディアURLへ置換
  - 投稿作成（slug/date/category/excerpt/featured image）
- 実行: WP-CLI + REST いずれか（実装容易な方を採用）

### 5.2 Embed移行
- 初期は shortcode 実装を優先（工数最小）。
- 仕様安定後、必要に応じて Gutenberg カスタムブロックへ昇格。

### 5.3 デザイン移行
- 完全再現ではなく「ブランド要素優先」。
- 必須:
  - ヘッダー構成（titleSegments, nav）
  - 記事カード、本文タイポ、埋め込み見た目

## 6. 工程計画（WBS）

### Phase 0: キックオフ（1週間）
- 要件確定、スコープ凍結、役割分担。
- 既存URL一覧・機能一覧を確定。

### Phase 1: 基盤PoC（1〜2週間）
- WordPress環境を本番同等で構築。
- キャッシュ/CDN戦略をPoC検証。
- 目標TTFBの初期計測。

### Phase 2: データ移行実装（1〜2週間）
- Markdown→WP投入パイプライン実装。
- 画像一括取り込み、slug/date整合。
- 差分再実行可能な冪等処理にする。

### Phase 3: 機能移植（2〜4週間）
- Embed 4種、数式、動画、details、外部リンク制御。
- テーマ設定画面（site.json相当）実装。
- health/counter API移植。

### Phase 4: SEO・性能・セキュリティ（1〜2週間）
- 301設計、canonical、OGP、sitemap。
- 性能チューニング（キャッシュ層、画像、不要プラグイン整理）。
- セキュリティヘッダ/権限/監査。

### Phase 5: UAT・移行リハーサル（1週間）
- 本番データでリハーサル2回以上。
- 差分インポート、失敗時ロールバック確認。

### Phase 6: 本番切替（2〜3日）
- 凍結、最終差分移行、DNS/リバースプロキシ切替。
- 監視強化（48時間）。

### Phase 7: 安定化（2週間）
- エラー/性能の是正。
- 運用手順の更新と引継ぎ完了。

## 7. 体制（最小）

- PM/Tech Lead: 1名
- WordPressエンジニア: 1〜2名
- フロント実装（テーマ/JS）: 1名
- QA/運用: 1名（兼務可）

## 8. テスト計画

### 8.1 機能テスト
- URL到達、一覧/詳細、カテゴリ、検索（必要なら）
- Embed全属性（count/speed/color/position/size/counterKey/digits）
- 画像/動画/数式/details/外部リンク

### 8.2 データ整合テスト
- タイトル/抜粋/本文/公開日/更新日/slug
- 記事件数、画像件数、リンク切れ
- 旧URL→新URLの 301 網羅

### 8.3 性能テスト
- キャッシュ命中時・ミス時で分離計測
- CWV（LCP/INP/CLS）
- 負荷試験（同時接続、キャッシュウォーム後）

### 8.4 セキュリティテスト
- 管理画面権限、REST露出、nonce/csrf
- ヘッダ、XSS、依存プラグイン脆弱性

## 9. カットオーバー計画

### D-14 〜 D-7
- 移行対象を凍結（新機能停止、記事更新ルールを制限）。
- リハーサル1回目。

### D-6 〜 D-2
- リハーサル2回目。
- ロールバック手順最終確認。

### D-1
- 旧環境バックアップ（DB/ファイル/設定）。
- 最終差分インポート準備。

### D-Day
1. 旧環境メンテナンスモード
2. 最終差分取り込み
3. DNS/プロキシ切替
4. スモークテスト（機能/性能/SEO）
5. 公開

### D+1 〜 D+7
- 監視強化、404/500/TTFBアラート監視。
- 問題の優先修正。

## 10. ロールバック計画

### 発動条件
- P1障害が30分超で継続
- 主要導線の 5xx が閾値超過
- 重大データ欠損が検知

### 手順
1. DNS/プロキシを旧環境へ戻す
2. WordPress側を保全（DBスナップショット）
3. 事後分析と再切替条件を明文化

## 11. リスク管理

- リスク: Embed互換不足
  - 対策: 先に shortcode で最小実装、UATで仕様固定
- リスク: プラグイン過多による性能悪化
  - 対策: 導入基準を明文化（必須/代替不可のみ）
- リスク: キャッシュ整合性不良（更新反映遅延）
  - 対策: purge戦略を定義、公開フローに purge を組み込む
- リスク: SEO毀損
  - 対策: URL固定、301網羅、Search Console監視
- リスク: セキュリティ運用劣化
  - 対策: 更新窓口・定例パッチ日・脆弱性監査ルール化

## 12. 運用設計（移行後）

- 編集運用
  - 投稿/下書き/予約公開を標準化
  - 画像アップロード規約（拡張子・サイズ）
- 変更管理
  - テーマ・プラグイン更新は staging 検証後に本番反映
- 監視
  - uptime、HTTP 5xx、TTFB、キャッシュヒット率
- 保守
  - 週次: 更新確認
  - 月次: バックアップ復元訓練、性能レビュー

## 13. 成果物一覧

- 移行スクリプト（Markdown/画像/メタ）
- WordPressテーマ（または子テーマ）
- Embed実装（shortcode or block）
- 運用手順書（編集/公開/障害対応）
- テスト仕様書・結果レポート
- カットオーバー実施記録

## 14. マイルストーン（例）

- M1: 要件凍結完了
- M2: PoC合格（性能目標の目処）
- M3: 全記事移行完了
- M4: 機能互換テスト合格
- M5: リハーサル完了
- M6: 本番切替
- M7: 安定化完了

## 15. 参考（公式ドキュメント）

- WordPress Performance / Cache
  - https://developer.wordpress.org/advanced-administration/performance/cache/
  - https://developer.wordpress.org/advanced-administration/performance/optimization/
- WordPress Responsive Images
  - https://developer.wordpress.org/apis/responsive-images/
- WordPress Shortcode API
  - https://developer.wordpress.org/plugins/shortcodes/
- WordPress Custom Post Types
  - https://developer.wordpress.org/plugins/post-types/
- WordPress REST API
  - https://developer.wordpress.org/rest-api/
- Gutenberg Block Registration
  - https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
- WP-CLI media import
  - https://developer.wordpress.org/cli/commands/media/import/
- WordPress importing guidance
  - https://developer.wordpress.org/advanced-administration/wordpress/import/
- Cloudflare APO
  - https://developers.cloudflare.com/automatic-platform-optimization/

