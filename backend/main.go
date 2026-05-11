package main

import (
	"log"
	"net/http"
	"os"

	"club-app/function"
	"club-app/utility"
)

func main() {
	utility.ConnectSQL()

	http.Handle("/saveEvent", utility.AppHandler(function.SaveNote))
	http.Handle("/getMonthEvents", utility.AppHandler(function.GetMonthNotes))
	http.Handle("/getDateEvent", utility.AppHandler(function.GetDateEvent))
	http.Handle("/accountInfo", utility.AppHandler(function.GetAccountInfo))
	http.Handle("/getMoneySum", utility.AppHandler(function.GetMoneyTotal))
	http.Handle("/addMoneyLog", utility.AppHandler(function.SaveMoneyLog))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server started at :%s", port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal(err)
	}
}
