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
  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200 transition-all hover:border-slate-300 group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
          <Icon name={icon} className="text-xl" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {trend && (
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${trend === 'up' ? 'text-slate-700 bg-slate-100' :
                trend === 'down' ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-50'
              }`}>
              <Icon
                name={trend === 'up' ? 'arrow_upward' : trend === 'down' ? 'arrow_downward' : 'remove'}
                className="text-[10px]"
              />
              {trendText && <span>{trendText}</span>}
            </div>
          )}
          {subValue && !trendText && (
            <p className="text-[11px] text-slate-400 font-medium">{subValue}</p>
          )}
        </div>

        {/* Subtle decorative element for professional look */}
        <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${trend === 'up' ? 'bg-slate-300 w-2/3' : 'bg-slate-200 w-1/3'}`}></div>
        </div>
      </div>
    </div>
  );
};