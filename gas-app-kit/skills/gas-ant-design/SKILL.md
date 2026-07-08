---
name: gas-ant-design
description: UI components with Ant Design (antd v5) inside a Google Apps Script webapp. Layout, forms, tables, modals, search, notifications, and theming via ConfigProvider.
---

# Ant Design for GAS Webapps

Ant Design v5 patterns for building UIs in a single-page Google Apps Script webapp.

## Setup

Ant Design 5.x uses CSS-in-JS — no external CSS imports needed.

Wrap your app with `ConfigProvider`:
```tsx
// src/index.tsx
import { ConfigProvider } from 'antd';
import App from './App';

root.render(
  <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
    <App />
  </ConfigProvider>
);
```

**Bundle size:** antd adds ~300–500KB when tree-shaken. Import only what you use:
```tsx
// Good — tree-shaken
import { Button, Table, Form } from 'antd';

// Avoid — imports everything
import antd from 'antd';
```

---

## Layout

```tsx
import { Layout, Menu, Typography } from 'antd';
const { Header, Content, Footer } = Layout;
const { Title } = Typography;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>My App</Title>
      </Header>
      <Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {children}
      </Content>
      <Footer style={{ textAlign: 'center' }}>My App</Footer>
    </Layout>
  );
}
```

## Forms

```tsx
import { Form, Input, Button, Select } from 'antd';

interface FormValues {
  name: string;
  category: string;
}

export default function MyForm({ onSubmit }: { onSubmit: (v: FormValues) => Promise<void> }) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: FormValues) => {
    setLoading(true);
    try {
      await onSubmit(values);
      form.resetFields();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} onFinish={handleFinish} layout="vertical">
      <Form.Item name="name" label="Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="category" label="Category" rules={[{ required: true }]}>
        <Select options={[{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }]} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
      </Form.Item>
    </Form>
  );
}
```

## Data Tables

```tsx
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface Row { id: string; name: string; value: number; }

const columns: ColumnsType<Row> = [
  { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
  { title: 'Value', dataIndex: 'value', key: 'value', sorter: (a, b) => a.value - b.value },
  {
    title: 'Actions',
    key: 'actions',
    render: (_, record) => <Button size="small" onClick={() => handleEdit(record)}>Edit</Button>,
  },
];

<Table
  columns={columns}
  dataSource={data}
  rowKey="id"
  loading={loading}
  pagination={{ pageSize: 10 }}
/>
```

## Modals

```tsx
import { Modal, Form } from 'antd';

interface EditModalProps {
  open: boolean;
  record: Row | null;
  onOk: (values: Row) => Promise<void>;
  onCancel: () => void;
}

export default function EditModal({ open, record, onOk, onCancel }: EditModalProps) {
  const [form] = Form.useForm<Row>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && record) form.setFieldsValue(record);
    else form.resetFields();
  }, [open, record]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try { await onOk(values); } finally { setLoading(false); }
  };

  return (
    <Modal title="Edit" open={open} onOk={handleOk} onCancel={onCancel} confirmLoading={loading}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

## Search / Filter

```tsx
import { Input } from 'antd';
const { Search } = Input;

const [search, setSearch] = useState('');
const filtered = data.filter(row =>
  row.name.toLowerCase().includes(search.toLowerCase())
);

<Search
  placeholder="Search..."
  onChange={e => setSearch(e.target.value)}
  style={{ width: 300, marginBottom: 16 }}
/>
```

## Notifications

```tsx
import { message, notification } from 'antd';

// Inline toast (transient)
message.success('Saved!');
message.error('Something went wrong.');

// Persistent notification
notification.error({
  message: 'Error',
  description: 'Could not save the record.',
  duration: 5,
});
```

## Theming

```tsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1677ff',    // primary brand color
      borderRadius: 6,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    components: {
      Button: { borderRadius: 4 },
    },
  }}
>
  <App />
</ConfigProvider>
```

## Craft: don't ship the "AI-generated look"

Ant Design defaults scream "template". Small, cheap moves that make the app
look designed by a senior human:

- **Pick a real palette** (one primary + neutral grays), set it once in
  `ConfigProvider` tokens — never leave the default blue on everything.
- **Typography hierarchy**: one display size for page titles, one for section
  titles, 13-14px body. Consistent spacing scale (8/12/16/24/32) — no random
  margins.
- **Density**: generous padding inside cards (16-20px), max content width with
  `margin: '0 auto'` — content glued to the viewport edges looks broken.
- **Hover states** on anything clickable (`transition` + subtle shadow lift).
- **Empty states that instruct** ("Nothing here yet — add your first record
  with the button above"), never a bare "No data".
- **Every alert needs a way out**: a primary action, a "learn more", or a
  dismiss. An alert the user can't act on is a bug.

## Loading / Empty states

```tsx
import { Spin, Empty, Alert } from 'antd';

// Use this pattern consistently across all pages
if (loading) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
if (error) return <Alert type="error" message={error} showIcon style={{ margin: 24 }} />;
if (!data.length) return <Empty description="No data yet" style={{ margin: 48 }} />;
```
