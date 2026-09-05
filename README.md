# バックオフィス職人

AIを使わなくても、仕事は楽になる。小さな事業所の事務・労務のための道具箱。

| ページ | 内容 |
|---|---|
| `/` | 道具箱の入口 |
| `/update/` | 福祉行政アップデート。国・地方厚生局・都道府県の更新を、自分の県と事業の種類だけ、見落とさない |
| `/chutaikyo/` | 中退共スケジューラー。掛金額と提出スケジュールをブラウザ内で出す |
| `/gmail/` | Gmail添付自動保存の手順書 |

## しくみ

- `scripts/fetch.cjs` が行政サイトの RSS／ページを読んで `data/items.json` に溜める
- `scripts/build.cjs` が `site/index.html` を生成する（サーバー不要の1ファイル）
- GitHub Actions（`.github/workflows/daily.yml`）が毎日 2 回これを回し、GitHub Pages に公開する

## 手元で動かす

```
npm install
node scripts/fetch.cjs
node scripts/build.cjs
```

## 情報の扱い

- 掲載するのは要約・タイトル・一次ソースへのリンク。詳細は必ず出所のページで確認してください
- 日付・締切は公的ページで確認できたものだけ載せています。誤りに気づいたらサイトの「ご意見」から知らせてください
