// src/components/AlertForm.tsx
// Component for creating and editing stock alerts

import React, { useState, useEffect } from 'react';
import { Alert, CreateAlertForm, StockPrice } from '@/types';
import { Search, TrendingUp, TrendingDown, DollarSign, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface AlertFormProps {
  onSubmit: (data: CreateAlertForm) => Promise<void>;
  initialData?: Alert;
  isEditing?: boolean;
  onCancel?: () => void;
}

export const AlertForm: React.FC<AlertFormProps> = ({
  onSubmit,
  initialData,
  isEditing = false,
  onCancel,
}) => {
  const [symbol, setSymbol] = useState(initialData?.symbol || '');
  const [targetPrice, setTargetPrice] = useState(initialData?.targetPrice?.toString() || '');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>(initialData?.condition || 'ABOVE');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch current price when symbol changes
  useEffect(() => {
    const fetchPrice = async () => {
      if (symbol.length >= 2) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/prices/${symbol.toUpperCase()}`);
          if (response.ok) {
            const data: StockPrice = await response.json();
            setCurrentPrice(data.price);
          } else {
            setCurrentPrice(null);
          }
        } catch (error) {
          setCurrentPrice(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setCurrentPrice(null);
      }
    };

    const debounceTimer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(debounceTimer);
  }, [symbol]);

  // Search for stock symbols
  const searchSymbols = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/prices/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const symbols: string[] = await response.json();
        setSuggestions(symbols);
      }
    } catch (error) {
      console.error('Error searching symbols:', error);
    }
  };

  const handleSymbolChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setSymbol(upperValue);
    searchSymbols(upperValue);
    setShowSuggestions(true);
  };

  const selectSymbol = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!symbol.trim() || !targetPrice) {
      toast.error('Please fill in all fields');
      return;
    }

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid target price');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        symbol: symbol.toUpperCase(),
        targetPrice: price,
        condition,
      });
      
      if (!isEditing) {
        // Reset form after successful creation
        setSymbol('');
        setTargetPrice('');
        setCondition('ABOVE');
        setCurrentPrice(null);
      }
      
      toast.success(isEditing ? 'Alert updated successfully!' : 'Alert created successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriceRecommendation = () => {
    if (!currentPrice) return null;
    
    const abovePrice = (currentPrice * 1.05).toFixed(2);
    const belowPrice = (currentPrice * 0.95).toFixed(2);
    
    return { above: abovePrice, below: belowPrice };
  };

  const recommendation = getPriceRecommendation();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        {isEditing ? <Save className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-green-600" />}
        <h2 className="text-xl font-semibold text-gray-800">
          {isEditing ? 'Edit Alert' : 'Create New Alert'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Stock Symbol Input */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Symbol
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="e.g., AAPL, GOOGL, TSLA"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => selectSymbol(suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Price Display */}
        {symbol && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Price:</span>
              {isLoading ? (
                <span className="text-sm text-gray-500">Loading...</span>
              ) : currentPrice ? (
                <span className="text-lg font-semibold text-gray-800">${currentPrice.toFixed(2)}</span>
              ) : (
                <span className="text-sm text-red-500">Price not found</span>
              )}
            </div>
          </div>
        )}

        {/* Target Price Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Price
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          {/* Price recommendations */}
          {recommendation && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setTargetPrice(recommendation.above)}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200"
              >
                +5% (${recommendation.above})
              </button>
              <button
                type="button"
                onClick={() => setTargetPrice(recommendation.below)}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200"
              >
                -5% (${recommendation.below})
              </button>
            </div>
          )}
        </div>

        {/* Condition Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alert Condition
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCondition('ABOVE')}
              className={`p-3 rounded-lg border-2 transition-all ${
                condition === 'ABOVE'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Above Target</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Alert when price goes above target
              </p>
            </button>
            
            <button
              type="button"
              onClick={() => setCondition('BELOW')}
              className={`p-3 rounded-lg border-2 transition-all ${
                condition === 'BELOW'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 hover:border-red-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingDown className="w-4 h-4" />
                <span className="font-medium">Below Target</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Alert when price goes below target
              </p>
            </button>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !symbol || !targetPrice}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Alert' : 'Create Alert'}
          </button>
          
          {isEditing && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};