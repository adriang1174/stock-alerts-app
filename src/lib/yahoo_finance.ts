// Yahoo Finance API utilities for fetching stock prices
// Includes caching, error handling, and rate limiting

import axios from 'axios';
import { StockPrice, YahooFinanceQuote } from '@/types';
import { prisma } from './db';

// Cache duration in minutes
const CACHE_DURATION = 5;

// Rate limiting configuration
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// In-memory rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 * @param key - Unique identifier for rate limiting (e.g., IP address)
 * @returns boolean - True if request is allowed
 */
const checkRateLimit = (key: string = 'default'): boolean => {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
};

/**
 * Validate stock symbol format
 * @param symbol - Stock symbol to validate
 * @returns boolean - True if symbol is valid
 */
export const isValidStockSymbol = (symbol: string): boolean => {
  // Basic validation: 1-5 alphanumeric characters
  const symbolRegex = /^[A-Z]{1,5}$/;
  return symbolRegex.test(symbol.toUpperCase());
};

/**
 * Normalize stock symbol (convert to uppercase, remove spaces)
 * @param symbol - Raw stock symbol
 * @returns normalized symbol
 */
export const normalizeSymbol = (symbol: string): string => {
  return symbol.trim().toUpperCase();
};

/**
 * Check if cached price is still valid
 * @param updatedAt - Last update timestamp
 * @returns boolean - True if cache is still valid
 */
const isCacheValid = (updatedAt: Date): boolean => {
  const cacheExpiry = new Date(updatedAt.getTime() + CACHE_DURATION * 60 * 1000);
  return new Date() < cacheExpiry;
};

/**
 * Get stock price from cache
 * @param symbol - Stock symbol
 * @returns cached price or null if not found/expired
 */
const getCachedPrice = async (symbol: string): Promise<StockPrice | null> => {
  try {
    const cached = await prisma.stockPrice.findUnique({
      where: { symbol: normalizeSymbol(symbol) }
    });
    
    if (cached && isCacheValid(cached.updatedAt)) {
      return {
        symbol: cached.symbol,
        price: cached.price,
        timestamp: cached.updatedAt
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching cached price:', error);
    return null;
  }
};

/**
 * Update price cache
 * @param symbol - Stock symbol
 * @param price - Current price
 */
const updatePriceCache = async (symbol: string, price: number): Promise<void> => {
  try {
    await prisma.stockPrice.upsert({
      where: { symbol: normalizeSymbol(symbol) },
      update: { price, updatedAt: new Date() },
      create: { symbol: normalizeSymbol(symbol), price }
    });
  } catch (error) {
    console.error('Error updating price cache:', error);
  }
};

/**
 * Fetch stock price from Yahoo Finance API
 * Uses the unofficial Yahoo Finance API endpoint
 * @param symbol - Stock symbol
 * @returns Promise<StockPrice>
 */
const fetchPriceFromAPI = async (symbol: string): Promise<StockPrice> => {
  const normalizedSymbol = normalizeSymbol(symbol);
  
  try {
    // Using Yahoo Finance query API
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedSymbol}`,
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }
    );
    
    const data = response.data;
    
    if (!data.chart?.result?.[0]) {
      throw new Error(`No data found for symbol: ${normalizedSymbol}`);
    }
    
    const result = data.chart.result[0];
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    
    if (!currentPrice) {
      throw new Error(`No price data available for symbol: ${normalizedSymbol}`);
    }
    
    const stockPrice: StockPrice = {
      symbol: normalizedSymbol,
      price: currentPrice,
      change: meta.regularMarketPrice - meta.previousClose,
      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      timestamp: new Date()
    };
    
    // Update cache
    await updatePriceCache(normalizedSymbol, currentPrice);
    
    return stockPrice;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`Stock symbol not found: ${normalizedSymbol}`);
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - Yahoo Finance API is not responding');
      }
    }
    
    console.error(`Error fetching price for ${normalizedSymbol}:`, error);
    throw new Error(`Failed to fetch price for ${normalizedSymbol}`);
  }
};

/**
 * Get current stock price with caching and rate limiting
 * @param symbol - Stock symbol
 * @param useCache - Whether to use cached data (default: true)
 * @returns Promise<StockPrice>
 */
export const getStockPrice = async (
  symbol: string,
  useCache: boolean = true
): Promise<StockPrice> => {
  const normalizedSymbol = normalizeSymbol(symbol);
  
  // Validate symbol format
  if (!isValidStockSymbol(normalizedSymbol)) {
    throw new Error(`Invalid stock symbol format: ${symbol}`);
  }
  
  // Check rate limit
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  // Try to get from cache first
  if (useCache) {
    const cachedPrice = await getCachedPrice(normalizedSymbol);
    if (cachedPrice) {
      return cachedPrice;
    }
  }
  
  // Fetch from API
  return await fetchPriceFromAPI(normalizedSymbol);
};

/**
 * Get multiple stock prices in batch
 * @param symbols - Array of stock symbols
 * @param useCache - Whether to use cached data
 * @returns Promise<StockPrice[]>
 */
export const getMultipleStockPrices = async (
  symbols: string[],
  useCache: boolean = true
): Promise<StockPrice[]> => {
  const promises = symbols.map(symbol => 
    getStockPrice(symbol, useCache).catch(error => ({
      symbol: normalizeSymbol(symbol),
      price: 0,
      timestamp: new Date(),
      error: error.message
    }))
  );
  
  return Promise.all(promises);
};

/**
 * Search for stock symbols by company name
 * @param query - Search query (company name or partial symbol)
 * @returns Promise<string[]> - Array of matching symbols
 */
export const searchStockSymbols = async (query: string): Promise<string[]> => {
  try {
    // Check rate limit
    if (!checkRateLimit('search')) {
      throw new Error('Search rate limit exceeded');
    }
    
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v1/finance/search`,
      {
        params: {
          q: query,
          quotesCount: 10,
          newsCount: 0,
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }
    );
    
    const quotes = response.data.quotes || [];
    return quotes
      .filter((quote: any) => quote.typeDisp === 'Equity' && quote.symbol)
      .map((quote: any) => quote.symbol)
      .slice(0, 10);
      
  } catch (error) {
    console.error('Error searching stock symbols:', error);
    return [];
  }
};

/**
 * Clear expired cache entries
 * Should be run periodically to clean up old data
 */
export const clearExpiredCache = async (): Promise<void> => {
  try {
    const expiredTime = new Date(Date.now() - CACHE_DURATION * 60 * 1000);
    
    await prisma.stockPrice.deleteMany({
      where: {
        updatedAt: {
          lt: expiredTime
        }
      }
    });
    
    console.log('Expired cache entries cleared');
  } catch (error) {
    console.error('Error clearing expired cache:', error);
  }
};