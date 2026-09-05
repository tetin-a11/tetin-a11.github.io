# できるかな魔改造 — AI GAME LAB.

AIを使った個人ゲーム開発とGoogle Play公開の試行錯誤を記録する、依存ゼロの静的サイトです。

## 使い方

```bash
npm run build
npm run dev
```

`http://localhost:4173` で確認できます。

## コンテンツ追加

- 記事: `content/articles/` にfront matter付きMarkdownを追加
- ゲーム: `content/games.json` に1件追加
- サイト設定: `site.config.json`

ビルド結果は `dist/` に出力されます。記事は個別HTMLとして事前生成されるため、JavaScript無効時も本文とSEO情報を取得できます。
