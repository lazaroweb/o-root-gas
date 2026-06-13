---
name: gas-typescript-pro
description: TypeScript strict mode patterns for Google Apps Script webapps. Proper types, no-any rules, GAS-specific type declarations, and common pitfalls.
---

# TypeScript for GAS Webapps

Strict TypeScript patterns for the GAS App Kit stack (React 18 + esbuild + GAS).

## tsconfig.json

The template includes this config — never downgrade settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "skipLibCheck": true,
    "types": ["google-apps-script"]
  },
  "include": ["src"]
}
```

**`types: ["google-apps-script"]`** — provides `SpreadsheetApp`, `HtmlService`, `GoogleAppsScript.*` types for `src/server.ts`.

---

## No `any` rule

Never use `any`. Alternatives:

```typescript
// Wrong
function process(data: any) { ... }

// Right — use unknown and narrow
function process(data: unknown) {
  if (typeof data === 'string') { ... }
  if (Array.isArray(data)) { ... }
}

// Right — type the response
async function getData(): Promise<Row[]> {
  return callServer<Row[]>('getRows');
}
```

---

## Typing `google.script.run`

The `google.script.run` global is not fully typed by `@types/google-apps-script`. Use this declaration:

```typescript
// src/types.ts

// Declare google global for the client (not needed in server.ts)
declare const google: {
  script: {
    run: GoogleScriptRun;
    history: { push: (params: Record<string, string>) => void };
    url: { getLocation: (cb: (loc: { parameter: Record<string, string> }) => void) => void };
  };
};

interface GoogleScriptRun {
  withSuccessHandler<T>(handler: (result: T) => void): GoogleScriptRun;
  withFailureHandler(handler: (err: Error) => void): GoogleScriptRun;
  [fnName: string]: unknown;
}
```

---

## Server function types

Define all server function signatures in `src/types.ts`:

```typescript
// src/types.ts

export interface Row {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CreateRowInput {
  name: string;
  email: string;
}

export type Status = 'active' | 'inactive' | 'pending';
```

In `src/server.ts`, use these types:
```typescript
/// <reference types="google-apps-script" />

function getRows(): Row[] {
  const sheet = getSheet();
  const [, ...rows] = sheet.getDataRange().getValues();
  return rows.map(parseRow);
}

function parseRow([id, name, email, createdAt]: string[]): Row {
  return { id, name, email, createdAt };
}
```

---

## React component patterns

```typescript
// Always type props explicitly
interface TableRowProps {
  row: Row;
  onEdit: (row: Row) => void;
  onDelete: (id: string) => void;
}

// Use explicit return type for complex components
function TableRow({ row, onEdit, onDelete }: TableRowProps): React.ReactElement {
  return (
    <tr key={row.id}>
      <td>{row.name}</td>
      <td>
        <button onClick={() => onEdit(row)}>Edit</button>
        <button onClick={() => onDelete(row.id)}>Delete</button>
      </td>
    </tr>
  );
}
```

---

## Event handler types

```typescript
// Form events
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

// Click events
const handleClick = (_e: React.MouseEvent<HTMLButtonElement>) => {
  doSomething();
};

// Ant Design form onFinish
const handleFinish = (values: FormValues): void => {
  submit(values);
};
```

---

## Error handling with unknown

```typescript
async function save(data: CreateRowInput): Promise<void> {
  try {
    await callServer<void>('saveRow', data);
  } catch (err: unknown) {
    // Narrow the unknown error type
    const msg = err instanceof Error ? err.message : 'Unknown error';
    setError(msg);
  }
}
```

---

## GAS-specific type pitfalls

| Pitfall | Fix |
|---------|-----|
| `SpreadsheetApp` not recognized in `src/App.tsx` | Only use GAS APIs in `src/server.ts`, not client files |
| `google.script.run` not typed | Use the `GoogleScriptRun` interface declaration above |
| `sheet.getValues()` returns `object[][]` | Cast: `sheet.getValues() as string[][]` or define `SpreadsheetRow` |
| `Logger.log` in client code | Only valid in `server.ts` (GAS runtime) |
| `console.log` in server code | Use `Logger.log()` in GAS server functions |
