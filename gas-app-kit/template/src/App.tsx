import React, { useState, useEffect } from 'react';
import { Button, Typography, Spin, Alert, Space } from 'antd';
import callServer from './gas-client';

const { Title, Paragraph } = Typography;

// Replace with your actual data types
interface AppData {
  message: string;
}

// Mock data shown when running locally (google.script.run is not available locally)
const MOCK_DATA: AppData = {
  message: 'Hello from local preview! Deploy to Google to see real data.',
};

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callServer<AppData>('getData')
      .then(setData)
      .catch((err: unknown) => {
        // When running locally, google.script.run is not available — show mock data
        if (err instanceof Error && err.message.includes('google')) {
          setData(MOCK_DATA);
        } else {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  if (error) return <Alert type="error" message={error} showIcon style={{ margin: 24 }} />;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title>My App</Title>
      <Paragraph>{data?.message}</Paragraph>
      <Space>
        <Button type="primary" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </Space>
    </div>
  );
}
