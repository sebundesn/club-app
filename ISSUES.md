# 課題一覧 (ISSUES)

リポジトリ全体を棚卸しして洗い出した、対応が必要な課題のリスト。
GitLab / GitHub に Issue を登録する際は、各項目をそのまま1 Issue として転記できる粒度で書いてある。

- **調査日:** 2026-09-15
- **調査対象:** ブランチ `participation` @ `e9bd6ae`
- **確認コマンド:** `go build ./...` / `go vet ./...` / `npx tsc --noEmit`
- **最終更新:** 2026-09-21（#1〜#15・#18〜#22 を対応済み）

## 対応状況

`#1`〜`#15` と `#18`〜`#22` は対応済み。残りは次の3件。

| # | 状態 | 残っている理由 |
|---|---|---|
| #6 | 一部のみ | `git rm --cached` で追跡は外した。**履歴からの除去は未対応**（force push が必要なのでメンバーとの調整待ち） |
| #16 | 未対応 | 新規機能のため、バグ・セキュリティ修正とは別で対応する |
| #17 | 未対応 | 同上 |

### 対応時に決めたこと

- **#2 の認証方式:** パスワードではなく **LINE Login（OAuth 2.0）** を採用した。
  初回のみ学籍番号を入力して部員レコードと紐づけ、以降はLINEだけでログインする。
  `users` に `line_user_id` を追加し、学籍番号だけのログイン（`/login`）は削除した。
- **#12 のイベント仕様:** **1日に複数イベントを許可する**方針にした。
  `events.date` の UNIQUE を外し、保存を `event_id` 指定の更新に変更。
  カレンダーの日付セルとモーダルも複数件表示に作り直した。

## 一覧

