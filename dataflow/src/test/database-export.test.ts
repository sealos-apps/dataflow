import { describe, expect, it } from 'vitest'

import {
  buildDatabaseExportPlan,
  formatDatabaseExportEntryName,
} from '@/utils/database-export'

describe('buildDatabaseExportPlan', () => {
  it('exports every non-system PostgreSQL schema in a database', () => {
    expect(buildDatabaseExportPlan({
      connectionType: 'POSTGRES',
      fallbackSchema: 'public',
      allSchemas: ['public', 'analytics', 'pg_catalog'],
      systemSchemas: ['pg_catalog'],
      includeSystemSchemas: false,
    })).toEqual(['public', 'analytics'])
  })

  it('keeps single-schema export behavior for MySQL-style databases', () => {
    expect(buildDatabaseExportPlan({
      connectionType: 'MYSQL',
      fallbackSchema: 'app_db',
      allSchemas: ['ignored'],
      systemSchemas: [],
      includeSystemSchemas: false,
    })).toEqual(['app_db'])
  })
})

describe('formatDatabaseExportEntryName', () => {
  it('groups PostgreSQL tables under schema directories', () => {
    expect(formatDatabaseExportEntryName('POSTGRES', 'analytics', 'events', 'sql')).toBe(
      'analytics/events.sql',
    )
  })

  it('keeps flat filenames for MySQL exports', () => {
    expect(formatDatabaseExportEntryName('MYSQL', 'app_db', 'events', 'csv')).toBe(
      'events.csv',
    )
  })
})
