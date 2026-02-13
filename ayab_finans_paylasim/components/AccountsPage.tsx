
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils';

declare const XLSX: any;

interface AccountsPageProps {
  transactions: Transaction[];
  onDataChange: () => Promise<void>;
}

interface AccountGroupSummary {
  name: string;
  totalExpense: number;
  totalIncome: number;
  netBalance: number;
  transactionCount: number;
  lastTransactionDate: string;
  monthlyStats: { [key: string]: number };
  clients: string[];
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ transactions, onDataChange }) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter excluded clients/personnel within group
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setExcludedItems(new Set());
  }, [selectedGroup]);

  // --- GROUPING LOGIC ---
  const groupSummaries = useMemo(() => {
    const summaryMap: { [key: string]: AccountGroupSummary } = {};

    transactions.forEach(t => {
      if (t.status === TransactionStatus.REJECTED) return;
      
      // Group by 'group' field. If empty, fallback to 'Genel'.
      const groupName = t.group || 'Genel / Grupsuz';

      if (!summaryMap[groupName]) {
        summaryMap[groupName] = {
          name: groupName,
          totalExpense: 0,
          totalIncome: 0,
          netBalance: 0,
          transactionCount: 0,
          lastTransactionDate: t.date,
          monthlyStats: {},
          clients: []
        };
      }

      const group = summaryMap[groupName];
      const monthKey = t.date.substring(0, 7); // YYYY-MM

      if (t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT) {
        const amount = Math.abs(Number(t.amount));
        group.totalExpense += amount;
        group.monthlyStats[monthKey] = (group.monthlyStats[monthKey] || 0) + amount;
      } else if (t.type === TransactionType.INCOME || t.type === TransactionType.RECEIVABLE) {
        group.totalIncome += Math.abs(Number(t.amount));
      } else if (t.type === TransactionType.CURRENT) {
          if (t.amount < 0) {
              const amount = Math.abs(t.amount);
              group.totalExpense += amount;
              group.monthlyStats[monthKey] = (group.monthlyStats[monthKey] || 0) + amount;
          } else {
              group.totalIncome += t.amount;
          }
      }

      group.transactionCount += 1;
      if (t.date > group.lastTransactionDate) {
        group.lastTransactionDate = t.date;
      }
      
      const clientName = t.client || 'Müvekkilsiz';
      if (!group.clients.includes(clientName)) {
          group.clients.push(clientName);
      }
    });

    return Object.values(summaryMap).map(g => ({
      ...g,
      netBalance: g.totalIncome - g.totalExpense,
    })).sort((a, b) => b.totalExpense - a.totalExpense);
  }, [transactions]);

  const filteredGroups = groupSummaries.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- DETAIL VIEW LOGIC ---
  const groupDetails = useMemo(() => {
    if (!selectedGroup) return { transactions: [], subItems: [], monthlyData: [] };

    const rawGroupTx = transactions.filter(t => {
        const gName = t.group || 'Genel / Grupsuz';
        return gName === selectedGroup && t.status !== TransactionStatus.REJECTED;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const subItems = Array.from(new Set(rawGroupTx.map(t => t.client || 'Müvekkilsiz')));

    const filteredTx = rawGroupTx.filter(t => {
        const item = t.client || 'Müvekkilsiz';
        return !excludedItems.has(item);
    });

    const monthlyAgg: Record<string, number> = {};
    filteredTx.forEach(t => {
        if (t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount < 0)) {
            const m = t.date.substring(0, 7);
            monthlyAgg[m] = (monthlyAgg[m] || 0) + Math.abs(Number(t.amount));
        }
    });

    const monthlyData = Object.entries(monthlyAgg)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => b.month.localeCompare(a.month));

    return { transactions: filteredTx, subItems, monthlyData };
  }, [selectedGroup, transactions, excludedItems]);

  const toggleSubItem = (itemName: string) => {
      const newExcluded = new Set(excludedItems);
      if (newExcluded.has(itemName)) {
          newExcluded.delete(itemName);
      } else {
          newExcluded.add(itemName);
      }
      setExcludedItems(newExcluded);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    if (supabase) {
      try {
        const { error } = await supabase.from('transactions').delete().eq('id', itemToDelete);
        if (error) throw error;
        await onDataChange();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } catch (error: any) {
        alert("Silme hatası: " + error.message);
      } finally {
        setIsDeleting(false);
      }
    } else {
       setIsDeleteModalOpen(false);
       setItemToDelete(null);
       setIsDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedGroup) return;

    const dataToExport = groupDetails.transactions.map(t => ({
      "İşlem No": t.transactionNumber,
      "Tarih": formatDate(t.date),
      "Müvekkil": t.client || '-',
      "Personel": t.personnel || '-',
      "Tür": t.type,
      "Kategori": t.category,
      "Açıklama": t.description,
      "Tutar": t.amount,
      "Durum": t.status
    }));

    const monthlySummaryExport = groupDetails.monthlyData.map(d => ({
        "Dönem": d.month,
        "Toplam Gider": d.amount
    }));

    const wb = XLSX.utils.book_new();
    
    const wsDetail = XLSX.utils.json_to_sheet(dataToExport);
    wsDetail['!cols'] = [{wch: 15}, {wch: 12}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 15}, {wch: 30}, {wch: 12}, {wch: 10}];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Islem_Detayi");

    const wsMonthly = XLSX.utils.json_to_sheet(monthlySummaryExport);
    wsMonthly['!cols'] = [{wch: 15}, {wch: 15}];
    XLSX.utils.book_append_sheet(wb, wsMonthly, "Aylik_Ozet");

    const fileName = `${selectedGroup}_Masraf_Ekstresi_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getMonthName = (monthStr: string) => {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  if (selectedGroup) {
    const totalGroupExpense = groupDetails.monthlyData.reduce((acc, curr) => acc + curr.amount, 0);
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    const thisMonthExpense = groupDetails.monthlyData.find(d => d.month === thisMonthKey)?.amount || 0;

    return (
      <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative animate-fade-in">
        <div className="p-6 border-b border-gray-100 bg-gray-50 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedGroup(null)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200">
                  <Icon name="arrow_back" className="text-gray-600" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedGroup}</h2>
                  <p className="text-sm text-gray-500">Grup / Hesap Masraf Detayı</p>
                </div>
              </div>
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm">
                  <Icon name="download" /> <span className="hidden sm:inline">Excel İndir</span>
              </button>
          </div>

          <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Müvekkil/Kişi Filtresi</p>
              <div className="flex flex-wrap gap-2">
                  {groupDetails.subItems.map(item => {
                      const isExcluded = excludedItems.has(item);
                      return (
                          <button key={item} onClick={() => toggleSubItem(item)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${isExcluded ? 'bg-gray-100 text-gray-400 border-gray-200 line-through' : 'bg-white text-primary-700 border-primary-200'}`}>
                              {isExcluded ? <Icon name="check_box_outline_blank" className="text-[14px]" /> : <Icon name="check_box" className="text-[14px]" />} {item}
                          </button>
                      );
                  })}
                  {groupDetails.subItems.length === 0 && <span className="text-xs text-gray-400 italic">Bilgi bulunamadı.</span>}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 bg-white">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="p-5 rounded-xl bg-red-50 border border-red-100 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <Icon name="trending_down" className="text-6xl text-red-900" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-white rounded-lg text-red-600 shadow-sm"><Icon name="receipt_long" /></div>
                        <span className="text-sm font-bold text-red-800 uppercase">Toplam Masraf</span>
                    </div>
                    <p className="text-3xl font-bold text-red-700">₺{totalGroupExpense.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
                    <p className="text-xs text-red-500 mt-1 font-medium">Seçili kriterlere göre</p>
                 </div>

                 <div className="p-5 rounded-xl bg-orange-50 border border-orange-100 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <Icon name="calendar_today" className="text-6xl text-orange-900" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-white rounded-lg text-orange-600 shadow-sm"><Icon name="event" /></div>
                        <span className="text-sm font-bold text-orange-800 uppercase">Bu Ayki Masraf</span>
                    </div>
                    <p className="text-3xl font-bold text-orange-700">₺{thisMonthExpense.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
                    <p className="text-xs text-orange-500 mt-1 font-medium">{getMonthName(thisMonthKey)} Dönemi</p>
                 </div>
            </div>

            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-64 lg:h-auto shadow-sm">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm border-b border-gray-100 pb-2">
                    <Icon name="bar_chart" className="text-primary-600" /> Aylık Masraf Dağılımı
                </h4>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {groupDetails.monthlyData.map(d => {
                        const percent = (d.amount / totalGroupExpense) * 100;
                        return (
                            <div key={d.month} className="relative group">
                                <div className="flex justify-between text-xs mb-1.5 z-10 relative">
                                    <span className="font-bold text-gray-600">{getMonthName(d.month)}</span>
                                    <span className="font-bold text-gray-900">₺{d.amount.toLocaleString()}</span>
                                </div>
                                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500 rounded-full transition-all duration-500 group-hover:bg-primary-600" style={{ width: `${percent}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                     {groupDetails.monthlyData.length === 0 && <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Veri yok</div>}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6">
           <div className="border border-gray-200 rounded-xl overflow-hidden">
             <table className="w-full">
               <thead className="bg-gray-50 border-b border-gray-200">
                 <tr>
                   <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">İşlem No</th>
                   <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Tarih</th>
                   <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Müvekkil</th>
                   <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Açıklama</th>
                   <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Kategori</th>
                   <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Tutar</th>
                   <th className="py-3 px-4 w-10"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 bg-white">
                 {groupDetails.transactions.map(t => {
                   const isExpense = t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount < 0);
                   return (
                   <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-3 px-4 text-xs font-mono text-gray-500">{t.transactionNumber}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{formatDate(t.date)}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium">{t.client || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{t.description}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs border border-gray-200">{t.category}</span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold text-sm ${isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
                         {isExpense ? '-' : '+'} ₺{Math.abs(t.amount).toLocaleString('tr-TR', {minimumFractionDigits: 2})}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button 
                          onClick={(e) => handleDeleteClick(t.id, e)} 
                          className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                          title="Sil"
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      </td>
                   </tr>
                 )})}
                 {groupDetails.transactions.length === 0 && (
                   <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic">Görüntülenecek işlem bulunamadı.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-gray-100">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="delete_forever" className="text-3xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Emin misiniz?</h3>
              <p className="text-gray-500 text-sm mb-6">Bu işlemi silmek üzeresiniz.</p>
              <div className="flex gap-3">
                <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">İptal</button>
                <button disabled={isDeleting} onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">{isDeleting ? 'Siliniyor...' : 'Evet, Sil'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
           <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
           <input type="text" placeholder="Hesap/Grup ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div className="text-sm text-gray-500">Toplam <span className="font-bold text-gray-800">{filteredGroups.length}</span> Grup</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
         {filteredGroups.map(group => (
            <div key={group.name} onClick={() => setSelectedGroup(group.name)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all cursor-pointer group relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
               
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100"><Icon name="folder_open" className="text-2xl" /></div>
                     <div>
                         <h3 className="font-bold text-gray-900 group-hover:text-red-700 transition-colors text-lg">{group.name}</h3>
                         <p className="text-xs text-gray-500">{group.clients.length} Müvekkil • {group.transactionCount} İşlem</p>
                     </div>
                  </div>
                  <Icon name="chevron_right" className="text-gray-300 group-hover:text-red-500" />
               </div>

               <div className="space-y-3">
                  <div className="flex justify-between text-sm bg-red-50 p-2 rounded-lg border border-red-100">
                      <span className="text-red-800 font-medium">Toplam Gider</span>
                      <span className="font-bold text-red-700">₺{group.totalExpense.toLocaleString('tr-TR', {maximumFractionDigits: 0})}</span>
                  </div>
                  
                  <div className="flex justify-between items-end pt-2 border-t border-gray-100">
                      <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 uppercase font-bold">Son İşlem</span>
                          <span className="text-xs font-medium text-gray-600">{formatDate(group.lastTransactionDate)}</span>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] text-gray-400 uppercase font-bold">Aylık Ort.</span>
                         <p className="text-xs font-bold text-gray-600">₺{(group.totalExpense / (Object.keys(group.monthlyStats).length || 1)).toLocaleString('tr-TR', {maximumFractionDigits: 0})}</p>
                      </div>
                  </div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};