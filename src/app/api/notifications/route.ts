// API routes for push notification management
// Handles device token registration, sending notifications, and cleanup

import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbErrorHandling } from '@/lib/db';
import { sendPushNotification, sendBulkPushNotifications } from '@/lib/firebase';
import { ApiResponse, NotificationPayload } from '@/types';
import { z } from 'zod';

// Validation schemas
const tokenSchema = z.object({
  token: z.string().min(1),
  userId: z.string().optional(),
});

const notificationSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.string()).optional(),
  tokens: z.array(z.string()).optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/notifications/token - Register device token
 * Body: { token: string, userId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = tokenSchema.safeParse(body);
    if (!validationResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid request data',
        message: validationResult.error.errors.map(e => e.message).join(', '),
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    const { token, userId } = validationResult.data;

    // Save or update device token
    const deviceToken = await withDbErrorHandling(async () => {
      return await prisma.deviceToken.upsert({
        where: { token },
        update: { 
          userId,
          isActive: true,
          updatedAt: new Date(),
        },
        create: { 
          token,
          userId,
          isActive: true,
        },
      });
    });

    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: deviceToken.id },
      message: 'Device token registered successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error registering device token:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register device token',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * GET /api/notifications/tokens - Get registered device tokens
 * Query parameters:
 * - userId: string (filter by user ID)
 * - active: boolean (filter by active status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const active = searchParams.get('active');

    // Build where clause for filtering
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (active !== null) {
      where.isActive = active === 'true';
    }

    const tokens = await withDbErrorHandling(async () => {
      return await prisma.deviceToken.findMany({
        where,
        select: {
          id: true,
          token: true,
          userId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    