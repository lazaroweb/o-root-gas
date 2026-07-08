---
name: gas-frontend-patterns
description: Frontend development patterns for React + TypeScript in a Google Apps Script webapp. State management, API calls via google.script.run, forms, error handling, and GAS-specific constraints.
---

# Frontend Patterns for GAS Webapps

React + TypeScript patterns adapted for the Google Apps Script environment.

## GAS-specific constraints (always remember)

1. **No routing** — single page only. No React Router, no hash routing.
2. **No localStorage** — GAS iframe blocks it. Use component state or URL params.
3. **No client-side fetch()** — call GAS server functions instead.
4. **No dynamic import()** — everything must be bundled statically.
5. **Bundle < 1.5MB** — keep imports lean and tree-shaken.
6. **`google.script.run` is async** — always wrap in promises, never use callback style.

---

## Calling GAS server functions

Always use this promise wrapper — never use raw callback style:

```typescript
// src/gas-client.ts
function callServer<T>(fnName: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    (google.script.run as unknown as Record<string, unknown>)
      .withSuccessHandler(resolve as (r: unknown) => void)
      .withFailureHandler((err: Error) => reject(err))
      [fnName](...args);
  });
}

export default callServer;
```

Usage:
```typescript
import callServer from './gas-client';

const data = await callServer<MyData[]>('getRows');
```

**Local development fallback** — wrap in try/catch since `google` is undefined locally:
```typescript
async function fetchData(): Promise<MyData[]> {
  try {
    return await callServer<MyData[]>('getRows');
  } catch {
    // Return mock data when running locally (google.script.run not available)
    return MOCK_DATA;
  }
}
```

---

## State management patterns

### Simple local state (most cases)
```typescript
const [data, setData] = useState<MyData[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchData()
    .then(setData)
    .catch((err: Error) => setError(err.message))
    .finally(() => setLoading(false));
}, []);
```

### Loading + error pattern (always include both)
```tsx
if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 48 }} />;
if (error) return <Alert type="error" message={error} showIcon />;
return <MyContent data={data} />;
```

### Form state
```typescript
const [form] = Form.useForm<FormValues>();

const handleSubmit = async (values: FormValues) => {
  setLoading(true);
  try {
    await callServer('saveRow', values);
    message.success('Saved!');
    form.resetFields();
  } catch (err: unknown) {
    message.error(err instanceof Error ? err.message : 'Something went wrong');
  } finally {
    setLoading(false);
  }
};
```

---

## Component patterns

### Page component structure
```tsx
interface PageProps {
  // always type props explicitly
}

export default function MyPage(_props: PageProps) {
  // 1. hooks at the top
  // 2. derived state / computed values
  // 3. event handlers
  // 4. render
  return (
    <div style={{ padding: 24 }}>
      {/* content */}
    </div>
  );
}
```

### Prop drilling vs. lifting state

For GAS apps (single page), lifting state to the top-level `App` component works fine. No need for Context or external state libraries for most use cases.

---

## TypeScript conventions

- Always use `interface` for object shapes, `type` for unions/primitives
- Server response types go in `src/types.ts`
- No `any` — use `unknown` and narrow it
- Component props: always explicitly typed even if empty

```typescript
// src/types.ts
export interface Row {
  id: string;
  name: string;
  value: number;
}

export type Status = 'pending' | 'done' | 'error';
```

---

## GAS server function patterns (`src/server.ts`)

Persistence goes through the **gas-sheet-db** skill (the server creates and
manages its own spreadsheet — never hardcode a spreadsheet ID, never ask the
user to create one). Server functions stay thin:

```typescript
// Always annotate return types. dbGetAll/dbCreate come from gas-sheet-db.
function getRows(): Row[] {
  return dbGetAll('Registros').map((r) => ({
    id: r.id,
    name: r.nome,
    value: Number(r.valor),
  }));
}

function saveRow(data: Row): void {
  dbCreate('Registros', { nome: data.name, valor: String(data.value) });
}

function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('My App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

### Server result envelope (recommended for anything that can fail)

Throwing inside a server function surfaces a cryptic error to the client.
Return a uniform envelope instead and keep the friendly message server-side:

```typescript
interface ServerResult<T = unknown> { ok: boolean; data?: T; error?: string }

function salvarRegistro(input: CreateRowInput): ServerResult<Row> {
  try {
    if (!input?.name?.trim()) return { ok: false, error: 'Informe um nome.' };
    return { ok: true, data: dbCreate('Registros', { nome: input.name }) as unknown as Row };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar' };
  }
}
```

### Timing constraints that WILL bite you

- **Each execution has ~6 minutes max.** Long jobs must be chunked and resumed
  (store a cursor in `PropertiesService` or `CacheService`, let the frontend
  call the next step).
- **`UrlFetchApp` has a hard ~60-second timeout per request.** Calling slow
  external APIs (e.g. LLMs with long prompts)? Split the work into smaller
  calls — retrying the same oversized call just fails again.

**GAS types** — add to `tsconfig.json`:
```json
{ "compilerOptions": { "types": ["google-apps-script"] } }
```

Install: `npm install --save-dev @types/google-apps-script`
