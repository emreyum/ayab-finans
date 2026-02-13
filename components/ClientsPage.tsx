
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus, GroupSummary } from '../types';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils';

declare const XLSX: any;

interface ClientsPageProps {
  transactions: Transaction[];
  onDataChange: () => Promise<void>;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ transactions, onDataChange }) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [excludedClients, setExcludedClients] = useState<Set<string>>(new Set());

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { setExcludedClients(new Set()); }, [selectedGroup]);

  const groupSummaries = useMemo(() => {
    const summaryMap: { [key: string]: GroupSummary } = {};
    transactions.forEach(t => {
      if (t.status === TransactionStatus.REJECTED) return;
      const groupName = t.group || 'Genel / Diğer';
      if (!summaryMap[groupName]) {
        summaryMap[groupName] = { name: groupName, totalIncome: 0, totalExpense: 0, balance: 0, clientCount: 0, transactionCount: 0, clients: [], lastTransactionDate: t.date };
      }
      const group = summaryMap[groupName];
      if (t.type === TransactionType.INCOME) group.totalIncome += Number(t.amount);
      else if (t.type === TransactionType.EXPENSE) group.totalExpense += Number(t.amount);
      group.transactionCount += 1;
      if (t.date > group.lastTransactionDate) group.lastTransactionDate = t.date;
      if (t.client && !group.clients.includes(t.client)) group.clients.push(t.client);
    });
    return Object.values(summaryMap).map(g => ({ ...g, balance: g.totalIncome - g.totalExpense, clientCount: g.clients.length })).sort((a, b) => b.lastTransactionDate.localeCompare(a.lastTransactionDate));
  }, [transactions]);

  const filteredGroups = groupSummaries.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const groupDetails = useMemo(() => {
    if (!selectedGroup) return { transactions: [], clients: [] };
    const rawGroupTx = transactions.filter(t => (t.group || 'Genel / Diğer') === selectedGroup && t.status !== TransactionStatus.REJECTED).sort((a, b) => b.date.localeCompare(a.date));
    const clientsInGroup = Array.from(new Set(rawGroupTx.map(t => t.client || 'Müvekkilsiz').filter(Boolean)));
    const filteredTx = rawGroupTx.filter(t => !excludedClients.has(t.client || 'Müvekkilsiz'));
    return { transactions: filteredTx, clients: clientsInGroup };
  }, [selectedGroup, transactions, excludedClients]);

  const toggleClient = (clientName: string) => {
    const s = new Set(excludedClients);
    s.has(clientName) ? s.delete(clientName) : s.add(clientName);
    setExcludedClients(s);
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
      "İşlem No": t.transactionNumber, Tarih: formatDate(t.date), Müvekkil: t.client || '-', Tür: t.type, Kategori: t.category, Açıklama: t.description, Muhatap: t.counterparty || '-', Tutar: t.amount, Durum: t.status
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proje Ekstresi");
    ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 12 }, { wch: 10 }];
    XLSX.writeFile(wb, `${selectedGroup}_Proje_Ekstresi_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    const filteredIncome = groupDetails.transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + Number(t.amount), 0);
    const filteredExpense = groupDetails.transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + Number(t.amount), 0);
    const filteredBalance = filteredIncome - filteredExpense;

    const cariTransactions = groupDetails.transactions.filter(t => t.type === TransactionType.CURRENT);
    const filteredCariAccrual = cariTransactions.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
    const filteredCariPayment = cariTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const filteredCariNet = filteredCariAccrual - filteredCariPayment;

    const thClass = "py-2.5 px-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider";

    return (
      <div className="h-full flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="glass-card rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedGroup(null)} className="p-1.5 rounded-lg bg-white/60 border border-slate-200/50 hover:bg-white hover:border-slate-300 transition-all">
                <Icon name="arrow_back" className="text-slate-500 text-sm" />
              </button>
              <div>
                <h2 className="text-base font-bold text-slate-800">{selectedGroup}</h2>
                <p className="text-[10px] text-slate-400">Proje / Grup Cari Ekstresi</p>
              </div>
            </div>
            <button onClick={handleExportExcel} className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-all shadow-sm">
              <Icon name="download" className="text-sm" /> Excel
            </button>
          </div>

          {/* Client filter chips */}
          {groupDetails.clients.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100/60">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Müvekkil Filtresi</p>
              <div className="flex flex-wrap gap-1.5">
                {groupDetails.clients.map(clientName => {
                  const isExcluded = excludedClients.has(clientName);
                  return (
                    <button key={clientName} onClick={() => toggleClient(clientName)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-all flex items-center gap-1 ${isExcluded ? 'bg-slate-50/60 text-slate-300 border-slate-200/40 line-through' : 'bg-white/70 text-slate-600 border-slate-200/60 hover:border-slate-300'}`}>
                      <Icon name={isExcluded ? 'check_box_outline_blank' : 'check_box'} className="text-[11px]" /> {clientName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="glass-card rounded-xl p-3.5 bg-gradient-to-br from-emerald-500/8 to-teal-500/4">
            <div className="flex items-center gap-1.5 mb-1.5"><Icon name="arrow_downward" className="text-emerald-500 text-xs" /><span className="text-[9px] font-bold text-slate-400 uppercase">Nakit Tahsilat</span></div>
            <p className="text-base font-bold text-slate-800">₺{filteredIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass-card rounded-xl p-3.5 bg-gradient-to-br from-rose-500/8 to-pink-500/4">
            <div className="flex items-center gap-1.5 mb-1.5"><Icon name="arrow_upward" className="text-rose-500 text-xs" /><span className="text-[9px] font-bold text-slate-400 uppercase">Yapılan Gider</span></div>
            <p className="text-base font-bold text-slate-800">₺{filteredExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="glass-card rounded-xl p-3.5 bg-gradient-to-br from-violet-500/8 to-purple-500/4">
            <div className="flex items-center gap-1.5 mb-1.5"><Icon name="post_add" className="text-violet-500 text-xs" /><span className="text-[9px] font-bold text-slate-400 uppercase">Cari (Net)</span></div>
            <p className="text-base font-bold text-slate-800">₺{filteredCariNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <div className="mt-2 pt-1.5 border-t border-slate-100/50 text-[9px] space-y-0.5">
              <div className="flex justify-between"><span className="text-violet-400">Tahakkuk</span><span className="font-bold text-slate-600">₺{filteredCariAccrual.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-orange-400">Düşülen</span><span className="font-bold text-slate-600">₺{filteredCariPayment.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-3.5 bg-gradient-to-br from-sky-500/8 to-blue-500/4">
            <div className="flex items-center gap-1.5 mb-1.5"><Icon name="account_balance_wallet" className="text-sky-500 text-xs" /><span className="text-[9px] font-bold text-slate-400 uppercase">Kasa Bakiyesi</span></div>
            <p className={`text-base font-bold ${filteredBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>₺{filteredBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
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
                  const isCariNegative = t.type === TransactionType.CURRENT && t.amount < 0;
                  const isNeg = t.type === TransactionType.EXPENSE || isCariNegative;
                  return (
                    <tr key={t.id} className="row-glow border-b border-slate-50/60 transition-all group">
                      <td className="py-2 px-3 text-[11px] font-mono text-slate-500">{t.transactionNumber}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-500">{formatDate(t.date)}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-600 font-medium">{t.client || '-'}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400">{t.description}</td>
                      <td className="py-2 px-3">
                        {t.type === TransactionType.CURRENT
                          ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isCariNegative ? 'bg-orange-50/80 text-orange-600' : 'bg-violet-50/80 text-violet-600'}`}>{t.category}</span>
                          : <span className="text-[11px] text-slate-500">{t.category}</span>}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold text-[11px] ${isNeg ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {t.type === TransactionType.INCOME ? '+' : t.type === TransactionType.EXPENSE ? '-' : isCariNegative ? '(-)' : '(+)'} ₺{Math.abs(t.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={(e) => handleDeleteClick(t.id, e)} className="p-1 text-slate-300 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all" title="Sil">
                          <Icon name="delete_outline" className="text-[14px]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
          <input type="text" placeholder="Proje veya Grup ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/60 border border-slate-200/60 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none transition-all focus:bg-white" />
        </div>
        <span className="text-[10px] text-slate-400">Toplam <span className="font-bold text-slate-600">{filteredGroups.length}</span> Proje/Grup</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredGroups.map((group, i) => (
          <div key={group.name} onClick={() => setSelectedGroup(group.name)}
            className="glass-card rounded-xl p-4 cursor-pointer group relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${i * 50}ms` }}>
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-400/60 to-violet-400/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100/80 text-slate-500 flex items-center justify-center border border-slate-200/40">
                  <Icon name="folder" className="text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">{group.name}</h3>
                  <p className="text-[9px] text-slate-400">{group.clientCount} Müvekkil · {group.transactionCount} İşlem</p>
                </div>
              </div>
              <Icon name="chevron_right" className="text-slate-200 group-hover:text-slate-400 text-sm transition-colors" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] bg-slate-50/60 p-2 rounded-lg">
                <span className="text-slate-400">Tahsilat</span>
                <span className="font-semibold text-emerald-600">₺{group.totalIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] px-2">
                <span className="text-slate-400">Gider</span>
                <span className="font-medium text-rose-500">₺{group.totalExpense.toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-100/50 pt-2 flex justify-between text-[11px] px-2">
                <span className="font-bold text-slate-600">Net Bakiye</span>
                <span className={`font-bold ${group.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{group.balance >= 0 ? '+' : ''}₺{group.balance.toLocaleString()}</span>
              </div>
            </div>

            {group.clients.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-50/60 flex items-center gap-1.5">
                <Icon name="group" className="text-slate-200 text-xs" />
                <div className="flex gap-1">
                  {group.clients.slice(0, 2).map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 bg-white/60 border border-slate-200/40 text-slate-500 rounded-full whitespace-nowrap">{c}</span>)}
                  {group.clients.length > 2 && <span className="text-[9px] px-1.5 py-0.5 bg-slate-100/50 text-slate-400 rounded-full">+{group.clients.length - 2}</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {deleteModal}
    </div>
  );
};