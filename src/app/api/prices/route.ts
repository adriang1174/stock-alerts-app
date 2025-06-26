// API routes for stock price operations
// Handles fetching current prices, searching symbols, and price monitoring

import { NextRequest, NextResponse } from 'next/server';
import { 
  getStockPrice, 
  getMultipleStockPrices, 
  searchStockSymbols,
  normalizeSymbol,
  isValidStockSymbol 
} from '@/lib/yahoo-finance';
import { ApiResponse, StockPrice } from '@/types';
import { z } from 'zod';

// Validation schemas
const singlePriceSchema = z.object({
  symbol: z.string().min(1).max(10),
  useCache: z.boolean().optional().default(true),
});

const multiplePricesSchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).min(1).max(20),
  useCache: z.boolean().optional().default(true),
});

const searchSchema = z.object({
  query: z.string().min(1).max(50),
});

/**
 * GET /api/prices - Get stock prices
 * Query parameters:
 * - symbol: string (single symbol)
 * - symbols: string (comma-separated symbols for multiple)
 * - useCache: boolean (whether to use cached data)
 * - search: string (search query for symbol lookup)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const symbols = searchParams.get('symbols');
    const search = searchParams.get('search');
    const useCache = searchParams.get('useCache') !== 'false';

    // Handle symbol search
    if (search) {
      const validationResult = searchSchema.safeParse({ query: search });
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid search query',
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const searchResults = await searchStockSymbols(validationResult.data.query);
      
      const response: ApiResponse<string[]> = {
        success: true,
        data: searchResults,
      };

      return NextResponse.json(response);
    }

    // Handle single symbol price request
    if (symbol) {
      const validationResult = singlePriceSchema.safeParse({ symbol, useCache });
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid symbol parameter',
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const normalizedSymbol = normalizeSymbol(validationResult.data.symbol);
      
      if (!isValidStockSymbol(normalizedSymbol)) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Invalid stock symbol format: ${symbol}`,
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const stockPrice = await getStockPrice(normalizedSymbol, validationResult.data.useCache);
      
      const response: ApiResponse<StockPrice> = {
        success: true,
        data: stockPrice,
      };

      return NextResponse.json(response);
    }

    // Handle multiple symbols price request
    if (symbols) {
      const symbolArray = symbols.split(',').map(s => s.trim()).filter(Boolean);
      
      const validationResult = multiplePricesSchema.safeParse({ 
        symbols: symbolArray, 
        useCache 
      });
      
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid symbols parameter',
          message: 'Provide 1-20 valid symbols separated by commas',
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      // Validate each symbol format
      const invalidSymbols = validationResult.data.symbols.filter(s => 
        !isValidStockSymbol(normalizeSymbol(s))
      );

      if (invalidSymbols.length > 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Invalid stock symbol format: ${invalidSymbols.join(', ')}`,
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const stockPrices = await getMultipleStockPrices(
        validationResult.data.symbols, 
        validationResult.data.useCache
      );
      
      const response: ApiResponse<StockPrice[]> = {
        success: true,
        data: stockPrices,
      };

      return NextResponse.json(response);
    }

    // No valid parameters provided
    const response: ApiResponse<null> = {
      success: false,
      error: 'Missing required parameters',
      message: 'Provide either symbol, symbols, or search parameter',
    };

    return NextResponse.json(response, { status: 400 });

  } catch (error) {
    console.error('Error in prices API:', error);
    
    let errorMessage = 'Failed to fetch stock prices';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific error types
      if (error.message.includes('Rate limit exceeded')) {
        statusCode = 429;
      } else if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('Invalid')) {
        statusCode = 400;
      }
    }
    
    const response: ApiResponse<null> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: statusCode });
  }
}

/**
 * POST /api/prices - Refresh stock prices (force cache update)
 * Body: { symbols: string[] } or { symbol: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle single symbol refresh
    if (body.symbol) {
      const validationResult = singlePriceSchema.safeParse({ 
        symbol: body.symbol, 
        useCache: false // Force refresh
      });
      
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid symbol parameter',
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const normalizedSymbol = normalizeSymbol(validationResult.data.symbol);
      
      if (!isValidStockSymbol(normalizedSymbol)) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Invalid stock symbol format: ${body.symbol}`,
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const stockPrice = await getStockPrice(normalizedSymbol, false);
      
      const response: ApiResponse<StockPrice> = {
        success: true,
        data: stockPrice,
        message: 'Price refreshed successfully',
      };

      return NextResponse.json(response);
    }

    // Handle multiple symbols refresh
    if (body.symbols && Array.isArray(body.symbols)) {
      const validationResult = multiplePricesSchema.safeParse({ 
        symbols: body.symbols, 
        useCache: false // Force refresh
      });
      
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid symbols parameter',
          message: 'Provide 1-20 valid symbols in an array',
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      // Validate each symbol format
      const invalidSymbols = validationResult.data.symbols.filter(s => 
        !isValidStockSymbol(normalizeSymbol(s))
      );

      if (invalidSymbols.length > 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Invalid stock symbol format: ${invalidSymbols.join(', ')}`,
        };
        
        return NextResponse.json(response, { status: 400 });
      }

      const stockPrices = await getMultipleStockPrices(validationResult.data.symbols, false);
      
      const response: ApiResponse<StockPrice[]> = {
        success: true,
        data: stockPrices,
        message: 'Prices refreshed successfully',
      };

      return NextResponse.json(response);
    }

    // Invalid request body
    const response: ApiResponse<null> = {
      success: false,
      error: 'Invalid request body',
      message: 'Provide either symbol (string) or symbols (array)',
    };

    return NextResponse.json(response, { status: 400 });

  } catch (error) {
    console.error('Error refreshing prices:', error);
    
    let errorMessage = 'Failed to refresh stock prices';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('Rate limit exceeded')) {
        statusCode = 429;
      } else if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('Invalid')) {
        statusCode = 400;
      }
    }
    
    const response: ApiResponse<null> = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: statusCode });
  }
}