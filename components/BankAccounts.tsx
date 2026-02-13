import React from 'react';
import { BankAccount } from '../types';
import { Icon } from './Icons';

interface BankAccountsProps {
  accounts: BankAccount[];
}

export const BankAccounts: React.FC<BankAccountsProps> = ({ accounts }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-gray-100 border border-gray-50">
      <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Icon name="account_balance" className="text-gray-400" />
        Banka Hesapları Özeti
      </h2>
      <div className="space-y-4">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="bg-gray-50 hover:bg-gray-100 transition-colors p-4 rounded-xl flex items-center justify-between group border border-transparent hover:border-gray-200"
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${
                  account.currency === 'USD'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                <Icon name="account_balance" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">{account.bankName} - {account.accountNumber}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{account.type}</p>
              </div>
            </div>
            <p className="font-bold text-lg text-gray-800 tracking-tight">
              {account.currency === 'USD' ? '$' : '₺'}
              {account.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};