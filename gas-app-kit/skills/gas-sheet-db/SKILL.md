---
name: gas-sheet-db
description: Use Google Sheets as the app database with ZERO manual setup. The server creates the spreadsheet automatically on first run, stores its ID in Script Properties, and keeps tables/columns in sync. Use whenever the app needs to persist data, or when the user mentions spreadsheet, database, saving records, or tables.
---

# SheetDB — Google Sheets as a zero-setup database

The user should **never** have to create a spreadsheet, copy an ID, or paste
anything. The server bootstraps its own database on first access and remembers
it forever. This pattern is battle-tested in production (the Forja app runs
~40 tables on it).

## The golden rule

**All persistence goes through `_getDb_()` + the `db*` helpers below.** Never
hardcode a spreadsheet ID in source code, never ask the user to create a sheet.

## 1. Auto-bootstrap (creates the spreadsheet on first run)

```typescript
// src/server.ts
const DB_PROP_KEY = 'APP_SHEET_ID';

function _getDb_(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty(DB_PROP_KEY);
  if (saved) {
    try { return SpreadsheetApp.openById(saved); } catch (_e) { /* deleted? recreate */ }
  }
  // First run (or sheet was deleted): create and remember. User does nothing.
  const ss = SpreadsheetApp.create('MyApp — Banco de dados');
  props.setProperty(DB_PROP_KEY, ss.getId());
  return ss;
}
```

Why Script Properties and not a constant: the ID is environment state, not
code. The same codebase deploys to any account without edits, and `clasp push`
never risks pointing at someone else's data.

## 2. Declarative schema + idempotent init

Declare tables once; `_initDb_()` creates whatever is missing and appends new
columns to existing tables. Safe to call on every cold start.

```typescript
interface TableDef { name: string; columns: string[] }

const SCHEMA: TableDef[] = [
  { name: 'Registros', columns: ['id', 'nome', 'valor', 'criadoEm', 'atualizadoEm'] },
  // add tables here; bump columns freely — init appends missing ones
];

function _initDb_(): void {
  const ss = _getDb_();
  for (const t of SCHEMA) {
    let sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
      sheet.getRange(1, 1, 1, t.columns.length).setValues([t.columns]);
      sheet.setFrozenRows(1);
      continue;
    }
    // Append columns added after the table was created
    const existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
      .getValues()[0].map(String);
    const missing = t.columns.filter((c) => existing.indexOf(c) === -1);
    if (missing.length > 0) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    }
  }
}
```

## 3. CRUD helpers (the only way to touch data)

```typescript
type Row = Record<string, string>;

function _sheet_(table: string): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = _getDb_().getSheetByName(table);
  if (!sheet) { _initDb_(); return _getDb_().getSheetByName(table)!; }
  return sheet;
}

function dbGetAll(table: string): Row[] {
  const sheet = _sheet_(table);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(String);
  return values.slice(1).map((r) => {
    const row: Row = {};
    header.forEach((h, i) => { row[h] = String(r[i] ?? ''); });
    return row;
  });
}

function dbCreate(table: string, data: Partial<Row>): Row {
  const sheet = _sheet_(table);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const now = new Date().toISOString();
  const full: Row = {
    ...data,
    id: data.id || Utilities.getUuid(),
    criadoEm: data.criadoEm || now,
    atualizadoEm: now,
  } as Row;
  sheet.appendRow(header.map((h) => full[h] ?? ''));
  return full;
}

function dbUpdate(table: string, id: string, patch: Partial<Row>): boolean {
  const sheet = _sheet_(table);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idCol = header.indexOf('id');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === id) {
      const updated = { ...patch, atualizadoEm: new Date().toISOString() };
      for (const key of Object.keys(updated)) {
        const col = header.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(updated[key as keyof typeof updated]);
      }
      return true;
    }
  }
  return false;
}

function dbDelete(table: string, id: string): boolean {
  const sheet = _sheet_(table);
  const values = sheet.getDataRange().getValues();
  const idCol = values[0].map(String).indexOf('id');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === id) { sheet.deleteRow(i + 1); return true; }
  }
  return false;
}
```

## 4. Concurrency — lock writes

Two users saving at once can interleave `appendRow`. Wrap multi-step writes:

```typescript
function saveSafely(data: Partial<Row>): Row {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // throws after 10s — surface as friendly error
  try {
    return dbCreate('Registros', data);
  } finally {
    lock.releaseLock();
  }
}
```

## 5. Limits you must respect (learned in production)

| Limit | Practical guidance |
|---|---|
| ~50.000 rows per table | Beyond this, full-scan reads get slow. Archive old rows to another tab. |
| Every read is a full scan | There are no indexes. Read once per request, filter in memory. Never call `dbGetAll` inside a loop. |
| `getValue()` per cell is slow | Always read/write in ranges (`getValues`/`setValues`), never cell by cell in loops. |
| 6-minute execution limit | Batch big migrations into chunks resumable via a cursor stored in Properties. |
| Quotas per day | SpreadsheetApp calls are quota'd; caching hot reads in `CacheService` (TTL minutes) removes most of them. |

## 6. Required OAuth scope

Using `SpreadsheetApp.create` + `openById` requires in `appsscript.json`:

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.container.ui"
]
```

## What to tell the user

Plain language only: "Your app stores data in a Google Sheet that it creates
and manages by itself — you don't need to set anything up. If you ever want to
peek at the raw data, I can give you the link."

To give them the link: `_getDb_().getUrl()`.
