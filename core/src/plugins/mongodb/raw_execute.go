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
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/clidey/whodb/core/src/engine"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// RawExecute executes a MongoDB shell command (e.g. db.users.find({...})) and
// returns the results as a tabular GetRowsResult. All results have DisableUpdate
// set to true because raw results cannot be mapped back to individual documents.
func (p *MongoDBPlugin) RawExecute(config *engine.PluginConfig, query string, _ ...any) (*engine.GetRowsResult, error) {
	cmd, err := parseShellCommand(query)
	if err != nil {
		return nil, err
	}
	args, err := parseArgs(cmd.RawArgs)
	if err != nil {
		return nil, err
	}

	client, err := DB(config)
	if err != nil {
		return nil, err
	}
	ctx, cancel := opCtx()
	defer cancel()
	defer disconnectClient(client)

	db := client.Database(config.Credentials.Database)
	if cmd.Collection == "" {
		switch cmd.Method {
		case "dropDatabase":
			if err := db.Drop(ctx); err != nil {
				return nil, err
			}
			return mutationResult(map[string]string{
				"acknowledged": "true",
				"database":     config.Credentials.Database,
			}), nil
		default:
			return nil, fmt.Errorf("unsupported database method %q; supported methods: dropDatabase", cmd.Method)
		}
	}
	coll := db.Collection(cmd.Collection)

	switch cmd.Method {
	case "find":
		return execFind(ctx, coll, args)
	case "findOne":
		return execFindOne(ctx, coll, args)
	case "insertOne":
		return execInsertOne(ctx, coll, args)
	case "insertMany":
		return execInsertMany(ctx, coll, args)
	case "updateOne":
		return execUpdateOne(ctx, coll, args)
	case "updateMany":
		return execUpdateMany(ctx, coll, args)
	case "deleteOne":
		return execDeleteOne(ctx, coll, args)
	case "deleteMany":
		return execDeleteMany(ctx, coll, args)
	case "countDocuments":
		return execCountDocuments(ctx, coll, args)
	case "aggregate":
		return execAggregate(ctx, coll, args)
	case "distinct":
		return execDistinct(ctx, coll, args)
	case "createIndex":
		return execCreateIndex(ctx, coll, args)
	case "drop":
		return execDrop(ctx, coll)
	default:
		return nil, fmt.Errorf("unsupported method %q; supported methods: find, findOne, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, countDocuments, aggregate, distinct, createIndex, drop", cmd.Method)
	}
}

// execFind runs db.<coll>.find(filter, projection) with a hard limit of 1000 documents.
func execFind(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	filter := toBsonM(argAt(args, 0))
	opts := options.Find().SetLimit(1000)
	if proj, ok := argAt(args, 1).(map[string]any); ok && len(proj) > 0 {
		opts.SetProjection(bson.M(proj))
	}
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	return documentsToResult(docs), nil
}

// execFindOne runs db.<coll>.findOne(filter) and returns at most one document.
func execFindOne(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	filter := toBsonM(argAt(args, 0))
	var doc bson.M
	err := coll.FindOne(ctx, filter).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return &engine.GetRowsResult{Columns: []engine.Column{}, Rows: [][]string{}, DisableUpdate: true}, nil
	}
	if err != nil {
		return nil, err
	}
	return documentsToResult([]bson.M{doc}), nil
}

// execInsertOne runs db.<coll>.insertOne(doc) and returns the inserted ID.
func execInsertOne(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("insertOne requires a document argument")
	}
	res, err := coll.InsertOne(ctx, args[0])
	if err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"insertedId": formatBSONValueForCell(res.InsertedID),
	}), nil
}

// execInsertMany runs db.<coll>.insertMany([docs]) and returns the count of inserted documents.
func execInsertMany(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("insertMany requires an array argument")
	}
	arr, ok := args[0].([]any)
	if !ok {
		return nil, fmt.Errorf("insertMany: first argument must be an array of documents")
	}
	res, err := coll.InsertMany(ctx, arr)
	if err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"insertedCount": fmt.Sprintf("%d", len(res.InsertedIDs)),
	}), nil
}

