# Data Export Feature — Design Spec

**Date:** 2026-03-27
**Branch:** `dataflow`
**Scope:** `/dataflow/src/`

---

## Overview

Implement three data export capabilities in the DataFlow frontend:

1. **Table data export** (9.1) — rewrite `ExportDataModal.tsx` to use `RawExecute` GraphQL
2. **Database export** (9.2) — rewrite `ExportDatabaseModal.tsx` to export all tables as a zip
3. **Chart PNG export** — add PNG download to dashboard chart widgets

All export logic is client-side. No backend changes required.

---

## Architecture: Approach 1 (Client-Side via RawExecute)

All data exports fetch via `RawExecute` GraphQL query, format client-side, and trigger browser download. This aligns with the project's GraphQL-first principle and provides a single code path for all formats.

**Trade-off accepted:** Loading all data into browser memory. Mitigated by the default 1000-row limit in the table export modal.

---

## 1. Shared Export Utility

**New file:** `src/lib/export-utils.ts`

### Input

`RawExecute` result shape:

```typescript
{
  Columns: Array<{ Type: string; Name: string }>;
  Rows: Array<Array<string>>;
  TotalCount: number;
}
```

### Format Functions

Each function takes columns + rows and returns a `Blob`:

- **`toCSV(columns, rows)`** — Column headers + rows, comma-separated, RFC 4180 compliant (quote fields containing commas/quotes/newlines).
- **`toJSON(columns, rows)`** — Array of objects: `[{ col1: val1, col2: val2 }, ...]`. Output as pretty-printed JSON.
- **`toSQL(tableName, columns, rows)`** — `INSERT INTO tableName (col1, col2) VALUES (...);` statements. Value quoting uses a simple heuristic: if a value is the string `"NULL"` → output `NULL` keyword; if the value parses as a finite number → output unquoted; otherwise → single-quote with internal single quotes escaped by doubling (`'` → `''`). Column `Type` is not consulted — the heuristic is value-based, avoiding the need to map database-specific type strings.
- **`toExcel(sheetName, columns, rows)`** — Single-sheet workbook via `xlsx` library (already installed, version 0.18.5). Sheet name = table name. Plain data only — no cell styling (SheetJS CE does not support styles).

### Download Trigger

```typescript
function downloadBlob(blob: Blob, filename: string): void
```

Uses `URL.createObjectURL(blob)` + programmatic `<a>` click + `URL.revokeObjectURL()`. Extracted from the inline pattern repeated in MongoDB/Redis export modals.

---

## 2. Table Data Export (ExportDataModal Rewrite)

**File:** `src/components/database/sql/ExportDataModal.tsx`

### Current State

- Calls non-existent `POST /api/connections/export-data` with SSE streaming
- Has format selector (CSV, JSON, SQL, Excel), row limit, WHERE filter, progress bar
- Never works — endpoint doesn't exist

### New Behavior

