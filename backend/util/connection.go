package util

import (
	"database/sql"
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
	// .envファイルを読み込む（エラーハンドリング付き）
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// DATABASE_URLがない場合は個別の環境変数から組み立てる
		host := os.Getenv("DB_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "5432"
		}
		user := os.Getenv("DB_USER")
		if user == "" {
			user = "yuito" // デフォルト（問題の原因だった箇所）
		}
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

	_, err = DB.Exec(query.CreateEventsTable_Q)
	if err != nil {
		log.Fatal(err)
	}
	_, err = DB.Exec(query.AccountLogTable)
	if err != nil {
		log.Fatal(err)
	}
	_, err = DB.Exec(query.ReceiptImagesTable)
	if err != nil {
		log.Fatal(err)
	}

	_, err = DB.Exec(query.UserTable)
	if err != nil {
		log.Fatal(err)
	}
}

func SetCorsHeader(w http.ResponseWriter) {
	//ここ本番なら変える

	frontend := os.Getenv("FRONTEND_URL")
	if frontend == "" {
		frontend = "http://localhost:3000"
	}

	w.Header().Set("Access-Control-Allow-Origin", frontend)
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
}
