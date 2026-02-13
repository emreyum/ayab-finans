
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Transaction, TransactionType, TransactionStatus } from '../types';

interface DashboardChartProps {
    transactions: Transaction[];
}

export const DashboardChart: React.FC<DashboardChartProps> = ({ transactions }) => {
    // Last 6 months data calculation
    const data = React.useMemo(() => {
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
            const label = d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
            
            months.push({ key: monthKey, label, Gelir: 0, Gider: 0 });
        }

        transactions.forEach(t => {
            if (t.status === TransactionStatus.REJECTED) return;
            const tKey = t.date.slice(0, 7);
            const monthData = months.find(m => m.key === tKey);
            
            if (monthData) {
                if (t.type === TransactionType.INCOME) {
                    monthData.Gelir += t.amount;
                } else if (t.type === TransactionType.EXPENSE) {
                    monthData.Gider += t.amount;
                }
            }
        });
        return months;
    }, [transactions]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[350px]">
            <h3 className="font-bold text-gray-800 mb-4">Son 6 Ay Gelir/Gider</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(val) => `₺${val/1000}k`} />
                    <Tooltip 
                        cursor={{fill: '#f9fafb'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                    <Bar dataKey="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
