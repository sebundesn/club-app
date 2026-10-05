# 部活動運営支援システム

部活動の管理を円滑にし、運営側とメンバー間の情報共有やエンゲージメントを高めるためのWebアプリケーション

## 1. 開発の背景と解決したい課題

サークル運営において、以下の2つの大きな課題を解決するためにこのアプリを開発

1. **情報共有の漏れ・認知ギャップの解消**
   重要な連絡やスケジュールが全メンバーに正確に伝わらず、確認漏れが起きやすい課題を、リアルタイムに共有できるカレンダーと会計ログで解決
2. **メンバーの主体性の向上**
   「何を提案していいか分からない」「意見を言う心理的ハードルが高い」という受動的な状態を解消するため、イベントの提案やフィードバックを気軽に送れる**匿名意見箱（お便りポスト）機能**を実装

---

## 2. デモ

* **本番環境URL:** [https://club-app-tdos.onrender.com/calendar](https://club-app-tdos.onrender.com/calendar)

---

## 3. 技術スタック

### バックエンド (Backend)
* **Go**
  * **採用理由:** 静的型付けによる堅牢性と、コンパイル・実行速度の速さから採用。シンプルでメンテナンス性の高いAPIサーバーを構築するのに最適であるため。

### データベース (Database)
* **PostgreSQL**
  * **採用理由:** カレンダーのスケジュールデータや、会計ログなどの構造化されたデータを安全かつ正確に管理するために、信頼性の高いRDBであるから

### フロントエンド (Frontend)
* **TypeScript / React / Next.js**
  * **採用理由:** コンポーネント指向による画面開発の効率化と、TypeScriptによる型安全な開発を行うために採用

---

## 4. 主な機能 (Main Functions)

* **リアルタイムカレンダー機能**
  * サークルのイベントや活動スケジュールを一覧で確認・登録・削除する機能。この機能は、部長・副部長の人しか登録・削除できないようになっている。1日に複数のイベントを登録できる（合宿と定例会が同日、など）

* **LINEログイン**
  * LINE Login（OAuth 2.0）でログインする。初回のみ学籍番号を入力して部員情報と紐づけ、次回以降はLINEだけでログインできる
* **匿名意見箱**（開発中）
  * メンバーが名前を伏せて、新しいイベントのアイデアや運営へのフィードバックを気軽に送信できる機能。現在は入力欄のみで、保存用のAPI・テーブルは未実装
* **会計ログ**
  * サークルの部費の使い道を透明化するための会計記録機能。この機能は、会計の人しか追加削除できないようになっている
* **領収書アップロード・削除機能**
  * イベント一つ一つで、使った経費の領収書をアップロード・削除する機能
* **部員情報管理機能**
  * 部員の学籍番号、名前、ユーザー名や役職等を見ることができる機能。部長・副部長のみが利用できる（認可はサーバー側のロール判定で行う）
* **CSVアップロード・ダウンロード機能**
  * 部員の情報を載せたCSVをアップロードし、データベースに反映させる機能。そして、データベースに保存されたCSVをダウンロードする機能

---

## ローカル環境での動かし方

### 前提条件
- Go (version 1.25.0 以上 / `backend/go.mod` を参照)
- Node.js (version 20 以上)
- PostgreSQL (version 16 以上)
- LINE Developers のアカウント（LINEログインのチャネルが必要）

### 手順

#### ① クローン
```bash
git clone https://github.com/sebundesn/club-app
cd club-app
```

#### ② 環境変数を用意する
`.env.example` をコピーして値を埋める。手順を飛ばすと起動しない。

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**backend/.env の必須項目**

| 変数 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL の接続文字列。例: `postgres://postgres:password@localhost:5432/club_db?sslmode=disable` |
| `SESSION_SECRET_KEY` | セッションの署名鍵。`openssl rand -base64 32` などで生成する |
| `FRONTEND_URL` | CORS の許可オリジン。ローカルは `http://localhost:3000` |
| `PORT` | 省略時は `8080` |
| `COOKIE_SECURE` | ローカルは必ず `false`。`http://localhost` では Secure Cookie が保存されずログインできない |
| `COOKIE_SAMESITE` | ローカルは `lax`。フロントとバックが別ドメインの本番では `none`（`COOKIE_SECURE=true` とセット） |
| `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | LINE Developers の「LINEログイン」チャネルから取得 |
| `LINE_REDIRECT_URI` | ローカルは `http://localhost:8080/api/auth/line/callback`。同じURLを LINE のチャネル設定にコールバックURLとして登録する |

**frontend/.env の必須項目**

| 変数 | 説明 |
|---|---|
| `NEXT_PUBLIC_API_URL` | バックエンドのURL。ローカルは `http://localhost:8080` |

> `NEXT_PUBLIC_` 付きの変数はビルド時にクライアントのJSへ埋め込まれ、誰でも読める。
> 秘密の値をここに置かないこと。

#### ③ 起動
テーブルはバックエンドの起動時に自動で作成される。

```bash
cd backend
go run .
```

```bash
cd frontend
npm install
npm run dev
```

#### ④ 部員を登録する
LINEログインは「学籍番号が `users` に登録されている人」しか通れない。
最初の部員は、管理画面のCSVインポート、または直接 `users` に INSERT して用意する。

```sql
INSERT INTO users (student_id, name, role) VALUES ('1234567', '山田 太郎', '部長');
```

#### ⑤ 閲覧
http://localhost:3000/calendar で閲覧できます

---

## 既知の課題

未対応の課題は [ISSUES.md](./ISSUES.md) にまとめてある。
