package utility

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"club-app/SQLquery"

	"github.com/antonlindstrom/pgstore"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var DB *sql.DB
var Store *pgstore.PGStore

func ConnectSQL() {
	_ = godotenv.Load()

	//ここ本番なら変える
	connStr := os.Getenv("DATABASE_URL")

	var err error
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

	_, err = DB.Exec(SQLquery.CreateEventsTable_Q)
	if err != nil {
		log.Fatal(err)
	}
	_, err = DB.Exec(SQLquery.AccountLogTable)
	if err != nil {
		log.Fatal(err)
	}
	_, err = DB.Exec(SQLquery.ReceiptImagesTable)
	if err != nil {
		log.Fatal(err)
	}

	_, err = DB.Exec(SQLquery.UserTable)
	if err != nil {
		log.Fatal(err)
	}

	_, err = DB.Exec(SQLquery.Todotable)
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
