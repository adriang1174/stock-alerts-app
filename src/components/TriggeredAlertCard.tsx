// src/components/TriggeredAlertCard.tsx
// Component for displaying triggered alerts with status and actions

import React from 'react';
import { TriggeredAlert } from '@/types';
import { TrendingUp, TrendingDown, Clock, Check, Trash2, AlertTriangle } from 'lucide-react';

interface TriggeredAlertCardProps {
  triggeredAlert: TriggeredAlert;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TriggeredAlertCard: React.FC<TriggeredAlertCardProps> = ({
  triggeredAlert,
  onMarkAsRead,
  onDelete,
}) => {
  const isAboveTarget = triggeredAlert.condition === 'ABOVE';
  const priceChange = triggeredAlert.actualPrice - triggeredAlert.targetPrice;
  const priceChangePercent = ((priceChange / triggeredAlert.targetPrice) * 100).toFixed(2);
  
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };

  return (
    <div className={`rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-md ${
      triggeredAlert.isRead 
        ? 'bg-gray-50 border-gray-200' 
        : 'bg-orange-50 border-orange-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-5 h-5 ${
              triggeredAlert.isRead ? 'text-gray-500' : 'text-orange-600'
            }`} />
            <span className="font-bold text-lg text-gray-800">{triggeredAlert.symbol}</span>
            {isAboveTarget ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            {!triggeredAlert.isRead && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                New
              </span>
            )}
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Target Price:</span>
              <span className="font-medium">${triggeredAlert.targetPrice.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Triggered at:</span>
              <span className="font-medium">${triggeredAlert.actualPrice.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Condition:</span>
              <span className={`font-medium ${
                isAboveTarget ? 'text-green-600' : 'text-red-600'
              }`}>
                Price went {isAboveTarget ? 'above' : 'below'} target
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Price Change:</span>
              <span className={`font-medium ${
                priceChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} ({priceChangePercent}%)
              </span>
            </div>
          </div>
          
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDateTime(triggeredAlert.triggeredAt)}</span>
              </div>
              <span className="font-medium">{getTimeAgo(triggeredAlert.triggeredAt)}</span>
            </div>
          </div>

          {/* Alert success message */}
          <div className={`mt-2 p-2 rounded-lg ${
            isAboveTarget ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <p className={`text-xs font-medium ${
              isAboveTarget ? 'text-green-800' : 'text-red-800'
            }`}>
              🎯 Alert triggered successfully! {triggeredAlert.symbol} reached your target price.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          {!triggeredAlert.isRead && (
            <button
              onClick={() => onMarkAsRead(triggeredAlert.id)}
              className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              title="Mark as Read"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => onDelete(triggeredAlert.id)}
            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            title="Delete Alert"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};