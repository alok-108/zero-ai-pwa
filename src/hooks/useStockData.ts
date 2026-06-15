// Stock data hook — CSV parsing, Live Stock feeds, RSS news parsing, and indicators
import { useState, useCallback } from 'react';
import Papa from 'papaparse';

export interface StockRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: string | number;
}

export interface StockStats {
  minClose: number;
  maxClose: number;
  avgClose: number;
  totalVolume: number;
  percentChange: number;
  tradingDays: number;
  startDate: string;
  endDate: string;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

// ───────────────────────────────────────────────────────────
// Technical Indicator Calculators
// ───────────────────────────────────────────────────────────

export function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

export function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  if (data.length === 0) return [];
  
  const k = 2 / (period + 1);
  let prevEma = data[0];
  ema.push(prevEma);

  for (let i = 1; i < data.length; i++) {
    if (i < period) {
      const sum = data.slice(0, i + 1).reduce((a, b) => a + b, 0);
      prevEma = sum / (i + 1);
      ema.push(NaN);
    } else {
      const currentEma = data[i] * k + prevEma * (1 - k);
      ema.push(currentEma);
      prevEma = currentEma;
    }
  }
  return ema;
}

export function calculateRSI(data: number[], period = 14): number[] {
  const rsi: number[] = [];
  if (data.length < period) return Array(data.length).fill(NaN);

  let gains = 0;
  let losses = 0;

  // First interval average
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    } else {
      const diff = data[i] - data[i - 1];
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }
  return rsi;
}

// ───────────────────────────────────────────────────────────
// useStockData hook
// ───────────────────────────────────────────────────────────

