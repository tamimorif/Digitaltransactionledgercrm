package api

import (
    "github.com/gorilla/mux"
)

// InitializeRouter initializes the API router
func InitializeRouter() *mux.Router {
    router := mux.NewRouter()
    
    // Define your routes here
    // router.HandleFunc("/transactions", TransactionHandler).Methods("GET")
    
    return router
}