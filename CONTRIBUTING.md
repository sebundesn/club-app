# 🛠 共同開発ルール

---

## 1. コーディング内のコメント

・（必ず）コードから読み取れない「意図・理由・仕様の背景」
・（ときどき）複雑なアルゴリズムやトリッキーな処理の解説

・（必ず）関数や構造体の真上には、コメントを残す
・（必ず）トリッキーな処理や、あえて「泥臭く」書いた場所

・　`//TODO: の時`
開発中、「とりあえず動くようにしたけど、ここは後でリファクタリングしたいな」という場所には、　　
`// TODO: コメント`


## 2. コミットメッセージの規則
### 📌 種類一覧 [例付き]

* **`feature:`（新機能の追加）**
  * `feature: 会計ログにCSVエクスポート機能を追加`
  * `feature(auth): パスワードリセット機能のバックエンドAPI実装`

  スコープ付き（`feature(auth):`）でも、なしでもよい。
  これまでの履歴が `feature(participation):` `feature(notificate):` のように
  `feature` で揃っているので、`feat` ではなく `feature` を使う。

* **`fix・refactor:`（バグ・不具合の修正・改善）**
  * `fix: タイムゾーンのズレによりカレンダーの日付が1日ずれる問題を修正`

* **`chore:`（その他の雑務・設定変更・ドキュメントの変更）**
  * `chore: 不要になったログ出力コード（fmt.Println等）の削除`
  * `chore: データベースのマイグレーションファイルを生成`

* **`style:`（見た目・CSSのみの変更）**
  * `style(account-page): receiptのレスポンシブを変えた`

### ⚠️ 避けること
`debug` や `refs #?: わからない前回の処理` のような、
あとから見て何をしたか分からないメッセージは残さない。
何を変えたのかを一行で書く。

---

## 3. ブランチの命名規則

機能ごとに命名する。接頭辞は付けない。

### ✍️ 具体的な命名例
* `loginlogout`
* `calendar`
* `anonymousform`
* `accountlog`
* `receiptlog`
* `management`
* `participation`

---

## 4. main ブランチにマージするまでの流れ

### ① 作業ブランチの作成と実装
必ず`main` からブランチを切り、作業を行う
```bash
git checkout main
git pull origin main
git checkout -b 作業内容
```

上の「3. ブランチの命名規則」に合わせて、`feature/` などの接頭辞は付けない。

### ② プルリクエスト（PR）の作成
GitHub上で「自分の書いたコードをメインのコードに合流させてください」と Pull Request を送る
記載すること: 変更内容の概要、確認してほしいポイント、動作確認の結果など

### ③ CI とコードレビュー
PRを出すと GitHub Actions（`.github/workflows/ci.yml`）が次を実行する。
ここが赤いままマージしない。

* バックエンド: `go build ./...` / `go vet ./...` / `go test ./...`
* フロントエンド: `npx tsc --noEmit` / `npm run lint` / `npm run build`

手元で同じことを確認するには:

```bash
cd backend && go build ./... && go vet ./... && go test ./...
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

そのうえでコードレビューを受ける

### ④ マージ（合流）とブランチの削除
レビューでOKをもらったら、 main ブランチへマージ
マージが完了したら、役割の終わった作業用ブランチは削除