| # | 種別 | 概要 | 状態 |
|---|---|---|---|
| [1](#1-criticalbug-backend-がコンパイルできないgetallclubmembers-に-return-がない) | critical / bug | backend がコンパイルできない（`GetAllClubMembers` に return がない） | ✅ 対応済み |
| [2](#2-criticalsecurity-認証が学籍番号のみパスワードが存在しない) | critical / security | 認証が学籍番号のみ・パスワードが存在しない | ✅ 対応済み |
| [3](#3-criticalsecurity-getmembersupdatemembers-に認可がなく権限昇格できる) | critical / security | `/getMembers`・`/updateMembers` に認可がなく、権限昇格できる | ✅ 対応済み |
| [4](#4-criticalsecurity-管理画面のパスワードがクライアントバンドルに露出している) | critical / security | 管理画面のパスワードがクライアントバンドルに露出している | ✅ 対応済み |
| [5](#5-criticalsecurity-レシートのアップロード削除に認証もファイル検証もない) | critical / security | レシートのアップロード・削除に認証もファイル検証もない | ✅ 対応済み |
| [6](#6-criticalsecurity-領収書画像-48-枚が-gitignore-済みなのに-git-に追跡されている) | critical / security | 領収書画像 48 枚が .gitignore 済みなのに Git に追跡されている | ⚠️ 一部（履歴の除去は未対応） |
| [7](#7-bug-checkauthhandler-の型アサーションでサーバーが-panic-する) | bug | `CheckAuthHandler` の型アサーションでサーバーが panic する | ✅ 対応済み |
| [8](#8-bug-参加者機能が一通り壊れている存在しないapi型不一致) | bug | 参加者機能が一通り壊れている（存在しないAPI・型不一致） | ✅ 対応済み |
| [9](#9-bug-レシート取得のクエリパラメータ名がフロントとバックで食い違っている) | bug | レシート取得のクエリパラメータ名が食い違っている | ✅ 対応済み |
| [10](#10-bug-参加者保存が失敗しても成功と表示される) | bug | 参加者保存が失敗しても「成功」と表示される | ✅ 対応済み |
| [11](#11-bug-fmterrorf-の書式指定子が壊れている) | bug | `fmt.Errorf` の書式指定子が壊れている | ✅ 対応済み |
| [12](#12-bug-eventsdate-が-unique-のため-1日1イベントしか登録できない) | bug | `events.date` が UNIQUE のため 1日1イベントしか登録できない | ✅ 対応済み |
| [13](#13-bug-会計ログ削除が重複行をまとめて消す) | bug | 会計ログ削除が重複行をまとめて消す | ✅ 対応済み |
| [14](#14-bug-マイグレーション最後のエラーだけチェックされていない) | bug | マイグレーション最後のエラーだけチェックされていない | ✅ 対応済み |
| [15](#15-bug-secure-cookie-固定で-localhost-ではログインできない) | bug | Secure Cookie 固定で localhost ではログインできない | ✅ 対応済み |
| [16](#16-feature-通知機能が-ui-に接続されていない) | enhancement | 通知機能が UI に接続されていない | ❌ 未対応 |
| [17](#17-feature-匿名意見箱が未実装) | enhancement | 匿名意見箱が未実装 | ❌ 未対応 |
| [18](#18-refactor-alert-が-37-箇所トースト--インライン表示へ置き換える) | refactor | `alert()` が 37 箇所。トースト / インライン表示へ置き換える | ✅ 対応済み |
| [19](#19-refactor-エラーが全部-http-500-で返る) | refactor | エラーが全部 HTTP 500 で返る | ✅ 対応済み |
| [20](#20-chore-ci-がなくテストもゼロ) | chore | CI がなく、テストもゼロ | ✅ 対応済み |
| [21](#21-chore-デバッグコードと未使用コードの掃除) | chore | デバッグコードと未使用コードの掃除 | ✅ 対応済み |
| [22](#22-docs-ドキュメントと実装の食い違い) | documentation | ドキュメントと実装の食い違い | ✅ 対応済み |

## 残りの対応順

1. **#6 の履歴除去** — 個人情報が履歴に残り続けている。`git filter-repo` / BFG を使うが force push が必要なので、先にメンバーと日程を合わせる
2. **#16 / #17** — 未完成機能。どちらも新規テーブルとAPIが要るので、バグ修正とは分けて進める


---

## #1 [critical][bug] backend がコンパイルできない（GetAllClubMembers に return がない）

**ラベル:** `critical` `bug` `backend`

`feature/participation.go:48` の `GetAllClubMembers` が空実装のまま commit されており、`go build ./...` が失敗する。
現状 `participation` ブランチはサーバーを起動できない。

```
$ go build ./...
# club-app/feature
feature/participation.go:50:1: missing return
```

**やること**
- [ ] `GetAllClubMembers` を実装する（`query.SelectMembers` 相当で id / name を返し、フロントの react-select が使える形にする）
- [ ] `main.go` の `/getClubMembers` から正しく呼べることを確認
- [ ] ビルドが通らない状態を push できないよう #20（CI導入）と合わせて対応

---

## #2 [critical][security] 認証が学籍番号のみ・パスワードが存在しない

**ラベル:** `critical` `security` `backend`

`query/managementQuery.go` の `AuthenticatingQuery` は

```sql
SELECT id, name, role FROM users WHERE student_id = $1;
```

で、`users` テーブル（`query/auth.go`）にパスワード列が存在しない。
つまり **学籍番号を知っているだけで誰でもその人としてログインできる**。学籍番号は規則性のある連番であることが多く、総当たりも容易。
さらに `middleware/session.go:37` の `isInitial := req.Password == userInfo.Name` も、パスワードと名前を比較するという意味の通らない判定になっている。

#3 と組み合わさると、未認証で全部員の学籍番号を取得 → 任意のユーザーになりすまし、という完全な乗っ取り経路が成立する。

**やること**
- [ ] `users` に `password_hash` 列を追加
- [ ] bcrypt / argon2 でハッシュ化して保存・検証する
- [ ] 初回ログインフローを「初期パスワード発行 → 本人が変更」に設計し直す
- [ ] ログイン失敗時のレート制限を検討

---

## #3 [critical][security] /getMembers・/updateMembers に認可がなく、権限昇格できる

**ラベル:** `critical` `security` `backend`

`feature/management.go` の `FetchMembers` / `UpdateMembers` はセッションを一切参照していない。`main.go` でも素の `AppHandler` で登録されているだけ。

- `GET /getMembers` … 未認証で全部員の学籍番号・氏名・役職が取れる（#2 によりこれはログイン情報そのもの）
- `POST /updateMembers` … 未認証で `users` を upsert できる。`role` に `部長` / `会計` を入れれば**任意の権限に昇格できる**

**やること**
- [ ] 両ハンドラでセッション認証を必須にする
- [ ] `updateMembers` は管理権限（部長/副部長）のみに制限
- [ ] 認可チェックを共通ミドルウェア化し、各ハンドラでの書き漏らしを防ぐ

---

## #4 [critical][security] 管理画面のパスワードがクライアントバンドルに露出している

**ラベル:** `critical` `security` `frontend`

`app/management/page.tsx:31`

```ts
if (passwordInput === `${process.env.NEXT_PUBLIC_MANAGEMENT_PASSWORD}`) {
```

`NEXT_PUBLIC_` 接頭辞の環境変数は**ビルド時にクライアント JS へ埋め込まれる**ため、DevTools やバンドルの検索で誰でも平文で読める。
コミット 93af8fd「管理画面のパスワードをコーディングから見れないようにした」は、ソース直書きから env に移しただけで、露出そのものは解消していない。

加えて認可は `isAuthorized` という React state のみで、API 側（#3）は素通しなので、パスワードを知らなくても直接 API を叩けば同じことができる。

**やること**
- [ ] クライアント側パスワード判定を廃止する
- [ ] 管理操作の認可はサーバー側のロール判定に一本化する（#3 と同時に対応）
- [ ] `NEXT_PUBLIC_MANAGEMENT_PASSWORD` を削除

---

## #5 [critical][security] レシートのアップロード・削除に認証もファイル検証もない

**ラベル:** `critical` `security` `backend`

`feature/receipt.go` の `UploadReceipt` / `DeleteImg` はセッションを見ていない。フロント（`app/account/page.tsx` のアップロード）も `credentials: 'include'` すら付けていない。

- 未認証で任意のファイルをサーバーに書き込める
- 拡張子はユーザー由来のファイル名から `filepath.Ext` でそのまま採用（`feature/receipt.go`）。MIME 検証なし
- サイズ上限・枚数上限なし（ディスクを埋められる）
- 未認証で他人のレシート画像を削除できる

**やること**
- [ ] 認証必須にし、削除は会計ロールのみに制限
- [ ] 拡張子/MIME のホワイトリスト検証（jpeg / png のみ等）
- [ ] `http.MaxBytesReader` と `ParseMultipartForm` でサイズ上限を設定
- [ ] 保存ファイル名をサーバー生成値のみで構成する

---

## #6 [critical][security] 領収書画像 48 枚が .gitignore 済みなのに Git に追跡されている

**ラベル:** `critical` `security` `chore`

`.gitignore` に `backend/uploads` があるが、ignore 追加前にコミットされていたため追跡が続いており、`git ls-files backend/uploads` に 48 ファイルが並ぶ。
実際の部活動の領収書画像であり、個人情報・金額が履歴に残り続けている。

**やること**
- [ ] `git rm --cached backend/uploads -r` で追跡を外す
- [ ] 履歴からの除去が必要か判断する（`git filter-repo` / BFG。force push が必要なのでメンバーと調整）
- [ ] 本番では uploads をローカルディスクではなくオブジェクトストレージへ置くことを検討（Render はディスクが揮発するため、現状の実装では再デプロイで画像が消える可能性がある）

---

## #7 [bug] CheckAuthHandler の型アサーションでサーバーが panic する

**ラベル:** `bug` `backend`

`middleware/session.go:81-83`

```go
id := session.Values["id"].(int)
name := session.Values["name"].(string)
role := session.Values["role"].(string)
```

チェックなしの型アサーション。`feature/auth.go` の `Logout` はログアウト時に `session.Values["id"] = ""` と**文字列**を入れるため、その後 `/checkAuth` が呼ばれると `interface conversion` で panic する。
`util.AppHandler` に recover がないため、panic はプロセス全体を落とす。

**やること**
- [ ] `v, ok := ...(int)` 形式に直し、失敗時は未ログイン扱いで返す
- [ ] `AppHandler.ServeHTTP` に recover を入れ、1リクエストの panic でサーバーが落ちないようにする

---

## #8 [bug] 参加者機能が一通り壊れている（存在しないAPI・型不一致）

**ラベル:** `bug` `frontend` `backend`

`app/account/page.tsx` の参加者まわりが、動かない状態で commit されている。

1. `page.tsx:242` が `POST /takePartIn` を叩くが、**`main.go` にこのエンドポイントが存在しない**（常に 404）
2. `page.tsx:218` の `GET /getClubMembers` はハンドラが空実装（#1）
3. `fetchCurrentParticipants` は `{value, label}` を作って `as MemberOption[]`（= `{ID, name}`）にキャストしている。型が実際には一致していない
4. その結果 `page.tsx:346` の `m.user_name` / `m.amount` / `key={m.user_id}` はすべて `undefined` になり、参加者名も金額も表示されない
5. `react-select` の `options` に渡している `allClubMembers` も `{ID, name}` 形。react-select は `{value, label}` を要求するので選択肢が空欄で並ぶ
6. `takePartInButton` の `selectedOptions.map(opt => opt.ID)`（`page.tsx:240`）も、実体が `{value,label}` なので `undefined` の配列を送る

`model/calendar.go` の `CreateTodoRequest`（`user_ids` / `event_id` を受ける想定の構造体）は定義だけで未使用。おそらくこれが `/takePartIn` のリクエスト型のはず。

**やること**
- [ ] `/takePartIn` を実装して `main.go` に登録する（`event_members` への upsert）
- [ ] `/getClubMembers` を実装する（#1）
- [ ] フロント・バックで参加者の型を一つに揃える（`{value, label}` に寄せるか、react-select に `getOptionValue`/`getOptionLabel` を渡す）
- [ ] 表示側のプロパティ名を実データに合わせる

---

## #9 [bug] レシート取得のクエリパラメータ名がフロントとバックで食い違っている

**ラベル:** `bug` `frontend`

`app/account/page.tsx:32` は `?howLongMonth=` を送るが、`feature/receipt.go` の `GetMonthReceipts` は `howLongWeek` を読む。
結果、フロントの `howLongWeek` 定数は一切効かず、常にバックエンド側のデフォルト `"2"` が使われる。名前に `Month` と `Week` が混在しているのも紛らわしい。

**やること**
- [ ] パラメータ名を `howLongWeek` に統一する
- [ ] 変数名も週単位であることが分かる名前に揃える

---

## #10 [bug] 参加者保存が失敗しても「成功」と表示される

**ラベル:** `bug` `frontend`

`app/account/page.tsx:253-256`

```ts
if(!res.ok){
  alert("participants preservation error")
}

alert("response success")
```

`!res.ok` の分岐に `return` がないため、失敗時もそのまま "response success" が続けて表示される。

**やること**
- [ ] エラー分岐で `return` する
- [ ] 併せてメッセージを日本語のユーザー向け文言にする（#18）

---

## #11 [bug] fmt.Errorf の書式指定子が壊れている

**ラベル:** `bug` `backend`

`feature/participation.go:35`

```go
return fmt.Errorf("Scan error: w", err)
```

`%w` の `%` が抜けている。エラーがラップされず、ログには `Scan error: w%!(EXTRA *errors.errorString=...)` と出て原因が読み取りにくい。

**やること**
- [ ] `fmt.Errorf("scan error: %w", err)` に修正
- [ ] `go vet` を CI に入れてこの種の書式ミスを自動検出する（#20）

---

## #12 [bug] events.date が UNIQUE のため 1日1イベントしか登録できない

**ラベル:** `bug` `backend` `db`

`query/calendar.go` の `CreateEventsTable_Q` で `date DATE UNIQUE NOT NULL`、保存も `ON CONFLICT(date) DO UPDATE` の upsert。
同じ日に 2 件目のイベントを登録すると、既存のイベントが**上書きされて消える**。合宿と定例会が同日、といったケースで実際に問題になる。

**やること**
- [ ] 1日に複数イベントを持てるスキーマに変更するか、仕様として1日1件に固定するか決める
- [ ] 複数許可する場合、`UNIQUE` を外して `event_id` 指定の更新に変更する（`receipt_images` / `event_members` が `event_id` 参照なので影響範囲の確認が必要）

---

## #13 [bug] 会計ログ削除が重複行をまとめて消す

**ラベル:** `bug` `backend`

`query/account.go`

```sql
DELETE FROM accountLog WHERE date = $1 AND content = $2 AND amount = $3
```

同じ日に同じ内容・同じ金額のログが 2 件あると（例: 同日に同額の交通費が2人分）、1件消すつもりで**両方消える**。`accountLog` には `id` があるのに使っていない。

**やること**
- [ ] 削除を `WHERE id = $1` に変更
- [ ] API のレスポンスとフロントの `MoneyLogStruct` に `id` を持たせる

---

## #14 [bug] マイグレーション最後のエラーだけチェックされていない

**ラベル:** `bug` `backend`

`util/connection.go:83`

```go
_, err = DB.Exec(query.CreateEventMembers)
```

他のテーブル作成はすべて `if err != nil { log.Fatal(err) }` しているのに、`CreateEventMembers` だけ戻り値を握り潰している。`event_members` の作成に失敗しても起動してしまい、参加者機能が実行時に落ちる。

**やること**
- [ ] 他と同様にエラーチェックを追加
- [ ] テーブル作成が増えるたびに同じ 5 行を書いている状態なので、スライスでループさせるかマイグレーションツール導入を検討

---

## #15 [bug] Secure Cookie 固定で localhost ではログインできない

**ラベル:** `bug` `backend` `dx`

`middleware/session.go:48`

```go
session.Options.Secure = true  // Https connection(true in release)
```

コメント自身が「リリース時 true」と書いているのに常時 `true`。`http://localhost:3000` / `:8080` では Secure Cookie がブラウザに保存されないため、README 記載のローカル手順どおりに起動してもログインできない。

**やること**
- [ ] 環境変数（例: `APP_ENV` / `COOKIE_SECURE`）で切り替える
- [ ] README のローカル起動手順に必要な環境変数を追記する

---

## #16 [feature] 通知機能が UI に接続されていない

**ラベル:** `enhancement` `frontend` `backend`

バックエンド `GET /getNotification` は実装済み（`feature/calendar.go`）だが、フロントで表示に繋がっていない。

- `components/Header.tsx:68, 129` … 取得結果を `console.log` しているだけ
- `app/calendar/page.tsx:26` … `notificate` state は `useState([])` のまま `setNotificate` が一度も呼ばれない
- `app/calendar/page.tsx:255-` … そのため通知欄は常に「報告はないです!」。中の `<li>` もハードコードされたダミー
- 通知を**作成する** API が存在しない（`notificate` テーブルに INSERT する経路がない）ので、そもそもデータが入らない
- 見出しも「通知 (開発中)」のまま

**やること**
- [ ] 通知作成 API（`POST`）を実装する
- [ ] Header で取得した通知を calendar ページへ渡す（Context / 親コンポーネントへのリフトアップ / 取得場所を calendar 側へ移す のいずれか）
- [ ] ダミーの `<li>` を実データ描画に置き換える
- [ ] 既読・完了（`is_completed`）を更新する導線を作る

---

## #17 [feature] 匿名意見箱が未実装

**ラベル:** `enhancement` `frontend` `backend`

README で「主な機能」かつ開発動機の柱として挙げている匿名意見箱が、`app/calendar/page.tsx:150` の `sendMessage` で

- 空チェックして
- confirm を出して
- `setOpinion('')` で入力を消す

だけ。送信先の API もテーブルもない。UI 見出しも「匿名意見箱(開発中)」のまま。

**やること**
- [ ] 意見を保存するテーブルと `POST` API を作る（投稿者を記録しない設計にする）
- [ ] 運営側が投稿を閲覧する画面を作る
- [ ] 匿名性の担保方法を決める（セッションIDやIPを保存しない、など）

---

## #18 [refactor] alert() が 37 箇所。トースト / インライン表示へ置き換える

**ラベル:** `refactor` `frontend` `ux`

`frontend/app` と `frontend/components` に `alert(` が 37 箇所。`STUDYFORME.txt` に自分で「alert は最悪の UX」「エラー詳細の露出はセキュリティリスク」と書いた方針と、実装が矛盾している。

実際に問題のあるパターン:
- `alert(\`Failed to get notification: ${e}\`)` のように例外オブジェクトをそのまま表示（`app/utils/notification.tsx`）
- `alert(errorText)` でサーバーのエラー文字列をそのまま表示（`components/Header.tsx`）
- "response error" / "The password is wrong" / "There are no exported datas" など英語のまま

**やること**
- [ ] トースト通知コンポーネントを作る
- [ ] 全 `alert()` を置き換える
- [ ] 例外の中身はユーザーに見せず `console.error` 側に回す
- [ ] メッセージを日本語に統一する

---

## #19 [refactor] エラーが全部 HTTP 500 で返る

**ラベル:** `refactor` `backend`

`util/errorhandle.go` の `AppHandler` は、ハンドラが返したエラーをすべて 500 + 「失敗しました。」に潰している。

そのため、
- 権限不足（本来 403）
- 未ログイン（本来 401）
- メソッド不正（本来 405）
- リクエスト不正（本来 400）

が区別できない。フロントは `!res.ok` しか見られないので、`app/calendar/page.tsx` の「保存には"部長、副部長"の権限が必要です」のように、原因が何であれ決め打ちのメッセージを出す実装になっている。

**やること**
- [ ] ステータスコードを持つエラー型（例: `AppError{Code int, Msg string}`）を定義
- [ ] 各ハンドラで適切なコードを返す
- [ ] フロントでステータスコードに応じた出し分けをする

---

## #20 [chore] CI がなく、テストもゼロ

**ラベル:** `chore` `ci` `test`

`.gitlab-ci.yml` も GitHub Actions もなく、テストファイルも 1 つもない。
その結果 #1（ビルドできないコード）がそのまま commit されている。

**やること**
- [ ] CI を用意し、最低限 `go build ./...` / `go vet ./...` / `npx tsc --noEmit` / `npm run lint` / `npm run build` を回す
- [ ] ハンドラのテーブル駆動テストを書き始める（まずは認可判定から）
- [ ] main へのマージに CI 通過を必須にする

---

## #21 [chore] デバッグコードと未使用コードの掃除

**ラベル:** `chore` `good-first-issue`

**やること**
- [ ] `backend/feature/calendar.go:83` の `fmt.Printf("1")` を削除
- [ ] `backend/feature/calendar.go:150` の `fmt.Printf("notificates: %v", notificates)` を削除
- [ ] `console.log` 5 箇所を削除（`management/page.tsx:71`, `calendar/page.tsx:117`, `account/page.tsx:225`, `Header.tsx:68`, `Header.tsx:129`）
- [ ] 未使用 state を削除: `management/page.tsx:10-11` の `name` / `role`、`Header.tsx:24` の `timerRef`
- [ ] `model/account.go` の `MoneyLogStruct` と `MoneyLog` が完全に同一定義なので片方に統合する
- [ ] `catch (e: any)` / `useRef<any>` / `data.map((item: any) ...)` の `any` を型付けする
- [ ] ファイル名の typo `backend/query/participantion.go` → `participation.go`

---

## #22 [docs] ドキュメントと実装の食い違い

**ラベル:** `documentation` `good-first-issue`

- README の前提条件が「Go (version 1.26.0)」だが `backend/go.mod` は `go 1.25.0`
- README のローカル起動手順に `.env`（`DATABASE_URL`, `SESSION_SECRET_KEY`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` 等）の説明がなく、手順どおりでは起動しない。`.env.example` もない
- CONTRIBUTING はコミット接頭辞を `feat:` と定めているが、実際の履歴は `feature(participation):` `feature(notificate):` など。加えて `debug` / `refs #?: わからない前回の処理` のような規約外コミットが複数ある
- CONTRIBUTING はブランチ名を `loginlogout` 等と定めつつ、手順例は `git checkout -b feature/作業内容` になっており不一致
- `app/utils/schema.tsx` の `CSVRow` は `名前` を持つが、`management/page.tsx:72,81,103` は `学生氏名` を読み書きしている

**やること**
- [ ] 上記を実装に合わせて修正する
- [ ] `.env.example` を追加する
