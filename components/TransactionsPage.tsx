
import React, { useState, useEffect, useRef } from 'react';
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

interface ColumnDef {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'transactionNumber', label: 'İşlem No', visible: true },
  { id: 'date', label: 'Tarih', visible: true },
  { id: 'type', label: 'Tür', visible: true },
  { id: 'category', label: 'Kategori', visible: true },
  { id: 'account', label: 'Hesap', visible: true },
  { id: 'client', label: 'Müvekkil', visible: true },
  { id: 'group', label: 'Grup', visible: true },
  { id: 'counterparty', label: 'Muhatap', visible: true },
  { id: 'personnel', label: 'Kimden', visible: true },
  { id: 'description', label: 'Açıklama', visible: true },
  { id: 'amount', label: 'Tutar', visible: true },
  { id: 'status', label: 'Durum', visible: true },
];

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ transactions: initialTransactions, onTransactionsChange }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [searchTerm, setSearchTerm] = useState('');

  // --- UI State ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'SINGLE' | 'BULK', id?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const handleOpenCreateModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (transaction: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'SINGLE', id });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const previousTransactions = [...transactions];
    try {
      let idsToDelete = deleteTarget.type === 'SINGLE' && deleteTarget.id ? [deleteTarget.id] : Array.from(selectedIds);
      if (supabase) {
        const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
        if (error) throw error;
        await onTransactionsChange();
      }
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      setSelectedIds(new Set());
    } catch (error: any) {
      alert("Silme hatası: " + error.message);
      setTransactions(previousTransactions);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id); else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = (filteredData: Transaction[]) => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(t => t.id)));
    }
  };

  const handleSaveTransaction = async (transactionData: any, id?: string) => {
    if (supabase) {
      try {
        const payload = {
          date: transactionData.date,
          description: transactionData.description,
          category: transactionData.category,
          amount: transactionData.amount,
          type: transactionData.type,
          status: transactionData.status,
          method: transactionData.method,
          counterparty: transactionData.counterparty,
          account: transactionData.account,
          client: transactionData.client,
          group: transactionData.group,
          personnel: transactionData.personnel,
          transaction_number: transactionData.transactionNumber
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
      } catch (error: any) {
        alert("Hata: " + error.message);
      }
    }
  };

  const processedTransactions = React.useMemo(() => {
    let filtered = transactions.filter(t => {
      const search = searchTerm.toLowerCase();
      return (
        t.transactionNumber?.toLowerCase().includes(search) ||
        t.client?.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search)
      );
    });

    Object.keys(filters).forEach(key => {
      const val = filters[key].toLowerCase();
      if (val) filtered = filtered.filter(t => String((t as any)[key]).toLowerCase().includes(val));
    });

    filtered.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];
      const res = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === 'asc' ? res : -res;
    });

    return filtered;
  }, [transactions, filters, sortConfig, searchTerm]);

  const renderStatus = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.APPROVED:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium text-[11px]">
            <Icon name="check_circle" className="text-sm" /> Onaylandı
          </div>
        );
      case TransactionStatus.PENDING:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-medium text-[11px]">
            <Icon name="warning" className="text-sm scale-90" /> Beklemede
          </div>
        );
      case TransactionStatus.REJECTED:
        return (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px]">
            <Icon name="cancel" className="text-sm" /> Reddedildi
          </div>
        );
      default:
        return status;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8">
      {/* Container Card */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-8">İşlemler</h1>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
              <input
                type="text"
                placeholder="İşlem No, müvekkil veya açıklama ile ara..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-slate-100 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Icon name="filter_list" className="text-lg" />
                Filtrele
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-2xl text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                <Icon name="add" className="text-lg" />
                Yeni İşlem
              </button>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-y border-slate-100">
                <th className="py-4 pl-8 w-16 text-left">
                  <div
                    onClick={() => toggleSelectAll(processedTransactions)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${selectedIds.size === processedTransactions.length && processedTransactions.length > 0
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-200'
                      }`}
                  >
                    {selectedIds.size === processedTransactions.length && processedTransactions.length > 0 && (
                      <Icon name="check" className="text-white text-[10px] font-bold" />
                    )}
                  </div>
                </th>
                <th className="py-4 px-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">İşlem ID</th>
                <th className="py-4 px-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Müvekkil</th>
                <th className="py-4 px-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                <th className="py-4 px-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kategori</th>
                <th className="py-4 px-4 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tutar</th>
                <th className="py-4 px-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Durum</th>
                <th className="py-4 pr-8 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {processedTransactions.map((t) => (
                <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-5 pl-8">
                    <div
                      onClick={() => toggleSelection(t.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${selectedIds.has(t.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-slate-200'
                        }`}
                    >
                      {selectedIds.has(t.id) && (
                        <Icon name="check" className="text-white text-[10px] font-bold" />
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <span className="font-bold text-[13px] text-slate-900">
                      {t.transactionNumber || `AR-${t.id.substring(0, 8).toUpperCase()}`}
                    </span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-[13px] text-slate-600">{t.client || t.counterparty || '-'}</span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-[13px] text-slate-400">{formatDate(t.date)}</span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-[13px] text-slate-500">{t.category}</span>
                  </td>
                  <td className="py-5 px-4 text-right">
                    <span className="font-bold text-[13px] text-slate-900">
                      ₺{t.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-5 px-4">
                    {renderStatus(t.status)}
                  </td>
                  <td className="py-5 pr-8 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="p-2 hover:bg-white hover:text-slate-900 rounded-lg transition-all"
                        title="Düzenle"
                      >
                        <Icon name="edit" className="text-lg" />
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="p-2 hover:bg-white hover:text-slate-900 rounded-lg transition-all"
                        title="İndir"
                      >
                        <Icon name="file_download" className="text-lg" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(t.id, e)}
                        className="p-2 hover:bg-white hover:text-red-600 rounded-lg transition-all"
                        title="Sil"
                      >
                        <Icon name="delete_outline" className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {processedTransactions.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="search_off" className="text-2xl text-slate-300" />
              </div>
              <h3 className="text-slate-900 font-semibold">İşlem bulunamadı</h3>
              <p className="text-slate-400 text-sm">Farklı bir arama terimi deneyin.</p>
            </div>
          )}
        </div>

        {/* Footer / Pagination Placeholder */}
        <div className="p-8 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <span className="font-medium text-slate-900">{processedTransactions.length}</span> işlem gösteriliyor
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-30">
              <Icon name="chevron_left" className="text-2xl" />
            </button>
            <div className="flex items-center gap-1">
              {[1, 2, '...', 7, 8].map((p, i) => (
                <button
                  key={i}
                  className={`min-w-[40px] h-10 rounded-xl text-sm font-semibold transition-all ${p === 2 ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-50">
              <Icon name="chevron_right" className="text-2xl" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="delete_forever" className="text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Emin misiniz?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {deleteTarget?.type === 'BULK' ? `${selectedIds.size} kaydı kalıcı olarak silmek üzeresiniz.` : 'Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3.5 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all text-sm">İptal</button>
              <button onClick={confirmDelete} className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all text-sm shadow-lg shadow-red-100">
                {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        initialData={editingTransaction}
      />

      <BulkTransactionModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImportComplete={onTransactionsChange}
      />
    </div>
  );
};