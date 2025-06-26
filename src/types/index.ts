// TypeScript type definitions for the stock alerts application

export type AlertCondition = 'ABOVE' | 'BELOW';

// Main alert interface
export interface Alert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Triggered alert interface with additional data
export interface TriggeredAlert {
  id: string;
  alertId: string;
  symbol: string;
  targetPrice: number;
  actualPrice: number;
  condition: AlertCondition;
  triggeredAt: Date;
  isRead: boolean;
  alert?: Alert; // Optional populated alert data
}

// Stock price data interface
export interface StockPrice {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  timestamp: Date;
}

// Device token for push notifications
export interface DeviceToken {
  id: string;
  token: string;
  userId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form data types
export interface CreateAlertForm {
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
}

export interface UpdateAlertForm extends Partial<CreateAlertForm> {
  id: string;
  isActive?: boolean;
}

// Dashboard statistics
export interface DashboardStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  totalTriggered: number;
}

// Yahoo Finance API response types
export interface YahooFinanceQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketTime: number;
}

// Push notification payload
export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    alertId: string;
    symbol: string;
    price: string;
    type: 'alert_triggered';
  };
}

// Component prop types
export interface AlertCardProps {
  alert: Alert;
  currentPrice?: number;
  onEdit: (alert: Alert) => void;
  onDelete: (alertId: string) => void;
  onToggle: (alertId: string, isActive: boolean) => void;
}

export interface TriggeredAlertCardProps {
  triggeredAlert: TriggeredAlert;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface StockSearchProps {
  onSelect: (symbol: string) => void;
  placeholder?: string;
}

// Error types
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Environment variables type
export interface EnvironmentVariables {
  DATABASE_URL: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: string;
}