
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
        <div className="glass-card p-5 rounded-2xl border border-white/40 h-[350px]">
            <h3 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2">
                <span className="material-icons text-blue-400 text-lg">bar_chart</span>
                Son 6 Ay Gelir/Gider
            </h3>
            <ResponsiveContainer width="100%" height="85%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f050" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `₺${val / 1000}k`} />
                    <Tooltip
                        cursor={{ fill: 'rgba(248, 250, 252, 0.5)' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', background: 'rgba(255,255,255,0.8)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '11px' }} />
                    <Bar dataKey="Gelir" fill="#334155" radius={[6, 6, 0, 0]} barSize={20} />
                    <Bar dataKey="Gider" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
