// src/components/AlertCard.tsx
// Component for displaying individual alert cards with actions

import React from 'react';
import { Alert } from '@/types';
import { TrendingUp, TrendingDown, Edit, Trash2, Power } from 'lucide-react';

interface AlertCardProps {
  alert: Alert;
  currentPrice?: number;
  onEdit: (alert: Alert) => void;
  onDelete: (alertId: string) => void;
  onToggle: (alertId: string, isActive: boolean) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  currentPrice,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const isAboveTarget = alert.condition === 'ABOVE';
  const priceDistance = currentPrice ? Math.abs(currentPrice - alert.targetPrice) : 0;
  const distancePercent = currentPrice ? ((priceDistance / alert.targetPrice) * 100).toFixed(2) : '0';
  
  const getStatusColor = () => {
    if (!alert.isActive) return 'bg-gray-100 border-gray-300';
    
    if (!currentPrice) return 'bg-yellow-50 border-yellow-200';
    
    if (isAboveTarget) {
      return currentPrice >= alert.targetPrice 
        ? 'bg-green-50 border-green-200' 
        : 'bg-blue-50 border-blue-200';
    } else {
      return currentPrice <= alert.targetPrice 
        ? 'bg-red-50 border-red-200' 
        : 'bg-blue-50 border-blue-200';
    }
  };

  const getStatusText = () => {
    if (!alert.isActive) return 'Inactive';
    
    if (!currentPrice) return 'Loading price...';
    
    if (isAboveTarget) {
      return currentPrice >= alert.targetPrice ? 'Target Reached!' : 'Monitoring...';
    } else {
      return currentPrice <= alert.targetPrice ? 'Target Reached!' : 'Monitoring...';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-md ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-lg text-gray-800">{alert.symbol}</span>
            {isAboveTarget ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              alert.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {alert.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Target Price:</span>
              <span className="font-medium">${alert.targetPrice.toFixed(2)}</span>
            </div>
            
            {currentPrice && (
              <div className="flex justify-between">
                <span className="text-gray-600">Current Price:</span>
                <span className="font-medium">${currentPrice.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">Condition:</span>
              <span className={`font-medium ${
                isAboveTarget ? 'text-green-600' : 'text-red-600'
              }`}>
                {isAboveTarget ? 'Above' : 'Below'} ${alert.targetPrice.toFixed(2)}
              </span>
            </div>
            
            {currentPrice && (
              <div className="flex justify-between">
                <span className="text-gray-600">Distance:</span>
                <span className="font-medium text-gray-800">
                  ${priceDistance.toFixed(2)} ({distancePercent}%)
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Created: {new Date(alert.createdAt).toLocaleDateString()}</span>
              <span className="font-medium">{getStatusText()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <button
            onClick={() => onToggle(alert.id, !alert.isActive)}
            className={`p-2 rounded-lg transition-colors ${
              alert.isActive
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
            title={alert.isActive ? 'Pause Alert' : 'Activate Alert'}
          >
            <Power className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onEdit(alert)}
            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            title="Edit Alert"
          >
            <Edit className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onDelete(alert.id)}
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