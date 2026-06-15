import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  Upload,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Sparkles,
  Loader2,
  Trash2,
  Database,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Newspaper,
  FileText,
  Plus,
  Info
} from 'lucide-react';
import { useStockData, type StockStats, calculateSMA, calculateEMA, calculateRSI, type StockRow } from '../hooks/useStockData';
import type { AppSettings } from '../lib/db';

// Register Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

interface StockAnalyzerProps {
  settings: AppSettings;
  generateResponse?: (
    messages: any[],
    temperature: number,
    maxTokens: number,
    onToken: (token: string) => void,
    signal?: AbortSignal,
  ) => Promise<string>;
  aiReady?: boolean;
}

type ChartType = 'line' | 'area' | 'bar' | 'volume';

const QUICK_TICKERS = [
  { label: 'NIFTY 50', symbol: '^NSEI' },
  { label: 'Reliance', symbol: 'RELIANCE' },
  { label: 'TCS', symbol: 'TCS' },
  { label: 'Infosys', symbol: 'INFY' },
  { label: 'HDFC Bank', symbol: 'HDFCBANK' }
];

export function StockAnalyzer({ settings, generateResponse, aiReady }: StockAnalyzerProps) {
  const {
    filteredData,
    fileName,
    parseError,
    news,
    isFetching,
    isFetchingNews,
    parseCSV,
    filterByDateRange,
    getStatistics,
    fetchLiveStockData,
    fetchMarketNews,
    generateSampleData,
    clearData,
    hasData,
  } = useStockData();

  // Search quotes
  const [tickerQuery, setTickerQuery] = useState('');
  const [activeTicker, setActiveTicker] = useState('');

  // Toggles for Technical Indicators
  const [showSma20, setShowSma20] = useState(false);
  const [showEma50, setShowEma50] = useState(false);
  const [showRsi14, setShowRsi14] = useState(false);

  // Comparison states
  const [compareQuery, setCompareQuery] = useState('');
  const [compareData, setCompareData] = useState<StockRow[]>([]);
  const [compareName, setCompareName] = useState('');
  const [isComparing, setIsComparing] = useState(false);

  // Layout states
  const [chartType, setChartType] = useState<ChartType>('area');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stats = hasData ? getStatistics() : null;

  // Sync date range filter
  useEffect(() => {
    filterByDateRange(dateStart, dateEnd);
  }, [dateStart, dateEnd, filterByDateRange]);

  // Handle standard CSV file drops
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setCompareData([]);
        setCompareName('');
        parseCSV(file);
        setDateStart('');
        setDateEnd('');
        setAiResponse('');
        setActiveTicker('');
        fetchMarketNews(); // load general market news
      }
      e.target.value = '';
    },
    [parseCSV, fetchMarketNews],
  );

  // Initial news load on mount
  useEffect(() => {
    fetchMarketNews();
  }, [fetchMarketNews]);

  // Run live ticker queries
  const handleTickerSearch = async (symbol: string) => {
    if (!symbol.trim()) return;
    setCompareData([]);
    setCompareName('');
    const ticker = symbol.trim().toUpperCase();
    setActiveTicker(ticker);
    setAiResponse('');
    
    await fetchLiveStockData(ticker);
    await fetchMarketNews(ticker);
  };

  // Run comparative ticker fetches
  const handleCompareSearch = async () => {
    if (!compareQuery.trim() || !hasData) return;
    setIsComparing(true);
    let ticker = compareQuery.trim().toUpperCase();
    if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO') && !ticker.startsWith('^')) {
      ticker = `${ticker}.NS`;
    }

    try {
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3mo&interval=1d`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Comparison symbol quote unavailable.');

      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('No historical records found.');

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      
      const rows: StockRow[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] == null) continue;
        const d = new Date(timestamps[i] * 1000);
        rows.push({
          date: d.toISOString().split('T')[0],
          open: 0, high: 0, low: 0,
          close: Math.round(closes[i] * 100) / 100,
          volume: 0
        });
      }

      setCompareData(rows);
      setCompareName(ticker);
      setCompareQuery('');
    } catch (err) {
      console.error(err);
      alert('Failed to load comparison ticker data.');
    } finally {
      setIsComparing(false);
    }
  };

  // Trigger browser print sheet to download vector PDF
  const handleExportPDF = () => {
    window.print();
  };

  // AI insights query builder
  const handleAskAI = useCallback(async () => {
    if (!generateResponse || !aiReady || aiLoading || !aiQuestion.trim() || !stats) return;

    setAiLoading(true);
    setAiResponse('');

    const prices = filteredData.map(r => r.close);
    const rsiVals = calculateRSI(prices, 14);
    const lastRsi = rsiVals.length > 0 ? rsiVals[rsiVals.length - 1] : NaN;

    const dataSummary = `
Stock: ${fileName}
Period: ${stats.startDate} to ${stats.endDate} (${stats.tradingDays} trading days)
Close price range: ₹${stats.minClose.toLocaleString()} – ₹${stats.maxClose.toLocaleString()}
Average close level: ₹${stats.avgClose.toLocaleString()}
Percentage Change: ${stats.percentChange > 0 ? '+' : ''}${stats.percentChange}%
Total Volume: ${(stats.totalVolume / 1e9).toFixed(2)} Billion
Indicators: SMA20 enabled=${showSma20}, EMA50 enabled=${showEma50}, RSI14 current=${isNaN(lastRsi) ? 'N/A' : lastRsi.toFixed(1)}
Last 5 closing values: ${filteredData.slice(-5).map((r) => `${r.date}: ₹${r.close}`).join(' | ')}
`.trim();

    const systemMsg = {
      id: 'sys',
      role: 'system' as const,
      content: 'You are an expert Indian stock market analyst. Provide concise, data-driven technical analysis and insights. Use ₹ for INR currency representations.',
      timestamp: Date.now(),
    };
    const userMsg = {
      id: 'usr',
      role: 'user' as const,
      content: `Analyze this stock data summary:\n\n${dataSummary}\n\nUser Question: ${aiQuestion}`,
      timestamp: Date.now(),
    };

    abortRef.current = new AbortController();
    let full = '';

    try {
      await generateResponse(
        [systemMsg, userMsg],
        settings.temperature,
        settings.maxTokens,
        (token) => {
          full += token;
          setAiResponse(full);
        },
        abortRef.current.signal,
      );
    } catch {
      if (!abortRef.current?.signal.aborted) {
        setAiResponse('❌ AI analysis failed. Please verify the AI model is ready in the Chat tab.');
      }
    } finally {
      setAiLoading(false);
      abortRef.current = null;
    }
  }, [generateResponse, aiReady, aiLoading, aiQuestion, stats, filteredData, fileName, settings, showSma20, showEma50]);

  // Build Primary price/volume chart data
  const closePrices = filteredData.map((r) => r.close);
  const sma25Values = showSma20 ? calculateSMA(closePrices, 20) : [];
  const ema50Values = showEma50 ? calculateEMA(closePrices, 50) : [];

  // Check if comparison overlays should render
  const rendersComparison = compareData.length > 0;

  const buildChartDataLocal = () => {
    const labels = filteredData.map((r) => r.date);

    if (chartType === 'volume') {
      return {
        labels,
        datasets: [
          {
            label: 'Volume',
            data: filteredData.map((r) => r.volume),
            backgroundColor: 'rgba(139, 92, 246, 0.45)', // Violet volume color
            borderColor: 'rgba(139, 92, 246, 0.8)',
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
      };
    }

    if (rendersComparison) {
      // Return percentage-normalized comparative charts
      const baseStart = closePrices[0] || 1;
      const basePercentage = filteredData.map((r) => ((r.close - baseStart) / baseStart) * 100);

      // Find matching date values for compared ticker
      const compareStart = compareData[0]?.close || 1;
      const comparePercentage = filteredData.map((r) => {
        const match = compareData.find(c => c.date === r.date);
        const price = match ? match.close : compareStart;
        return ((price - compareStart) / compareStart) * 100;
      });

      return {
        labels,
        datasets: [
          {
            label: `${fileName.replace('LIVE:', '')} (% change)`,
            data: basePercentage,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.05)',
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2
          },
          {
            label: `${compareName} (% change)`,
            data: comparePercentage,
            borderColor: '#ec4899', // Pink compare color
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      };
    }

    // Default price datasets
    const datasets: any[] = [
      {
        label: 'Close Price',
        data: closePrices,
        borderColor: '#8b5cf6',
        backgroundColor: chartType === 'area' ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
        fill: chartType === 'area',
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2.5,
      }
    ];

    if (chartType === 'line') {
      datasets.push(
        {
          label: 'High Bounds',
          data: filteredData.map((r) => r.high),
          borderColor: 'rgba(16, 185, 129, 0.45)',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [3, 3]
        },
        {
          label: 'Low Bounds',
          data: filteredData.map((r) => r.low),
          borderColor: 'rgba(239, 68, 68, 0.45)',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [3, 3]
        }
      );
    }

    // Append technical indicators overlays
    if (showSma20) {
      datasets.push({
        label: 'SMA 20',
        data: sma25Values,
        borderColor: '#f59e0b', // Amber SMA
        backgroundColor: 'transparent',
        fill: false,
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0.2
      });
    }

    if (showEma50) {
      datasets.push({
        label: 'EMA 50',
        data: ema50Values,
        borderColor: '#10b981', // Emerald EMA
        backgroundColor: 'transparent',
        fill: false,
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0.2
      });
    }

    return { labels, datasets };
  };

  const chartData = buildChartDataLocal();

  // Price chart configurations
  const buildChartOptionsLocal = (): ChartOptions<'line'> => {
    const textColor = settings.theme === 'dark' ? '#94a3b8' : '#475569';
    const gridColor = settings.theme === 'dark' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.5)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, boxWidth: 10, padding: 12, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: settings.theme === 'dark' ? '#0f172a' : '#ffffff',
          titleColor: settings.theme === 'dark' ? '#f1f5f9' : '#0f172a',
          bodyColor: textColor,
          borderColor: settings.theme === 'dark' ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              if (val == null) return '';
              if (chartType === 'volume') return `Volume: ${(val / 1e6).toFixed(1)}M`;
              if (rendersComparison) return `${ctx.dataset.label}: ${val.toFixed(2)}%`;
              return `${ctx.dataset.label}: ₹${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor, drawOnChartArea: true } as any,
          ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 10 },
        },
        y: {
          grid: { color: gridColor, drawOnChartArea: true } as any,
          ticks: {
            color: textColor,
            font: { size: 10 },
            callback: (val) => {
              if (val == null) return '';
              if (chartType === 'volume') return `${((val as number) / 1e6).toFixed(0)}M`;
              if (rendersComparison) return `${val}%`;
              return `₹${(val as number).toLocaleString()}`;
            },
          },
        },
      },
    };
  };

  const chartOptions = buildChartOptionsLocal();

  // RSI Chart Construction
  const rsiValues = calculateRSI(closePrices, 14);
  const rsiChartData = {
    labels: filteredData.map((r) => r.date),
    datasets: [
      {
        label: 'RSI 14',
        data: rsiValues,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        fill: true,
        tension: 0.15,
        pointRadius: 0,
        borderWidth: 1.5
      }
    ]
  };

  const rsiChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { display: false } // Align timestamps with price chart, hide bottom labels
      },
      y: {
        min: 10,
        max: 90,
        ticks: {
          stepSize: 20,
          color: settings.theme === 'dark' ? '#94a3b8' : '#475569',
          font: { size: 9 }
        },
        grid: {
          color: (ctx: any) => {
            if (ctx.tick.value === 30 || ctx.tick.value === 70) {
              return 'rgba(239, 68, 68, 0.4)'; // Red boundaries for overbought/oversold
            }
            return 'rgba(30, 41, 59, 0.15)';
          }
        }
      }
    }
  };

  return (
    <div className="tab-container fade-in">
      <div className="stock-workspace">
        {/* Left Control Panel */}
        <div className="control-panel stock-controls">
          <div className="panel-header">
            <h3>📈 Stock Analyzer</h3>
            <p className="panel-subtitle">Fetch live Indian stocks, plot moving averages, and request AI analysis</p>
          </div>

          <div className="control-form">
            {/* Live Search Bar */}
            <div className="form-group">
              <label>Search Tickers (NSE India)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={tickerQuery}
                  onChange={(e) => setTickerQuery(e.target.value)}
                  placeholder="e.g. RELIANCE, TCS, INFY, ^NSEI"
                  onKeyDown={(e) => e.key === 'Enter' && handleTickerSearch(tickerQuery)}
                  style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleTickerSearch(tickerQuery)}
                  disabled={isFetching}
                  style={{ padding: '8px 12px' }}
                >
                  {isFetching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>
              <span className="input-help">
                Fetches live data + related business news feed.
              </span>
            </div>

            {/* Quick links */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {QUICK_TICKERS.map((t) => (
                <button
                  key={t.symbol}
                  className={`btn btn-ghost`}
                  onClick={() => {
                    setTickerQuery(t.symbol);
                    handleTickerSearch(t.symbol);
                  }}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* CSV File Upload fallback */}
            <div className="form-group">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                className="btn btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%', border: '1px dashed var(--border)', justifyContent: 'center' }}
              >
                <Upload size={14} /> Upload Custom CSV
              </button>
            </div>

            {hasData && (
              <>
                <div className="csv-info-card" style={{ marginBottom: 12 }}>
                  <div className="csv-info-header">
                    <BarChart3 size={15} color="var(--accent)" />
                    <span className="csv-filename" style={{ fontWeight: 600 }}>{fileName}</span>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => {
                        clearData();
                        setAiResponse('');
                        setDateStart('');
                        setDateEnd('');
                        setCompareData([]);
                        setCompareName('');
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="csv-info-meta">
                    {filteredData.length} entries {stats && ` • ${stats.startDate} → ${stats.endDate}`}
                  </div>
                </div>

                {/* Date filter */}
                <div className="form-group">
                  <label><Calendar size={12} /> Date Filtering</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input
                      type="date"
                      value={dateStart}
                      onChange={(e) => setDateStart(e.target.value)}
                      style={{ fontSize: 11, padding: '6px 8px' }}
                    />
                    <input
                      type="date"
                      value={dateEnd}
                      onChange={(e) => setDateEnd(e.target.value)}
                      style={{ fontSize: 11, padding: '6px 8px' }}
                    />
                  </div>
                </div>

                {/* Chart type */}
                <div className="engine-select-group">
                  <label>Chart Display Type</label>
                  <div className="engine-toggle-buttons" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    {(['line', 'area', 'bar', 'volume'] as ChartType[]).map((t) => (
                      <button
                        key={t}
                        className={`toggle-option ${chartType === t ? 'selected' : ''}`}
                        onClick={() => setChartType(t)}
                        style={{ fontSize: 10, padding: '6px 2px' }}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technical Indicator Checkboxes */}
                <div className="video-settings-group animate-fade" style={{ marginTop: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    📊 Technical Indicators
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showSma20}
                        onChange={(e) => setShowSma20(e.target.checked)}
                        disabled={chartType === 'volume'}
                      />
                      <span>SMA 20 (Moving Average)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showEma50}
                        onChange={(e) => setShowEma50(e.target.checked)}
                        disabled={chartType === 'volume'}
                      />
                      <span>EMA 50 (Exponential MA)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showRsi14}
                        onChange={(e) => setShowRsi14(e.target.checked)}
                        disabled={chartType === 'volume'}
                      />
                      <span>RSI 14 (Strength Oscillator)</span>
                    </label>
                  </div>
                </div>

                {/* Multi Ticker Comparison */}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label><Plus size={12} /> Compare Tickers (Normalized %)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={compareQuery}
                      onChange={(e) => setCompareQuery(e.target.value)}
                      placeholder="e.g. TCS, INFY"
                      style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={handleCompareSearch}
                      disabled={isComparing || !compareQuery.trim()}
                      style={{ padding: '6px 12px' }}
                    >
                      {isComparing ? <Loader2 size={12} className="animate-spin" /> : 'Compare'}
                    </button>
                  </div>
                </div>

                {/* Statistics Card grid */}
                {stats && <StatsCard stats={stats} />}

                {/* RAG analysis inputs */}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>
                    <Sparkles size={12} /> AI Technical Evaluation
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="e.g. Predict trend of this asset?"
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                      style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleAskAI}
                      disabled={!aiReady || aiLoading || !aiQuestion.trim()}
                      style={{ padding: '8px 12px' }}
                    >
                      {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </button>
                  </div>
                </div>

                {/* Export Report Trigger */}
                <button
                  className="btn btn-ghost"
                  onClick={handleExportPDF}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12, border: '1px solid var(--border)' }}
                >
                  <FileText size={14} /> Download PDF Report
                </button>
              </>
            )}

            {/* Mock button */}
            {!hasData && (
              <button
                className="btn btn-ghost"
                onClick={generateSampleData}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              >
                <Database size={14} /> Mock NIFTY 50 Sample Data
              </button>
            )}

            {parseError && (
              <div className="engine-info-note warning" style={{ marginTop: 12 }}>
                <span>⚠️ {parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Output details & Chart / News grid split */}
        <div className="stock-chart-area">
          {!hasData ? (
            <div className="viewport-empty">
              <div className="placeholder-icon-circle">
                <TrendingUp size={28} />
              </div>
              <h4>No Ticker Loaded</h4>
              <p>Type an Indian stock symbol above (e.g. TCS) or upload a custom CSV dataset to display analysis.</p>
            </div>
          ) : (
            <div className="stock-chart-container" style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr', gap: 16 }}>
              {/* Chart panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="chart-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="chart-title-row" style={{ padding: '12px 16px' }}>
                    <h4>{fileName.replace('LIVE:', '')} {compareName && `vs ${compareName}`}</h4>
                    {stats && (
                      <span className={`change-badge ${stats.percentChange >= 0 ? 'up' : 'down'}`}>
                        {stats.percentChange >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {stats.percentChange > 0 ? '+' : ''}{stats.percentChange}%
                      </span>
                    )}
                  </div>
                  
                  {/* Price display overlay chart */}
                  <div className="chart-wrapper" style={{ flex: showRsi14 ? 2.2 : 3, minHeight: 220 }}>
                    {chartType === 'volume' || chartType === 'bar' ? (
                      <Bar data={chartData} options={chartOptions as any} />
                    ) : (
                      <Line data={chartData} options={chartOptions as any} />
                    )}
                  </div>

                  {/* RSI panel chart */}
                  {showRsi14 && chartType !== 'volume' && (
                    <div className="rsi-chart-panel" style={{ height: 100, borderTop: '1px solid var(--border)', padding: '8px 12px 2px 12px', background: 'var(--bg-base)' }}>
                      <span style={{ fontSize: 9, fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase' }}>RSI (14)</span>
                      <div style={{ height: 75 }}>
                        <Line data={rsiChartData} options={rsiChartOptions as any} />
                      </div>
                    </div>
                  )}
                </div>

                {/* AI text insights */}
                {aiResponse && (
                  <div className="stock-ai-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Sparkles size={13} color="var(--violet)" />
                      <strong style={{ fontSize: 12 }}>Technical Evaluation</strong>
                      {aiLoading && <Loader2 size={12} className="animate-spin" />}
                    </div>
                    <pre className="ai-insight-text" style={{ whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                      {aiResponse}
                      {aiLoading && <span className="streaming-cursor" />}
                    </pre>
                  </div>
                )}
              </div>

              {/* Business News sidebar */}
              <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <Newspaper size={15} color="var(--accent)" />
                  <h4 style={{ margin: 0, fontSize: 13 }}>Live Market News</h4>
                  {isFetchingNews && <Loader2 size={12} className="animate-spin" />}
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440 }} className="news-body-scroller">
                  {news.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                      No stock-specific reports found.
                    </div>
                  ) : (
                    news.map((item, idx) => (
                      <a
                        key={idx}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          padding: 8,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          textDecoration: 'none',
                          color: 'inherit',
                          transition: 'border-color 0.2s'
                        }}
                        className="news-card-hover"
                      >
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                          {item.source}
                        </span>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: 11, lineHeight: 1.35, color: 'var(--text-primary)', fontWeight: 500 }}>
                          {item.title}
                        </h5>
                        <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                          {item.pubDate}
                        </span>
                      </a>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Stats Card Rendering grid */
function StatsCard({ stats }: { stats: StockStats }) {
  const isUp = stats.percentChange >= 0;
  return (
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-label">Min Low</span>
        <span className="stat-value">₹{stats.minClose.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Max High</span>
        <span className="stat-value">₹{stats.maxClose.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Average Close</span>
        <span className="stat-value">₹{stats.avgClose.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Price Change</span>
        <span className={`stat-value ${isUp ? 'stat-up' : 'stat-down'}`}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isUp ? '+' : ''}{stats.percentChange}%
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Volume</span>
        <span className="stat-value">{(stats.totalVolume / 1e9).toFixed(2)}B</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Sessions</span>
        <span className="stat-value">{stats.tradingDays}</span>
      </div>
    </div>
  );
}
