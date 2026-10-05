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
	http.Handle("/api/auth/line/login", util.AppHandler(feature.LineLogin))
	http.Handle("/api/auth/line/callback", util.AppHandler(feature.LineCallback))
	http.Handle("/api/auth/line/link", util.AppHandler(feature.LinkLineAccount))
	http.Handle("/api/checkAuth", util.AppHandler(middleware.CheckAuthHandler))
	http.Handle("/api/logout", util.AppHandler(feature.Logout))
	http.Handle("/api/firstLogin", util.AppHandler(feature.FirstLogin))

	// カレンダー / イベント
	http.Handle("/api/saveEvent", util.AppHandler(feature.SaveNote))
	http.Handle("/api/getMonthEvents", util.AppHandler(feature.GetMonthNotes))
	http.Handle("/api/getDateEvent", util.AppHandler(feature.GetDateEvents))
	http.Handle("/api/getNotification", util.AppHandler(feature.GetNotificate))

	// 会計
	http.Handle("/api/accountInfo", util.AppHandler(feature.GetAccountInfo))
	http.Handle("/api/getMoneySum", util.AppHandler(feature.GetMoneyTotal))
	http.Handle("/api/addMoneyLog", util.AppHandler(feature.SaveMoneyLog))
	http.Handle("/api/deleteMoneyLog", util.AppHandler(feature.DeleteMoneyLog))

	// レシート
	http.Handle("/api/getReceiptsInfo", util.AppHandler(feature.GetMonthReceipts))
	http.Handle("/api/uploadReceipt", util.AppHandler(feature.UploadReceipt))
	http.Handle("/api/deleteImage", util.AppHandler(feature.DeleteImg))

	// 部員 / 参加者
	http.Handle("/api/getClubMembers", util.AppHandler(feature.GetAllClubMembers))
	http.Handle("/api/fetchMembersAndPayment", util.AppHandler(feature.GetMembersWithPayment))
	http.Handle("/api/takePartIn", util.AppHandler(feature.TakePartIn))

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
