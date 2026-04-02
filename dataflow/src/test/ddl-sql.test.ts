import { describe, expect, it } from 'vitest'

import {
  buildStorageUnitReference,
  copyTableStructureSQL,
  copyTableWithDataSQL,
  deleteAllRowsSQL,
} from '@/utils/ddl-sql'

describe('copyTableStructureSQL', () => {
  it('preserves full PostgreSQL table structure when copying without data', () => {
    expect(copyTableStructureSQL('POSTGRES', 'orders', 'orders_backup', 'public')).toBe(
      'CREATE TABLE "public"."orders_backup" (LIKE "public"."orders" INCLUDING ALL)',
    )
  })
})

describe('copyTableWithDataSQL', () => {
  it('preserves PostgreSQL constraints before copying data', () => {
    expect(copyTableWithDataSQL('POSTGRES', 'orders', 'orders_backup', 'public')).toBe(
      'CREATE TABLE "public"."orders_backup" (LIKE "public"."orders" INCLUDING ALL);\nINSERT INTO "public"."orders_backup" SELECT * FROM "public"."orders"',
    )
  })
})

describe('deleteAllRowsSQL', () => {
  it('uses ClickHouse mutation syntax instead of generic DELETE FROM', () => {
    expect(deleteAllRowsSQL('CLICKHOUSE', 'events')).toBe(
      'ALTER TABLE `events` DELETE WHERE 1=1',
    )
  })
})

describe('buildStorageUnitReference', () => {
  it('quotes PostgreSQL schema and table names', () => {
    expect(buildStorageUnitReference('POSTGRES', 'Order', 'Sales')).toBe('"Sales"."Order"')
  })

  it('quotes MySQL table names with backticks', () => {
    expect(buildStorageUnitReference('MYSQL', 'order')).toBe('`order`')
  })
})
