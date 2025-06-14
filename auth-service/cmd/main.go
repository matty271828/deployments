package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/matty271828/auth-service/internal/server"
)

func main() {
	// Create and start the server
	srv := server.NewServer(8080)

	// Start server in a goroutine
	go func() {
		if err := srv.Start(); err != nil {
			log.Printf("Server error: %v\n", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v\n", err)
	}
}
