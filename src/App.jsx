// 匯入 React hooks 與狀態管理工具
import { useEffect, useMemo, useState } from 'react';
// 匯入 Ant Design 相關 UI 元件
import {
  Alert,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Empty,
  Layout,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
// 匯入儀表板指示圖示
import {
  BulbOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
// 匯入 Recharts 圖表繪製元件
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
// 匯入日期處理函式庫 dayjs
import dayjs from 'dayjs';
// 連線 Firebase 即時資料庫所需查詢方法
import { limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';
// 匯入封裝好的資料庫實例
import { database } from './firebase';
// 匯入本頁面樣式
import './App.css';

const { RangePicker } = DatePicker;
const { Header, Content } = Layout;

// 預設時間範圍選項供使用者快速切換
const rangeOptions = [
  { label: '1小時', value: '1h' },
  { label: '24小時', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '全部', value: 'all' },
  { label: '自訂', value: 'custom' },
];

// 共用指標格式化函式，用來顯示不同單位與精度
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
  // 儲存感測數據、載入狀態與錯誤資訊
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // 追蹤篩選條件與自訂區間
  const [rangeKey, setRangeKey] = useState('24h');
  const [customRange, setCustomRange] = useState(null);

  // 連線 Firebase 即時資料庫並訂閱資料變化
  useEffect(() => {
    const readingsQuery = query(ref(database), orderByChild('ts'), limitToLast(720));

    const unsubscribe = onValue(
      readingsQuery,
      (snapshot) => {
        const value = snapshot.val();
        if (!value) {
          setReadings([]);
          setLastUpdated(null);
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
        setLastUpdated(parsed.length ? parsed[parsed.length - 1].timestamp : null);
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

  // 依據選取的時間範圍過濾資料，避免不必要的重新計算
  const filteredReadings = useMemo(() => {
    if (!readings.length) {
      return [];
    }

    if (rangeKey === 'all') {
      return readings;
    }

    if (rangeKey === 'custom') {
      if (!customRange || !customRange[0] || !customRange[1]) {
        return readings;
      }

      const startMs = customRange[0].valueOf();
      const endMs = customRange[1].valueOf();
      return readings.filter((item) => item.timestamp >= startMs && item.timestamp <= endMs);
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

    return readings.filter((item) => item.timestamp >= startMs && item.timestamp <= endMs);
  }, [readings, rangeKey, customRange]);

  // 加工成圖表專用資料格式，附上時間標籤
  const chartData = useMemo(
    () =>
      filteredReadings.map((item) => ({
        ...item,
        timeLabel: dayjs(item.timestamp).format('MM/DD HH:mm'),
      })),
    [filteredReadings],
  );

  // 取得最新的單筆資料以及最後更新時間文字
  const latestReading = readings.length ? readings[readings.length - 1] : null;
  const lastUpdatedLabel = lastUpdated
    ? dayjs(lastUpdated).format('YYYY/MM/DD HH:mm:ss')
    : '尚無資料';

  // 處理預設時間區段切換
  const handleRangeKeyChange = (value) => {
    setRangeKey(value);
    if (value !== 'custom') {
      setCustomRange(null);
    } else if (!customRange) {
      const now = dayjs();
      setCustomRange([now.subtract(24, 'hour'), now]);
    }
  };

  // 處理使用者從日期區間選擇器選取自訂範圍
  const handleCustomRangeChange = (value) => {
    if (!value || !value[0] || !value[1]) {
      setCustomRange(null);
      return;
    }

    setCustomRange(value);
    setRangeKey('custom');
  };

  // 透過 Ant Design 元件組成整體 UI
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
          <Tag icon={<ClockCircleOutlined />} color="geekblue" className="update-tag">
            最近更新：{lastUpdatedLabel}
          </Tag>
        </Header>
        <Content className="app-content">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {error ? (
              <Alert message="讀取資料時發生問題" description={error} type="error" showIcon />
            ) : null}

            <Row gutter={[24, 24]}>
              <Col xs={24} md={8}>
                <Card className="metric-card" loading={loading} bordered={false}>
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
                <Card className="metric-card" loading={loading} bordered={false}>
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
                <Card className="metric-card" loading={loading} bordered={false}>
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

            <Card className="chart-card" bordered={false} loading={loading && !chartData.length}>
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
                    disabled={!readings.length}
                    style={{ minWidth: 260 }}
                  />
                </div>

                {!chartData.length && !loading ? (
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
