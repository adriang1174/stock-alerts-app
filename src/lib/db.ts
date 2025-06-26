// Database configuration and connection utilities
// Supports both PostgreSQL (production) and SQLite (development)

import { PrismaClient } from '@prisma/client';

// Global variable to store the Prisma client instance
declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Create a new Prisma client instance with proper configuration
 * @returns Configured PrismaClient instance
 */
const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    // Enable query logging in development
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    
    // Configure connection pooling for production
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

/**
 * Get the Prisma client instance (singleton pattern)
 * This prevents multiple instances in development due to hot reloading
 */
export const prisma = globalThis.prisma || createPrismaClient();

// In development, store the client in globalThis to prevent re-instantiation
if (process.env.NODE_ENV === 'development') {
  globalThis.prisma = prisma;
}

/**
 * Gracefully disconnect from the database
 * Useful for cleanup in serverless environments
 */
export const disconnectDb = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
};

/**
 * Test database connection
 * @returns Promise<boolean> - True if connection is successful
 */
export const testDbConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

/**
 * Database health check
 * @returns Promise with connection status and metadata
 */
export const getDbHealth = async () => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Initialize database schema and seed data if needed
 * This function can be called during application startup
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Test connection first
    const isConnected = await testDbConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to database');
    }
    
    console.log('Database connection established successfully');
    
    // Add any initial data seeding logic here if needed
    // For example, creating default device tokens or sample alerts
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Execute database operations with error handling
 * @param operation - Database operation function
 * @returns Promise with operation result
 */
export const withDbErrorHandling = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error('Database operation failed:', error);
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('P2002')) {
        throw new Error('A record with this data already exists');
      }
      if (error.message.includes('P2025')) {
        throw new Error('Record not found');
      }
      if (error.message.includes('P2003')) {
        throw new Error('Foreign key constraint failed');
      }
    }
    
    throw new Error('Database operation failed');
  }
};

// Export the Prisma client as default
export default prisma;