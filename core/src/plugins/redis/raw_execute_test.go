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

package redis

import (
	"testing"
)

func TestTokenize_Simple(t *testing.T) {
	tokens := tokenizeRedisCommand("GET mykey")
	if len(tokens) != 2 {
		t.Fatalf("expected 2 tokens, got %d", len(tokens))
	}
	if tokens[0] != "GET" || tokens[1] != "mykey" {
		t.Errorf("unexpected tokens: %v", tokens)
	}
}

func TestTokenize_QuotedString(t *testing.T) {
	tokens := tokenizeRedisCommand(`SET mykey "hello world"`)
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens, got %d", len(tokens))
	}
	if tokens[2] != "hello world" {
		t.Errorf("expected last token to be \"hello world\", got %q", tokens[2])
	}
}

func TestTokenize_SingleQuoted(t *testing.T) {
	tokens := tokenizeRedisCommand("SET mykey 'hello world'")
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens, got %d", len(tokens))
	}
	if tokens[2] != "hello world" {
		t.Errorf("expected last token to be \"hello world\", got %q", tokens[2])
	}
}

func TestTokenize_MultipleArgs(t *testing.T) {
	tokens := tokenizeRedisCommand("HSET myhash field1 value1 field2 value2")
	if len(tokens) != 6 {
		t.Fatalf("expected 6 tokens, got %d", len(tokens))
	}
}

func TestTokenize_Multiline(t *testing.T) {
	tokens := tokenizeRedisCommand("SET\n  mykey\n  myvalue")
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens, got %d: %v", len(tokens), tokens)
	}
	if tokens[0] != "SET" || tokens[1] != "mykey" || tokens[2] != "myvalue" {
		t.Errorf("unexpected tokens: %v", tokens)
	}
}

func TestTokenize_Empty(t *testing.T) {
	tokens := tokenizeRedisCommand("")
	if len(tokens) != 0 {
		t.Fatalf("expected 0 tokens, got %d", len(tokens))
	}
}

func TestFormatRedisResult_String(t *testing.T) {
	result := formatRedisResult("GET", "hello")
	if len(result.Columns) != 1 || result.Columns[0].Name != "value" {
		t.Fatalf("expected 1 column named 'value', got %v", result.Columns)
	}
	if len(result.Rows) != 1 || result.Rows[0][0] != "hello" {
		t.Errorf("expected row value 'hello', got %v", result.Rows)
	}
}

func TestFormatRedisResult_Integer(t *testing.T) {
	result := formatRedisResult("DBSIZE", int64(42))
	if len(result.Rows) != 1 || result.Rows[0][0] != "42" {
		t.Errorf("expected row value '42', got %v", result.Rows)
	}
}

func TestFormatRedisResult_HashPairs(t *testing.T) {
	result := formatRedisResult("HGETALL", []any{"name", "Alice", "age", "30"})
	if len(result.Columns) != 2 || result.Columns[0].Name != "field" || result.Columns[1].Name != "value" {
		t.Fatalf("expected columns [field, value], got %v", result.Columns)
	}
	if len(result.Rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(result.Rows))
	}
	if result.Rows[0][0] != "name" || result.Rows[0][1] != "Alice" {
		t.Errorf("unexpected first row: %v", result.Rows[0])
	}
	if result.Rows[1][0] != "age" || result.Rows[1][1] != "30" {
		t.Errorf("unexpected second row: %v", result.Rows[1])
	}
}

func TestFormatRedisResult_List(t *testing.T) {
	result := formatRedisResult("LRANGE", []any{"a", "b", "c"})
	if len(result.Columns) != 2 || result.Columns[0].Name != "index" || result.Columns[1].Name != "value" {
		t.Fatalf("expected columns [index, value], got %v", result.Columns)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("expected 3 rows, got %d", len(result.Rows))
	}
	if result.Rows[0][0] != "0" || result.Rows[2][1] != "c" {
		t.Errorf("unexpected rows: %v", result.Rows)
	}
}

func TestFormatRedisResult_Nil(t *testing.T) {
	result := formatRedisResult("GET", nil)
	if len(result.Rows) != 1 || result.Rows[0][0] != "(nil)" {
		t.Errorf("expected '(nil)' row, got %v", result.Rows)
	}
}

func TestFormatRedisResult_EmptyArray(t *testing.T) {
	result := formatRedisResult("KEYS", []any{})
	if len(result.Rows) != 0 {
		t.Errorf("expected 0 rows, got %d", len(result.Rows))
	}
}
