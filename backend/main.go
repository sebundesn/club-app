package main

import (
	"context"
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

	if err := feature.InitMedia(context.Background()); err != nil {
		log.Fatal(err)
	}
	feature.CleanupStaleMedia()
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

	// 入部申請の承認と部員の役職(部長・副部長)
	http.Handle("/api/applications", util.AppHandler(feature.GetApplications))
	http.Handle("/api/decideApplication", util.AppHandler(feature.DecideApplication))
	http.Handle("/api/members", util.AppHandler(feature.GetMembers))
	http.Handle("/api/setRoles", util.AppHandler(feature.SetRoles))

	// カレンダー / イベント
	http.Handle("/api/saveEvent", util.AppHandler(feature.SaveNote))
	http.Handle("/api/getMonthEvents", util.AppHandler(feature.GetMonthNotes))
	http.Handle("/api/getDateEvent", util.AppHandler(feature.GetDateEvents))
	http.Handle("/api/uploadEventFile", util.AppHandler(feature.UploadEventFile))
	http.Handle("/api/deleteEventFile", util.AppHandler(feature.DeleteEventFile))

	// 会計
	http.Handle("/api/accountInfo", util.AppHandler(feature.GetAccountInfo))
	http.Handle("/api/getMoneySum", util.AppHandler(feature.GetMoneyTotal))
	http.Handle("/api/addMoneyLog", util.AppHandler(feature.SaveMoneyLog))
	http.Handle("/api/deleteMoneyLog", util.AppHandler(feature.DeleteMoneyLog))

	// レシート
	http.Handle("/api/getReceiptsInfo", util.AppHandler(feature.GetReceipts))
	http.Handle("/api/uploadReceipt", util.AppHandler(feature.UploadReceipt))
	http.Handle("/api/deleteImage", util.AppHandler(feature.DeleteImg))

	// アルバム(写真・動画)
	http.Handle("/api/uploadMedia", util.AppHandler(feature.UploadMedia))
	http.Handle("/api/getAlbum", util.AppHandler(feature.GetAlbum))
	http.Handle("/api/getAlbums", util.AppHandler(feature.GetAlbums))
	http.Handle("/api/deleteMedia", util.AppHandler(feature.DeleteMedia))

	// 部費の未払い
	http.Handle("/api/myUnpaid", util.AppHandler(feature.GetMyUnpaid))
	http.Handle("/api/allUnpaid", util.AppHandler(feature.GetAllUnpaid))
	http.Handle("/api/allPayments", util.AppHandler(feature.GetAllPayments))
	http.Handle("/api/setPaid", util.AppHandler(feature.SetPaid))
	http.Handle("/api/setEventFee", util.AppHandler(feature.SetEventFee))

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
