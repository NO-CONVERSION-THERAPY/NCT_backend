import { describe, expect, it } from 'vitest';
import {
  dynamicColumnName,
  ensureDynamicColumns,
  extractDynamicColumns,
  serializeDynamicColumnValue,
} from './dynamic-schema';

function createFakeDb(
  initialColumns: string[] = [],
  duplicateColumns: Set<string> = new Set(),
) {
  const columns = new Set(initialColumns);
  const sqlLog: string[] = [];

  const db = {
    prepare(sql: string) {
      return {
        all: async () => {
          sqlLog.push(sql);
          return {
            results: Array.from(columns).map((name) => ({ name })),
          };
        },
        run: async () => {
          sqlLog.push(sql);
          const match = sql.match(/ADD COLUMN "((?:[^"]|"")+)"/);
          const columnName = match?.[1]?.replaceAll('""', '"');

          if (!columnName) {
            throw new Error(`Unexpected SQL: ${sql}`);
          }

          if (duplicateColumns.has(columnName)) {
            throw new Error('duplicate column name');
          }

          columns.add(columnName);
          return {
            success: true,
          };
        },
      };
    },
  } as unknown as D1Database;

  return {
    db,
    sqlLog,
  };
}

describe('dynamic schema helpers', () => {
  it('normalizes reserved field names into safe dynamic columns', () => {
    expect(dynamicColumnName('payload_json')).toMatch(
      /^field_payload_json_[a-z0-9]+$/,
    );
    expect(dynamicColumnName('123 phone')).toMatch(
      /^f_123_phone_[a-z0-9]+$/,
    );
  });

  it('adds missing dynamic columns once per trimmed field name', async () => {
    const { db, sqlLog } = createFakeDb([
      'id',
      'payload_json',
    ]);

    const mappings = await ensureDynamicColumns(
      db,
      'nct_form',
      [' Email ', 'full name', 'Email', 'full name'],
    );

    expect([...mappings.keys()]).toEqual([
      'Email',
      'full name',
    ]);
    expect([...mappings.values()]).toHaveLength(2);
    expect(
      sqlLog.filter((sql) => sql.includes('ALTER TABLE')),
    ).toHaveLength(2);
  });

  it('reuses existing columns, tolerates duplicate-column races, and extracts values', async () => {
    const seedDb = createFakeDb();
    const seedMappings = await ensureDynamicColumns(
      seedDb.db,
      'nct_form',
      ['email', 'notes'],
    );
    const emailColumn = seedMappings.get('email');
    const notesColumn = seedMappings.get('notes');

    expect(emailColumn).toBeTruthy();
    expect(notesColumn).toBeTruthy();

    const reusedDb = createFakeDb([emailColumn!], new Set([notesColumn!]));
    const mappings = await ensureDynamicColumns(
      reusedDb.db,
      'nct_form',
      ['email', 'notes'],
    );

    expect(mappings.get('email')).toBe(emailColumn);
    expect(mappings.get('notes')).toBe(notesColumn);
    expect(
      reusedDb.sqlLog.filter((sql) => sql.includes('ALTER TABLE')),
    ).toHaveLength(1);

    expect(
      serializeDynamicColumnValue({
        nested: true,
        list: [1, 2],
      }),
    ).toBe('{"list":[1,2],"nested":true}');
    expect(serializeDynamicColumnValue(null)).toBeNull();

    const extracted = extractDynamicColumns(
      {
        [emailColumn!]: 'demo@example.com',
        [notesColumn!]: '{"list":[1,2],"nested":true}',
      },
      ['notes', 'email'],
    );

    expect(extracted).toEqual({
      email: 'demo@example.com',
      notes: '{"list":[1,2],"nested":true}',
    });
  });
});
