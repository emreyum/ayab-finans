import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const CollectionRate: React.FC = () => {
  // Using Recharts to satisfy requirements, even though SVG is simpler for a donut gauge
  const data = [
    { name: 'Collected', value: 85 },
    { name: 'Remaining', value: 15 },
  ];
  
  const COLORS = ['#10b981', '#f3f4f6']; // Emerald-500 and Gray-100

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-gray-100 border border-gray-50 flex flex-col items-center justify-center h-full min-h-[250px]">
      <h2 className="text-lg font-bold text-gray-800 mb-2 self-start w-full">Tahsilat Oranı</h2>
      
      <div className="relative w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              cornerRadius={10}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
                formatter={(value: number) => [`${value}%`, 'Oran']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-bold text-gray-800">85%</span>
          <span className="text-sm text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full mt-1">Başarılı</span>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2 max-w-[150px]">
          Toplam kesilen faturaların tahsil edilme oranı
      </p>
    </div>
  );
};