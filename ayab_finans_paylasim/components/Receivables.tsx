
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ReceivablesProps {
  totalAmount: number;
}

export const Receivables: React.FC<ReceivablesProps> = ({ totalAmount }) => {
  // Visual data for the donut chart (100% filled to represent the total volume)
  const data = [
    { name: 'Toplam Alacak', value: 100 },
  ];
  
  // Blue-600 for the main color
  const COLORS = ['#2563eb']; 

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-gray-100 border border-gray-50 flex flex-col items-center justify-center h-full min-h-[280px]">
      <div className="w-full flex justify-between items-start mb-2">
         <h2 className="text-lg font-bold text-gray-800">Toplam Hesap Avans Alacağı</h2>
         <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <span className="material-icons">account_balance_wallet</span>
         </div>
      </div>
      
      <div className="relative w-56 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={75}
              outerRadius={95}
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
            <Tooltip cursor={false} content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-gray-900">
            ₺{totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full mt-2">
             Tahsil Edilecek
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-4 px-4">
          Müvekkil ve dosyalara yapılan masraflar ile henüz tahsil edilmemiş bakiyelerin toplamı.
      </p>
    </div>
  );
};
