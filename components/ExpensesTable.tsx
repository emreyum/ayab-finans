import React from 'react';
import { Expense, TransactionStatus } from '../types';
import { Icon } from './Icons';

interface ExpensesTableProps {
  expenses: Expense[];
}

const StatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  const styles = {
    [TransactionStatus.APPROVED]: 'bg-emerald-50/80 text-emerald-600 border-emerald-200/50',
    [TransactionStatus.PENDING]: 'bg-amber-50/80 text-amber-600 border-amber-200/50',
    [TransactionStatus.REJECTED]: 'bg-red-50/80 text-red-400 border-red-200/50 line-through',
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
};

export const ExpensesTable: React.FC<ExpensesTableProps> = ({ expenses }) => {
  return (
    <div className="glass-card p-5 rounded-2xl border border-white/40">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Icon name="receipt" className="text-slate-400 text-lg" />
          Avukat Giderleri Takibi
        </h2>
        <button className="px-3 py-1.5 bg-white/50 hover:bg-white/80 text-slate-600 border border-white/40 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors">
          <Icon name="add" className="text-sm" />
          Gider Ekle
        </button>
      </div>

      <div className="space-y-3">
        {expenses.map((expense) => (
          <div key={expense.id} className="flex items-center justify-between hover:bg-white/30 p-2.5 -mx-2 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {expense.lawyerName.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800">{expense.lawyerName}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{expense.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-slate-800 mb-1">
                ₺{expense.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
              <StatusBadge status={expense.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};