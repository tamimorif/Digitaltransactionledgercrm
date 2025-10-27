package main

import (
    "log"
    "net/http"
    "go-transaction-service/internal/api"
)

func main() {
    router := api.NewRouter()
    log.Println("Starting server on :8080")
    if err := http.ListenAndServe(":8080", router); err != nil {
        log.Fatalf("Could not start server: %s\n", err)
    }
}