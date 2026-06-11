package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"club-app/middleware"
	"club-app/feature"
	"club-app/util"
)

func main() {
	util.ConnectSQL()
	defer util.DB.Close()
	defer util.Store.Close()
	defer util.Store.StopCleanup(util.Store.Cleanup(time.Hour))

	fs := http.FileServer(http.Dir("./uploads"))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", fs))

	http.Handle("/saveEvent", util.AppHandler(feature.SaveNote))
	http.Handle("/getMonthEvents", util.AppHandler(feature.GetMonthNotes))
	http.Handle("/getDateEvent", util.AppHandler(feature.GetDateEvent))
	http.Handle("/accountInfo", util.AppHandler(feature.GetAccountInfo))
	http.Handle("/getMoneySum", util.AppHandler(feature.GetMoneyTotal))
	http.Handle("/addMoneyLog", util.AppHandler(feature.SaveMoneyLog))
	http.Handle("/getReceiptsInfo", util.AppHandler(feature.GetMonthReceipts))
	http.Handle("/uploadReceipt", util.AppHandler(feature.UploadReceipt))
	http.Handle("/login", util.AppHandler(middleware.LoginHandler))
	http.Handle("/updateMembers", util.AppHandler(feature.UpdateMembers))
	http.Handle("/deleteImage", util.AppHandler(feature.DeleteImg))
	http.Handle("/deleteMoneyLog", util.AppHandler(feature.DeleteMoneyLog))
	http.Handle("/getMembers", util.AppHandler(feature.FetchMembers))
	http.Handle("/checkAuth", util.AppHandler(middleware.CheckAuthHandler))
	http.Handle("/logout", util.AppHandler(feature.Logout))
	http.Handle("/firstLogin", util.AppHandler(feature.FirstLogin))

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
