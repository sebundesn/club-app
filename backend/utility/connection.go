package utility

import (
	"club-app/SQLquery"
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var DB *sql.DB

func ConnectSQL() {
	_ = godotenv.Load()

	//ここ本番なら変える
	connStr := os.Getenv("DATABASE_URL")

	var err error
	DB, err = sql.Open("postgres", connStr)
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
}

func SetCorsHeader(w http.ResponseWriter) {
	//ここ本番なら変える
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}