1. User selects format, optionally sets row limit and WHERE filter
2. On "Start Export", construct SQL query:
   ```
   SELECT * FROM tableName [WHERE filter] [LIMIT rowCount]
   ```
   Table names are used as-is (unquoted), following the same convention as `SQLEditorView.tsx`. The `schema` prop is passed via GraphQL context (the `RawExecute` query operates within the current connection's schema context set by the backend). If `schema` is provided, the query uses `schema.tableName`.
3. Execute via `useRawExecuteLazyQuery()`
4. Pass result to the appropriate `export-utils` function
5. Trigger browser download

### UI Changes

- **Keep:** Format selector (CSV, JSON, SQL, Excel), row limit input, WHERE filter textarea
- **Replace:** SSE streaming progress bar → simple loading state (Loader2 spinner + "Exporting..." text). Single GraphQL call has no incremental progress.
- **Add:** Error message display (red text below progress area). Current modal silently fails on error.
- **Keep:** Success state with download action

### Props (unchanged)

```typescript
interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  databaseName: string;
  schema?: string | null;
  tableName: string;
}
```

`connectionId` is no longer needed for the export itself (RawExecute uses auth headers), but kept for interface compatibility since it's passed by `TableDetailView`.

---

## 3. Database Export (ExportDatabaseModal Rewrite)

**File:** `src/components/database/ExportDatabaseModal.tsx`

### Current State

- Calls non-existent `POST /api/connections/export-database` with SSE streaming
- Has format selector, WHERE filter (applies to all tables), progress bar
- Never works — endpoint doesn't exist

### New Behavior

1. User selects format
2. On "Start Export":
   a. Fetch table list via `GetStorageUnits` GraphQL query
   b. For each table, execute `SELECT * FROM [schema.]tableName` via `RawExecute`
   c. Format each table's result using the appropriate `export-utils` function
   d. Add each formatted file to a JSZip archive
   e. Generate zip blob and trigger download
3. Filename: `export_{databaseName}.zip`

### File Naming Inside Zip

- `tableName.csv`
- `tableName.json`
- `tableName.sql`
- `tableName.xlsx`

### UI Changes

- **Keep:** Format selector (CSV, JSON, SQL, Excel)
- **Remove:** WHERE filter textarea (applying one WHERE clause to all tables is not meaningful)
- **Replace:** SSE progress bar → per-table progress: "Exporting table 3 of 15... (users)" with a progress bar showing percentage of tables completed
- **Keep:** Success/error states

### Error Handling for Multi-Table Export

If a single table's `RawExecute` fails during database export, skip that table and continue with remaining tables. After completion, show a warning listing which tables failed (e.g., "Exported 13 of 15 tables. Failed: audit_log, temp_cache"). The zip still contains all successfully exported tables.

### New Dependency

**JSZip** — client-side zip generation. ~13kB gzipped. Install via `pnpm add jszip`.

### Schema Handling

The modal receives `databaseName` but not `schema`. Add a `schema` prop to the modal interface and the `export_database` modal type in `useSidebarModals.ts`. The caller passes schema based on context:

- **Postgres:** The sidebar export action is on database nodes. Pass `"public"` as the default schema. (The `GetStorageUnits` query requires `schema: String!`.)
- **MySQL/ClickHouse:** Pass `databaseName` as the schema value (MySQL uses the database name as the schema parameter in WhoDB's GraphQL API).
- **SQLite:** Pass `""` (empty string).

Updated props:

```typescript
interface ExportDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  databaseName: string;
  schema: string;
}
```

---

## 4. Chart PNG Export

**Key constraint:** `NativeECharts.tsx` uses `SVGRenderer` exclusively. ECharts' `getDataURL()` with SVG renderer always returns an SVG data URL regardless of the `type: 'png'` option — the `renderToCanvas` path is never reached. To produce a true PNG, we render the SVG to a `<canvas>` element and call `canvas.toDataURL('image/png')`.

Three code changes:

### 4.1 NativeECharts — Expose Chart Instance

**File:** `src/components/ui/NativeECharts.tsx`

Currently, `chartRef` is internal-only. Add a `ref` prop (React 19 style — no `forwardRef` needed, `ref` is a regular prop in React 19) and expose a handle via `useImperativeHandle`:

```typescript
export interface NativeEChartsHandle {
  exportPNG: (pixelRatio?: number) => string | null;
}
```

The `exportPNG()` method:
1. Calls `chartRef.current.getDataURL()` → gets SVG data URL
2. Creates an offscreen `<canvas>` element sized to chart dimensions × `pixelRatio`
3. Draws the SVG image onto the canvas via `Image` + `canvas.drawImage()`
4. Returns `canvas.toDataURL('image/png')`

This is an async operation (image loading), so the actual signature is:

```typescript
exportPNG: (pixelRatio?: number) => Promise<string | null>;
```

### 4.2 SafeECharts — Forward Ref

**File:** `src/components/ui/SafeECharts.tsx`

Currently a re-export alias. Update to pass through the `ref` prop to `NativeECharts`.

### 4.3 DashboardWidget — Add Export Menu Item

**File:** `src/components/analysis/DashboardWidget.tsx`

- Add a ref to the `SafeECharts` component for chart-type widgets
- Add "导出 PNG" menu item to `menuItems` array (between "放大" and "编辑"):

```typescript
{
  label: "导出 PNG",
  icon: <ImageDown className="w-4 h-4" />,
  onClick: () => handleExportPNG()
}
```

- `handleExportPNG()`: calls `chartRef.current.exportPNG(2)` (async), converts the returned base64 data URL to a blob, triggers download via `export-utils.downloadBlob()`.
- Only shown for chart-type widgets (not table/text/stats).
- Filename: `{component.title}.png`

### 4.4 Export Utility — SVG-to-PNG Helper

**File:** `src/lib/export-utils.ts`

Add `svgDataURLToPNG(svgDataURL: string, width: number, height: number, pixelRatio: number): Promise<Blob>` — shared helper that handles the SVG → Canvas → PNG conversion. Used by `NativeEChartsHandle.exportPNG()`.

---

## Files Changed Summary

| File | Action |
|------|--------|
| `src/lib/export-utils.ts` | **New** — shared format conversion + download |
| `src/components/database/sql/ExportDataModal.tsx` | **Rewrite** — GraphQL + client-side formatting |
| `src/components/database/ExportDatabaseModal.tsx` | **Rewrite** — multi-table + zip |
| `src/components/ui/NativeECharts.tsx` | **Edit** — add ref prop + useImperativeHandle (React 19 style) |
| `src/components/ui/SafeECharts.tsx` | **Edit** — pass through ref prop |
| `src/components/analysis/DashboardWidget.tsx` | **Edit** — add chart ref + export menu item |
| `package.json` | **Edit** — add jszip dependency |

---

## Dependencies

| Package | Version | Purpose | Size (gzipped) |
|---------|---------|---------|----------------|
| `jszip` | latest | Client-side zip generation for database export | ~13kB |
| `xlsx` | 0.18.5 | Excel workbook generation (already installed) | — |

---

## Out of Scope

- Query results export from SQL editor result pane (feature A)
- Chart data export as CSV (only PNG)
- Dashboard-wide batch export (all widgets at once)
- Backend changes
- Export progress for individual tables (only table-count progress for database export)
- Localization of new UI strings (DataFlow has no i18n infrastructure yet; existing modals and widgets already use hardcoded Chinese/English strings — this is a pre-existing gap, not introduced by this feature)
- Export cancellation (single GraphQL calls cannot be cancelled mid-flight; for database export, the user can close the modal but in-flight requests complete silently)
