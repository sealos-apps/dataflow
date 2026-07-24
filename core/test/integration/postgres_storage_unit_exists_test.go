//go:build integration

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

package integration

import (
	"testing"

	"github.com/clidey/whodb/core/src/engine"
)

// TestPostgresStorageUnitExistsPreservesRawIdentifiers verifies PostgreSQL relation lookup with raw names.
func TestPostgresStorageUnitExistsPreservesRawIdentifiers(t *testing.T) {
	var postgresTarget *target
	for i := range targets {
		if targets[i].plugin.Type == engine.DatabaseType_Postgres {
			postgresTarget = &targets[i]
			break
		}
	}
	if postgresTarget == nil {
		t.Skip("postgres target not configured")
	}

	tests := []struct {
		name        string
		storageUnit string
		createQuery string
		dropQuery   string
	}{
		{
			name:        "lowercase",
			storageUnit: "intg_exists_lowercase",
			createQuery: `CREATE TABLE public."intg_exists_lowercase" (id integer)`,
			dropQuery:   `DROP TABLE IF EXISTS public."intg_exists_lowercase"`,
		},
		{
			name:        "camel case",
			storageUnit: "intgExistsCamelCase",
			createQuery: `CREATE TABLE public."intgExistsCamelCase" (id integer)`,
			dropQuery:   `DROP TABLE IF EXISTS public."intgExistsCamelCase"`,
		},
		{
			name:        "space",
			storageUnit: "intg exists space",
			createQuery: `CREATE TABLE public."intg exists space" (id integer)`,
			dropQuery:   `DROP TABLE IF EXISTS public."intg exists space"`,
		},
		{
			name:        "dot",
			storageUnit: "intg.exists.dot",
			createQuery: `CREATE TABLE public."intg.exists.dot" (id integer)`,
			dropQuery:   `DROP TABLE IF EXISTS public."intg.exists.dot"`,
		},
		{
			name:        "double quote",
			storageUnit: `intg_exists_double"quote`,
			createQuery: `CREATE TABLE public."intg_exists_double""quote" (id integer)`,
			dropQuery:   `DROP TABLE IF EXISTS public."intg_exists_double""quote"`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, test.dropQuery); err != nil {
				t.Fatalf("failed to remove stale fixture: %v", err)
			}
			t.Cleanup(func() {
				if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, test.dropQuery); err != nil {
					t.Errorf("failed to clean up fixture: %v", err)
				}
			})

			if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, test.createQuery); err != nil {
				t.Fatalf("failed to create fixture: %v", err)
			}

			exists, err := postgresTarget.plugin.StorageUnitExists(
				postgresTarget.config,
				postgresTarget.schema,
				test.storageUnit,
			)
			if err != nil {
				t.Fatalf("StorageUnitExists returned an error: %v", err)
			}
			if !exists {
				t.Fatalf("expected raw storage unit name %q to exist", test.storageUnit)
			}
		})
	}

	t.Run("special schema", func(t *testing.T) {
		const (
			schema      = `intg.Exists"Schema`
			storageUnit = "intg_exists_special_schema"
			dropQuery   = `DROP SCHEMA IF EXISTS "intg.Exists""Schema" CASCADE`
		)

		if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, dropQuery); err != nil {
			t.Fatalf("failed to remove stale schema fixture: %v", err)
		}
		t.Cleanup(func() {
			if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, dropQuery); err != nil {
				t.Errorf("failed to clean up schema fixture: %v", err)
			}
		})

		if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, `CREATE SCHEMA "intg.Exists""Schema"`); err != nil {
			t.Fatalf("failed to create schema fixture: %v", err)
		}
		if _, err := postgresTarget.plugin.RawExecute(postgresTarget.config, `CREATE TABLE "intg.Exists""Schema"."intg_exists_special_schema" (id integer)`); err != nil {
			t.Fatalf("failed to create table fixture: %v", err)
		}

		exists, err := postgresTarget.plugin.StorageUnitExists(postgresTarget.config, schema, storageUnit)
		if err != nil {
			t.Fatalf("StorageUnitExists returned an error: %v", err)
		}
		if !exists {
			t.Fatalf("expected raw schema %q and storage unit %q to exist", schema, storageUnit)
		}
	})

	exists, err := postgresTarget.plugin.StorageUnitExists(
		postgresTarget.config,
		postgresTarget.schema,
		"intg_exists_missing",
	)
	if err != nil {
		t.Fatalf("StorageUnitExists returned an error for a missing relation: %v", err)
	}
	if exists {
		t.Fatal("expected missing relation not to exist")
	}
}
