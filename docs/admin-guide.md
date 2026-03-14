# 管理者向け運用ガイド（簡潔版）

## 0. 30秒版（ここだけ読めば運用できる）
1. 記事を書く: `content/blog/` または `content/blog-tech/` に `.md` を置く
2. 画像/動画: `content/assets/` に置いて `assets/...` で参照
3. 確認: `npm run dev`（`http://localhost:3000`）
4. 公開前チェック: `npm run publish:secure`

## 1. 何をすれば公開される？
- `content/blog/*.md` と `content/blog-tech/*.md` にある記事が公開対象です。
- `content/wip/` は非公開です。

## 2. ローカルで表示確認する方法
- ふだんの確認: `npm run dev`
- ブラウザ: `http://localhost:3000`
- 本番に近い確認: `npm run preview`

`npm run preview` は `build -> start` をまとめて実行します。

## 3. 公開前チェックとは？
- コマンド: `npm run publish:secure`
- 中身:
  - `npm run lint`（コードや設定の問題チェック）
  - `npm run build`（本番ビルドできるかチェック）
  - `npm run security`（依存関係の脆弱性監査）
- これが通れば「公開できる状態」です。
- Codexへ依頼する場合は `docs/codex-prepublish-check.md` のテンプレートを使います。

## 4. 基本運用
1. `content/home.md` を編集（ホーム本文）
2. 記事を `content/blog/` または `content/blog-tech/` に追加
3. 画像/動画を `content/assets/` に置く
4. 記事から `![alt](assets/xxx.png)` や `![video](assets/sample.mp4)` で参照
5. `npm run publish:secure` を実行

## 5. サイト名・説明・ナビの変更
- 設定ファイル: `content/site.json`
- 変更できる項目:
  - `title`（ブログ名）
  - `description`（サイト説明）
  - `fontVariant`（フォントプリセット）
  - `navigation`（上部ナビ表示）

例:
```json
{
  "title": "My Research Blog",
  "description": "ML experiments and notes",
  "navigation": [
    { "href": "/", "label": "home" },
    { "href": "/blog", "label": "blog" },
    { "href": "/blog-tech", "label": "blog(tech)" }
  ]
}
```

## 6. 数式
- `$$ ... $$` で記述すれば表示されます。
- インライン数式は `$ ... $` で記述できます。
- HTMLタグは安全のため一部のみ許可しています（`details` / `summary` など）。
- ローカル動画は `mp4` / `webm` に対応しています。

`details` / `summary` の例:
```md
<details>
  <summary>やばい！</summary>

やばくない！
</details>
```

動画の例（簡易）:
```md
![demo video](assets/demo.mp4)
```

動画の例（詳細）:
```md
<video controls preload="metadata" width="720">
  <source src="assets/demo.webm" type="video/webm" />
  <source src="assets/demo.mp4" type="video/mp4" />
</video>
```

## 7. 一覧用サマリー（要約）を手動で指定する
- 記事冒頭にFrontmatterを追加し、`summary` を書くと一覧の説明文を上書きできます。

例:
```md
---
summary: "この記事の短い説明文をここに書く"
---

# 記事タイトル
本文...
```

- `summary` がない場合は、本文から自動生成されます。

## 8. フォントプリセット一覧
- `classic`: 元の雰囲気（本文サンセリフ + 見出しセリフ）
- `clean-sans`: 全体サンセリフで素直
- `kaku`: 角ゴ系で現代的
- `kaku-light`: 角ゴ系で軽め
- `tech-sans`: 技術寄りで見出し強め
- `system-sans`: OS標準フォント優先

`content/site.json` の例:
```json
{
  "fontVariant": "kaku-light"
}
```

## 9. 日付
- `publishedAt`: Git初回コミット日時
- `updatedAt`: Git最終コミット日時
- Git未設定時のみファイル時刻を使用します。
