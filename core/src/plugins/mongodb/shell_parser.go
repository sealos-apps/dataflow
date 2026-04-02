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

package mongodb

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// shellCommand holds the parsed components of a MongoDB shell command.
type shellCommand struct {
	Collection string
	Method     string
	RawArgs    string
}

// shellCommandPattern matches MongoDB shell syntax: db.<collection>.<method>(<args>)
// The (?s) flag allows '.' to match newlines so multi-line argument blocks are captured.
var shellCommandPattern = regexp.MustCompile(`(?s)^\s*db\.([a-zA-Z_][\w.]*?)\.(\w+)\s*\((.*)\)\s*;?\s*$`)
var getCollectionCommandPattern = regexp.MustCompile(`(?s)^\s*db\.getCollection\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\)\.(\w+)\s*\((.*)\)\s*;?\s*$`)
var databaseCommandPattern = regexp.MustCompile(`(?s)^\s*db\.(\w+)\s*\((.*)\)\s*;?\s*$`)

// parseShellCommand parses a MongoDB shell command string such as
// `db.users.find({ "age": { "$gt": 25 } })` into its components.
// It strips comments before matching so inline and block comments are ignored.
func parseShellCommand(input string) (*shellCommand, error) {
	cleaned := stripComments(input)
	matches := shellCommandPattern.FindStringSubmatch(cleaned)
	if matches != nil {
		return &shellCommand{
			Collection: matches[1],
			Method:     matches[2],
			RawArgs:    strings.TrimSpace(matches[3]),
		}, nil
	}

	matches = getCollectionCommandPattern.FindStringSubmatch(cleaned)
	if matches != nil {
		collection, err := strconv.Unquote(matches[1])
		if err != nil {
			return nil, fmt.Errorf("invalid getCollection argument: %w", err)
		}

		return &shellCommand{
			Collection: collection,
			Method:     matches[2],
			RawArgs:    strings.TrimSpace(matches[3]),
		}, nil
	}

	matches = databaseCommandPattern.FindStringSubmatch(cleaned)
	if matches != nil {
		return &shellCommand{
			Collection: "",
			Method:     matches[1],
			RawArgs:    strings.TrimSpace(matches[2]),
		}, nil
	}

	return nil, fmt.Errorf("not a valid MongoDB shell command: %s", truncate(strings.TrimSpace(input), 80))
}

// stripComments removes single-line (//) and block (/* */) comments from s.
func stripComments(s string) string {
	// Remove block comments first, then single-line comments.
	var b strings.Builder
	i := 0
	for i < len(s) {
		if i+1 < len(s) && s[i] == '/' && s[i+1] == '*' {
			// Skip until closing */
			end := strings.Index(s[i+2:], "*/")
			if end == -1 {
				// Unclosed block comment — skip to end of string.
				break
			}
			i = i + 2 + end + 2
			continue
		}
		if i+1 < len(s) && s[i] == '/' && s[i+1] == '/' {
			// Skip until end of line.
			end := strings.IndexByte(s[i:], '\n')
			if end == -1 {
				break
			}
			i += end
			continue
		}
		b.WriteByte(s[i])
		i++
	}
	return b.String()
}

// truncate returns s truncated to n runes, appending "..." when truncation occurs.
func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}

// unquotedKeyPattern matches unquoted object keys in JS object literals so they
// can be replaced with double-quoted JSON keys.
var unquotedKeyPattern = regexp.MustCompile(`(?m)([\{,]\s*)([a-zA-Z_$][\w$]*)\s*:`)

// trailingCommaPattern matches trailing commas before a closing brace or bracket.
var trailingCommaPattern = regexp.MustCompile(`,\s*([\}\]])`)