// execUpdateOne runs db.<coll>.updateOne(filter, update) and returns matched/modified/upserted counts.
func execUpdateOne(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	return execUpdate(ctx, coll, args, false)
}

// execUpdateMany runs db.<coll>.updateMany(filter, update) and returns matched/modified/upserted counts.
func execUpdateMany(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	return execUpdate(ctx, coll, args, true)
}

func execUpdate(ctx context.Context, coll *mongo.Collection, args []any, multi bool) (*engine.GetRowsResult, error) {
	if len(args) < 2 {
		return nil, fmt.Errorf("update requires filter and update arguments")
	}
	filter := toBsonM(args[0])
	update := toBsonM(args[1])
	var res *mongo.UpdateResult
	var err error
	if multi {
		res, err = coll.UpdateMany(ctx, filter, update)
	} else {
		res, err = coll.UpdateOne(ctx, filter, update)
	}
	if err != nil {
		return nil, err
	}
	kvs := map[string]string{
		"matchedCount":  fmt.Sprintf("%d", res.MatchedCount),
		"modifiedCount": fmt.Sprintf("%d", res.ModifiedCount),
	}
	if res.UpsertedCount > 0 {
		kvs["upsertedId"] = formatBSONValueForCell(res.UpsertedID)
	}
	return mutationResult(kvs), nil
}

// execDeleteOne runs db.<coll>.deleteOne(filter) and returns the deleted count.
func execDeleteOne(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	filter := toBsonM(argAt(args, 0))
	res, err := coll.DeleteOne(ctx, filter)
	if err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"deletedCount": fmt.Sprintf("%d", res.DeletedCount),
	}), nil
}

// execDeleteMany runs db.<coll>.deleteMany(filter) and returns the deleted count.
func execDeleteMany(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	filter := toBsonM(argAt(args, 0))
	res, err := coll.DeleteMany(ctx, filter)
	if err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"deletedCount": fmt.Sprintf("%d", res.DeletedCount),
	}), nil
}

// execCountDocuments runs db.<coll>.countDocuments(filter) and returns the count.
func execCountDocuments(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	filter := toBsonM(argAt(args, 0))
	count, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"count": fmt.Sprintf("%d", count),
	}), nil
}

// execAggregate runs db.<coll>.aggregate(pipeline) with a hard limit of 1000 documents
// appended automatically unless the pipeline already contains a $limit stage.
func execAggregate(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("aggregate requires a pipeline argument")
	}
	arr, ok := args[0].([]any)
	if !ok {
		return nil, fmt.Errorf("aggregate: first argument must be an array (pipeline)")
	}

	// Append $limit if no $limit stage already exists in the pipeline.
	hasLimit := false
	for _, stage := range arr {
		if m, ok := stage.(map[string]any); ok {
			if _, found := m["$limit"]; found {
				hasLimit = true
				break
			}
		}
	}
	if !hasLimit {
		arr = append(arr, map[string]any{"$limit": 1000})
	}

	cursor, err := coll.Aggregate(ctx, arr)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	return documentsToResult(docs), nil
}

// execDistinct runs db.<coll>.distinct(field, filter) and returns distinct values as a single column.
func execDistinct(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("distinct requires a field name argument")
	}
	field, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("distinct: first argument must be a field name string")
	}
	filter := toBsonM(argAt(args, 1))
	values, err := coll.Distinct(ctx, field, filter)
	if err != nil {
		return nil, err
	}
	result := &engine.GetRowsResult{
		Columns:       []engine.Column{{Name: field, Type: "mixed"}},
		Rows:          make([][]string, len(values)),
		DisableUpdate: true,
	}
	for i, v := range values {
		result.Rows[i] = []string{formatBSONValueForCell(v)}
	}
	return result, nil
}

