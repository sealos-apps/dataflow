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
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/clidey/whodb/core/src/engine"
	"github.com/go-redis/redis/v8"
)

// kvPairCommands is the set of Redis commands whose []any reply is a flat
// [field, value, field, value, …] list that should be rendered as two columns.
var kvPairCommands = map[string]bool{
	"HGETALL":   true,
	"CONFIG":    true,
	"XRANGE":    true,
	"XREVRANGE": true,
}

// RawExecute executes an arbitrary Redis command expressed as a single query
// string and returns the result formatted as a GetRowsResult.
func (p *RedisPlugin) RawExecute(config *engine.PluginConfig, query string, _ ...any) (*engine.GetRowsResult, error) {
	tokens := tokenizeRedisCommand(query)
	if len(tokens) == 0 {
		return nil, errors.New("empty Redis command")
	}

	client, err := DB(config)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	ctx := context.Background()

	args := make([]any, len(tokens))
	for i, t := range tokens {
		args[i] = t
	}

	result, err := client.Do(ctx, args...).Result()
	if err != nil {
		if err == redis.Nil {
			return formatRedisResult(strings.ToUpper(tokens[0]), nil), nil
		}
		return nil, err
	}

	return formatRedisResult(strings.ToUpper(tokens[0]), result), nil
}

// formatRedisResult converts a raw Redis reply into a GetRowsResult.
func formatRedisResult(command string, result any) *engine.GetRowsResult {
	switch v := result.(type) {
	case nil:
		return singleValueResult("value", "(nil)")
	case string:
		return singleValueResult("value", v)
	case int64:
		return singleValueResult("value", strconv.FormatInt(v, 10))
	case []any:
		if kvPairCommands[command] && len(v)%2 == 0 {
			return kvPairResult(v)
		}
		return indexedListResult(v)
	default:
		return singleValueResult("value", fmt.Sprintf("%v", v))
	}
}

// singleValueResult returns a one-column, one-row result.
func singleValueResult(name, value string) *engine.GetRowsResult {
	return &engine.GetRowsResult{
		Columns:       []engine.Column{{Name: name, Type: "string"}},
		Rows:          [][]string{{value}},
		DisableUpdate: true,
		TotalCount:    1,
	}
}

// kvPairResult renders a flat [field, value, …] slice as two columns: "field" and "value".
func kvPairResult(flat []any) *engine.GetRowsResult {
	rows := make([][]string, 0, len(flat)/2)
	for i := 0; i+1 < len(flat); i += 2 {
		field := fmt.Sprintf("%v", flat[i])
		value := fmt.Sprintf("%v", flat[i+1])
		rows = append(rows, []string{field, value})
	}
	return &engine.GetRowsResult{
		Columns:       []engine.Column{{Name: "field", Type: "string"}, {Name: "value", Type: "string"}},
		Rows:          rows,
		DisableUpdate: true,
		TotalCount:    int64(len(rows)),
	}
}

// indexedListResult renders a []any as two columns: "index" and "value".
func indexedListResult(items []any) *engine.GetRowsResult {
	rows := make([][]string, len(items))
	for i, item := range items {
		rows[i] = []string{strconv.Itoa(i), fmt.Sprintf("%v", item)}
	}
	return &engine.GetRowsResult{
		Columns:       []engine.Column{{Name: "index", Type: "string"}, {Name: "value", Type: "string"}},
		Rows:          rows,
		DisableUpdate: true,
		TotalCount:    int64(len(rows)),
	}
}

// tokenizeRedisCommand splits a Redis command string into tokens, respecting
// single- and double-quoted strings so that quoted whitespace is preserved as
// part of a single token.
func tokenizeRedisCommand(input string) []string {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil
	}

	var tokens []string
	var current strings.Builder
	inDouble := false
	inSingle := false

	for i := 0; i < len(input); i++ {
		b := input[i]
		switch {
		case b == '"' && !inSingle:
			inDouble = !inDouble
		case b == '\'' && !inDouble:
			inSingle = !inSingle
		case (b == ' ' || b == '\t' || b == '\n' || b == '\r') && !inDouble && !inSingle:
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
		default:
			current.WriteByte(b)
		}
	}

	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}

	return tokens
}
