
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

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setExcludedClients(new Set());
  }, [selectedGroup]);

  const groupSummaries = useMemo(() => {
    const summaryMap: { [key: string]: GroupSummary } = {};

    transactions.forEach(t => {
      if (t.status === TransactionStatus.REJECTED) return;
      
      const groupName = t.group || 'Genel / Diğer';

      if (!summaryMap[groupName]) {
        summaryMap[groupName] = {
          name: groupName,
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          clientCount: 0,
          transactionCount: 0,
          clients: [],
          lastTransactionDate: t.date,
        };
      }

      const group = summaryMap[groupName];
      
      if (t.type === TransactionType.INCOME) {
        group.totalIncome += Number(t.amount);
      } else if (t.type === TransactionType.EXPENSE) {
        group.totalExpense += Number(t.amount);
      }

      group.transactionCount += 1;
      if (t.date > group.lastTransactionDate) {
        group.lastTransactionDate = t.date;
      }
      
      if (t.client && !group.clients.includes(t.client)) {
          group.clients.push(t.client);
      }
    });

    return Object.values(summaryMap).map(g => ({
      ...g,
      balance: g.totalIncome - g.totalExpense,
      clientCount: g.clients.length
    })).sort((a, b) => b.lastTransactionDate.localeCompare(a.lastTransactionDate));
  }, [transactions]);

  const filteredGroups = groupSummaries.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupDetails = useMemo(() => {
    if (!selectedGroup) return { transactions: [], clients: [] };

    const rawGroupTx = transactions.filter(t => 
        (t.group || 'Genel / Diğer') === selectedGroup && t.status !== TransactionStatus.REJECTED
    ).sort((a, b) => b.date.localeCompare(a.date));

    const clientsInGroup = Array.from(new Set(rawGroupTx.map(t => t.client || 'Müvekkilsiz').filter(Boolean)));

    const filteredTx = rawGroupTx.filter(t => {
        const clientName = t.client || 'Müvekkilsiz';
        return !excludedClients.has(clientName);
    });

    return { transactions: filteredTx, clients: clientsInGroup };
  }, [selectedGroup, transactions, excludedClients]);

  const toggleClient = (clientName: string) => {
      const newExcluded = new Set(excludedClients);
      if (newExcluded.has(clientName)) {
          newExcluded.delete(clientName);
      } else {
          newExcluded.add(clientName);
      }
      setExcludedClients(newExcluded);
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
        await onDataChange(); // Refresh data
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
      Tarih: formatDate(t.date),
      Müvekkil: t.client || '-',
      Tür: t.type,
      Kategori: t.category,
      Açıklama: t.description,
      Muhatap: t.counterparty || '-',
      Tutar: t.amount,
      Durum: t.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proje Ekstresi");

    const wscols = [
      {wch: 15}, {wch: 12}, {wch: 20}, {wch: 10}, {wch: 15}, {wch: 40}, {wch: 20}, {wch: 12}, {wch: 10}
    ];
    ws['!cols'] = wscols;

    const fileName = `${selectedGroup}_Proje_Ekstresi_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (selectedGroup) {
    const filteredIncome = groupDetails.transactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + Number(t.amount), 0);
        
    const filteredExpense = groupDetails.transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);
        
    const filteredBalance = filteredIncome - filteredExpense;

    const cariTransactions = groupDetails.transactions.filter(t => t.type === TransactionType.CURRENT);
    const filteredCariAccrual = cariTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
    const filteredCariPayment = cariTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const filteredCariNet = filteredCariAccrual - filteredCariPayment;

    return (
      <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="p-6 border-b border-gray-100 bg-gray-50 space-y-4">
          <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedGroup(null)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200">
                  <Icon name="arrow_back" className="text-gray-600" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedGroup}</h2>
                  <p className="text-sm text-gray-500">Proje / Grup Cari Ekstresi</p>
                </div>
              </div>
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm">
                  <Icon name="download" /> <span className="hidden sm:inline">Excel İndir</span>
              </button>
          </div>
          <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Müvekkil Filtresi</p>
              <div className="flex flex-wrap gap-2">
                  {groupDetails.clients.map(clientName => {
                      const isExcluded = excludedClients.has(clientName);
                      return (
                          <button key={clientName} onClick={() => toggleClient(clientName)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${isExcluded ? 'bg-gray-100 text-gray-400 border-gray-200 line-through' : 'bg-white text-primary-700 border-primary-200'}`}>
                              {isExcluded ? <Icon name="check_box_outline_blank" className="text-[14px]" /> : <Icon name="check_box" className="text-[14px]" />} {clientName}
                          </button>
                      );
                  })}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white">
           <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
             <div className="flex items-center gap-2 mb-1"><Icon name="arrow_downward" className="text-emerald-600 text-xs" /><p className="text-xs text-emerald-600 font-bold uppercase">Nakit Tahsilat</p></div>
             <p className="text-2xl font-bold text-emerald-700">₺{filteredIncome.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
           </div>
           <div className="p-4 rounded-xl bg-red-50 border border-red-100">
             <div className="flex items-center gap-2 mb-1"><Icon name="arrow_upward" className="text-red-600 text-xs" /><p className="text-xs text-red-600 font-bold uppercase">Yapılan Gider</p></div>
             <p className="text-2xl font-bold text-red-700">₺{filteredExpense.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
           </div>
           <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 flex flex-col justify-between">
             <div><div className="flex items-center gap-2 mb-1"><Icon name="post_add" className="text-purple-600 text-xs" /><p className="text-xs text-purple-600 font-bold uppercase">Yansıtılan Cari (Net)</p></div><p className="text-2xl font-bold text-purple-700">₺{filteredCariNet.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p></div>
             <div className="mt-2 pt-2 border-t border-purple-100 text-[10px] space-y-1"><div className="flex justify-between"><span className="text-purple-500">Toplam Tahakkuk (+):</span><span className="font-bold text-purple-700">₺{filteredCariAccrual.toLocaleString()}</span></div><div className="flex justify-between"><span className="text-orange-500">Toplam Düşülen (-):</span><span className="font-bold text-orange-600">₺{filteredCariPayment.toLocaleString()}</span></div></div>
           </div>
           <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
             <div className="flex items-center gap-2 mb-1"><Icon name="account_balance_wallet" className="text-blue-600 text-xs" /><p className="text-xs text-blue-600 font-bold uppercase">Kasa Bakiyesi (Nakit)</p></div>
             <p className="text-2xl font-bold text-blue-700">₺{filteredBalance.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
           </div>
        </div>

        <div className="flex-1 overflow-auto p-6 pt-0">
           <table className="w-full">
             <thead className="bg-gray-50 sticky top-0 z-10">
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
             <tbody className="divide-y divide-gray-100">
               {groupDetails.transactions.map(t => {
                 const isCariNegative = t.type === TransactionType.CURRENT && t.amount < 0;
                 const displayAmount = Math.abs(t.amount);
                 return (
                 <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-3 px-4 text-xs font-mono text-gray-500">{t.transactionNumber}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{formatDate(t.date)}</td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-medium">{t.client || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{t.description}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {t.type === TransactionType.CURRENT ? <span className={`px-2 py-0.5 rounded text-xs font-bold ${isCariNegative ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{t.category}</span> : t.category}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold text-sm ${t.type === TransactionType.INCOME ? 'text-emerald-600' : t.type === TransactionType.EXPENSE ? 'text-red-600' : isCariNegative ? 'text-orange-600' : 'text-purple-600'}`}>
                       {t.type === TransactionType.INCOME ? '+' : t.type === TransactionType.EXPENSE ? '-' : isCariNegative ? '(-)' : '(+)'} ₺{displayAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}
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
             </tbody>
           </table>
        </div>

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-gray-100 transform transition-all scale-100">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="delete_forever" className="text-3xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Emin misiniz?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Bu işlemi silmek üzeresiniz. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3">
                <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">İptal</button>
                <button disabled={isDeleting} onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isDeleting ? 'Siliniyor...' : 'Evet, Sil'}</button>
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
           <input type="text" placeholder="Proje veya Grup ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div className="text-sm text-gray-500">Toplam <span className="font-bold text-gray-800">{filteredGroups.length}</span> Proje/Grup</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
         {filteredGroups.map(group => (
            <div key={group.name} onClick={() => setSelectedGroup(group.name)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600"></div>
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center"><Icon name="folder" className="text-2xl" /></div>
                     <div><h3 className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors text-lg">{group.name}</h3><p className="text-xs text-gray-500">{group.clientCount} Müvekkil • {group.transactionCount} İşlem</p></div>
                  </div>
                  <Icon name="chevron_right" className="text-gray-300 group-hover:text-primary-500" />
               </div>
               <div className="space-y-3">
                  <div className="flex justify-between text-sm bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Toplam Tahsilat</span><span className="font-bold text-emerald-600">₺{group.totalIncome.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm px-2"><span className="text-gray-500">Toplam Gider</span><span className="font-medium text-red-600">₺{group.totalExpense.toLocaleString()}</span></div>
                  <div className="border-t border-gray-100 pt-2 mt-1 flex justify-between text-sm px-2"><span className="font-bold text-gray-700">Nakit Dengesi</span><span className={`font-bold ${group.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{group.balance >= 0 ? '+' : ''} ₺{group.balance.toLocaleString()}</span></div>
               </div>
               <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2 overflow-hidden">
                   <Icon name="group" className="text-gray-300 text-sm" />
                   <div className="flex gap-1">
                        {group.clients.slice(0, 2).map(c => <span key={c} className="text-[10px] px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-full whitespace-nowrap">{c}</span>)}
                        {group.clients.length > 2 && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">+{group.clients.length - 2}</span>}
                   </div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};