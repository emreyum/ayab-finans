import React from 'react';
import { Expense, TransactionStatus } from '../types';
import { Icon } from './Icons';

interface ExpensesTableProps {
  expenses: Expense[];
}

const StatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  const styles = {
    [TransactionStatus.APPROVED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [TransactionStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
    [TransactionStatus.REJECTED]: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span
      className={`text-xs font-semibold px-3 py-1 rounded-full border ${styles[status]}`}
    >
      {status}
    </span>
  );
};

export const ExpensesTable: React.FC<ExpensesTableProps> = ({ expenses }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-gray-100 border border-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Icon name="receipt" className="text-gray-400" />
            Avukat Giderleri Takibi
        </h2>
        <button className="group border border-gray-200 hover:border-primary-600 hover:text-primary-600 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all text-gray-600">
          <div className="bg-gray-100 group-hover:bg-primary-50 rounded-md p-0.5">
              <Icon name="add" className="text-sm" />
          </div>
          Gider Ekle
        </button>
      </div>

      <div className="space-y-5">
        {expenses.map((expense) => (
          <div key={expense.id} className="flex items-center justify-between hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors">
            <div className="flex items-center gap-4">
              <div className="relative">
                  <img
                    alt={expense.lawyerName}
                    className="w-12 h-12 rounded-full object-cover border border-gray-100"
                    src={expense.avatarUrl}
                  />
                  {expense.status === TransactionStatus.APPROVED && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 border-2 border-white w-4 h-4 rounded-full"></div>
                  )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{expense.lawyerName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{expense.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900 mb-1">
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