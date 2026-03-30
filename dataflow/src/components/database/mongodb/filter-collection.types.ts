/** Supported MongoDB operators exposed by the flat collection filter builder. */
export type MongoFilterOperator =
  | '$eq'
  | '$ne'
  | '$regex'
  | '$gt'
  | '$lt'
  | '$gte'
  | '$lte'
  | '$in'

/**
 * Single editable condition in the filter modal draft state.
 *
 * The UI stores raw text input here. For `$in`, the provider layer is expected
 * to interpret `value` as a comma-separated string before emitting the final
 * filter object.
 */
export interface FilterConditionDraft {
  id: string
  field: string
  operator: MongoFilterOperator
  value: string
}

/**
 * Flat MongoDB filter object emitted by the modal.
 *
 * Provider code must only emit field-keyed flat objects for this phase; nested
 * `$and`/`$or` groups are intentionally out of scope.
 */
export type FlatMongoFilter = Record<string, unknown>
