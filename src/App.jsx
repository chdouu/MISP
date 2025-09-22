import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Empty,
  Layout,
  Radio,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  BulbOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';
import { database } from './firebase';
import './App.css';

const { RangePicker } = DatePicker;
const { Header, Content } = Layout;

const rangeOptions = [
  { label: '1小時', value: '1h' },
  { label: '24小時', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '全部', value: 'all' },
  { label: '自訂', value: 'custom' },
];

const formatMetric = (value, unit, precision = 1) => {
  if (value === null || value === undefined) {
    return '--';
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return '--';
  }

  const formatted = numericValue.toFixed(precision);
  return unit ? `${formatted} ${unit}` : formatted;
};

function App() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rangeKey, setRangeKey] = useState('24h');
  const [customRange, setCustomRange] = useState(null);
  const [mode, setMode] = useState('default');

  useEffect(() => {
    const readingsQuery = query(ref(database), orderByChild('ts'), limitToLast(720));

    const unsubscribe = onValue(
      readingsQuery,
      (snapshot) => {
        const value = snapshot.val();
        if (!value) {
          setReadings([]);
          setLoading(false);
          return;
        }

        const parsed = Object.entries(value)
          .map(([id, item]) => {
            const humidity = item?.humid ?? item?.humidity;
            const temperature = item?.temp ?? item?.temperature;
            const uv = item?.uv;
            const ts = item?.ts ?? item?.timestamp;
            const timestampRaw = Number(ts);
            const timestamp = Number.isNaN(timestampRaw)
              ? null
              : timestampRaw > 1e12
                ? timestampRaw
                : timestampRaw * 1000;

            return {
              id,
              humidity: humidity !== undefined ? Number(humidity) : null,
              temperature: temperature !== undefined ? Number(temperature) : null,
              uv: uv !== undefined ? Number(uv) : null,
              timestamp,
            };
          })
          .filter((item) => item.timestamp)
          .sort((a, b) => a.timestamp - b.timestamp);

        setReadings(parsed);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to read data from Firebase:', err);
        setError('無法載入資料，請稍後再試。');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const activeReadings = useMemo(() => {
    if (mode === 'mock') {
      const now = Date.now();
      const points = 48;
      const intervalMs = (12 * 60 * 60 * 1000) / points;
      return Array.from({ length: points }, (_, index) => {
        const temperatureBase = 24 + Math.sin(index / 6) * 3;
        const humidityBase = 60 + Math.cos(index / 5) * 10;
        const uvBase = 4 + Math.sin(index / 8) * 2;

        return {
          id: `mock-${index}`,
          temperature: Number((temperatureBase + (Math.random() - 0.5)).toFixed(2)),
          humidity: Number((humidityBase + (Math.random() - 0.5) * 2).toFixed(2)),
          uv: Number((uvBase + (Math.random() - 0.5) * 0.6).toFixed(2)),
          timestamp: now - (points - 1 - index) * intervalMs,
        };
      });
    }

    return readings;
  }, [mode, readings]);

  const filteredReadings = useMemo(() => {
    if (!activeReadings.length) {
      return [];
    }

    if (rangeKey === 'all') {
      return activeReadings;
    }

    if (rangeKey === 'custom') {
      if (!customRange || !customRange[0] || !customRange[1]) {
        return activeReadings;
      }

      const startMs = customRange[0].valueOf();
      const endMs = customRange[1].valueOf();
      return activeReadings.filter((item) => item.timestamp >= startMs && item.timestamp <= endMs);
    }

    const presets = {
      '1h': { amount: 1, unit: 'hour' },
      '24h': { amount: 24, unit: 'hour' },
      '7d': { amount: 7, unit: 'day' },
      '30d': { amount: 30, unit: 'day' },
    };

    const preset = presets[rangeKey] ?? presets['24h'];
    const endMs = Date.now();
    const startMs = dayjs(endMs).subtract(preset.amount, preset.unit).valueOf();

    return activeReadings.filter((item) => item.timestamp >= startMs && item.timestamp <= endMs);
  }, [activeReadings, rangeKey, customRange]);

  const chartData = useMemo(
    () =>
      filteredReadings.map((item) => ({
        ...item,
        timeLabel: dayjs(item.timestamp).format('MM/DD HH:mm'),
      })),
    [filteredReadings],
  );

  const isLoading = mode === 'default' ? loading : false;
  const latestReading = activeReadings.length ? activeReadings[activeReadings.length - 1] : null;
  const activeLastUpdated = latestReading?.timestamp ?? null;
  const lastUpdatedLabel = activeLastUpdated
    ? dayjs(activeLastUpdated).format('YYYY/MM/DD HH:mm:ss')
    : mode === 'mock'
      ? '模擬資料'
      : '尚無資料';

  const handleRangeKeyChange = (value) => {
    setRangeKey(value);
    if (value !== 'custom') {
      setCustomRange(null);
    } else if (!customRange) {
      const now = dayjs();
      setCustomRange([now.subtract(24, 'hour'), now]);
    }
  };

  const handleCustomRangeChange = (value) => {
    if (!value || !value[0] || !value[1]) {
      setCustomRange(null);
      return;
    }

    setCustomRange(value);
    setRangeKey('custom');
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorBgLayout: '#f0f6ff',
          colorBgContainer: '#ffffff',
          borderRadiusLG: 16,
          fontSize: 14,
        },
        components: {
          Card: {
            boxShadow: '0 16px 40px rgba(12, 72, 176, 0.1)',
          },
        },
      }}
    >
      <Layout className="app-layout">
        <Header className="app-header">
          <Typography.Title level={3} className="header-title">
            ESP32 環境監測儀表板
          </Typography.Title>
          <Typography.Text className="header-subtitle">
            即時追蹤溫度、濕度與紫外線指數
          </Typography.Text>
          <Space size="middle" align="center" wrap>
            <Tag icon={<ClockCircleOutlined />} color="geekblue" className="update-tag">
              最近更新：{lastUpdatedLabel}
            </Tag>
            <Tag color={mode === 'default' ? 'blue' : 'orange'}>
              {mode === 'default' ? '預設模式' : '模擬模式'}
            </Tag>
            <Radio.Group
              optionType="button"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <Radio.Button value="default">預設模式</Radio.Button>
              <Radio.Button value="mock">模擬模式</Radio.Button>
            </Radio.Group>
          </Space>
        </Header>
        <Content className="app-content">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {error ? (
              <Alert message="讀取資料時發生問題" description={error} type="error" showIcon />
            ) : null}

            <Row gutter={[24, 24]}>
              <Col xs={24} md={8}>
                <Card className="metric-card" loading={isLoading} bordered={false}>
                  <Space align="center" size={18}>
                    <div className="metric-icon temperature">
                      <FireOutlined />
                    </div>
                    <Statistic
                      title="溫度"
                      value={latestReading?.temperature}
                      formatter={(value) => formatMetric(value, '°C')}
                    />
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="metric-card" loading={isLoading} bordered={false}>
                  <Space align="center" size={18}>
                    <div className="metric-icon humidity">
                      <CloudOutlined />
                    </div>
                    <Statistic
                      title="濕度"
                      value={latestReading?.humidity}
                      formatter={(value) => formatMetric(value, '%')}
                    />
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="metric-card" loading={isLoading} bordered={false}>
                  <Space align="center" size={18}>
                    <div className="metric-icon uv">
                      <BulbOutlined />
                    </div>
                    <Statistic
                      title="紫外線指數"
                      value={latestReading?.uv}
                      formatter={(value) => formatMetric(value, '')}
                    />
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="chart-card" bordered={false} loading={isLoading && !chartData.length}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div className="range-controls">
                  <Segmented
                    options={rangeOptions}
                    value={rangeKey}
                    onChange={handleRangeKeyChange}
                  />
                  <RangePicker
                    showTime
                    allowClear
                    value={rangeKey === 'custom' ? customRange : null}
                    onChange={handleCustomRangeChange}
                    disabled={!activeReadings.length}
                    style={{ minWidth: 260 }}
                  />
                </div>

                {!chartData.length && !isLoading ? (
                  <Empty description="尚無歷史數據" style={{ marginTop: 40 }} />
                ) : (
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 119, 255, 0.1)" />
                        <XAxis
                          dataKey="timestamp"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => dayjs(value).format('MM/DD HH:mm')}
                          stroke="rgba(14, 26, 43, 0.45)"
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="rgba(14, 26, 43, 0.45)"
                          tickLine={false}
                          axisLine={false}
                          width={48}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="rgba(14, 26, 43, 0.45)"
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 'auto']}
                          width={48}
                        />
                        <Tooltip
                          labelFormatter={(value) => dayjs(value).format('YYYY/MM/DD HH:mm')}
                          formatter={(value, name) => {
                            if (value === null || value === undefined) {
                              return '--';
                            }
                            const numericValue = Number(value);
                            if (Number.isNaN(numericValue)) {
                              return '--';
                            }
                            if (name === 'temperature') {
                              return [`${numericValue.toFixed(1)} °C`, '溫度'];
                            }
                            if (name === 'humidity') {
                              return [`${numericValue.toFixed(1)} %`, '濕度'];
                            }
                            return [`${numericValue.toFixed(1)}`, '紫外線指數'];
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          formatter={(value) => {
                            if (value === 'temperature') return '溫度';
                            if (value === 'humidity') return '濕度';
                            return '紫外線指數';
                          }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="temperature"
                          stroke="#ff784e"
                          strokeWidth={2}
                          dot={false}
                          name="temperature"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="humidity"
                          stroke="#4096ff"
                          strokeWidth={2}
                          dot={false}
                          name="humidity"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="uv"
                          stroke="#00c6b8"
                          strokeWidth={2}
                          dot={false}
                          name="uv"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Space>
            </Card>
          </Space>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
