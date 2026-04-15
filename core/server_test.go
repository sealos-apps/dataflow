/*
 * Copyright 2026 Clidey, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package main

import (
	"context"
	"embed"
	"errors"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/clidey/whodb/core/src"
	"github.com/clidey/whodb/core/src/log"
	"github.com/clidey/whodb/core/src/router"
)

//go:embed build/*
var staticFilesTest embed.FS

func TestMain(m *testing.M) {
	log.Info("Starting WhoDB in test mode...")

	src.InitializeEngine()
	r := router.InitializeRouter(staticFilesTest)

	srv := &http.Server{
		Addr:              ":0",
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      1 * time.Minute,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		log.Info("Server starting...")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %s", err)
		}
	}()

	log.Info("WhoDB test server running")

	code := m.Run()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Errorf("Graceful shutdown failed: %v", err)
	}

	log.Info("Test server shut down. Exiting and writing coverage.")
	os.Exit(code)
}
