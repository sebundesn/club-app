package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"club-app/auth"
	"club-app/function"
	"club-app/utility"
)

func main() {
	utility.ConnectSQL()
	defer utility.DB.Close()
	defer utility.Store.Close()
	defer utility.Store.StopCleanup(utility.Store.Cleanup(time.Hour))

	fs := http.FileServer(http.Dir("./uploads"))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", fs))

	http.Handle("/saveEvent", utility.AppHandler(function.SaveNote))
	http.Handle("/getMonthEvents", utility.AppHandler(function.GetMonthNotes))
	http.Handle("/getDateEvent", utility.AppHandler(function.GetDateEvent))
	http.Handle("/accountInfo", utility.AppHandler(function.GetAccountInfo))
	http.Handle("/getMoneySum", utility.AppHandler(function.GetMoneyTotal))
	http.Handle("/addMoneyLog", utility.AppHandler(function.SaveMoneyLog))
	http.Handle("/getReceiptsInfo", utility.AppHandler(function.GetMonthReceipts))
	http.Handle("/uploadReceipt", utility.AppHandler(function.UploadReceipt))
	http.Handle("/login", utility.AppHandler(auth.LoginHandler))
	http.Handle("/updateMembers", utility.AppHandler(auth.UpdateMembers))
	http.Handle("/deleteImage", utility.AppHandler(function.DeleteImg))
	http.Handle("/deleteMoneyLog", utility.AppHandler(function.DeleteMoneyLog))
	http.Handle("/getMembers", utility.AppHandler(function.FetchMembers))

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