export function useStockData() {
  const [rawData, setRawData] = useState<StockRow[]>([]);
  const [filteredData, setFilteredData] = useState<StockRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  
  // Live states
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);

  const parseCSV = useCallback((file: File) => {
    setParseError('');
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(`CSV parse error: ${results.errors[0].message}`);
          return;
        }

        const data = results.data as Record<string, any>[];
        if (data.length === 0) {
          setParseError('CSV file is empty.');
          return;
        }

        const cols = Object.keys(data[0]);
        setColumns(cols);

        // Normalize headers mapping
        const normalize = (headers: string[]) => {
          const map: Record<string, string> = {};
          for (const h of headers) {
            const lc = h.toLowerCase().trim();
            if (lc === 'date' || lc === 'timestamp' || lc === 'time') map[h] = 'date';
            else if (lc === 'open') map[h] = 'open';
            else if (lc === 'high') map[h] = 'high';
            else if (lc === 'low') map[h] = 'low';
            else if (lc === 'close' || lc === 'adj close' || lc === 'adj_close') map[h] = 'close';
            else if (lc === 'volume' || lc === 'vol') map[h] = 'volume';
            else map[h] = h;
          }
          return map;
        };

        const colMap = normalize(cols);

        const rows: StockRow[] = data.map((row) => {
          const mapped: any = {};
          for (const [orig, norm] of Object.entries(colMap)) {
            mapped[norm] = row[orig];
          }
          mapped.open = Number(mapped.open) || 0;
          mapped.high = Number(mapped.high) || 0;
          mapped.low = Number(mapped.low) || 0;
          mapped.close = Number(mapped.close) || 0;
          mapped.volume = Number(mapped.volume) || 0;
          mapped.date = String(mapped.date || '');
          return mapped as StockRow;
        }).filter(r => r.date);

        rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setRawData(rows);
        setFilteredData(rows);
      },
      error: (err) => {
        setParseError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, []);

  const filterByDateRange = useCallback((start: string, end: string) => {
    if (!start && !end) {
      setFilteredData(rawData);
      return;
    }
    const startTs = start ? new Date(start).getTime() : 0;
    const endTs = end ? new Date(end).getTime() : Infinity;
    
    setFilteredData(
      rawData.filter((r) => {
        const ts = new Date(r.date).getTime();
        return ts >= startTs && ts <= endTs;
      })
    );
  }, [rawData]);

  const getStatistics = useCallback((): StockStats | null => {
    if (filteredData.length === 0) return null;
    
    const closes = filteredData.map((r) => r.close);
    const volumes = filteredData.map((r) => r.volume);
    
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const firstClose = closes[0];
    const lastClose = closes[closes.length - 1];
    const percentChange = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
    
    return {
      minClose: Math.round(minClose * 100) / 100,
      maxClose: Math.round(maxClose * 100) / 100,
      avgClose: Math.round(avgClose * 100) / 100,
      totalVolume,
      percentChange: Math.round(percentChange * 100) / 100,
      tradingDays: filteredData.length,
      startDate: filteredData[0].date,
      endDate: filteredData[filteredData.length - 1].date,
    };
  }, [filteredData]);

  // Fetch Live Ticker Data with robust multi-proxy fallback
  const fetchLiveStockData = useCallback(async (tickerInput: string) => {
    setIsFetching(true);
    setParseError('');

    let ticker = tickerInput.trim().toUpperCase();
    if (!ticker) {
      setIsFetching(false);
      return;
    }

    // Auto NSE suffix helper
    if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO') && !ticker.startsWith('^')) {
      ticker = `${ticker}.NS`;
    }

    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3mo&interval=1d`;
    const proxyUrls = [
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${targetUrl}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    ];

    let success = false;
    let lastError = 'Failed to fetch live stock data.';

    for (let i = 0; i < proxyUrls.length; i++) {
      const proxyUrl = proxyUrls[i];
      try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`Proxy status ${response.status}`);
        }
        
        const json = await response.json();
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error('No historical records found.');

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const closePrices = quote.close || [];
        const openPrices = quote.open || [];
        const highPrices = quote.high || [];
        const lowPrices = quote.low || [];
        const volumes = quote.volume || [];

        const rows: StockRow[] = [];
        for (let j = 0; j < timestamps.length; j++) {
          if (closePrices[j] == null) continue;
          
          const d = new Date(timestamps[j] * 1000);
          rows.push({
            date: d.toISOString().split('T')[0],
            open: Math.round((openPrices[j] || closePrices[j] || 0) * 100) / 100,
            high: Math.round((highPrices[j] || closePrices[j] || 0) * 100) / 100,
            low: Math.round((lowPrices[j] || closePrices[j] || 0) * 100) / 100,
            close: Math.round((closePrices[j] || 0) * 100) / 100,
            volume: Math.round(volumes[j] || 0)
          });
        }

        if (rows.length === 0) throw new Error('Parsed rows are empty.');

        setRawData(rows);
        setFilteredData(rows);
        setColumns(['date', 'open', 'high', 'low', 'close', 'volume']);
        setFileName(`LIVE:${ticker}`);
        success = true;
        break; // Stop loop on success
      } catch (err: any) {
        console.warn(`Proxy ${i + 1} failed: ${proxyUrl}`, err);
        lastError = err?.message || lastError;
      }
    }

    if (!success) {
      setParseError(`⚠️ Failed to pull live stock values: ${lastError}. Proxies may be temporarily offline.`);
    }
    setIsFetching(false);
  }, []);

  // Fetch Live RSS News with robust multi-proxy fallback
  const fetchMarketNews = useCallback(async (tickerInput?: string) => {
    setIsFetchingNews(true);
    setNews([]);

    let searchQuery = 'Indian stock market NSE BSE';
    if (tickerInput && tickerInput.trim()) {
      let query = tickerInput.trim().toUpperCase();
      if (query.endsWith('.NS') || query.endsWith('.BO')) {
        query = query.slice(0, -3);
      }
      searchQuery = `${query} stock India business`;
    }

    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const proxyUrls = [
      `https://corsproxy.io/?${encodeURIComponent(googleNewsUrl)}`,
      `https://corsproxy.io/?${googleNewsUrl}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(googleNewsUrl)}`
    ];

    let success = false;
    for (let i = 0; i < proxyUrls.length; i++) {
      const proxyUrl = proxyUrls[i];
      try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const items = xmlDoc.getElementsByTagName('item');
        
        const newsList: NewsItem[] = [];
        for (let j = 0; j < Math.min(items.length, 10); j++) {
          const item = items[j];
          const title = item.getElementsByTagName('title')[0]?.textContent || '';
          const link = item.getElementsByTagName('link')[0]?.textContent || '';
          const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
          const source = item.getElementsByTagName('source')[0]?.textContent || 'News';
          
          let displayDate = pubDate;
          try {
            displayDate = new Date(pubDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          } catch { /* ignore */ }

          newsList.push({
            title,
            link,
            pubDate: displayDate,
            source
          });
        }

        setNews(newsList);
        success = true;
        break;
      } catch (err) {
        console.warn(`News Proxy ${i + 1} failed: ${proxyUrl}`, err);
      }
    }

    setIsFetchingNews(false);
  }, []);

  const generateSampleData = useCallback(() => {
    const rows: StockRow[] = [];
    let basePrice = 22000;
    const startDate = new Date('2024-01-02');

    for (let i = 0; i < 250; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + Math.floor(i * 1.4));

      const dailyReturn = (Math.random() - 0.48) * 0.02;
      const open = basePrice;
      const close = open * (1 + dailyReturn);
      const high = Math.max(open, close) * (1 + Math.random() * 0.008);
      const low = Math.min(open, close) * (1 - Math.random() * 0.008);
      const volume = Math.floor(150000000 + Math.random() * 100000000);

      rows.push({
        date: date.toISOString().split('T')[0],
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume,
      });

      basePrice = close;
    }

    setRawData(rows);
    setFilteredData(rows);
    setColumns(['date', 'open', 'high', 'low', 'close', 'volume']);
    setFileName('NIFTY50_Sample_2024.csv');
    setParseError('');
  }, []);

  const clearData = useCallback(() => {
    setRawData([]);
    setFilteredData([]);
    setColumns([]);
    setFileName('');
    setParseError('');
    setNews([]);
  }, []);

  return {
    rawData,
    filteredData,
    columns,
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
    hasData: rawData.length > 0,
  };
}
