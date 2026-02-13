
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { StatCard } from './components/StatCard';
import { Receivables } from './components/Receivables';
import { CollectionRate } from './components/CollectionRate';
import { TransactionsPage } from './components/TransactionsPage';
import { BankPage } from './components/BankPage';
import { SettingsPage } from './components/SettingsPage';
import { ClientsPage } from './components/ClientsPage';
import { PersonnelPage } from './components/PersonnelPage';
import { AccountsPage } from './components/AccountsPage';
import { TransactionModal } from './components/TransactionModal';
import { Icon } from './components/Icons';
import { supabase } from './services/supabase';
import { Transaction, BankAccount, TransactionType, TransactionStatus, Expense, Receivable, OrganizationSettings, AppUser } from './types';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Application State (Real Data)
  const [dashboardStats, setDashboardStats] = useState({
    totalIncome: 0,
    incomeGrowth: 0,
    pendingInvoicesTotal: 0,
    pendingInvoicesCount: 0,
    expensesTotal: 0,
    expensesGrowth: 0,
    cashBalance: 0,
    totalClientReceivable: 0 // New Stat for the visual card
  });

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allAccounts, setAllAccounts] = useState<BankAccount[]>([]);
  const user: AppUser = { id: 'admin', username: 'admin', full_name: 'Yönetici', role: 'Admin' };
  const [appSettings, setAppSettings] = useState<OrganizationSettings>({ app_name: 'AYAB Finans' });

  // Quick Action Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [initialTxType, setInitialTxType] = useState<TransactionType>(TransactionType.EXPENSE);



  const fetchAllData = async () => {
    if (!supabase) return;

    try {
      const { data: settingsData, error } = await supabase.from('organization_settings').select('*').single();
      if (!error && settingsData) {
        const finalSettings = {
          ...settingsData,
          app_name: (settingsData.app_name === 'HukukFinans' || !settingsData.app_name) ? 'AYAB Finans' : settingsData.app_name
        };
        setAppSettings(finalSettings);
        document.title = finalSettings.app_name + " - Yönetim Paneli";
      } else {
        setAppSettings({ app_name: 'AYAB Finans' });
      }
    } catch (err) {
      console.warn("Settings table skipped.");
    }

    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_number', { ascending: false });

      const { data: txData } = await query;

      const transactions = (txData || []).map((t: any) => ({
        ...t,
        transactionNumber: t.transaction_number || (t.id.length > 8 ? `ESKİ-${t.id.substring(0, 6).toUpperCase()}` : t.id),
      })) as Transaction[];

      setAllTransactions(transactions);

      const { data: accData } = await supabase.from('bank_accounts').select('*');

      let accounts: BankAccount[] = [];
      if (accData) {
        accounts = accData.map((a: any) => ({
          id: a.id,
          bankName: a.bank_name,
          accountNumber: a.account_number,
          balance: a.balance,
          currency: a.currency,
          type: a.type
        }));
      }

      const liveAccounts = accounts.map(account => {
        const accountTransactions = transactions.filter(t =>
          t.account === account.bankName && t.status !== TransactionStatus.REJECTED
        );

        const moneyIn = accountTransactions
          .filter(t => t.type === TransactionType.INCOME || t.type === TransactionType.RECEIVABLE)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const moneyOut = accountTransactions
          .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
          ...account,
          balance: Number(account.balance) + (moneyIn - moneyOut)
        };
      });
      setAllAccounts(liveAccounts);

      const incomeTotal = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.REJECTED)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenseTotal = transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.REJECTED)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const pendingTotal = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const pendingCount = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
        .length;

      const totalCash = liveAccounts.reduce((sum, acc) => {
        if (acc.type.includes('Kredi Kartı')) return sum;
        const val = acc.currency === 'USD' ? acc.balance * 34.5 : acc.currency === 'EUR' ? acc.balance * 36.2 : acc.balance;
        return sum + val;
      }, 0);

      // Calculate Client Receivables (Account Advance)
      // Logic: Iterate clients, calc balance. If balance < 0 (Client owes us), add to total.
      const clientBalances: { [key: string]: number } = {};
      transactions.forEach(t => {
        if (t.status === TransactionStatus.REJECTED) return;
        const client = t.client;
        if (!client) return;
        if (!clientBalances[client]) clientBalances[client] = 0;

        // In Client View: Income adds to balance (Money held), Expense subtracts (Money spent)
        if (t.type === TransactionType.INCOME) clientBalances[client] += t.amount;
        else if (t.type === TransactionType.EXPENSE) clientBalances[client] -= t.amount;
        else if (t.type === TransactionType.CURRENT) clientBalances[client] += t.amount; // + is Accrual/Deposit, - is Payment/Use
      });

      const totalClientReceivable = Object.values(clientBalances)
        .filter(balance => balance < 0) // Negative means we spent more than we got => Receivable
        .reduce((sum, balance) => sum + Math.abs(balance), 0);

      setDashboardStats({
        totalIncome: incomeTotal,
        incomeGrowth: 0,
        pendingInvoicesTotal: pendingTotal,
        pendingInvoicesCount: pendingCount,
        expensesTotal: expenseTotal,
        expensesGrowth: 0,
        cashBalance: totalCash,
        totalClientReceivable: totalClientReceivable
      });

    } catch (error) {
      console.error("Data fetch error:", error);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
  };

  const handleSaveTransaction = async (transactionData: any) => {
    if (supabase) {
      try {
        const payload = {
          ...transactionData,
          transaction_number: transactionData.transactionNumber
        };
        const { error } = await supabase.from('transactions').insert([payload]);
        if (error) throw error;
        await fetchAllData();
      } catch (e: any) {
        alert("Hata: " + e.message);
      }
    }
  }

  const renderContent = () => {
    if (activeTab === 'transactions') return <TransactionsPage transactions={allTransactions} onTransactionsChange={fetchAllData} />;
    if (activeTab === 'bank') return <BankPage accounts={allAccounts} transactions={allTransactions} onDataChange={fetchAllData} />;
    if (activeTab === 'accounts') return <AccountsPage transactions={allTransactions} onDataChange={fetchAllData} />;
    if (activeTab === 'settings') return <SettingsPage />;
    if (activeTab === 'clients') return <ClientsPage transactions={allTransactions} onDataChange={fetchAllData} />;
    if (activeTab === 'personnel') return <PersonnelPage transactions={allTransactions} onDataChange={fetchAllData} />;

    // Dashboard
    const recentTransactions = [...allTransactions]
      .filter(t => t.status !== TransactionStatus.REJECTED)
      .slice(0, 5);

    return (
      <div className="space-y-6">
        {/* Top Row: Key Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ofis Gelir"
            value={`₺${dashboardStats.totalIncome.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            trend="up"
            trendText="+12%"
            icon="trending_up"
          />
          <StatCard
            title="Ofis Gider"
            value={`₺${dashboardStats.expensesTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            trend="down"
            trendText="-5%"
            icon="trending_down"
          />
          <StatCard
            title="Toplam Varlık"
            value={`₺${dashboardStats.cashBalance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            subValue="Nakit + Banka"
            icon="account_balance_wallet"
          />
          <StatCard
            title="Müvekkil Alacağı"
            value={`₺${dashboardStats.totalClientReceivable.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            subValue="Tahsil Edilecek"
            icon="payments"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Visualizations (8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Receivables totalAmount={dashboardStats.totalClientReceivable} />
              <CollectionRate />
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Icon name="history" className="text-slate-400" /> Son İşlemler
                </h3>
                <button onClick={() => setActiveTab('transactions')} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider">
                  Tümünü Gör
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Müvekkil / Grup</th>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Tutar</th>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentTransactions.length > 0 ? recentTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-3 text-xs text-slate-600 font-medium">{new Date(t.date).toLocaleDateString('tr-TR')}</td>
                        <td className="px-5 py-3">
                          <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]">{t.client || t.group || '-'}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{t.category}</p>
                        </td>
                        <td className={`px-5 py-3 text-xs font-bold text-right ${t.type === TransactionType.INCOME ? 'text-slate-700' : 'text-slate-500'
                          }`}>
                          {t.type === TransactionType.INCOME || t.type === TransactionType.RECEIVABLE ? '+' : '-'}
                          ₺{t.amount.toLocaleString('tr-TR')}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <div className={`w-1.5 h-1.5 rounded-full inline-block ${t.status === TransactionStatus.APPROVED ? 'bg-slate-800' : 'bg-slate-400'
                            }`}></div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-400">Henüz işlem bulunmuyor.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Side Dashboard Panel (4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <div className="bg-slate-900 rounded-lg p-5 text-white">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Hızlı İşlemler</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setInitialTxType(TransactionType.INCOME); setIsTxModalOpen(true); }}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-all flex flex-col items-center gap-2 border border-white/5"
                >
                  <Icon name="add_circle" className="text-xl" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Gelir Ekle</span>
                </button>
                <button
                  onClick={() => { setInitialTxType(TransactionType.EXPENSE); setIsTxModalOpen(true); }}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-all flex flex-col items-center gap-2 border border-white/5"
                >
                  <Icon name="remove_circle" className="text-xl" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Gider Ekle</span>
                </button>
                <button
                  onClick={() => setActiveTab('bank')}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-all flex flex-col items-center gap-2 border border-white/5"
                >
                  <Icon name="account_balance" className="text-xl" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Bankalar</span>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-all flex flex-col items-center gap-2 border border-white/5"
                >
                  <Icon name="settings" className="text-xl" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Ayarlar</span>
                </button>
              </div>
            </div>

            {/* Information Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Icon name="info" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Sistem Durumu</h4>
                  <p className="text-[10px] text-slate-400">Veriler Supabase ile senkronize.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Bekleyen İşlemler</span>
                  <span className="font-bold text-slate-800">{dashboardStats.pendingInvoicesCount} Adet</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Müvekkil Sayısı</span>
                  <span className="font-bold text-slate-800">{[...new Set(allTransactions.map(t => t.client))].filter(Boolean).length}</span>
                </div>
                <div className="w-full bg-slate-50 rounded-full h-1.5">
                  <div className="bg-slate-800 h-1.5 rounded-full w-4/5"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return { title: 'Finansal Durum', subtitle: 'Anlık finansal veriler ve performans özeti.' };
      case 'transactions': return { title: 'İşlemler', subtitle: 'Tüm finansal hareketlerinizi detaylı olarak inceleyin.' };
      case 'bank': return { title: 'Kasa ve Banka Yönetimi', subtitle: 'Banka hesaplarınızı ve nakit akışınızı tek ekrandan yönetin.' };
      case 'accounts': return { title: 'Hesap ve Avanslar', subtitle: 'Ofis gider grupları ve operasyonel harcama takibi.' };
      case 'settings': return { title: 'Ayarlar', subtitle: 'Sistem parametrelerini, bankaları ve kullanıcıları yönetin.' };
      case 'clients': return { title: 'Müvekkil Yönetimi', subtitle: 'Müvekkil carileri, proje bakiyeleri ve hesap ekstreleri.' };
      case 'personnel': return { title: 'Personel Hesapları', subtitle: 'Personel maaş, prim ve masraf ödemelerinin takibi.' };
      default: return { title: 'Sayfa', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex h-screen bg-surface-light overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} appSettings={appSettings} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
              <p className="text-gray-500 mt-1">{subtitle}</p>
            </div>
          </div>

          {renderContent()}
        </main>

        <TransactionModal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          onSave={handleSaveTransaction}
          initialData={{ type: initialTxType } as any}
        />
      </div>
    </div>
  );
}

export default App;
