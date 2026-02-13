
import React, { useState } from 'react';
import { BankAccount, Transaction, TransactionType, TransactionStatus } from '../types';
import { Icon } from './Icons';
import { BankModal } from './BankModal';

interface BankPageProps {
  accounts: BankAccount[];
  transactions: Transaction[];
  onDataChange: () => Promise<void>;
}

export const BankPage: React.FC<BankPageProps> = ({ accounts, transactions, onDataChange }) => {
  const [openSections, setOpenSections] = useState({ tl: true, fx: true, cc: false });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const toggleSection = (section: 'tl' | 'fx' | 'cc') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (updatedData: Partial<BankAccount>) => {
    await onDataChange();
  };

  // Categorization
  const creditCards = accounts.filter(a => a.type === 'Kredi Kartı' || a.type.includes('Kredi'));
  const fxAccounts = accounts.filter(a => a.currency !== 'TRY' && !a.type.includes('Kredi'));
  const tlAccounts = accounts.filter(a => a.currency === 'TRY' && !a.type.includes('Kredi'));

  // Totals
  const calculateTotal = (type: TransactionType) => {
    return transactions
      .filter(t => t.type === type && t.status !== TransactionStatus.REJECTED)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };
  const totalIncome = calculateTotal(TransactionType.INCOME);
  const totalExpense = calculateTotal(TransactionType.EXPENSE);
  const systemBalance = totalIncome - totalExpense;

  const liquidAssets =
    tlAccounts.reduce((sum, a) => sum + a.balance, 0) +
    fxAccounts.reduce((sum, a) => sum + (a.currency === 'USD' ? a.balance * 34.5 : a.balance * 36.2), 0);

  const ccDebt = creditCards.reduce((sum, a) => sum + a.balance, 0);
  const discrepancy = liquidAssets - systemBalance;
  const isDiscrepancyZero = Math.abs(discrepancy) < 5;

  const getBankColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('garanti')) return 'from-emerald-600 to-emerald-700';
    if (lower.includes('iş')) return 'from-blue-700 to-blue-800';
    if (lower.includes('qnb')) return 'from-purple-700 to-purple-800';
    if (lower.includes('yapı')) return 'from-blue-600 to-blue-700';
    if (lower.includes('akbank')) return 'from-red-600 to-red-700';
    return 'from-slate-600 to-slate-700';
  };

  const getBankIcon = (type: string) => {
    if (type.includes('Kasa')) return 'point_of_sale';
    if (type.includes('Kredi')) return 'credit_card';
    return 'account_balance';
  };

  const renderSection = (title: string, items: BankAccount[], section: 'tl' | 'fx' | 'cc', icon: string, gradient: string) => {
    const isOpen = openSections[section];
    const sectionTotal = items.reduce((sum, a) => {
      const val = a.currency === 'USD' ? a.balance * 34.5 : a.currency === 'EUR' ? a.balance * 36.2 : a.balance;
      return sum + val;
    }, 0);

    return (
      <div className="glass-card rounded-2xl border border-white/40 overflow-hidden">
        <div
          onClick={() => toggleSection(section)}
          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow`}>
              <span className="material-icons text-base">{icon}</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
              <p className="text-[10px] text-slate-400">{items.length} hesap</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700 text-sm hidden sm:block">
              ₺{sectionTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </span>
            <span className="material-icons text-slate-400 text-lg">{isOpen ? 'expand_less' : 'expand_more'}</span>
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-white/20">
            {items.length > 0 ? items.map((account) => (
              <div key={account.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors border-b border-white/10 last:border-0 group">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getBankColor(account.bankName)} text-white flex items-center justify-center shadow-sm`}>
                    <span className="material-icons text-sm">{getBankIcon(account.type)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{account.bankName}</p>
                    <p className="text-[10px] text-slate-400">{account.type} {account.accountNumber !== '-' && `• ${account.accountNumber}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`font-bold text-sm ${account.type.includes('Kredi') ? 'text-red-500' : 'text-slate-700'}`}>
                      {account.currency === 'USD' ? '$' : account.currency === 'EUR' ? '€' : '₺'}
                      {account.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                    {account.currency !== 'TRY' && (
                      <p className="text-[10px] text-slate-400">
                        ≈ ₺{(account.currency === 'USD' ? account.balance * 34.5 : account.balance * 36.2).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(account); }}
                    className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-white/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Düzenle"
                  >
                    <span className="material-icons text-sm">edit</span>
                  </button>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400 text-xs">Bu kategoride hesap yok.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Info */}
      <div className="glass-card rounded-xl px-4 py-3 border border-white/40 flex items-center gap-2 text-xs text-slate-500">
        <span className="material-icons text-blue-400 text-base">info</span>
        Bakiyeler = Açılış Bakiyesi + İşlem hareketleri ile otomatik hesaplanır.
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Liquid Assets */}
        <div className="glass-card rounded-2xl p-5 border border-white/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-100/30 to-transparent rounded-bl-full"></div>
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Likit Varlıklar</p>
            <span className="material-icons text-emerald-500 text-lg">savings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">
            ₺{liquidAssets.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-slate-400">TL Hesapları</span>
              <p className="font-bold text-slate-600">₺{tlAccounts.reduce((s, a) => s + a.balance, 0).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400">Döviz (TL)</span>
              <p className="font-bold text-slate-600">₺{fxAccounts.reduce((s, a) => s + (a.currency === 'USD' ? a.balance * 34.5 : a.balance * 36.2), 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        {/* System Balance */}
        <div className="glass-card rounded-2xl p-5 border border-white/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-100/30 to-transparent rounded-bl-full"></div>
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İşlem Dengesi</p>
            <span className="material-icons text-blue-500 text-lg">sync_alt</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">
            ₺{systemBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-slate-400">Gelirler</span>
              <p className="font-bold text-emerald-600">+₺{totalIncome.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400">Giderler</span>
              <p className="font-bold text-red-400">-₺{totalExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Discrepancy */}
        <div className={`glass-card rounded-2xl p-5 border relative overflow-hidden ${isDiscrepancyZero ? 'border-white/40' : 'border-orange-200/50'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full ${isDiscrepancyZero ? 'bg-gradient-to-bl from-emerald-100/30 to-transparent' : 'bg-gradient-to-bl from-orange-100/30 to-transparent'}`}></div>
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isDiscrepancyZero ? 'Mutabakat' : 'Kayıt Dışı Fark'}
            </p>
            <span className={`material-icons text-lg ${isDiscrepancyZero ? 'text-emerald-500' : 'text-orange-500'}`}>
              {isDiscrepancyZero ? 'check_circle' : 'warning'}
            </span>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${isDiscrepancyZero ? 'text-emerald-600' : 'text-orange-600'}`}>
            {isDiscrepancyZero ? 'Tamam ✓' : `₺${Math.abs(discrepancy).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
          </p>
          <div className="mt-3 pt-3 border-t border-white/20 text-[10px]">
            <span className="text-slate-400">{isDiscrepancyZero ? 'Hesaplar tutuyor' : discrepancy > 0 ? 'Açılış bakiyeleri yüksek' : 'İşlemler varlıklardan fazla'}</span>
            {!isDiscrepancyZero && ccDebt > 0 && (
              <div className="mt-1">
                <span className="text-slate-400">KK Borcu: </span>
                <span className="font-bold text-red-400">₺{ccDebt.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Sections */}
      <div className="space-y-4">
        {renderSection('Banka ve Kasa Varlıkları (TL)', tlAccounts, 'tl', 'account_balance', 'from-slate-600 to-slate-700')}
        {renderSection('Döviz Varlıkları', fxAccounts, 'fx', 'currency_exchange', 'from-emerald-600 to-emerald-700')}
        {renderSection('Kredi Kartları', creditCards, 'cc', 'credit_card', 'from-purple-600 to-purple-700')}
      </div>

      <BankModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAccount}
        initialData={editingAccount}
      />
    </div>
  );
};
