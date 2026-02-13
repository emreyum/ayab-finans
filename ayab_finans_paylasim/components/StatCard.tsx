import React from 'react';
import { Icon } from './Icons';

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  variant?: 'primary' | 'default';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  icon,
  trend,
  trendText,
  variant = 'default'
}) => {
  const isPrimary = variant === 'primary';

  return (
    <div
      className={`p-6 rounded-2xl shadow-sm transition-transform hover:-translate-y-1 duration-300 ${
        isPrimary
          ? 'bg-emerald-600 text-white shadow-emerald-200'
          : 'bg-white text-gray-800 shadow-gray-100'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <p className={`font-medium ${isPrimary ? 'text-emerald-50' : 'text-gray-500'}`}>
          {title}
        </p>
        <div className={`p-2 rounded-lg ${isPrimary ? 'bg-white/20' : 'bg-gray-50'}`}>
           <Icon name={icon} className={isPrimary ? 'text-white' : 'text-gray-400'} />
        </div>
      </div>
      
      <p className="text-3xl font-bold tracking-tight mb-1">{value}</p>
      
      <div className="flex items-center gap-1 text-sm">
        {trend && (
            <Icon 
                name={trend === 'up' ? 'arrow_upward' : trend === 'down' ? 'arrow_downward' : 'remove'} 
                className={`text-xs ${
                    isPrimary ? 'text-emerald-100' : 
                    trend === 'up' ? 'text-emerald-500' : 
                    trend === 'down' ? 'text-red-500' : 'text-gray-400'
                }`} 
            />
        )}
        {trendText && (
           <p className={`${
               isPrimary ? 'text-emerald-100' :
               trend === 'up' ? 'text-emerald-600' :
               trend === 'down' ? 'text-red-600' :
               trendText.includes('Geçmiş') ? 'text-yellow-600 font-medium' : 'text-gray-500'
           }`}>
             {trendText}
           </p>
        )}
        {subValue && !trendText && (
            <p className={isPrimary ? 'text-emerald-100' : 'text-gray-400'}>{subValue}</p>
        )}
      </div>
    </div>
  );
};