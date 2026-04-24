package main

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
)

type Memo struct {
	Date    string `json:"date"`
	Content string `json:"content"`
}

var (
	memos = make(map[string]string)
	mu    sync.Mutex
)

func main() {
	r := gin.Default()

	// メモの取得 (GET /memo?date=2026-01-12)
	r.GET("/memo", func(c *gin.Context) {
		date := c.Query("date")
		mu.Lock()
		content := memos[date]
		mu.Unlock()
		c.JSON(http.StatusOK, gin.H{"date": date, "content": content})
	})

	// メモの保存 (POST /memo)
	r.POST("/memo", func(c *gin.Context) {
		var newMemo Memo
		if err := c.ShouldBindJSON(&newMemo); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		mu.Lock()
		memos[newMemo.Date] = newMemo.Content
		mu.Unlock()

		c.JSON(http.StatusOK, gin.H{"message": "saved!"})
	})

	r.Run(":8080")
}
