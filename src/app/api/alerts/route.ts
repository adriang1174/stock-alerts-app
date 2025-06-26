// API routes for alert management (CRUD operations)
// Handles creation, reading, updating, and deletion of stock alerts

import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbErrorHandling } from '@/lib/db';
import { CreateAlertForm, UpdateAlertForm, ApiResponse, Alert } from '@/types';
import { isValidStockSymbol, normalizeSymbol } from '@/lib/yahoo-finance';
import { z } from 'zod';

// Validation schemas
const createAlertSchema = z.object({
  symbol: z.string().min(1).max(10),
  targetPrice: z.number().positive(),
  condition: z.enum(['ABOVE', 'BELOW']),
});

const updateAlertSchema = z.object({
  id: z.string(),
  symbol: z.string().min(1).max(10).optional(),
  targetPrice: z.number().positive().optional(),
  condition: z.enum(['ABOVE', 'BELOW']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/alerts - Retrieve all alerts
 * Query parameters:
 * - active: boolean (filter by active status)
 * - symbol: string (filter by symbol)
 * - limit: number (pagination limit)
 * - offset: number (pagination offset)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause for filtering
    const where: any = {};
    if (active !== null) {
      where.isActive = active === 'true';
    }
    if (symbol) {
      where.symbol = normalizeSymbol(symbol);
    }

    const alerts = await withDbErrorHandling(async () => {
      return await prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // Max 100 records per request
        skip: offset,
      });
    });

    const response: ApiResponse<Alert[]> = {
      success: true,
      data: alerts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch alerts',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * POST /api/alerts - Create a new alert
 * Body: CreateAlertForm
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = createAlertSchema.safeParse(body);
    if (!validationResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid request data',
        message: validationResult.error.errors.map(e => e.message).join(', '),
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    const { symbol, targetPrice, condition } = validationResult.data;
    const normalizedSymbol = normalizeSymbol(symbol);

    // Validate stock symbol format
    if (!isValidStockSymbol(normalizedSymbol)) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Invalid stock symbol format: ${symbol}`,
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    // Check if alert already exists for this symbol and price
    const existingAlert = await prisma.alert.findFirst({
      where: {
        symbol: normalizedSymbol,
        targetPrice,
        condition,
        isActive: true,
      },
    });

    if (existingAlert) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'An active alert with the same parameters already exists',
      };
      
      return NextResponse.json(response, { status: 409 });
    }

    // Create new alert
    const newAlert = await withDbErrorHandling(async () => {
      return await prisma.alert.create({
        data: {
          symbol: normalizedSymbol,
          targetPrice,
          condition,
        },
      });
    });

    const response: ApiResponse<Alert> = {
      success: true,
      data: newAlert,
      message: 'Alert created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * PUT /api/alerts - Update an existing alert
 * Body: UpdateAlertForm
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = updateAlertSchema.safeParse(body);
    if (!validationResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid request data',
        message: validationResult.error.errors.map(e => e.message).join(', '),
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    const { id, ...updateData } = validationResult.data;

    // Normalize symbol if provided
    if (updateData.symbol) {
      updateData.symbol = normalizeSymbol(updateData.symbol);
      
      // Validate stock symbol format
      if (!isValidStockSymbol(updateData.symbol)) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Invalid stock symbol format: ${updateData.symbol}`,
        };
        
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Check if alert exists
    const existingAlert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!existingAlert) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Alert not found',
      };
      
      return NextResponse.json(response, { status: 404 });
    }

    // Update alert
    const updatedAlert = await withDbErrorHandling(async () => {
      return await prisma.alert.update({
        where: { id },
        data: updateData,
      });
    });

    const response: ApiResponse<Alert> = {
      success: true,
      data: updatedAlert,
      message: 'Alert updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating alert:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update alert',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * DELETE /api/alerts - Delete alerts
 * Query parameters:
 * - id: string (single alert ID)
 * - ids: string (comma-separated alert IDs for bulk delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const singleId = searchParams.get('id');
    const bulkIds = searchParams.get('ids');

    if (!singleId && !bulkIds) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Either id or ids parameter is required',
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    let alertIds: string[];
    
    if (singleId) {
      alertIds = [singleId];
    } else {
      alertIds = bulkIds!.split(',').map(id => id.trim()).filter(Boolean);
    }

    if (alertIds.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No valid alert IDs provided',
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    // Delete alerts (this will also cascade delete triggered alerts)
    const deleteResult = await withDbErrorHandling(async () => {
      return await prisma.alert.deleteMany({
        where: {
          id: {
            in: alertIds,
          },
        },
      });
    });

    const response: ApiResponse<{ deletedCount: number }> = {
      success: true,
      data: { deletedCount: deleteResult.count },
      message: `${deleteResult.count} alert(s) deleted successfully`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error deleting alerts:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete alerts',
    };

    return NextResponse.json(response, { status: 500 });
  }
}