// preprocessJS converts MongoDB shell JS constructs in s to valid JSON-compatible
// syntax. It handles ObjectId, new Date, ISODate, NumberInt, NumberLong,
// single-quoted strings, unquoted object keys, and trailing commas.
func preprocessJS(s string) string {
	// ObjectId("hex") → {"$oid":"hex"}
	s = regexp.MustCompile(`ObjectId\("([^"]+)"\)`).ReplaceAllString(s, `{"$$oid":"$1"}`)

	// new Date("str") → {"$date":"str"}
	s = regexp.MustCompile(`new\s+Date\("([^"]*)"\)`).ReplaceAllString(s, `{"$$date":"$1"}`)

	// new Date() with no args → {"$date":"<current UTC RFC3339>"}
	now := time.Now().UTC().Format(time.RFC3339)
	s = regexp.MustCompile(`new\s+Date\(\s*\)`).ReplaceAllString(s, `{"$$date":"`+now+`"}`)

	// ISODate("str") → {"$date":"str"}
	s = regexp.MustCompile(`ISODate\("([^"]*)"\)`).ReplaceAllString(s, `{"$$date":"$1"}`)

	// NumberInt(n) → n
	s = regexp.MustCompile(`NumberInt\((\d+)\)`).ReplaceAllString(s, `$1`)

	// NumberLong(n) → n
	s = regexp.MustCompile(`NumberLong\((\d+)\)`).ReplaceAllString(s, `$1`)

	// Single-quoted strings → double-quoted
	s = replaceSingleQuotedStrings(s)

	// Unquoted object keys → quoted
	s = unquotedKeyPattern.ReplaceAllString(s, `${1}"$2":`)

	// Trailing commas before } or ] → removed
	s = trailingCommaPattern.ReplaceAllString(s, `$1`)

	return s
}

// convertExtendedJSON recursively walks a parsed JSON value and converts
// Extended JSON markers to BSON types. Recognised markers:
//   - {"$oid": "<hex24>"}  → primitive.ObjectID
//   - {"$date": "<str>"}   → primitive.DateTime (RFC3339 or "2006-01-02")
func convertExtendedJSON(v any) any {
	switch val := v.(type) {
	case map[string]any:
		if len(val) == 1 {
			if hex, ok := val["$oid"].(string); ok {
				if oid, err := primitive.ObjectIDFromHex(hex); err == nil {
					return oid
				}
			}
			if s, ok := val["$date"].(string); ok {
				t, err := time.Parse(time.RFC3339, s)
				if err != nil {
					t, err = time.Parse("2006-01-02", s)
				}
				if err == nil {
					return primitive.NewDateTimeFromTime(t)
				}
			}
		}
		for k, item := range val {
			val[k] = convertExtendedJSON(item)
		}
		return val
	case []any:
		for i, item := range val {
			val[i] = convertExtendedJSON(item)
		}
		return val
	default:
		return v
	}
}

// parseArgs preprocesses and parses the raw argument string from a MongoDB
// shell command into a slice of Go values. Extended JSON markers such as
// {"$oid": "..."} and {"$date": "..."} are converted to BSON types.
// Returns nil, nil when rawArgs is empty.
func parseArgs(rawArgs string) ([]any, error) {
	if rawArgs == "" {
		return nil, nil
	}
	processed := preprocessJS(rawArgs)
	wrapped := "[" + processed + "]"
	var args []any
	if err := json.Unmarshal([]byte(wrapped), &args); err != nil {
		return nil, fmt.Errorf("failed to parse arguments: %w", err)
	}
	for i, arg := range args {
		args[i] = convertExtendedJSON(arg)
	}
	return args, nil
}

// replaceSingleQuotedStrings converts single-quoted string literals in s to
// double-quoted ones. It skips single quotes that appear inside already
// double-quoted strings so it does not corrupt valid JSON strings.
func replaceSingleQuotedStrings(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	inDouble := false
	i := 0
	for i < len(s) {
		c := s[i]
		if c == '"' {
			inDouble = !inDouble
			b.WriteByte(c)
			i++
			continue
		}
		if !inDouble && c == '\'' {
			// Collect characters until the closing single quote.
			b.WriteByte('"')
			i++
			for i < len(s) && s[i] != '\'' {
				b.WriteByte(s[i])
				i++
			}
			b.WriteByte('"')
			if i < len(s) {
				i++ // consume closing '
			}
			continue
		}
		b.WriteByte(c)
		i++
	}
	return b.String()
}
