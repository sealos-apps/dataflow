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
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestParseShellCommand_Find(t *testing.T) {
	cmd, err := parseShellCommand(`db.users.find({ "age": { "$gt": 25 } })`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "users" {
		t.Errorf("expected collection %q, got %q", "users", cmd.Collection)
	}
	if cmd.Method != "find" {
		t.Errorf("expected method %q, got %q", "find", cmd.Method)
	}
	if cmd.RawArgs != `{ "age": { "$gt": 25 } }` {
		t.Errorf("unexpected RawArgs: %q", cmd.RawArgs)
	}
}

func TestParseShellCommand_InsertMany(t *testing.T) {
	input := `db.orders.insertMany([
  { "item": "abc", "qty": 10 },
  { "item": "def", "qty": 20 }
])`
	cmd, err := parseShellCommand(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "orders" {
		t.Errorf("expected collection %q, got %q", "orders", cmd.Collection)
	}
	if cmd.Method != "insertMany" {
		t.Errorf("expected method %q, got %q", "insertMany", cmd.Method)
	}
	if cmd.RawArgs == "" {
		t.Error("expected non-empty RawArgs")
	}
}

func TestParseShellCommand_NoArgs(t *testing.T) {
	cmd, err := parseShellCommand(`db.users.drop()`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "users" {
		t.Errorf("expected collection %q, got %q", "users", cmd.Collection)
	}
	if cmd.Method != "drop" {
		t.Errorf("expected method %q, got %q", "drop", cmd.Method)
	}
	if cmd.RawArgs != "" {
		t.Errorf("expected empty RawArgs, got %q", cmd.RawArgs)
	}
}

func TestParseShellCommand_DropDatabase(t *testing.T) {
	cmd, err := parseShellCommand(`db.dropDatabase()`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "" {
		t.Errorf("expected empty collection, got %q", cmd.Collection)
	}
	if cmd.Method != "dropDatabase" {
		t.Errorf("expected method %q, got %q", "dropDatabase", cmd.Method)
	}
	if cmd.RawArgs != "" {
		t.Errorf("expected empty RawArgs, got %q", cmd.RawArgs)
	}
}

func TestParseShellCommand_InvalidFormat(t *testing.T) {
	_, err := parseShellCommand(`SELECT * FROM users`)
	if err == nil {
		t.Fatal("expected error for invalid format, got nil")
	}
}

func TestParseShellCommand_WithComments(t *testing.T) {
	input := `// find all adult users
db.users.find({ /* filter */ "age": { "$gt": 18 } })`
	cmd, err := parseShellCommand(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "users" {
		t.Errorf("expected collection %q, got %q", "users", cmd.Collection)
	}
	if cmd.Method != "find" {
		t.Errorf("expected method %q, got %q", "find", cmd.Method)
	}
}

func TestParseShellCommand_WithSemicolon(t *testing.T) {
	cmd, err := parseShellCommand(`db.users.find({});`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "users" {
		t.Errorf("expected collection %q, got %q", "users", cmd.Collection)
	}
	if cmd.Method != "find" {
		t.Errorf("expected method %q, got %q", "find", cmd.Method)
	}
	if cmd.RawArgs != "{}" {
		t.Errorf("expected RawArgs %q, got %q", "{}", cmd.RawArgs)
	}
}

func TestParseShellCommand_SubCollection(t *testing.T) {
	cmd, err := parseShellCommand(`db.system.users.find({})`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Collection != "system.users" {
		t.Errorf("expected collection %q, got %q", "system.users", cmd.Collection)
	}
	if cmd.Method != "find" {
		t.Errorf("expected method %q, got %q", "find", cmd.Method)
	}
}

func TestPreprocessJS_ObjectId(t *testing.T) {
	input := `ObjectId("507f1f77bcf86cd799439011")`
	want := `{"$oid":"507f1f77bcf86cd799439011"}`
	got := preprocessJS(input)
	if got != want {
		t.Errorf("expected %q, got %q", want, got)
	}
}

func TestPreprocessJS_NewDate(t *testing.T) {
	input := `new Date("2024-01-01")`
	want := `{"$date":"2024-01-01"}`
	got := preprocessJS(input)
	if got != want {
		t.Errorf("expected %q, got %q", want, got)
	}
}

func TestPreprocessJS_NewDateNow(t *testing.T) {
	got := preprocessJS(`new Date()`)
	if !strings.HasPrefix(got, `{"$date":"`) {
		t.Errorf("expected output to start with {\"$date\":\"..., got %q", got)
	}
}

func TestPreprocessJS_ISODate(t *testing.T) {
	input := `ISODate("2024-06-15T10:30:00Z")`
	want := `{"$date":"2024-06-15T10:30:00Z"}`
	got := preprocessJS(input)
	if got != want {
		t.Errorf("expected %q, got %q", want, got)
	}
}

func TestPreprocessJS_UnquotedKeys(t *testing.T) {
	input := `{ name: "John", age: 30 }`
	got := preprocessJS(input)
	if !strings.Contains(got, `"name"`) {
		t.Errorf("expected key 'name' to be quoted, got %q", got)
	}
	if !strings.Contains(got, `"age"`) {
		t.Errorf("expected key 'age' to be quoted, got %q", got)
	}
}

func TestPreprocessJS_SingleQuotes(t *testing.T) {
	input := `{ "name": 'John' }`
	got := preprocessJS(input)
	if !strings.Contains(got, `"John"`) {
		t.Errorf("expected single-quoted value to become double-quoted, got %q", got)
	}
}

func TestPreprocessJS_TrailingComma(t *testing.T) {
	input := `{ "a": 1, "b": 2, }`
	got := preprocessJS(input)
	if strings.Contains(got, `,}`) || strings.Contains(got, `, }`) {
		t.Errorf("expected trailing comma to be removed, got %q", got)
	}
}

func TestPreprocessJS_NumberInt(t *testing.T) {
	input := `NumberInt(42)`
	want := `42`
	got := preprocessJS(input)
	if got != want {
		t.Errorf("expected %q, got %q", want, got)
	}
}

func TestPreprocessJS_NumberLong(t *testing.T) {
	input := `NumberLong(9999999999)`
	want := `9999999999`
	got := preprocessJS(input)
	if got != want {
		t.Errorf("expected %q, got %q", want, got)
	}
}

func TestPreprocessJS_Complex(t *testing.T) {
	input := `{ _id: ObjectId("507f1f77bcf86cd799439011"), name: 'Alice', age: NumberInt(30), createdAt: ISODate("2024-01-01T00:00:00Z"), }`
	got := preprocessJS(input)
	if !strings.Contains(got, `{"$oid":"507f1f77bcf86cd799439011"}`) {
		t.Errorf("expected ObjectId conversion in %q", got)
	}
	if !strings.Contains(got, `"Alice"`) {
		t.Errorf("expected single-quoted string conversion in %q", got)
	}
	if !strings.Contains(got, `{"$date":"2024-01-01T00:00:00Z"}`) {
		t.Errorf("expected ISODate conversion in %q", got)
	}
	if strings.Contains(got, `,}`) || strings.Contains(got, `, }`) {
		t.Errorf("expected trailing comma removal in %q", got)
	}
}

func TestConvertExtendedJSON_ObjectId(t *testing.T) {
	input := map[string]any{"_id": map[string]any{"$oid": "507f1f77bcf86cd799439011"}}
	result := convertExtendedJSON(input)
	m, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}
	if _, ok := m["_id"].(primitive.ObjectID); !ok {
		t.Errorf("expected _id to be primitive.ObjectID, got %T", m["_id"])
	}
}

func TestConvertExtendedJSON_Date(t *testing.T) {
	input := map[string]any{"created": map[string]any{"$date": "2024-01-01T00:00:00Z"}}
	result := convertExtendedJSON(input)
	m, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}
	if _, ok := m["created"].(primitive.DateTime); !ok {
		t.Errorf("expected created to be primitive.DateTime, got %T", m["created"])
	}
}

func TestConvertExtendedJSON_Nested(t *testing.T) {
	input := map[string]any{
		"outer": map[string]any{
			"inner": map[string]any{"$oid": "507f1f77bcf86cd799439011"},
		},
	}
	result := convertExtendedJSON(input)
	outer, ok := result.(map[string]any)["outer"].(map[string]any)
	if !ok {
		t.Fatalf("expected outer to be map, got %T", result.(map[string]any)["outer"])
	}
	if _, ok := outer["inner"].(primitive.ObjectID); !ok {
		t.Errorf("expected inner to be primitive.ObjectID, got %T", outer["inner"])
	}
}

func TestConvertExtendedJSON_Array(t *testing.T) {
	input := []any{
		map[string]any{"$oid": "507f1f77bcf86cd799439011"},
		map[string]any{"$oid": "507f191e810c19729de860ea"},
	}
	result := convertExtendedJSON(input)
	arr, ok := result.([]any)
	if !ok {
		t.Fatalf("expected slice result, got %T", result)
	}
	for i, elem := range arr {
		if _, ok := elem.(primitive.ObjectID); !ok {
			t.Errorf("expected element %d to be primitive.ObjectID, got %T", i, elem)
		}
	}
}

func TestParseArgs_FindWithFilter(t *testing.T) {
	args, err := parseArgs(`{ name: "John", age: { "$gt": 25 } }`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(args) != 1 {
		t.Fatalf("expected 1 arg, got %d", len(args))
	}
	m, ok := args[0].(map[string]any)
	if !ok {
		t.Fatalf("expected map arg, got %T", args[0])
	}
	if m["name"] != "John" {
		t.Errorf("expected name=%q, got %v", "John", m["name"])
	}
}

func TestParseArgs_InsertManyDocs(t *testing.T) {
	input := `[{ name: "Alice", createdAt: new Date() }, { name: "Bob", createdAt: new Date() }]`
	args, err := parseArgs(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(args) != 1 {
		t.Fatalf("expected 1 arg (the array), got %d", len(args))
	}
	arr, ok := args[0].([]any)
	if !ok {
		t.Fatalf("expected slice arg, got %T", args[0])
	}
	if len(arr) != 2 {
		t.Errorf("expected 2 elements in array, got %d", len(arr))
	}
}

func TestParseArgs_UpdateWithObjectId(t *testing.T) {
	input := `{ _id: ObjectId("507f1f77bcf86cd799439011") }, { "$set": { name: "Updated" } }`
	args, err := parseArgs(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(args) != 2 {
		t.Fatalf("expected 2 args, got %d", len(args))
	}
	filter, ok := args[0].(map[string]any)
	if !ok {
		t.Fatalf("expected first arg to be map, got %T", args[0])
	}
	if _, ok := filter["_id"].(primitive.ObjectID); !ok {
		t.Errorf("expected _id to be primitive.ObjectID, got %T", filter["_id"])
	}
}

func TestParseArgs_Empty(t *testing.T) {
	args, err := parseArgs("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if args != nil {
		t.Errorf("expected nil args, got %v", args)
	}
}

func TestDocumentsToGetRowsResult(t *testing.T) {
	oid, _ := primitive.ObjectIDFromHex("507f1f77bcf86cd799439011")
	docs := []bson.M{
		{"_id": oid, "name": "Alice", "age": 30},
		{"_id": primitive.NewObjectID(), "name": "Bob", "email": "bob@example.com"},
	}
	result := documentsToResult(docs)

	if len(result.Columns) != 4 {
		t.Fatalf("expected 4 columns, got %d: %v", len(result.Columns), result.Columns)
	}
	if result.Columns[0].Name != "_id" {
		t.Errorf("expected first column to be _id, got %q", result.Columns[0].Name)
	}
	// Remaining columns are sorted alphabetically: age, email, name
	wantCols := []string{"_id", "age", "email", "name"}
	for i, want := range wantCols {
		if result.Columns[i].Name != want {
			t.Errorf("column[%d]: expected %q, got %q", i, want, result.Columns[i].Name)
		}
	}
	if len(result.Rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(result.Rows))
	}
	if !result.DisableUpdate {
		t.Error("expected DisableUpdate to be true")
	}
}

func TestMutationResult(t *testing.T) {
	result := mutationResult(map[string]string{
		"modifiedCount": "3",
		"matchedCount":  "3",
	})

	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}
	if len(result.Columns) != 2 {
		t.Fatalf("expected 2 columns, got %d", len(result.Columns))
	}
	// Columns must be sorted alphabetically
	if result.Columns[0].Name != "matchedCount" {
		t.Errorf("expected first column matchedCount, got %q", result.Columns[0].Name)
	}
	if result.Columns[1].Name != "modifiedCount" {
		t.Errorf("expected second column modifiedCount, got %q", result.Columns[1].Name)
	}
	if result.Rows[0][0] != "3" || result.Rows[0][1] != "3" {
		t.Errorf("unexpected row values: %v", result.Rows[0])
	}
	if !result.DisableUpdate {
		t.Error("expected DisableUpdate to be true")
	}
}
