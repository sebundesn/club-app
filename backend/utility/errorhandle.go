package utility

import (
	"log"
	"net/http"
)

// the handler that returns back error
type AppHandler func(http.ResponseWriter, *http.Request) error

func (fn AppHandler) ServeHTTP(w http.ResponseWriter, r *http.Request){
	SetCorsHeader(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if err := fn(w, r); err != nil {
		log.Printf("Error: %v", err)
		http.Error(w, "失敗しました。", http.StatusInternalServerError)
	}
}

//http.Error = func Error(w ResponseWriter, error string, code int)
