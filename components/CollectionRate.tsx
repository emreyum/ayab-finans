import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const CollectionRate: React.FC = () => {
  const data = [
    { name: 'Collected', value: 85 },
    { name: 'Remaining', value: 15 },
  ];

  const COLORS = ['#334155', '#e2e8f0'];

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col items-center justify-center h-full min-h-[250px]">
      <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 self-start w-full">Tahsilat Oranı</h2>

      <div className="relative w-44 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={70}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              cornerRadius={6}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Oran']}
              contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: 'none', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-semibold text-slate-900">85%</span>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Başarılı</span>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-2 max-w-[150px] leading-relaxed">
        Toplam kesilen faturaların tahsil edilme oranı
      </p>
    </div>
  );
};