# Markdown Blog Framework

`home / blog / blog-tech` を持つ、Markdown運用ベースのブログです。

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## コンテンツ運用

- `content/home.md`: ホーム本文
- `content/blog/*.md`: blog記事
- `content/blog-tech/*.md`: tech記事
- `content/wip/`: 非公開の作業中置き場
- `content/assets/`: 記事画像

公開対象は `blog` と `blog-tech` のみです。

## Markdown仕様

- 見出し、リスト、コードブロック、表（GFM）
- 数式（`$$ ... $$`）
- 画像（例: `![alt](assets/sample-grid.svg)`）
- 任意の一覧サマリー（先頭Frontmatterの `summary`）

## 日付ルール

- `publishedAt`: Git初回コミット日時
- `updatedAt`: Git最終コミット日時
- Git履歴がない場合のみファイル時刻を利用

## 公開コマンド

```bash
npm run publish
```

このコマンドは `lint + build` を実行し、ビルド時点で `content/blog`, `content/blog-tech` にある記事を公開対象として扱います。

## デザイン比較（3案）

```bash
npm run dev:minimal
npm run dev:labnote
npm run dev:magazine
```

`src/lib/site-config.ts` の `THEME_VARIANT` でも固定できます。

## 将来のデモ追加

- デモ用トップ: `/demos`
- 追加先: `src/app/demos/*`
- 例: MNIST手書き推論デモのようなマウス/タッチ対応UIを追加可能

## ドキュメント

- 一覧: `docs/README.md`
- 管理者向け: `docs/admin-guide.md`
- 開発者向け: `docs/developer-guide.md`
