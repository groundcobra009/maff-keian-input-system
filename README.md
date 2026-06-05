# 経営安定申請入力システム

React/Vite + Convex で作る、経営所得安定対策等の申請入力システムです。

## できること

- 農業者向けの分割申請フォーム
- 下書き保存を前提にした入力UI
- 農地利用計画（筆情報）の明細入力
- PDF/画像アップロードからAI読取ジョブ作成
- OpenAI / Anthropic / Gemini のモデル切替
- OCR候補の採用・却下・下書き反映
- 検証エラー表示
- CSV出力
- IF仕様から抽出した `public/field_catalog.csv` の参照
- WorkOS AuthKitによるGoogle認証
- テストモードでのログインなし利用
- ローカル確認モードでのlocalStorage途中保存

## ローカル起動

```bash
npm install
npm run dev
```

デフォルトでは `VITE_AUTH_MODE=test` 相当のテストモードで、ログインなしで起動します。Convex未接続の場合はローカル確認モードになり、下書きはブラウザのlocalStorageに途中保存されます。

## 環境変数

`.env.local.example` を参考に `.env.local` を作成します。

```bash
cp .env.local.example .env.local
```

| 変数 | 用途 |
| --- | --- |
| `VITE_AUTH_MODE` | `test` または `workos` |
| `VITE_WORKOS_CLIENT_ID` | WorkOS AuthKitのClient ID |
| `VITE_WORKOS_API_HOSTNAME` | カスタム認証ドメイン。未設定時はdevModeを使う |
| `VITE_WORKOS_DEV_MODE` | `true` ならクライアント専用開発モード |
| `VITE_WORKOS_REDIRECT_URI` | WorkOSから戻るURL。例: `https://maff-keian.vercel.app` |
| `VITE_CONVEX_URL` | ConvexデプロイURL |

## Convex接続

```bash
npx convex dev
```

Convexの初期設定後、表示されたURLを `.env.local` に設定します。

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

AI読取を実APIで動かす場合は、Convex側の環境変数に必要なキーを設定します。

```bash
npx convex env set OPENAI_API_KEY "..."
npx convex env set ANTHROPIC_API_KEY "..."
npx convex env set GEMINI_API_KEY "..."
```

APIキーが未設定の場合、OCRジョブは画面確認用の疑似抽出結果を返します。

## WorkOS設定

WorkOS AuthKitのClient-only React構成を使います。

1. WorkOS DashboardでAuthKitを有効化
2. Redirect URIにローカルなら `http://localhost:5173` または `http://localhost:5173/callback` を登録
3. Sign-in endpointに `/login` を登録
4. Sign-up URLに `https://maff-keian.vercel.app/sign-up` を登録
5. SessionsのCORS Allowed originsに `http://localhost:5173` とVercel本番URLを登録
6. Social LoginでGoogleを有効化
7. `.env.local` またはVercel環境変数に `VITE_AUTH_MODE=workos` と `VITE_WORKOS_CLIENT_ID` を設定

## Vercelデプロイ

Vercelでは以下を設定します。

```bash
VITE_AUTH_MODE=workos
VITE_WORKOS_CLIENT_ID=client_xxx
VITE_WORKOS_DEV_MODE=true
VITE_WORKOS_REDIRECT_URI=https://maff-keian.vercel.app
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Convex未設定のままUIだけ公開する場合は、`VITE_AUTH_MODE=test` のままでもデプロイできます。

## 主要ファイル

- `src/auth/AuthShell.tsx` WorkOS / テストモード認証切替
- `src/` フロントエンド
- `convex/schema.ts` Convex DBスキーマ
- `convex/applications.ts` 申請保存・検証・提出
- `convex/files.ts` PDF/添付ファイル保存
- `convex/ocr.ts` AI読取ジョブ
- `convex/aiProviders.ts` OpenAI / Anthropic / Gemini 呼び出し
- `convex/export.ts` CSV出力
- `docs/requirements.md` 要件定義書
- `docs/field_catalog.csv` IF仕様由来の項目カタログ
