package connection

import (
	"database/sql"
	"net/http"
	"log"
	"club-app/queries"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func ConnectSql(){
	//ここ本番なら変える
	connStr := "user=postgres password=password dbname=club_db sslmode=disable"

	DB, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal(err)
	}

	_, err = DB.Exec(queries.CreateEventsTable_Q)
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