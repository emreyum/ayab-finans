
import React, { useState } from 'react';
import { BankAccount, Transaction, TransactionType, TransactionStatus } from '../types';
import { Icon } from './Icons';
import { BankModal } from './BankModal';

interface BankPageProps {
  accounts: BankAccount[];
  transactions: Transaction[];
  onDataChange: () => Promise<void>;
}

// Reusable Flip Card Component (Top Stats)
const FlipCard: React.FC<{
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}> = ({ front, back, className = "" }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={`h-48 w-full cursor-pointer group perspective-[1000px] ${className}`}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] rounded-lg ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-lg bg-white overflow-hidden">
          {front}
        </div>
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-lg bg-white overflow-hidden">
          {back}
        </div>
      </div>
    </div>
  );
};

// Collapsible Section Component
const AccountSection: React.FC<{
  title: string;
  accounts: BankAccount[];
  isOpen: boolean;
  onToggle: () => void;
  onEdit: (account: BankAccount) => void;
  icon: string;
  colorClass: string;
}> = ({ title, accounts, isOpen, onToggle, onEdit, icon, colorClass }) => {
  const totalBalanceTRY = accounts.reduce((sum, acc) => {
    const val = acc.currency === 'USD' ? acc.balance * 34.5 : acc.currency === 'EUR' ? acc.balance * 36.2 : acc.balance;
    return sum + val;
  }, 0);

  return (
    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden mb-4">
      <div 
        onClick={onToggle}
        className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
           <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
              <Icon name={icon} className={colorClass.replace('bg-', 'text-')} />
           </div>
           <h3 className="font-bold text-slate-800">{title}</h3>
           <span className="text-xs font-medium bg-white px-2 py-1 rounded-full border border-slate-200 text-slate-500">
             {accounts.length}
           </span>
        </div>
        <div className="flex items-center gap-4">
           <span className="font-bold text-slate-700 text-sm hidden sm:block">
             Toplam: ₺{totalBalanceTRY.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
           </span>
           <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-slate-400" />
        </div>
      </div>

      {isOpen && (
        <div className="divide-y divide-gray-50">
          {accounts.map((account) => (
            <div key={account.id} className="p-4 hover:bg-slate-50 flex items-center justify-between group transition-colors">
               <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      account.bankName.toLowerCase().includes('garanti') ? 'bg-[#269e6e] text-white' :
                      account.bankName.toLowerCase().includes('iş') ? 'bg-[#184590] text-white' :
                      account.bankName.toLowerCase().includes('qnb') ? 'bg-[#880e4f] text-white' :
                      account.bankName.toLowerCase().includes('yapı') ? 'bg-[#00529d] text-white' :
                      account.type === 'Nakit Kasa' ? 'bg-gray-700 text-white' :
                      'bg-slate-700 text-white'
                  }`}>
                    <Icon name={account.type.includes('Kasa') ? 'point_of_sale' : account.type.includes('Kredi') ? 'credit_card' : 'account_balance'} className="text-lg" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{account.bankName}</p>
                    <p className="text-xs text-slate-500">{account.type} {account.accountNumber !== '-' && `• ${account.accountNumber}`}</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-4">
                 <div className="text-right">
                    <p className={`font-bold ${account.type.includes('Kredi') ? 'text-slate-500' : 'text-slate-600'}`}>
                       {account.currency === 'USD' ? '$' : account.currency === 'EUR' ? '€' : '₺'}
                       {account.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                 </div>
                 <button 
                   onClick={(e) => { e.stopPropagation(); onEdit(account); }}
                   className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                   title="Düzenle"
                 >
                   <Icon name="edit" className="text-sm" />
                 </button>
               </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm italic">
              Bu kategoride hesap bulunmuyor.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const BankPage: React.FC<BankPageProps> = ({ accounts, transactions, onDataChange }) => {
  // NOTE: 'accounts' prop is already the LIVE calculated balance from App.tsx
  
  // Toggle States for Sections
  const [openSections, setOpenSections] = useState({
    tl: true,
    fx: true,
    cc: false
  });

  // Edit Modal State
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
     await onDataChange(); // Trigger Global Refresh in App.tsx
  };

  // --- Categorization Logic (Using Passed Props) ---
  const creditCards = accounts.filter(a => a.type === 'Kredi Kartı' || a.type.includes('Kredi'));
  const fxAccounts = accounts.filter(a => a.currency !== 'TRY' && !a.type.includes('Kredi'));
  const tlAccounts = accounts.filter(a => a.currency === 'TRY' && !a.type.includes('Kredi'));

  // --- Top Card Calculations ---
  const calculateTotal = (type: TransactionType) => {
    return transactions
      .filter(t => t.type === type && t.status !== TransactionStatus.REJECTED)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };
  const totalIncome = calculateTotal(TransactionType.INCOME);
  const totalExpense = calculateTotal(TransactionType.EXPENSE);
  
  const systemBalance = totalIncome - totalExpense;

  // Total Liquidity (Excluding Credit Card DEBT from assets)
  const liquidAssets = 
    tlAccounts.reduce((sum, a) => sum + a.balance, 0) + 
    fxAccounts.reduce((sum, a) => sum + (a.currency === 'USD' ? a.balance * 34.5 : a.balance * 36.2), 0);
  
  const ccDebt = creditCards.reduce((sum, a) => sum + a.balance, 0);

  const discrepancy = liquidAssets - systemBalance;
  const isDiscrepancyZero = Math.abs(discrepancy) < 5; // Tolerance for float precision

  return (
    <div className="space-y-8 pb-20">
      {/* Info Banner */}
      <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <Icon name="info" className="text-blue-500" />
        <span>Buradaki bakiyeler = Açılış Bakiyesi + İşlemler Sayfasındaki Hareketler şeklinde otomatik hesaplanır.</span>
      </div>

      {/* 3D Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD 1: LIQUID ASSETS */}
        <FlipCard
          front={
            <div className="h-full flex flex-col p-6 justify-between border border-slate-100 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-700">Likit Varlıklar</h3>
                  <p className="text-xs text-slate-400 mt-1">Nakit + Banka (TL Karşılığı)</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Icon name="savings" className="text-slate-600 text-xl" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">
                  ₺{liquidAssets.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 mt-2 text-slate-600 text-xs font-bold">
                  <Icon name="verified" className="text-sm" />
                  <span>Güncel Mevduat</span>
                </div>
              </div>
            </div>
          }
          back={
            <div className="h-full flex flex-col p-6 bg-gray-800 text-white justify-center space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-2">Varlık Dağılımı</h4>
               <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">TL Hesapları</span>
                <span className="font-bold">₺{tlAccounts.reduce((s,a)=>s+a.balance,0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Döviz (TL Karş.)</span>
                <span className="font-bold">₺{fxAccounts.reduce((s,a)=>s+(a.currency === 'USD' ? a.balance*34.5 : a.balance*36.2),0).toLocaleString('tr-TR', {maximumFractionDigits:0})}</span>
              </div>
            </div>
          }
        />

        {/* CARD 2: SYSTEM FLOW */}
        <FlipCard
          front={
            <div className="h-full flex flex-col p-6 justify-between border border-slate-100 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-700">İşlem Dengesi</h3>
                  <p className="text-xs text-slate-400 mt-1">Sistemdeki Gelir - Gider</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Icon name="sync_alt" className="text-slate-600 text-xl" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">
                  ₺{systemBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </p>
                 <div className="flex items-center gap-1 mt-2 text-slate-600 text-xs font-bold">
                  <Icon name="analytics" className="text-sm" />
                  <span>Muhasebe Kaydı</span>
                </div>
              </div>
            </div>
          }
          back={
             <div className="h-full flex flex-col p-6 bg-slate-50 border border-slate-200 justify-center space-y-3">
               <div className="flex justify-between text-sm">
                 <span className="text-slate-600 flex items-center gap-1"><Icon name="arrow_downward" className="text-xs"/> Gelir</span>
                 <span className="font-bold text-slate-800">₺{totalIncome.toLocaleString()}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-slate-500 flex items-center gap-1"><Icon name="arrow_upward" className="text-xs"/> Gider</span>
                 <span className="font-bold text-slate-800">₺{totalExpense.toLocaleString()}</span>
               </div>
               <div className="border-t border-dashed border-slate-200 my-1"></div>
                <div className="flex justify-between text-xs text-slate-500">
                 <span>Kredi Kartı Borcu:</span>
                 <span className="text-slate-400 font-bold">₺{ccDebt.toLocaleString()}</span>
               </div>
            </div>
          }
        />

        {/* CARD 3: DISCREPANCY */}
        <FlipCard
          front={
            <div className={`h-full flex flex-col p-6 justify-between border ${isDiscrepancyZero ? 'bg-slate-50 border-slate-200' : 'bg-orange-50 border-orange-100'}`}>
               <div className="flex justify-between items-start">
                <div>
                  <h3 className={`font-bold ${isDiscrepancyZero ? 'text-slate-800' : 'text-orange-800'}`}>
                    {isDiscrepancyZero ? 'Mutabakat' : 'Kayıt Dışı Fark'}
                  </h3>
                  <p className={`text-xs mt-1 ${isDiscrepancyZero ? 'text-slate-600' : 'text-slate-600'}`}>
                    Varlıklar vs İşlemler
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${isDiscrepancyZero ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'}`}>
                  <Icon name={isDiscrepancyZero ? "check_circle" : "warning"} className="text-xl" />
                </div>
              </div>
              <div>
                <p className={`text-3xl font-bold tracking-tight ${isDiscrepancyZero ? 'text-slate-700' : 'text-orange-700'}`}>
                  {isDiscrepancyZero ? 'Tamam' : `₺${Math.abs(discrepancy).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                </p>
                <p className={`text-xs mt-2 font-medium ${isDiscrepancyZero ? 'text-slate-600' : 'text-slate-600'}`}>
                   {isDiscrepancyZero ? 'Hesaplar Tutuyor' : discrepancy > 0 ? 'Açılış Bakiyeleri Yüksek' : 'İşlemler Varlıklardan Fazla'}
                </p>
              </div>
            </div>
          }
          back={
             <div className={`h-full flex flex-col p-6 justify-center items-center text-center ${isDiscrepancyZero ? 'bg-slate-800 text-white' : 'bg-orange-600 text-white'}`}>
               <h3 className="font-bold text-lg mb-2">{isDiscrepancyZero ? 'Sorun Yok' : 'Fark Analizi'}</h3>
               <p className="text-sm opacity-90">
                 Likit Varlıklar: ₺{liquidAssets.toLocaleString()} <br/>
                 İşlem Dengesi: ₺{systemBalance.toLocaleString()}
               </p>
            </div>
          }
        />
      </div>

      {/* Accounts Sections with Toggle */}
      <div className="space-y-2">
        <AccountSection 
          title="Banka ve Kasa Varlıkları (TL)" 
          accounts={tlAccounts} 
          isOpen={openSections.tl} 
          onToggle={() => toggleSection('tl')}
          onEdit={handleEdit}
          icon="account_balance"
          colorClass="bg-slate-500 text-blue-500"
        />

        <AccountSection 
          title="Döviz Varlıkları" 
          accounts={fxAccounts} 
          isOpen={openSections.fx} 
          onToggle={() => toggleSection('fx')}
          onEdit={handleEdit}
          icon="currency_exchange"
          colorClass="bg-slate-500 text-emerald-500"
        />

        <AccountSection 
          title="Kredi Kartları" 
          accounts={creditCards} 
          isOpen={openSections.cc} 
          onToggle={() => toggleSection('cc')}
          onEdit={handleEdit}
          icon="credit_card"
          colorClass="bg-purple-500 text-purple-500"
        />
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
