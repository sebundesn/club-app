package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"club-app/feature"
	"club-app/middleware"
	"club-app/util"
)

func main() {
	util.ConnectSQL()
	defer util.DB.Close()
	defer util.Store.Close()
	defer util.Store.StopCleanup(util.Store.Cleanup(time.Hour))

	fs := http.FileServer(http.Dir("./uploads"))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", fs))

	// 認証（LINEログイン）
	http.Handle("/auth/line/login", util.AppHandler(feature.LineLogin))
	http.Handle("/auth/line/callback", util.AppHandler(feature.LineCallback))
	http.Handle("/auth/line/link", util.AppHandler(feature.LinkLineAccount))
	http.Handle("/checkAuth", util.AppHandler(middleware.CheckAuthHandler))
	http.Handle("/logout", util.AppHandler(feature.Logout))
	http.Handle("/firstLogin", util.AppHandler(feature.FirstLogin))

	// カレンダー / イベント
	http.Handle("/saveEvent", util.AppHandler(feature.SaveNote))
	http.Handle("/getMonthEvents", util.AppHandler(feature.GetMonthNotes))
	http.Handle("/getDateEvent", util.AppHandler(feature.GetDateEvents))
	http.Handle("/getNotification", util.AppHandler(feature.GetNotificate))

	// 会計
	http.Handle("/accountInfo", util.AppHandler(feature.GetAccountInfo))
	http.Handle("/getMoneySum", util.AppHandler(feature.GetMoneyTotal))
	http.Handle("/addMoneyLog", util.AppHandler(feature.SaveMoneyLog))
	http.Handle("/deleteMoneyLog", util.AppHandler(feature.DeleteMoneyLog))

	// レシート
	http.Handle("/getReceiptsInfo", util.AppHandler(feature.GetMonthReceipts))
	http.Handle("/uploadReceipt", util.AppHandler(feature.UploadReceipt))
	http.Handle("/deleteImage", util.AppHandler(feature.DeleteImg))

	// 部員 / 参加者
	http.Handle("/getClubMembers", util.AppHandler(feature.GetAllClubMembers))
	http.Handle("/fetchMembersAndPayment", util.AppHandler(feature.GetMembersWithPayment))
	http.Handle("/takePartIn", util.AppHandler(feature.TakePartIn))

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
