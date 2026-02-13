
import React, { useState, useEffect } from 'react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { Icon } from './Icons';
import { TransactionModal } from './TransactionModal';
import { BulkTransactionModal } from './BulkTransactionModal';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils';

interface TransactionsPageProps {
  transactions: Transaction[];
  onTransactionsChange: () => Promise<void>;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ transactions: initialTransactions, onTransactionsChange }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'SINGLE' | 'BULK', id?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { setTransactions(initialTransactions); }, [initialTransactions]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelection = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processed.length && processed.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processed.map(t => t.id)));
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'SINGLE', id });
    setIsDeleteModalOpen(true);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: 'BULK' });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const ids = deleteTarget.type === 'SINGLE' && deleteTarget.id ? [deleteTarget.id] : Array.from(selectedIds);
      if (supabase) {
        const { error } = await supabase.from('transactions').delete().in('id', ids);
        if (error) throw error;
        await onTransactionsChange();
      }
      setSelectedIds(new Set());
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      alert("Silme hatası: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTransaction = async (data: any, id?: string) => {
    if (!supabase) return;
    try {
      const payload = {
        date: data.date, description: data.description, category: data.category,
        amount: data.amount, type: data.type, status: data.status, method: data.method,
        counterparty: data.counterparty, account: data.account, client: data.client,
        group: data.group, personnel: data.personnel, transaction_number: data.transactionNumber,
      };
      if (id) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert([payload]);
        if (error) throw error;
      }
      await onTransactionsChange();
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Hata: " + err.message);
    }
  };

  const processed = React.useMemo(() => {
    let filtered = transactions.filter(t => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s || (
        t.transactionNumber?.toLowerCase().includes(s) ||
        t.client?.toLowerCase().includes(s) ||
        t.counterparty?.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s) ||
        t.category?.toLowerCase().includes(s) ||
        t.account?.toLowerCase().includes(s)
      );
      const matchType = filterType === 'all' || t.type === filterType;
      const matchStatus = filterStatus === 'all' || t.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });

    filtered.sort((a, b) => {
      const aV = (a as any)[sortConfig.key];
      const bV = (b as any)[sortConfig.key];
      const r = aV < bV ? -1 : aV > bV ? 1 : 0;
      return sortConfig.direction === 'asc' ? r : -r;
    });

    return filtered;
  }, [transactions, searchTerm, filterType, filterStatus, sortConfig]);

  const totals = React.useMemo(() => {
    const calc = (type: TransactionType) =>
      transactions.filter(t => t.type === type && t.status !== TransactionStatus.REJECTED)
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    return {
      income: calc(TransactionType.INCOME),
      expense: calc(TransactionType.EXPENSE),
      receivable: calc(TransactionType.RECEIVABLE),
      debt: calc(TransactionType.DEBT),
    };
  }, [transactions]);

  const getStatusBadge = (status: TransactionStatus) => {
    const map: Record<string, { icon: string; cls: string }> = {
      [TransactionStatus.APPROVED]: { icon: 'check_circle', cls: 'text-emerald-600 bg-emerald-50/80' },
      [TransactionStatus.PENDING]: { icon: 'schedule', cls: 'text-amber-600 bg-amber-50/80' },
      [TransactionStatus.REJECTED]: { icon: 'cancel', cls: 'text-slate-400 bg-slate-50/80' },
    };
    const s = map[status] || map[TransactionStatus.PENDING];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>
        <Icon name={s.icon} className="text-[12px]" /> {status}
      </span>
    );
  };

  const getTypeBadge = (type: TransactionType) => {
    const map: Record<string, string> = {
      [TransactionType.INCOME]: 'text-emerald-700 bg-emerald-50/70 border-emerald-200/50',
      [TransactionType.EXPENSE]: 'text-rose-700 bg-rose-50/70 border-rose-200/50',
      [TransactionType.RECEIVABLE]: 'text-sky-700 bg-sky-50/70 border-sky-200/50',
      [TransactionType.DEBT]: 'text-orange-700 bg-orange-50/70 border-orange-200/50',
      [TransactionType.CURRENT]: 'text-violet-700 bg-violet-50/70 border-violet-200/50',
    };
    return (
      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${map[type] || ''}`}>
        {type}
      </span>
    );
  };

  const getAmountDisplay = (t: Transaction) => {
    const isNeg = t.type === TransactionType.EXPENSE || t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount < 0);
    const color = isNeg ? 'text-rose-600' : 'text-emerald-600';
    const sign = isNeg ? '-' : '+';
    return <span className={`font-semibold text-xs ${color}`}>{sign} ₺{Math.abs(t.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>;
  };

  const SortIcon = ({ col }: { col: string }) => (
    <Icon
      name={sortConfig.key === col ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
      className={`text-[11px] ${sortConfig.key === col ? 'text-slate-700' : 'text-slate-300'}`}
    />
  );

  const statCards = [
    { label: 'Gelirler', value: totals.income, icon: 'trending_up', accent: 'from-emerald-500/10 to-teal-500/5', iconColor: 'text-emerald-500' },
    { label: 'Giderler', value: totals.expense, icon: 'trending_down', accent: 'from-rose-500/10 to-pink-500/5', iconColor: 'text-rose-500' },
    { label: 'Alacaklar', value: totals.receivable, icon: 'call_received', accent: 'from-sky-500/10 to-blue-500/5', iconColor: 'text-sky-500' },
    { label: 'Borçlar', value: totals.debt, icon: 'call_made', accent: 'from-orange-500/10 to-amber-500/5', iconColor: 'text-orange-500' },
  ];

  const thClass = "py-2.5 px-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-600 transition-colors";

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c, i) => (
          <div key={i} className={`glass-card rounded-xl p-4 bg-gradient-to-br ${c.accent} relative overflow-hidden`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</span>
              <Icon name={c.icon} className={`text-lg ${c.iconColor} opacity-60`} />
            </div>
            <p className="text-lg font-bold text-slate-800">₺{c.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white/60 border border-slate-200/60 rounded-lg focus:ring-1 focus:ring-slate-300 outline-none w-48 transition-all focus:w-64 focus:bg-white"
              />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-[11px] py-1.5 px-2.5 bg-white/60 border border-slate-200/60 rounded-lg outline-none text-slate-600 font-medium">
              <option value="all">Tüm Türler</option>
              {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-[11px] py-1.5 px-2.5 bg-white/60 border border-slate-200/60 rounded-lg outline-none text-slate-600 font-medium">
              <option value="all">Tüm Durumlar</option>
              {Object.values(TransactionStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-[10px] text-slate-400 font-medium ml-1">{processed.length} sonuç</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button onClick={handleBulkDelete} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50/80 border border-rose-200/50 rounded-lg hover:bg-rose-100/80 transition-all">
                <Icon name="delete_sweep" className="text-sm" /> Sil ({selectedIds.size})
              </button>
            )}
            <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white/60 border border-slate-200/60 rounded-lg hover:bg-white transition-all">
              <Icon name="upload_file" className="text-sm" /> Excel
            </button>
            <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-all shadow-sm">
              <Icon name="add" className="text-sm" /> Yeni İşlem
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-100/80 bg-slate-50/40">
                <th className="py-2.5 pl-3 w-8">
                  <div onClick={toggleSelectAll} className={`w-3.5 h-3.5 rounded border cursor-pointer flex items-center justify-center transition-all ${selectedIds.size === processed.length && processed.length > 0 ? 'bg-slate-800 border-slate-800' : 'border-slate-300 hover:border-slate-400'}`}>
                    {selectedIds.size === processed.length && processed.length > 0 && <Icon name="check" className="text-white text-[8px]" />}
                  </div>
                </th>
                <th className={thClass} onClick={() => handleSort('transactionNumber')}>İşlem No <SortIcon col="transactionNumber" /></th>
                <th className={thClass} onClick={() => handleSort('date')}>Tarih <SortIcon col="date" /></th>
                <th className={thClass} onClick={() => handleSort('type')}>Tür <SortIcon col="type" /></th>
                <th className={thClass} onClick={() => handleSort('category')}>Kategori <SortIcon col="category" /></th>
                <th className={thClass} onClick={() => handleSort('account')}>Hesap <SortIcon col="account" /></th>
                <th className={thClass} onClick={() => handleSort('client')}>Müvekkil <SortIcon col="client" /></th>
                <th className={thClass} onClick={() => handleSort('group')}>Grup <SortIcon col="group" /></th>
                <th className={thClass} onClick={() => handleSort('counterparty')}>Muhatap <SortIcon col="counterparty" /></th>
                <th className={thClass} onClick={() => handleSort('personnel')}>Kimden <SortIcon col="personnel" /></th>
                <th className={thClass}>Açıklama</th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('amount')}>Tutar <SortIcon col="amount" /></th>
                <th className={thClass} onClick={() => handleSort('status')}>Durum <SortIcon col="status" /></th>
                <th className="py-2.5 pr-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {processed.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`row-glow border-b border-slate-50/80 transition-all group ${selectedIds.has(t.id) ? 'bg-slate-50/60' : ''}`}
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  <td className="py-2 pl-3">
                    <div onClick={() => toggleSelection(t.id)} className={`w-3.5 h-3.5 rounded border cursor-pointer flex items-center justify-center transition-all ${selectedIds.has(t.id) ? 'bg-slate-800 border-slate-800' : 'border-slate-300 hover:border-slate-400'}`}>
                      {selectedIds.has(t.id) && <Icon name="check" className="text-white text-[8px]" />}
                    </div>
                  </td>
                  <td className="py-2 px-3"><span className="font-mono text-[11px] font-semibold text-slate-700">{t.transactionNumber || t.id.substring(0, 8).toUpperCase()}</span></td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-500">{formatDate(t.date)}</span></td>
                  <td className="py-2 px-3">{getTypeBadge(t.type)}</td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-600">{t.category}</span></td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-500">{t.account || '-'}</span></td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-600 font-medium">{t.client || '-'}</span></td>
                  <td className="py-2 px-3">{t.group ? <span className="text-[10px] px-1.5 py-0.5 bg-slate-100/60 text-slate-500 rounded font-medium">{t.group}</span> : <span className="text-slate-300 text-[11px]">-</span>}</td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-500">{t.counterparty || '-'}</span></td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-500">{t.personnel || '-'}</span></td>
                  <td className="py-2 px-3"><span className="text-[11px] text-slate-400 truncate block max-w-[180px]" title={t.description}>{t.description || '-'}</span></td>
                  <td className="py-2 px-3 text-right">{getAmountDisplay(t)}</td>
                  <td className="py-2 px-3">{getStatusBadge(t.status)}</td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors" title="Düzenle"><Icon name="edit" className="text-[14px]" /></button>
                      <button onClick={(e) => handleDeleteClick(t.id, e)} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Sil"><Icon name="delete_outline" className="text-[14px]" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {processed.length === 0 && (
            <div className="py-16 text-center">
              <Icon name="search_off" className="text-3xl text-slate-200 mb-2" />
              <p className="text-xs text-slate-400">Sonuç bulunamadı</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100/60 flex items-center justify-between bg-slate-50/30">
          <span className="text-[11px] text-slate-400"><span className="font-semibold text-slate-600">{processed.length}</span> / {transactions.length} işlem</span>
          <span className="text-[10px] text-slate-300">Sütun başlığına tıklayarak sıralayabilirsiniz</span>
        </div>
      </div>

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="glass bg-white/90 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-in-up">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Icon name="delete_forever" className="text-2xl" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Silme Onayı</h3>
            <p className="text-slate-500 text-xs mb-5 leading-relaxed">
              {deleteTarget?.type === 'BULK' ? `${selectedIds.size} kaydı silmek üzeresiniz.` : 'Bu işlem geri alınamaz.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100/80 rounded-xl hover:bg-slate-200/80 transition-all">İptal</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all shadow-sm">
                {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTransaction} initialData={editingTransaction} />
      <BulkTransactionModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onImportComplete={onTransactionsChange} />
    </div>
  );
};