# 管理者向け運用ガイド（簡潔版）

## 0. 30秒版（ここだけ読めば運用できる）
1. 記事を書く: `content/blog/` または `content/blog-tech/` に `.md` を置く
2. 画像/動画: `content/assets/` に置いて `assets/...` で参照
3. 確認: `npm run dev`（`http://localhost:3000`）
4. 公開前チェック: `npm run publish:secure`
5. 本番反映: `./scripts/deploy-prod.sh`

## 1. 何をすれば公開される？
- `content/blog/*.md` と `content/blog-tech/*.md` にある記事が公開対象です。
- `content/wip/` は非公開です。

### 公開手順（この順でやれば本番に反映される）
1. 記事/画像を更新する
   - 記事: `content/blog/` または `content/blog-tech/`
   - 画像/動画: `content/assets/`
2. ローカル確認
   - `npm run preview`（または `npm run build`）を実行して `.meta` を生成
   - `npm run publish:secure` を通す
3. Gitへ反映
   - `git add .`
   - `git commit -m "publish: ..."`
   - `git push`
4. 本番サーバーへデプロイ（ConoHa）
   - 直打ち: `TARGET_HOST=133.88.121.12 TARGET_USER=deploy ./scripts/deploy.sh`
   - 1コマンド版: `./scripts/deploy-prod.sh`
5. 公開確認（本番URL）
   - `curl -I https://hutaroblog.com`
   - `curl -I http://hutaroblog.com`（HTTPSへリダイレクトされること）

補足:
- `npm run publish:secure` が通っていても、`deploy.sh` を実行しない限り本番には反映されません。
- `content/wip/` に置いた記事はデプロイしても公開されません。
- アクセスカウンター値を維持するため、本番 `.env.production` に `ACCESS_COUNTER_STORE_PATH=/opt/blog/shared/access-counter.json` を設定してください。

## 2. ローカルで表示確認する方法
- ふだんの確認: `npm run dev`
- ブラウザ: `http://localhost:3000`
- 本番に近い確認: `npm run preview`

`npm run preview` は `build -> start` をまとめて実行します。

重要:
- `content/.meta/published-at.json` と `content/.meta/updated-at.json` は、記事読み込み時に生成/更新されます。
- そのため、記事追加後に `git push` する前に、少なくとも一度 `npm run preview`（または `npm run build`）を実行してください。
- これを行わないと、時間メモファイルが作られないまま公開作業に進む可能性があります。
- アクセスカウンターは本番では `/opt/blog/shared/access-counter.json` への保存を推奨します（`ACCESS_COUNTER_STORE_PATH`）。

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
5. `npm run preview`（または `npm run build`）を1回実行して `.meta` 日時ファイルを生成
6. `npm run publish:secure` を実行
7. `./scripts/deploy-prod.sh` を実行して本番へ反映

画像キャプション/回転の例:
```md
![MNIST入力画像](assets/mnist.png "caption=手書き入力のサンプル; rotate=90")
```

- `caption=...` で画像下にキャプション表示
- `rotate=90` のように角度指定で回転
- `width=640` や `maxwidth=80%` で表示サイズ指定

## 5. サイト名・説明・ナビの変更
- 設定ファイル: `content/site.json`
- 変更できる項目:
  - `title`（ブログ名）
  - `titleSegments`（ブログ名を分割し、各パーツの表示サイズを数値で指定。`1`が基準）
  - `description`（サイト説明）
  - `fontVariant`（フォントプリセット）
  - `blogLead`（`/blog` 一覧ページの見出し下テキスト）
  - `blogTechLead`（`/blog-tech` 一覧ページの見出し下テキスト）
  - `navigation`（上部ナビ表示）

例:
```json
{
  "title": "My Research Blog 4th Edition",
  "titleSegments": [
    { "text": "My Research Blog", "size": 1 },
    { "text": "4th Edition", "size": 0.78 }
  ],
  "description": "ML experiments and notes",
  "blogLead": "日々のメモです",
  "blogTechLead": "技術記事の一覧です",
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
- 横スクロールの虹色ティッカーは埋め込みタグ `<md-embed ...>` で使えます。

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

ticker例:
```md
<md-embed type="ticker" text="WELCOME TO MY BLOG" speed="0.08" color="rainbow"></md-embed>
```

- `speed`: 1秒あたりの往復回数（回/秒）
  - `0.05` = 20秒で1往復（かなりゆっくり）
  - `0.1` = 10秒で1往復（標準）
  - `0.2` = 5秒で1往復（速い）
- `speed=0` は移動なし（位置固定、発光のみ）
- `color`: `rainbow` / `white` / `accent` / `#hex`
  - 例: `color=white`
  - 例: `color=#7dd3fc`
- `direction` 指定は不要です（現在は使いません）。
- `speed` は `slow` / `normal` / `fast` も使えます。
- 新しい埋め込み記法は `<md-embed ...>` です。
  - 例: 最新記事 `<md-embed type="latestPosts" source="all" count="5"></md-embed>`
  - 例: カウンター数字 `<md-embed type="counter"></md-embed>`
  - 例: テキスト装飾 `<md-embed type="text" position="center" size="lg" color="accent">見出しテキスト</md-embed>`

`type="text"` の主な属性:
- `position`: `left` / `center` / `right`
- `size`: `xs` / `sm` / `md` / `lg` / `xl` / `2xl`、または `1.2rem` など
- `color`: `text` / `muted` / `accent` / `white` / `black` / `#hex` / `rgb(...)`

### 埋め込み（embed）の拡張ルール
- 記事側は `<md-embed type="<name>" ...></md-embed>` を追加するだけで使えます。
- 新しい埋め込み機能は、`src/components/embeds/embed-registry.tsx` に `type` を追加して実装します。
- `type` が不明な場合はページ全体を壊さず、埋め込みエラー表示にフォールバックします。

カウントダウン例:
```md
<md-embed type="ticker" text="伊吹風子の誕生日まであと {{countdown:12-24}} 日" speed="0.1"></md-embed>
```

- `{{countdown:MM-DD}}` は次のその日付までの日数に置換されます。

## 7. 一覧用サマリー（要約）を手動で指定する
- 記事冒頭にFrontmatterを追加し、`title` と `summary` を指定できます。
- `title`: 記事タイトル（一覧・記事ページの`<h1>`・HTML`<title>`で使用）
- `summary`: 一覧の説明文
- `summary` は検索結果の説明文（`meta description`）にも利用されます。

例:
```md
---
title: "ブログ開設記念"
summary: "この記事の短い説明文をここに書く"
---

## 見出し2（本文はここから開始）
本文...
```

- SEO運用ルール:
  - `title` は必須として運用してください（空にしない）。
  - 本文では `#` を使わず、見出しは `##` から開始してください。
  - `#` を書いた場合でも、記事ページでは自動で`h2`に変換されます。
- `title` がない場合は、互換性のため本文先頭見出し（`# ...`）またはslugから自動生成されますが、公開運用では非推奨です。
- `summary` がない場合は、本文から自動生成します。

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

## 10. 画像サイズの目安と最適化
- 目安:
  - ヒーロー画像: 横 1600〜1920px
  - 記事中画像: 横 800〜1280px
  - サムネイル用途: 横 600〜800px
- 表示サイズだけ変える例:
```md
![図1](assets/figure.png "caption=比較図; width=720")
```
- 実ファイルを軽量化するコマンド:
  - 全体最適化（推奨）: `npm run assets:optimize`
  - 事前確認（dry-run）: `npm run assets:optimize:dry`
  - 単体リサイズ例:
    `npm run assets:resize -- --file content/assets/figure.png --width 1200`