// execCreateIndex runs db.<coll>.createIndex(keys, options) and returns the created index name.
func execCreateIndex(ctx context.Context, coll *mongo.Collection, args []any) (*engine.GetRowsResult, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("createIndex requires a keys argument")
	}
	keys := toBsonD(args[0])
	indexModel := mongo.IndexModel{Keys: keys}
	if len(args) >= 2 {
		if opts, ok := args[1].(map[string]any); ok {
			indexOpts := options.Index()
			if unique, ok := opts["unique"].(bool); ok {
				indexOpts.SetUnique(unique)
			}
			if name, ok := opts["name"].(string); ok {
				indexOpts.SetName(name)
			}
			indexModel.Options = indexOpts
		}
	}
	name, err := coll.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"indexName": name,
	}), nil
}

// execDrop drops the collection and returns an acknowledgement.
func execDrop(ctx context.Context, coll *mongo.Collection) (*engine.GetRowsResult, error) {
	name := coll.Name()
	if err := coll.Drop(ctx); err != nil {
		return nil, err
	}
	return mutationResult(map[string]string{
		"acknowledged": "true",
		"collection":   name,
	}), nil
}

// documentsToResult converts a slice of BSON documents to a GetRowsResult.
// All unique keys across documents are collected, sorted alphabetically with _id
// first. All results have DisableUpdate set to true.
func documentsToResult(docs []bson.M) *engine.GetRowsResult {
	// Collect all unique keys across all documents.
	keySet := make(map[string]struct{})
	for _, doc := range docs {
		for k := range doc {
			keySet[k] = struct{}{}
		}
	}

	// Sort keys alphabetically, with _id always first.
	keys := make([]string, 0, len(keySet))
	for k := range keySet {
		if k != "_id" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	if _, hasID := keySet["_id"]; hasID {
		keys = append([]string{"_id"}, keys...)
	}

	columns := make([]engine.Column, len(keys))
	for i, k := range keys {
		columns[i] = engine.Column{Name: k, Type: "mixed"}
	}

	rows := make([][]string, len(docs))
	for i, doc := range docs {
		row := make([]string, len(keys))
		for j, k := range keys {
			row[j] = formatBSONValueForCell(doc[k])
		}
		rows[i] = row
	}

	return &engine.GetRowsResult{
		Columns:       columns,
		Rows:          rows,
		DisableUpdate: true,
	}
}

// mutationResult builds a single-row GetRowsResult from a map of string key-value
// pairs. Column names are sorted alphabetically. DisableUpdate is always true.
func mutationResult(kvs map[string]string) *engine.GetRowsResult {
	keys := make([]string, 0, len(kvs))
	for k := range kvs {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	columns := make([]engine.Column, len(keys))
	row := make([]string, len(keys))
	for i, k := range keys {
		columns[i] = engine.Column{Name: k, Type: "string"}
		row[i] = kvs[k]
	}

	return &engine.GetRowsResult{
		Columns:       columns,
		Rows:          [][]string{row},
		DisableUpdate: true,
	}
}

// toBsonM converts a map[string]any to bson.M. Returns an empty bson.M if v is
// not a map.
func toBsonM(v any) bson.M {
	if m, ok := v.(map[string]any); ok {
		return bson.M(m)
	}
	return bson.M{}
}

// toBsonD converts a map to a bson.D (ordered document). This is used for index
// key specifications where field order matters. Note that compound index key
// ordering follows map iteration order, which is non-deterministic in Go; callers
// that need a specific order should use an already-ordered pipeline stage instead.
func toBsonD(v any) bson.D {
	m, ok := v.(map[string]any)
	if !ok {
		return bson.D{}
	}
	d := make(bson.D, 0, len(m))
	for k, val := range m {
		d = append(d, bson.E{Key: k, Value: val})
	}
	return d
}

// formatBSONValueForCell formats a BSON value for display in a table cell.
// ObjectIDs are rendered as their hex string, DateTimes as RFC3339, nil as "",
// plain strings as-is, and everything else as its JSON representation.
func formatBSONValueForCell(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case primitive.ObjectID:
		return val.Hex()
	case primitive.DateTime:
		return val.Time().UTC().Format(time.RFC3339)
	case string:
		return val
	default:
		data, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprintf("%v", val)
		}
		return string(data)
	}
}

// argAt returns args[i] if it exists, or nil otherwise.
func argAt(args []any, i int) any {
	if i < len(args) {
		return args[i]
	}
	return nil
}
