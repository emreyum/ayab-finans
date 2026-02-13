
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Transaction, TransactionType, TransactionStatus } from '../types';

interface DashboardChartProps {
    transactions: Transaction[];
}

export const DashboardChart: React.FC<DashboardChartProps> = ({ transactions }) => {
    const data = React.useMemo(() => {
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = d.toISOString().slice(0, 7);
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
        <div className="bg-white p-5 rounded-lg border border-slate-200 h-[350px]">
            <h3 className="font-medium text-sm text-slate-700 mb-4">Son 6 Ay Gelir/Gider</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `₺${val / 1000}k`} />
                    <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: 'none', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="Gelir" fill="#334155" radius={[3, 3, 0, 0]} barSize={24} />
                    <Bar dataKey="Gider" fill="#94a3b8" radius={[3, 3, 0, 0]} barSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
