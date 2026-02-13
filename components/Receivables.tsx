
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ReceivablesProps {
  totalAmount: number;
}

export const Receivables: React.FC<ReceivablesProps> = ({ totalAmount }) => {
  const data = [
    { name: 'Toplam Alacak', value: 100 },
  ];

  const COLORS = ['#475569'];

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col items-center justify-center h-full min-h-[280px]">
      <div className="w-full flex justify-between items-start mb-2">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Hesap Avans Alacağı</h2>
        <div className="p-1.5 rounded-md bg-slate-50">
          <span className="material-icons text-slate-400 text-lg">account_balance_wallet</span>
        </div>
      </div>

      <div className="relative w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={80}
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
            <Tooltip cursor={false} content={() => null} />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-semibold text-slate-900">
            ₺{totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1">
            Tahsil Edilecek
          </span>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 mt-3 px-4 leading-relaxed">
        Müvekkil ve dosyalara yapılan masraflar ile henüz tahsil edilmemiş bakiyelerin toplamı.
      </p>
    </div>
  );
};
