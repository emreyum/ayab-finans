import React from 'react';
import { Expense, TransactionStatus } from '../types';
import { Icon } from './Icons';

interface ExpensesTableProps {
  expenses: Expense[];
}

const StatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  const styles = {
    [TransactionStatus.APPROVED]: 'bg-slate-100 text-slate-600',
    [TransactionStatus.PENDING]: 'bg-slate-50 text-slate-500',
    [TransactionStatus.REJECTED]: 'bg-slate-50 text-slate-400 line-through',
  };

  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded ${styles[status]}`}
    >
      {status}
    </span>
  );
};

export const ExpensesTable: React.FC<ExpensesTableProps> = ({ expenses }) => {
  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Icon name="receipt" className="text-slate-400 text-lg" />
          Avukat Giderleri Takibi
        </h2>
        <button className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors">
          <Icon name="add" className="text-sm" />
          Gider Ekle
        </button>
      </div>

      <div className="space-y-4">
        {expenses.map((expense) => (
          <div key={expense.id} className="flex items-center justify-between hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-medium">
                {expense.lawyerName.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-sm text-slate-800">{expense.lawyerName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{expense.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm text-slate-800 mb-1">
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