
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
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { setExcludedItems(new Set()); }, [selectedGroup]);

  const groupSummaries = useMemo(() => {
    const summaryMap: { [key: string]: AccountGroupSummary } = {};
    transactions.forEach(t => {
      if (t.status === TransactionStatus.REJECTED) return;
      const groupName = t.group || 'Genel / Grupsuz';
      if (!summaryMap[groupName]) {
        summaryMap[groupName] = { name: groupName, totalExpense: 0, totalIncome: 0, netBalance: 0, transactionCount: 0, lastTransactionDate: t.date, monthlyStats: {}, clients: [] };
      }
      const group = summaryMap[groupName];
      const monthKey = t.date.substring(0, 7);
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
      if (t.date > group.lastTransactionDate) group.lastTransactionDate = t.date;
      const clientName = t.client || 'Müvekkilsiz';
      if (!group.clients.includes(clientName)) group.clients.push(clientName);
    });
    return Object.values(summaryMap).map(g => ({ ...g, netBalance: g.totalIncome - g.totalExpense })).sort((a, b) => b.totalExpense - a.totalExpense);
  }, [transactions]);

  const filteredGroups = groupSummaries.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const groupDetails = useMemo(() => {
    if (!selectedGroup) return { transactions: [], subItems: [], monthlyData: [] };
    const rawGroupTx = transactions.filter(t => (t.group || 'Genel / Grupsuz') === selectedGroup && t.status !== TransactionStatus.REJECTED).sort((a, b) => b.date.localeCompare(a.date));
    const subItems = Array.from(new Set(rawGroupTx.map(t => t.client || 'Müvekkilsiz')));
    const filteredTx = rawGroupTx.filter(t => !excludedItems.has(t.client || 'Müvekkilsiz'));
    const monthlyAgg: Record<string, number> = {};
    filteredTx.forEach(t => {
      if (t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount < 0)) {
        const m = t.date.substring(0, 7);
        monthlyAgg[m] = (monthlyAgg[m] || 0) + Math.abs(Number(t.amount));
      }
    });
    const monthlyData = Object.entries(monthlyAgg).map(([month, amount]) => ({ month, amount })).sort((a, b) => b.month.localeCompare(a.month));
    return { transactions: filteredTx, subItems, monthlyData };
  }, [selectedGroup, transactions, excludedItems]);

  const toggleSubItem = (itemName: string) => {
    const s = new Set(excludedItems);
    s.has(itemName) ? s.delete(itemName) : s.add(itemName);
    setExcludedItems(s);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setItemToDelete(id); setIsDeleteModalOpen(true); };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    if (supabase) {
      try {
        const { error } = await supabase.from('transactions').delete().eq('id', itemToDelete);
        if (error) throw error;
        await onDataChange();
        setIsDeleteModalOpen(false); setItemToDelete(null);
      } catch (error: any) { alert("Silme hatası: " + error.message); }
      finally { setIsDeleting(false); }
    } else { setIsDeleteModalOpen(false); setItemToDelete(null); setIsDeleting(false); }
  };

  const handleExportExcel = () => {
    if (!selectedGroup) return;
    const dataToExport = groupDetails.transactions.map(t => ({
      "İşlem No": t.transactionNumber, "Tarih": formatDate(t.date), "Müvekkil": t.client || '-', "Personel": t.personnel || '-', "Tür": t.type, "Kategori": t.category, "Açıklama": t.description, "Tutar": t.amount, "Durum": t.status
    }));
    const monthlySummaryExport = groupDetails.monthlyData.map(d => ({ "Dönem": d.month, "Toplam Gider": d.amount }));
    const wb = XLSX.utils.book_new();
    const wsDetail = XLSX.utils.json_to_sheet(dataToExport);
    wsDetail['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Islem_Detayi");
    const wsMonthly = XLSX.utils.json_to_sheet(monthlySummaryExport);
    wsMonthly['!cols'] = [{ wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsMonthly, "Aylik_Ozet");
    XLSX.writeFile(wb, `${selectedGroup}_Masraf_Ekstresi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  // --- DELETE MODAL ---
  const deleteModal = isDeleteModalOpen && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="glass bg-white/90 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-in-up">
        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mx-auto mb-4"><Icon name="delete_forever" className="text-2xl" /></div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Silme Onayı</h3>
        <p className="text-slate-500 text-xs mb-5">Bu işlem geri alınamaz.</p>
        <div className="flex gap-2">
          <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100/80 rounded-xl hover:bg-slate-200/80 transition-all">İptal</button>
          <button disabled={isDeleting} onClick={confirmDelete} className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all">{isDeleting ? 'Siliniyor...' : 'Evet, Sil'}</button>
        </div>
      </div>
    </div>
  );

  // --- DETAIL VIEW ---
  if (selectedGroup) {
    const totalGroupExpense = groupDetails.monthlyData.reduce((acc, curr) => acc + curr.amount, 0);
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    const thisMonthExpense = groupDetails.monthlyData.find(d => d.month === thisMonthKey)?.amount || 0;

    const thClass = "py-2.5 px-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider";

    return (
      <div className="h-full flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="glass-card rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedGroup(null)} className="p-1.5 rounded-lg bg-white/60 border border-slate-200/50 hover:bg-white hover:border-slate-300 transition-all">
                <Icon name="arrow_back" className="text-slate-500 text-sm" />
              </button>
              <div>
                <h2 className="text-base font-bold text-slate-800">{selectedGroup}</h2>
                <p className="text-[10px] text-slate-400">Hesap / Masraf Detayı</p>
              </div>
            </div>
            <button onClick={handleExportExcel} className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-all shadow-sm">
              <Icon name="download" className="text-sm" /> Excel
            </button>
          </div>

          {/* Sub-item filter */}
          {groupDetails.subItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100/60">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Müvekkil/Kişi Filtresi</p>
              <div className="flex flex-wrap gap-1.5">
                {groupDetails.subItems.map(item => {
                  const isExcluded = excludedItems.has(item);
                  return (
                    <button key={item} onClick={() => toggleSubItem(item)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-all flex items-center gap-1 ${isExcluded ? 'bg-slate-50/60 text-slate-300 border-slate-200/40 line-through' : 'bg-white/70 text-slate-600 border-slate-200/60 hover:border-slate-300'}`}>
                      <Icon name={isExcluded ? 'check_box_outline_blank' : 'check_box'} className="text-[11px]" /> {item}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Stats + Monthly */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-card rounded-xl p-4 bg-gradient-to-br from-rose-500/8 to-pink-500/4 relative overflow-hidden">
              <div className="absolute right-2 top-2 opacity-5"><Icon name="trending_down" className="text-5xl text-rose-900" /></div>
              <div className="flex items-center gap-1.5 mb-2"><Icon name="receipt_long" className="text-rose-500 text-sm" /><span className="text-[9px] font-bold text-slate-500 uppercase">Toplam Masraf</span></div>
              <p className="text-lg font-bold text-rose-700">₺{totalGroupExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Seçili kriterlere göre</p>
            </div>
            <div className="glass-card rounded-xl p-4 bg-gradient-to-br from-amber-500/8 to-orange-500/4 relative overflow-hidden">
              <div className="absolute right-2 top-2 opacity-5"><Icon name="calendar_today" className="text-5xl text-amber-900" /></div>
              <div className="flex items-center gap-1.5 mb-2"><Icon name="event" className="text-amber-500 text-sm" /><span className="text-[9px] font-bold text-slate-500 uppercase">Bu Ay</span></div>
              <p className="text-lg font-bold text-amber-700">₺{thisMonthExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-amber-500 mt-0.5">{getMonthName(thisMonthKey)}</p>
            </div>
          </div>

          {/* Monthly bar chart */}
          <div className="glass-card rounded-xl p-4 flex flex-col h-52 lg:h-auto">
            <h4 className="font-bold text-slate-600 mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
              <Icon name="bar_chart" className="text-slate-400 text-sm" /> Aylık Dağılım
            </h4>
            <div className="flex-1 overflow-y-auto pr-1.5 space-y-2.5 custom-scrollbar">
              {groupDetails.monthlyData.map(d => {
                const percent = totalGroupExpense > 0 ? (d.amount / totalGroupExpense) * 100 : 0;
                return (
                  <div key={d.month} className="group">
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="font-semibold text-slate-500">{getMonthName(d.month)}</span>
                      <span className="font-bold text-slate-700">₺{d.amount.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100/60 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full transition-all duration-500 group-hover:from-slate-500 group-hover:to-slate-700" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {groupDetails.monthlyData.length === 0 && <div className="h-full flex items-center justify-center text-slate-300 text-[10px]">Veri yok</div>}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-slate-50/70 backdrop-blur-sm">
                <tr className="border-b border-slate-100/60">
                  <th className={thClass}>İşlem No</th>
                  <th className={thClass}>Tarih</th>
                  <th className={thClass}>Müvekkil</th>
                  <th className={thClass}>Açıklama</th>
                  <th className={thClass}>Kategori</th>
                  <th className={`${thClass} text-right`}>Tutar</th>
                  <th className="py-2.5 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {groupDetails.transactions.map(t => {
                  const isExpense = t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount < 0);
                  return (
                    <tr key={t.id} className="row-glow border-b border-slate-50/60 transition-all group">
                      <td className="py-2 px-3 text-[11px] font-mono text-slate-500">{t.transactionNumber}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-500">{formatDate(t.date)}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-600 font-medium">{t.client || '-'}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400">{t.description}</td>
                      <td className="py-2 px-3"><span className="px-1.5 py-0.5 bg-slate-50/60 rounded text-[9px] text-slate-500 border border-slate-200/40">{t.category}</span></td>
                      <td className={`py-2 px-3 text-right font-semibold text-[11px] ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isExpense ? '-' : '+'} ₺{Math.abs(t.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={(e) => handleDeleteClick(t.id, e)} className="p-1 text-slate-300 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all" title="Sil">
                          <Icon name="delete_outline" className="text-[14px]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {groupDetails.transactions.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-300 text-[10px]">Görüntülenecek işlem yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100/50 bg-slate-50/30">
            <span className="text-[10px] text-slate-400"><span className="font-semibold text-slate-600">{groupDetails.transactions.length}</span> işlem</span>
          </div>
        </div>
        {deleteModal}
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Search */}
      <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
          <input type="text" placeholder="Hesap/Grup ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/60 border border-slate-200/60 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none transition-all focus:bg-white" />
        </div>
        <span className="text-[10px] text-slate-400">Toplam <span className="font-bold text-slate-600">{filteredGroups.length}</span> Grup</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredGroups.map((group, i) => (
          <div key={group.name} onClick={() => setSelectedGroup(group.name)}
            className="glass-card rounded-xl p-4 cursor-pointer group relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${i * 50}ms` }}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-rose-400/60 to-orange-400/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-50 to-orange-50/80 text-rose-500 flex items-center justify-center border border-rose-200/30">
                  <Icon name="folder_open" className="text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">{group.name}</h3>
                  <p className="text-[9px] text-slate-400">{group.clients.length} Müvekkil · {group.transactionCount} İşlem</p>
                </div>
              </div>
              <Icon name="chevron_right" className="text-slate-200 group-hover:text-slate-400 text-sm transition-colors" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] bg-rose-50/50 p-2 rounded-lg border border-rose-100/30">
                <span className="text-rose-700 font-medium">Toplam Gider</span>
                <span className="font-bold text-rose-600">₺{group.totalExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-slate-100/40">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-300 uppercase font-bold">Son İşlem</span>
                  <span className="text-[10px] font-medium text-slate-500">{formatDate(group.lastTransactionDate)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-slate-300 uppercase font-bold">Aylık Ort.</span>
                  <p className="text-[10px] font-bold text-slate-600">₺{(group.totalExpense / (Object.keys(group.monthlyStats).length || 1)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {deleteModal}
    </div>
  );
};