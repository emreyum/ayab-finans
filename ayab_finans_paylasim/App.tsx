
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
    return (
      <>
        {/* Row 1: Income and Expense Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <StatCard
            title="Ofis Gelir"
            value={`₺${dashboardStats.totalIncome.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            trendText="Genel Toplam"
            icon="trending_up"
            variant="primary"
            trend="up"
          />
          <StatCard
            title="Ofis Gider"
            value={`₺${dashboardStats.expensesTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            trendText="Genel Toplam"
            icon="trending_down"
            trend="down"
          />
        </div>

        {/* Row 2: Visual Stats (Assets, Receivables, Collection Rate) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Total Assets Card */}
          <div className="lg:col-span-1">
            <div className="h-full">
              <StatCard
                title="Toplam Varlık"
                value={`₺${dashboardStats.cashBalance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
                subValue="Nakit + Banka (TL Karş.)"
                icon="point_of_sale"
              />
            </div>
          </div>

          {/* Column 2: Receivables Visual */}
          <div className="lg:col-span-1">
            <Receivables totalAmount={dashboardStats.totalClientReceivable} />
          </div>

          {/* Column 3: Collection Rate Visual */}
          <div className="lg:col-span-1">
            <CollectionRate />
          </div>
        </div>
      </>
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
