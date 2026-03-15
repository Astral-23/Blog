# 現状まとめ（運用開始時点）

最終更新: 2026-03-15

## 1. 完成状態
- ブログ基盤は運用可能（`home / blog / blog-tech`）
- Markdown運用:
  - `content/home.md`
  - `content/blog/*.md`
  - `content/blog-tech/*.md`
- 非公開作業:
  - `content/wip/`
- アセット:
  - `content/assets/`（画像・動画）

## 2. 主な機能
- 数式: `$...$`, `$$...$$`
- 画像:
  - 表示
  - キャプション
  - 回転
  - サイズ指定（`width/height/maxwidth`）
- 動画:
  - `mp4/webm` 再生
  - `![...](assets/x.mp4)` と `<video><source ...>` の両対応
- 記事一覧サマリー:
  - `summary` Frontmatter で手動指定
- サイト設定:
  - `content/site.json` で `title/description/navigation/fontVariant`

## 3. ticker埋め込み仕様
- 記法:
  - `<md-embed type="ticker" text="..." speed="..." color="..."></md-embed>`
- `speed`:
  - 1秒あたりの往復回数
  - `speed=0` は位置固定
- `color`:
  - `rainbow` / `white` / `accent` / `#hex`（`#`なしも可）
- カウントダウン:
  - `{{countdown:MM-DD}}`

例:
```md
<md-embed type="ticker" text="伊吹風子の誕生日まであと {{countdown:7-20}}日" speed="0" color="#60a136"></md-embed>
```

## 4. セキュリティ対応
- Markdownサニタイズ
- 危険リンク無効化
- パストラバーサル対策
- セキュリティヘッダー
- `npm audit` を公開前チェックに組み込み

## 5. 運用コマンド
- ローカル確認: `npm run dev`
- 本番相当確認: `npm run preview`
- 公開前チェック: `npm run publish:secure`
- 画像最適化:
  - `npm run assets:optimize:dry`
  - `npm run assets:optimize`

## 6. 参照ドキュメント
- 運用者向け: `docs/admin-guide.md`
- 開発者向け: `docs/developer-guide.md`
- 公開前チェック依頼テンプレ: `docs/codex-prepublish-check.md`
