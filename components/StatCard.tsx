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
  const gradientMap = {
    up: 'from-emerald-100/30',
    down: 'from-red-100/30',
    neutral: 'from-slate-100/30'
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/40 transition-all hover:shadow-lg hover:scale-[1.01] group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${trend ? gradientMap[trend] : 'from-blue-100/30'} to-transparent rounded-bl-full`}></div>

      <div className="flex justify-between items-start mb-3 relative">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
          <Icon name={icon} className="text-lg" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-slate-900 tracking-tight relative">{value}</h3>

      <div className="flex items-center justify-between mt-3 relative">
        <div className="flex items-center gap-1.5">
          {trend && (
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${trend === 'up' ? 'text-emerald-600 bg-emerald-50/80' :
                trend === 'down' ? 'text-red-500 bg-red-50/80' : 'text-slate-400 bg-slate-50/80'
              }`}>
              <Icon
                name={trend === 'up' ? 'arrow_upward' : trend === 'down' ? 'arrow_downward' : 'remove'}
                className="text-[10px]"
              />
              {trendText && <span>{trendText}</span>}
            </div>
          )}
          {subValue && !trendText && (
            <p className="text-[10px] text-slate-400 font-medium">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
};