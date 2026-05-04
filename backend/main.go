package main

import (
	"log"
	"net/http"

	"club-app/function"
	"club-app/utility"
)

func main() {
	utility.ConnectSQL()

	http.Handle("/saveEvent", utility.AppHandler(function.SaveNote))
	http.Handle("/getMonthEvents", utility.AppHandler(function.GetMonthNotes))

	log.Printf("Server started at :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal(err)
	}
}
