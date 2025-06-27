// Firebase configuration for push notifications
// Includes both client-side and server-side Firebase setup

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { NotificationPayload } from '@/types';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// VAPID key for web push notifications
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Initialize Firebase app (singleton pattern)
let firebaseApp: FirebaseApp | undefined;

if (typeof window !== 'undefined') {
  // Client-side initialization
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

/**
 * Set up listener for foreground messages
 * This handles notifications when the app is in the foreground
 */
export const setupForegroundMessageListener = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return;
  }
  
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    // Show browser notification for foreground messages
    if (payload.notification) {
      const { title, body } = payload.notification;
      
      // Create custom notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title || 'Stock Alert', {
          body: body || 'Your stock alert has been triggered',
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: 'stock-alert',
          data: payload.data,
        });
      }
    }
  });
};

/**
 * Test push notification functionality
 * Sends a test notification to verify everything is working
 * @returns Promise<boolean> - True if test notification sent successfully
 */
export const testPushNotification = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error sending test notification:', error);
    return false;
  }
};

// Server-side Firebase Admin SDK configuration
let adminApp: any = null;

/**
 * Initialize Firebase Admin SDK (server-side only)
 * @returns Firebase Admin App instance
 */
export const getFirebaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK should only be used on the server side');
  }
  
  if (adminApp) {
    return adminApp;
  }
  
  try {
    // Dynamic import to avoid client-side bundling
    const admin = require('firebase-admin');
    
    if (admin.apps.length === 0) {
      // Initialize with service account credentials
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      adminApp = admin.apps[0];
    }
    
    return adminApp;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
};

/**
 * Send push notification to a specific device token (server-side)
 * @param token - FCM device token
 * @param payload - Notification payload
 * @returns Promise<boolean> - True if sent successfully
 */
export const sendPushNotification = async (
  token: string,
  payload: NotificationPayload
): Promise<boolean> => {
  if (typeof window !== 'undefined') {
    throw new Error('sendPushNotification should only be called on the server side');
  }
  
  try {
    const admin = getFirebaseAdmin();
    const messaging = admin.messaging();
    
    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: 'stock-alert',
          requireInteraction: true,
        },
        fcmOptions: {
          link: '/',
        },
      },
    };
    
    await messaging.send(message);
    console.log('Push notification sent successfully to:', token.substring(0, 20) + '...');
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

/**
 * Send push notifications to multiple device tokens (server-side)
 * @param tokens - Array of FCM device tokens
 * @param payload - Notification payload
 * @returns Promise<number> - Number of successfully sent notifications
 */
export const sendBulkPushNotifications = async (
  tokens: string[],
  payload: NotificationPayload
): Promise<number> => {
  if (typeof window !== 'undefined') {
    throw new Error('sendBulkPushNotifications should only be called on the server side');
  }
  
  if (tokens.length === 0) {
    return 0;
  }
  
  try {
    const admin = getFirebaseAdmin();
    const messaging = admin.messaging();
    
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: 'stock-alert',
          requireInteraction: true,
        },
        fcmOptions: {
          link: '/',
        },
      },
    };
    
    const response = await messaging.sendToDevice(tokens, message);
    
    let successCount = 0;
    response.results.forEach((result: any, index: number) => {
      if (result.error) {
        console.error(`Failed to send notification to token ${index}:`, result.error);
      } else {
        successCount++;
      }
    });
    
    console.log(`Bulk notifications sent: ${successCount}/${tokens.length} successful`);
    return successCount;
  } catch (error) {
    console.error('Error sending bulk push notifications:', error);
    return 0;
  }
};

/**
 * Clean up invalid device tokens from database
 * Should be called periodically to remove tokens that are no longer valid
 * @returns Promise<number> - Number of tokens removed
 */
export const cleanupInvalidTokens = async (): Promise<number> => {
  // This function should be implemented in the API route
  // as it requires database access
  try {
    const response = await fetch('/api/notifications/cleanup', {
      method: 'POST',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.removedCount || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('Error cleaning up invalid tokens:', error);
    return 0;
  }
};

// Export Firebase app for other modules
export { firebaseApp };
export default firebaseApp;

/**
 * Get Firebase messaging instance
 * Only available on client-side
 * @returns Messaging instance or null if not available
 */
export const getFirebaseMessaging = (): Messaging | null => {
  if (typeof window === 'undefined' || !firebaseApp) {
    return null;
  }
  
  try {
    return getMessaging(firebaseApp);
  } catch (error) {
    console.error('Error getting Firebase messaging:', error);
    return null;
  }
};

/**
 * Request notification permission from the user
 * @returns Promise<boolean> - True if permission granted
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Get FCM device token for push notifications
 * @returns Promise<string | null> - Device token or null if failed
 */
export const getDeviceToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const messaging = getFirebaseMessaging();
  if (!messaging || !vapidKey) {
    console.error('Firebase messaging not available or VAPID key missing');
    return null;
  }
  
  try {
    // Check if notification permission is granted
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return null;
    }
    
    // Get device token
    const token = await getToken(messaging, { vapidKey });
    if (token) {
      console.log('FCM device token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.warn('Failed to get FCM device token');
      return null;
    }
  } catch (error) {
    console.error('Error getting device token:', error);
    return null;
  }
};

/**
 * Save device token to database
 * @param token - FCM device token
 * @param userId - Optional user identifier
 * @returns Promise<boolean> - True if saved successfully
 */
export const saveDeviceToken = async (
  token: string,
  userId?: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/notifications/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, userId }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error saving device token:', error);
    return false;
  }
};

/**
 * Initialize push notifications
 * Call this function when the app starts
 * @param userId - Optional user identifier
 * @returns Promise<string | null> - Device token if successful
 */
export const initializePushNotifications = async (
  userId?: string
): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    // Get device token
    const token = await getDeviceToken();
    if (!token) {
      return null;
    }
    
    // Save token to database
    const saved = await saveDeviceToken(token, userId);
    if (!saved) {
      console.error('Failed to save device token to database');
      return null;
    }
    
    // Set up foreground message listener
    setupForegroundMessageListener();
    
    return token;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return null;
  }
};

/**
 */
