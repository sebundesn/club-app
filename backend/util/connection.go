package util

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"club-app/query"

	"github.com/antonlindstrom/pgstore"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var DB *sql.DB
var Store *pgstore.PGStore

func ConnectSQL() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		host := os.Getenv("DB_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "5432"
		}
		user := os.Getenv("DB_USER")
		password := os.Getenv("DB_PASSWORD")
		dbname := os.Getenv("DB_NAME")
		if dbname == "" {
			dbname = "club_db"
		}
		connStr = "postgres://" + user + ":" + password + "@" + host + ":" + port + "/" + dbname + "?sslmode=disable"
		log.Println("Using constructed DATABASE_URL from individual env vars")
	}

	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}

	secretKey := os.Getenv("SESSION_SECRET_KEY")
	Store, err = pgstore.NewPGStore(connStr, []byte(secretKey))
	if err != nil {
		log.Fatal(err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal(err)
	}

	if err := migrate(); err != nil {
		log.Fatal(err)
	}
}

// migrate は起動時のテーブル作成をまとめて流す。
// 以前は1つずつ手書きしていて、最後の1つだけエラーチェックが漏れていた。
// 名前付きにしているので、失敗したマイグレーションがログで分かる。
func migrate() error {
	migrations := []struct {
		name  string
		query string
	}{
		{"events", query.CreateEventsTable_Q},
		{"events: drop date unique", query.DropEventsDateUnique},
		{"events: date index", query.CreateEventsDateIndex},
		{"accountLog", query.AccountLogTable},
		{"receipt_images", query.ReceiptImagesTable},
		{"users", query.UserTable},
		{"users: line_user_id column", query.AddLineUserIDColumn},
		{"users: line_user_id index", query.AddLineUserIDIndex},
		{"notificate", query.CreateNotificateTable},
		{"event_members", query.CreateEventMembers},
	}

	for _, m := range migrations {
		if _, err := DB.Exec(m.query); err != nil {
			return fmt.Errorf("migration %q failed: %w", m.name, err)
		}
	}

	return nil
}

func SetCorsHeader(w http.ResponseWriter) {
	frontend := os.Getenv("FRONTEND_URL")
	if frontend == "" {
		frontend = "http://localhost:3000"
	}

	w.Header().Set("Access-Control-Allow-Origin", frontend)
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
}
