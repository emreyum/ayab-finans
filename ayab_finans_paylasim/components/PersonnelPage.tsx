
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus, Personnel } from '../types';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils';

declare const XLSX: any;

interface PersonnelPageProps {
  transactions: Transaction[];
  onDataChange: () => Promise<void>;
}

interface QuarterlyStat {
  year: number;
  quarter: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  shareAmount: number; 
  transactionCount: number;
}

interface PersonnelSummary extends Personnel {
  totalIncome: number; 
  totalExpense: number; 
  
  totalDebt: number;
  totalReceivable: number; 
  currentAccountBalance: number; 

  transactionCount: number;
  lastTransactionDate: string;
  currentYearShare: number; 
  quarterlyStats: QuarterlyStat[]; 
}

type SortOption = 'name-asc' | 'name-desc' | 'count-desc';
type ViewMode = 'performance' | 'current_account';

export const PersonnelPage: React.FC<PersonnelPageProps> = ({ transactions, onDataChange }) => {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonnelSummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('current_account');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupSort, setGroupSort] = useState<SortOption>('name-asc');
  const [expandedRoles, setExpandedRoles] = useState<{ [key: string]: boolean }>({});
  const [expandedQuarter, setExpandedQuarter] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonnel = async () => {
      if (supabase) {
        const { data, error } = await supabase.from('personnel_definitions').select('*').order('full_name');
        if (error) {
           console.warn("Personnel definitions table missing or error:", error.message);
           setPersonnelList([
             { id: '1', full_name: 'Av. Mehmet Yılmaz', role: 'Kıdemli Avukat', bonus_percentage: 40 },
             { id: '2', full_name: 'Stj. Ali Veli', role: 'Stajyer', bonus_percentage: 0 }
           ]);
        } else if (data) {
           setPersonnelList(data);
        }
      } else {
        setPersonnelList([
          { id: '1', full_name: 'Av. Mehmet Yılmaz', role: 'Kıdemli Avukat', bonus_percentage: 40 },
          { id: '2', full_name: 'Stj. Ali Veli', role: 'Stajyer', bonus_percentage: 10 }
        ]);
      }
    };
    fetchPersonnel();
  }, []);

  const summaries = useMemo<PersonnelSummary[]>(() => {
    return personnelList.map(person => {
      const personTransactions = transactions.filter(t => 
        t.personnel === person.full_name && t.status !== TransactionStatus.REJECTED
      );

      const income = personTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expense = personTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const debt = personTransactions
        .filter(t => t.type === TransactionType.DEBT)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const receivable = personTransactions
        .filter(t => t.type === TransactionType.RECEIVABLE)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const accountBalance = debt - receivable;
      const sortedDates = personTransactions.map(t => t.date).sort().reverse();

      const statsMap: { [key: string]: QuarterlyStat } = {};
      const currentYear = new Date().getFullYear();
      const bonusRate = (person.bonus_percentage || 0) / 100; 

      personTransactions.forEach(t => {
        const d = new Date(t.date);
        const year = d.getFullYear();
        const quarter = Math.floor(d.getMonth() / 3) + 1; 
        const key = `${year}-Q${quarter}`;

        if (!statsMap[key]) {
          statsMap[key] = {
            year,
            quarter,
            totalIncome: 0,
            totalExpense: 0,
            netBalance: 0,
            shareAmount: 0,
            transactionCount: 0
          };
        }

        const stat = statsMap[key];
        if (t.type === TransactionType.INCOME) {
          stat.totalIncome += Number(t.amount);
        } else if (t.type === TransactionType.EXPENSE) {
          stat.totalExpense += Number(t.amount);
        }
        stat.transactionCount += 1;
      });

      const quarterlyStats: QuarterlyStat[] = Object.values(statsMap).map(stat => {
        const net = stat.totalIncome - stat.totalExpense;
        return {
          ...stat,
          netBalance: net,
          shareAmount: net * bonusRate
        };
      }).sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.quarter - a.quarter;
      });

      const currentYearShare = quarterlyStats
        .filter(q => q.year === currentYear)
        .reduce((sum, q) => sum + q.shareAmount, 0);

      return {
        ...person,
        totalIncome: income,
        totalExpense: expense,
        totalDebt: debt,
        totalReceivable: receivable,
        currentAccountBalance: accountBalance,
        transactionCount: personTransactions.length,
        lastTransactionDate: sortedDates[0] || '-',
        quarterlyStats,
        currentYearShare
      } as PersonnelSummary;
    }).filter(p => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [personnelList, transactions, searchTerm]);

  const { operationalTransactions, financialTransactions } = useMemo(() => {
    if (!selectedPerson) return { operationalTransactions: [], financialTransactions: [] };
    
    const all = transactions
      .filter(t => t.personnel === selectedPerson.full_name && t.status !== TransactionStatus.REJECTED)
      .sort((a, b) => b.date.localeCompare(a.date));
      
    const financial = all.filter(t => 
        t.type === TransactionType.DEBT || 
        t.type === TransactionType.RECEIVABLE || 
        t.type === TransactionType.CURRENT
    );

    const operational = all.filter(t => 
        t.type === TransactionType.INCOME || 
        t.type === TransactionType.EXPENSE
    );

    return { operationalTransactions: operational, financialTransactions: financial };
  }, [selectedPerson, transactions]);

  const groupedPersonnel = useMemo<{ [key: string]: PersonnelSummary[] }>(() => {
    const groups: { [key: string]: PersonnelSummary[] } = {};
    summaries.forEach(person => {
        let rawRole = person.role && person.role.trim() !== '' ? person.role : 'Tanımsız Rol';
        if (rawRole.toLowerCase().endsWith('s') && rawRole.length > 3) {
            rawRole = rawRole.slice(0, -1);
        }
        
        const role = rawRole;
        if (!groups[role]) {
            groups[role] = [];
        }
        groups[role].push(person);
    });
    return groups;
  }, [summaries]);

  const sortedRoleKeys = useMemo(() => {
      const keys = Object.keys(groupedPersonnel);
      return keys.sort((a, b) => {
          if (groupSort === 'name-asc') return a.localeCompare(b, 'tr');
          if (groupSort === 'name-desc') return b.localeCompare(a, 'tr');
          if (groupSort === 'count-desc') return groupedPersonnel[b].length - groupedPersonnel[a].length;
          return 0;
      });
  }, [groupedPersonnel, groupSort]);

  const toggleRole = (role: string) => {
    setExpandedRoles(prev => ({ ...prev, [role]: !prev[role] }));
  };
  
  const toggleQuarter = (key: string) => {
      if (expandedQuarter === key) {
          setExpandedQuarter(null);
      } else {
          setExpandedQuarter(key);
      }
  };

  const handleBackToList = () => {
      setSelectedPerson(null);
      setViewMode('current_account');
      setExpandedQuarter(null);
  };

  const getTransactionsForQuarter = (year: number, quarter: number) => {
      if (!selectedPerson) return [];
      
      return operationalTransactions.filter(t => {
          const d = new Date(t.date);
          const tYear = d.getFullYear();
          const tQuarter = Math.floor(d.getMonth() / 3) + 1;
          return tYear === year && tQuarter === quarter;
      });
  };

  const handleQuarterExport = (e: React.MouseEvent, stat: QuarterlyStat) => {
      e.stopPropagation();
      if (!selectedPerson) return;
      
      const quarterTransactions = getTransactionsForQuarter(stat.year, stat.quarter);
      
      const summaryData = [{
          "Personel": selectedPerson.full_name,
          "Dönem": `${stat.year} - ${stat.quarter}. Çeyrek`,
          "Toplam Gelir": stat.totalIncome,
          "Toplam Gider": stat.totalExpense,
          "Net Ofis Kârı": stat.netBalance,
          "Hakediş Oranı": `%${selectedPerson.bonus_percentage}`,
          "Hakediş (%40'lar) Tutarı": stat.shareAmount
      }];
      
      const detailData = quarterTransactions.map(t => ({
          "Tarih": formatDate(t.date),
          "İşlem No": t.transactionNumber,
          "Tür": t.type,
          "Kategori": t.category,
          "Açıklama": t.description,
          "Müvekkil/Muhatap": t.client || t.counterparty,
          "Tutar": t.amount
      }));

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ozet");

      const wsDetail = XLSX.utils.json_to_sheet(detailData);
      wsDetail['!cols'] = [{wch: 12}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 30}, {wch: 20}, {wch: 12}];
      XLSX.utils.book_append_sheet(wb, wsDetail, "Islem_Dokumu");

      const safeName = selectedPerson.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      XLSX.writeFile(wb, `${safeName}_${stat.year}_Q${stat.quarter}_hakedis.xlsx`);
  };

  const handleFinancialExport = () => {
      if (!selectedPerson) return;

      const dataToExport = financialTransactions.map(t => ({
          "Tarih": formatDate(t.date),
          "İşlem No": t.transactionNumber,
          "Tür": t.type, // Borç / Alacak
          "Açıklama": t.description,
          "Kategori": t.category,
          "Tutar": t.amount
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = [{wch: 12}, {wch: 15}, {wch: 12}, {wch: 30}, {wch: 15}, {wch: 12}];
      
      XLSX.utils.book_append_sheet(wb, ws, "Cari_Hareketler");
      const safeName = selectedPerson.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      XLSX.writeFile(wb, `${safeName}_cari_hesap_dokumu.xlsx`);
  };

  const getRoleIcon = (roleName: string) => {
      const lower = roleName.toLowerCase();
      if (lower.includes('avukat') || lower.includes('hukuk')) return 'gavel';
      if (lower.includes('staj')) return 'school';
      if (lower.includes('tahsilat') || lower.includes('muhasebe') || lower.includes('finans')) return 'account_balance_wallet';
      if (lower.includes('sekreter') || lower.includes('asistan') || lower.includes('katip')) return 'support_agent';
      if (lower.includes('yönet') || lower.includes('admin') || lower.includes('ortak')) return 'admin_panel_settings';
      return 'badge';
  };

  return (
    <div className="space-y-6 pb-20">
      
      {!selectedPerson && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex gap-4 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Personel ara..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" 
                />
              </div>
              <div className="relative min-w-[160px]">
                <Icon name="sort" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                    value={groupSort}
                    onChange={(e) => setGroupSort(e.target.value as SortOption)}
                    className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white appearance-none cursor-pointer text-sm font-medium text-gray-600"
                >
                    <option value="name-asc">Grup Adı (A-Z)</option>
                    <option value="name-desc">Grup Adı (Z-A)</option>
                    <option value="count-desc">Personel Sayısı</option>
                </select>
                <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
          </div>
          <div className="text-sm text-gray-500 whitespace-nowrap">Toplam <span className="font-bold text-gray-800">{summaries.length}</span> Personel</div>
        </div>
      )}

      {selectedPerson ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
          
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-6">
               <button onClick={handleBackToList} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors">
                 <div className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-100">
                   <Icon name="arrow_back" />
                 </div>
                 <span className="font-medium">Listeye Dön</span>
               </button>
               <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide">{selectedPerson.role || 'Personel'}</span>
                  {selectedPerson.bonus_percentage && selectedPerson.bonus_percentage > 0 ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wide">%{selectedPerson.bonus_percentage} Prim</span>
                  ) : null}
               </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm">
                    {selectedPerson.full_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedPerson.full_name}</h2>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      {selectedPerson.phone && <span className="flex items-center gap-1"><Icon name="phone" className="text-xs" /> {selectedPerson.phone}</span>}
                      {selectedPerson.email && <span className="flex items-center gap-1"><Icon name="email" className="text-xs" /> {selectedPerson.email}</span>}
                    </div>
                  </div>
               </div>

               <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                  <button
                    onClick={() => setViewMode('current_account')} 
                    className={`flex-1 lg:flex-none p-4 bg-white rounded-xl border shadow-sm min-w-[160px] text-left hover:shadow-md transition-all ${
                        viewMode === 'current_account' ? 'ring-2 ring-purple-500 border-purple-500' : 'border-gray-200'
                    }`}
                  >
                     <div className="flex justify-between items-start mb-1">
                        <p className="text-xs text-gray-400 font-bold uppercase">Cari Bakiye</p>
                        <Icon name={viewMode === 'current_account' ? "check_circle" : "arrow_forward_ios"} className={`text-[10px] ${viewMode === 'current_account' ? "text-purple-500" : "text-gray-300"}`} />
                     </div>
                     <p className={`text-xl font-bold ${selectedPerson.currentAccountBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₺{selectedPerson.currentAccountBalance.toLocaleString()}
                     </p>
                     <p className="text-[10px] text-gray-400 mt-1">
                         {selectedPerson.currentAccountBalance < 0 ? 'Avans/Borçlu' : 'İçeride/Alacaklı'}
                     </p>
                  </button>
                  
                  <button 
                    onClick={() => setViewMode('performance')}
                    className={`flex-1 lg:flex-none p-4 rounded-xl border shadow-sm min-w-[180px] flex items-center justify-center gap-2 transition-all group ${
                        viewMode === 'performance' ? 'bg-gray-800 text-white border-gray-800' : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                     <Icon name="verified" className="text-xl" /> 
                     <div className="text-left">
                        <p className="text-[10px] font-bold uppercase opacity-70">%40'lar</p>
                        <p className="text-sm font-bold">Raporu Görüntüle</p>
                     </div>
                     <Icon name="chevron_right" />
                  </button>

                  {viewMode === 'current_account' && (
                    <button 
                       onClick={handleFinancialExport}
                       className="px-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                       <Icon name="download" /> Excel İndir
                    </button>
                  )}
               </div>
            </div>
          </div>

          <div className="p-6">
            {viewMode === 'performance' ? (
                <div className="animate-fade-in">
                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 mb-6">
                        <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
                            <Icon name="calculate" />
                            %40'lar Hesaplama Mantığı
                        </h3>
                        <p className="text-amber-800 text-sm">
                            Hakediş tutarı, personelin dahil olduğu <strong>Dosya/Ofis Geliri - Dosya/Ofis Gideri</strong> formülü ile bulunan NET tutarın, 
                            personel kartında tanımlanan <strong>Prim Oranı (%{selectedPerson.bonus_percentage || 0})</strong> ile çarpılması sonucu hesaplanır.
                        </p>
                    </div>

                    <h3 className="font-bold text-gray-800 mb-4 text-lg">Dönemsel Performans & %40'lar Tablosu</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="p-4 text-sm font-bold text-gray-600">Dönem</th>
                                    <th className="p-4 text-sm font-bold text-gray-600 text-center">İşlem Sayısı</th>
                                    <th className="p-4 text-sm font-bold text-gray-600 text-right">Dosya Geliri</th>
                                    <th className="p-4 text-sm font-bold text-gray-600 text-right">Dosya Gideri</th>
                                    <th className="p-4 text-sm font-bold text-gray-600 text-right">Net Ofis Kârı</th>
                                    <th className="p-4 text-sm font-bold text-primary-700 text-right bg-primary-50">%40'lar (%{selectedPerson.bonus_percentage})</th>
                                    <th className="p-4 w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {selectedPerson.quarterlyStats.map((q) => {
                                    const key = `${q.year}-Q${q.quarter}`;
                                    const isExpanded = expandedQuarter === key;
                                    
                                    return (
                                    <React.Fragment key={key}>
                                        <tr 
                                            onClick={() => toggleQuarter(key)}
                                            className={`cursor-pointer transition-colors border-l-4 ${isExpanded ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50 border-transparent'}`}
                                        >
                                            <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                                                <Icon name={isExpanded ? "expand_less" : "expand_more"} className="text-gray-400 text-lg" />
                                                {q.year} - {q.quarter}. Çeyrek
                                            </td>
                                            <td className="p-4 text-center text-gray-600">
                                                <span className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-bold">{q.transactionCount}</span>
                                            </td>
                                            <td className="p-4 text-right text-emerald-600 font-medium">
                                                ₺{q.totalIncome.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right text-red-600 font-medium">
                                                ₺{q.totalExpense.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right font-bold text-gray-800">
                                                ₺{q.netBalance.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right font-bold text-lg bg-opacity-50 bg-primary-50">
                                                <span className={q.shareAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                    ₺{q.shareAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={(e) => handleQuarterExport(e, q)}
                                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm transition-colors"
                                                    title="Excel Olarak İndir"
                                                >
                                                    <Icon name="download" className="text-sm" /> Excel
                                                </button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={7} className="p-4 animate-fade-in">
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                                            <span className="text-xs font-bold text-gray-500 uppercase">{key} Dönemi İşlem Dökümü</span>
                                                            <span className="text-xs text-gray-400">{q.transactionCount} kayıt listelendi</span>
                                                        </div>
                                                        <table className="w-full text-left text-sm">
                                                            <thead>
                                                                <tr className="text-gray-500 border-b border-gray-100">
                                                                    <th className="p-3 font-bold text-xs">Tarih</th>
                                                                    <th className="p-3 font-bold text-xs">Açıklama</th>
                                                                    <th className="p-3 font-bold text-xs">Müvekkil</th>
                                                                    <th className="p-3 font-bold text-xs text-right">Tutar</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {getTransactionsForQuarter(q.year, q.quarter).map(t => (
                                                                    <tr key={t.id} className="hover:bg-gray-50">
                                                                        <td className="p-3 text-xs font-mono text-gray-600">{formatDate(t.date)}</td>
                                                                        <td className="p-3 text-xs text-gray-800">{t.description}</td>
                                                                        <td className="p-3 text-xs text-gray-600">{t.client || t.counterparty || '-'}</td>
                                                                        <td className={`p-3 text-xs font-bold text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                            {t.type === TransactionType.INCOME ? '+' : '-'} ₺{t.amount.toLocaleString()}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                    );
                                })}
                            </tbody>
                            {selectedPerson.quarterlyStats.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr>
                                        <td colSpan={5} className="p-4 text-right font-bold text-gray-600 uppercase">Genel Toplam %40'lar</td>
                                        <td className="p-4 text-right font-bold text-xl text-primary-700 bg-primary-100 border-l border-primary-200">
                                            ₺{selectedPerson.quarterlyStats.reduce((acc, curr) => acc + curr.shareAmount, 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                           <h3 className="font-bold text-purple-900 text-lg flex items-center gap-2">
                               <Icon name="account_balance_wallet" className="text-purple-600" />
                               Cari Hesap Hareketleri
                           </h3>
                           <p className="text-sm text-gray-500">Personelin avans, borç ve alacak işlemleri.</p>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left border-b border-purple-100 bg-purple-50">
                                    <th className="py-3 pl-4 text-xs font-bold text-purple-700 uppercase">Tarih</th>
                                    <th className="py-3 text-xs font-bold text-purple-700 uppercase">Tür</th>
                                    <th className="py-3 text-xs font-bold text-purple-700 uppercase">Açıklama</th>
                                    <th className="py-3 text-xs font-bold text-purple-700 uppercase">Kategori</th>
                                    <th className="py-3 pr-4 text-right text-xs font-bold text-purple-700 uppercase">Tutar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {financialTransactions.map((t) => {
                                    const isDebt = t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount > 0);
                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-4 pl-4 text-sm text-gray-600 font-mono whitespace-nowrap">{formatDate(t.date)}</td>
                                            <td className="py-4">
                                                <span className={`text-[10px] px-2 py-1 rounded font-bold border ${
                                                    t.type === TransactionType.DEBT ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                    t.type === TransactionType.RECEIVABLE ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    'bg-purple-50 text-purple-600 border-purple-100'
                                                }`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="py-4 text-sm text-gray-800">{t.description}</td>
                                            <td className="py-4 text-sm text-gray-500">{t.category}</td>
                                            <td className={`py-4 pr-4 text-right font-bold text-sm ${
                                                isDebt ? 'text-orange-600' : 'text-blue-600'
                                            }`}>
                                                {isDebt ? '(Borç) +' : '(Alacak) -'} ₺{Math.abs(t.amount).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                                <tr>
                                    <td colSpan={4} className="p-4 text-right font-bold text-gray-600 uppercase">Güncel Bakiye</td>
                                    <td className={`p-4 text-right font-bold text-lg ${selectedPerson.currentAccountBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ₺{selectedPerson.currentAccountBalance.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedRoleKeys.length > 0 ? sortedRoleKeys.map((role) => {
            const people = groupedPersonnel[role];
            return (
            <div key={role} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div 
                    onClick={() => toggleRole(role)}
                    className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-sm">
                            <Icon name={getRoleIcon(role)} className="text-lg" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">{role}</h3>
                            <p className="text-xs text-gray-500">{people.length} Personel</p>
                        </div>
                    </div>
                    <Icon name={expandedRoles[role] ? "expand_less" : "expand_more"} className="text-gray-400" />
                </div>

                {expandedRoles[role] && (
                    <div className="border-t border-gray-100 animate-fade-in">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">Personel</th>
                                    <th className="px-6 py-3 hidden sm:table-cell">İletişim</th>
                                    <th className="px-6 py-3 hidden md:table-cell">Son İşlem</th>
                                    <th className="px-6 py-3 text-right">Cari Bakiye</th>
                                    <th className="px-6 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {people.map(person => (
                                    <tr 
                                        key={person.id} 
                                        onClick={() => { setSelectedPerson(person); setViewMode('current_account'); }}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold border border-gray-200">
                                                    {person.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors">{person.full_name}</p>
                                                    <p className="text-xs text-gray-500">{person.role || 'Personel'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 hidden sm:table-cell">
                                            <div className="flex flex-col text-xs">
                                                <span>{person.email || '-'}</span>
                                                <span>{person.phone}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 hidden md:table-cell text-xs whitespace-nowrap">
                                            {person.lastTransactionDate !== '-' ? (
                                                <div className="flex items-center gap-1">
                                                     <Icon name="event" className="text-[10px]" />
                                                     {formatDate(person.lastTransactionDate)}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${person.currentAccountBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                ₺{person.currentAccountBalance.toLocaleString()}
                                            </span>
                                            <p className="text-[10px] text-gray-400">
                                                {person.currentAccountBalance < 0 ? 'Borçlu/Avans' : 'Alacaklı'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Icon name="chevron_right" className="text-gray-300 group-hover:text-primary-600" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          )}) : (
             <div className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                <Icon name="person_off" className="text-2xl" />
              </div>
              <p className="text-gray-500 font-medium">Kayıtlı personel bulunamadı.</p>
              <p className="text-sm text-gray-400">Ayarlar sayfasından personel ekleyebilirsiniz.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};