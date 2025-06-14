package api

import "net/http"

const (
	BaseURL = "worker"
)

type APIServer struct {
}

func NewAPIServer() *APIServer {
	return &APIServer{}
}

func (s *APIServer) Start() {
	http.ListenAndServe(":9000", nil)
}

func (s *APIServer) registerEndpoints() {

}
