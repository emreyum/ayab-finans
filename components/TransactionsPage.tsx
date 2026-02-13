
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

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);

  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState<{ [key: string]: string }>({});

  // --- UI/layout State ---
  const [isCompact, setIsCompact] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'SINGLE' | 'BULK', id?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- DATA SYNC ---
  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const handleOpenCreateModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleOpenBulkModal = () => {
    setIsBulkModalOpen(true);
  }

  const handleOpenEditModal = (transaction: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  // --- INLINE EDITING HANDLER ---
  const handleCellSave = async (id: string, field: string, value: any) => {
    // Optimistic Update
    const originalTransactions = [...transactions];
    const updatedTransactions = transactions.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    );
    setTransactions(updatedTransactions);
    setEditingCell(null);

    try {
      let payload: any = {};

      // Field mapping logic
      if (field === 'transactionNumber') {
        payload.transaction_number = value;
      } else {
        // Most fields map directly, but amount needs number conversion
        if (field === 'amount') {
          payload[field] = parseFloat(value);
        } else {
          payload[field] = value;
        }
      }

      if (supabase) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', id);
        if (error) throw error;
        // Background sync to ensure data consistency
        onTransactionsChange();
      }
    } catch (error: any) {
      console.error("Hücre güncelleme hatası:", error);
      alert("Güncelleme hatası: " + error.message);
      setTransactions(originalTransactions); // Revert on error
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
          "group": transactionData.group,
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
      } catch (error: any) {
        alert("Kaydetme hatası: " + error.message);
      }
    } else {
      // Mock Update
      if (id) {
        setTransactions(transactions.map(t => t.id === id ? { ...t, ...transactionData } : t));
      } else {
        const newTx: Transaction = { id: Math.random().toString(36).substr(2, 9), ...transactionData };
        setTransactions([newTx, ...transactions]);
      }
    }
  };

  // --- DELETE TRIGGER HANDLERS ---
  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'SINGLE', id });
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: 'BULK' });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    const previousTransactions = [...transactions];

    try {
      let idsToDelete: string[] = [];

      if (deleteTarget.type === 'SINGLE' && deleteTarget.id) {
        idsToDelete = [deleteTarget.id];
      } else if (deleteTarget.type === 'BULK') {
        idsToDelete = Array.from(selectedIds);
      }

      setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
      if (deleteTarget.type === 'BULK') {
        setSelectedIds(new Set());
      }

      if (supabase) {
        const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
        if (error) throw error;
        await onTransactionsChange();
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);

    } catch (error: any) {
      console.error("Silme hatası:", error);
      alert("Silme işlemi başarısız oldu: " + error.message);
      setTransactions(previousTransactions);
      setIsDeleteModalOpen(false);
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
      const newSelection = new Set(filteredData.map(t => t.id));
      setSelectedIds(newSelection);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleColumnVisibility = (id: string) => {
    setColumns(columns.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
  };

  const toggleRowExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const processedTransactions = React.useMemo(() => {
    let filtered = [...transactions];
    Object.keys(filters).forEach(key => {
      const filterVal = filters[key].toLowerCase();
      if (filterVal) {
        filtered = filtered.filter(item => {
          const itemVal = (item as any)[key];
          if (itemVal === null || itemVal === undefined) return false;
          if (key === 'date') {
            const formatted = formatDate(String(itemVal));
            return formatted.toLowerCase().includes(filterVal);
          }
          return String(itemVal).toLowerCase().includes(filterVal);
        });
      }
    });
    filtered.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [transactions, filters, sortConfig]);

  const calculateTotal = (type: TransactionType) => {
    if (type === TransactionType.CURRENT) return 0;
    return transactions
      .filter(t => t.type === type && t.status !== TransactionStatus.REJECTED)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  const totalIncome = calculateTotal(TransactionType.INCOME);
  const totalExpense = calculateTotal(TransactionType.EXPENSE);
  const totalReceivable = calculateTotal(TransactionType.RECEIVABLE);
  const totalDebt = calculateTotal(TransactionType.DEBT);

  const getTypeStyles = (type: TransactionType) => {
    switch (type) {
      case TransactionType.INCOME: return { color: 'text-slate-700', bg: 'bg-slate-100' };
      case TransactionType.EXPENSE: return { color: 'text-slate-500', bg: 'bg-slate-50' };
      case TransactionType.RECEIVABLE: return { color: 'text-slate-600', bg: 'bg-slate-100' };
      case TransactionType.DEBT: return { color: 'text-slate-500', bg: 'bg-slate-50' };
      case TransactionType.CURRENT: return { color: 'text-slate-600', bg: 'bg-slate-100' };
      default: return { color: 'text-slate-500', bg: 'bg-slate-50' };
    }
  };

  const renderCell = (t: Transaction, colId: string) => {
    const isEditing = editingCell?.id === t.id && editingCell?.field === colId;
    const style = getTypeStyles(t.type);
    const displayTxNumber = t.transactionNumber
      ? t.transactionNumber
      : (t.id.length > 8 ? `ESKİ-${t.id.substring(0, 6).toUpperCase()}` : t.id);

    // EDIT MODE RENDER
    if (isEditing) {
      const commonInputClass = "w-full h-full p-2 border border-slate-300 rounded-md outline-none text-sm font-medium z-50 relative focus:ring-1 focus:ring-slate-400";

      switch (colId) {
        case 'date':
          return (
            <input
              type="date"
              defaultValue={t.date}
              autoFocus
              className={commonInputClass}
              onBlur={(e) => handleCellSave(t.id, colId, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          );
        case 'amount':
          return (
            <input
              type="number"
              defaultValue={t.amount}
              step="0.01"
              autoFocus
              className={commonInputClass}
              onBlur={(e) => handleCellSave(t.id, colId, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          );
        case 'type':
          return (
            <select
              defaultValue={t.type}
              autoFocus
              className={commonInputClass}
              onBlur={(e) => handleCellSave(t.id, colId, e.target.value)}
              onChange={(e) => {
                handleCellSave(t.id, colId, e.target.value);
                e.target.blur();
              }}
            >
              {Object.values(TransactionType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          );
        case 'status':
          return (
            <select
              defaultValue={t.status}
              autoFocus
              className={commonInputClass}
              onBlur={(e) => handleCellSave(t.id, colId, e.target.value)}
              onChange={(e) => {
                handleCellSave(t.id, colId, e.target.value);
                e.target.blur();
              }}
            >
              {Object.values(TransactionStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          );
        case 'transactionNumber':
          return <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded cursor-not-allowed">{displayTxNumber}</span>;
        default:
          return (
            <input
              type="text"
              defaultValue={(t as any)[colId]}
              autoFocus
              className={commonInputClass}
              onBlur={(e) => handleCellSave(t.id, colId, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              onClick={(e) => e.stopPropagation()}
            />
          );
      }
    }

    // DISPLAY MODE RENDER
    const wrap = (content: React.ReactNode) => (
      <div
        onDoubleClick={(e) => { e.stopPropagation(); colId !== 'transactionNumber' && setEditingCell({ id: t.id, field: colId }); }}
        className={`w-full h-full cursor-text flex items-center ${colId === 'amount' ? 'justify-end' : ''}`}
        title="Düzenlemek için çift tıklayın"
      >
        {content}
      </div>
    );

    switch (colId) {
      case 'transactionNumber':
        return <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{displayTxNumber}</span>;
      case 'date': return wrap(<span className="text-sm text-slate-700">{formatDate(t.date)}</span>);
      case 'type': return wrap(<span className={`px-2 py-0.5 rounded text-[11px] font-medium ${style.color} ${style.bg}`}>{t.type}</span>);
      case 'category': return wrap(<span className="text-sm text-gray-600">{t.category}</span>);
      case 'account': return wrap(<span className="text-sm text-slate-700">{t.account || '-'}</span>);
      case 'client': return wrap(<span className="text-sm text-slate-600">{t.client || '-'}</span>);
      case 'group': return wrap(t.group ? <span className="px-1.5 py-0.5 bg-slate-50 text-slate-600 rounded text-xs">{t.group}</span> : <span className="text-slate-300">-</span>);
      case 'counterparty': return wrap(<span className="text-sm text-slate-600">{t.counterparty}</span>);
      case 'personnel': return wrap(<span className="text-sm text-slate-500">{t.personnel || '-'}</span>);
      case 'description': return wrap(<span className="text-sm text-slate-400 block max-w-[200px] truncate" title={t.description}>{t.description}</span>);
      case 'amount':
        let displayAmount = t.amount;
        let sign = '₺';
        if (t.type === TransactionType.INCOME) sign = '+ ₺';
        if (t.type === TransactionType.RECEIVABLE) sign = '+ ₺';
        if (t.type === TransactionType.EXPENSE) sign = '- ₺';
        if (t.type === TransactionType.DEBT) sign = '- ₺';
        if (t.type === TransactionType.CURRENT) {
          sign = t.amount < 0 ? '(-) ₺' : '(+) ₺';
          displayAmount = Math.abs(t.amount);
        }
        return wrap(<span className={`text-sm font-bold ${style.color}`}>{sign}{displayAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>);
      case 'status': return wrap(<div className={`inline-block w-2 h-2 rounded-full ${t.status === TransactionStatus.APPROVED ? 'bg-slate-800' : t.status === TransactionStatus.PENDING ? 'bg-slate-400' : 'bg-slate-300'}`} title={t.status}></div>);
      default: return null;
    }
  };

  const visibleColumns = columns.filter(c => c.visible);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider mb-1">Ofis Gelirleri</p>
          <h3 className="text-xl font-semibold text-slate-900">₺{totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider mb-1">Ofis Giderleri</p>
          <h3 className="text-xl font-semibold text-slate-900">₺{totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider mb-1">Alacaklar</p>
          <h3 className="text-xl font-semibold text-slate-900">₺{totalReceivable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider mb-1">Borçlar</p>
          <h3 className="text-xl font-semibold text-slate-900">₺{totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
      </div>

      {/* Table Controls */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 relative">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDeleteClick}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 flex items-center gap-1.5 text-xs transition-colors"
              >
                <Icon name="delete" className="text-sm" /> Seçilenleri Sil ({selectedIds.size})
              </button>
            )}
            <span className="text-[11px] text-slate-400 ml-2 flex items-center gap-1">
              <Icon name="edit" className="text-xs" /> Hücreye çift tıklayarak düzenleyebilirsiniz
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCompact(!isCompact)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${isCompact ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <Icon name={isCompact ? 'unfold_less' : 'unfold_more'} className="text-sm" />
              {isCompact ? 'Kompakt' : 'Normal'}
            </button>
            <div className="relative">
              <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <Icon name="view_column" className="text-sm" /> Sütunlar
              </button>
              {isColumnMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-slate-200 z-50 p-3 shadow-xl">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                    <h4 className="font-medium text-xs text-slate-700">Sütun Yönetimi</h4>
                    <button onClick={() => setIsColumnMenuOpen(false)}><Icon name="close" className="text-slate-400 text-sm" /></button>
                  </div>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {columns.map((col, idx) => (
                      <div key={col.id} className="flex items-center justify-between hover:bg-slate-50 p-1.5 rounded">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleColumnVisibility(col.id)} className={`p-0.5 rounded ${col.visible ? 'text-slate-700' : 'text-slate-300'}`}>
                            <Icon name={col.visible ? 'visibility' : 'visibility_off'} className="text-sm" />
                          </button>
                          <span className={`text-xs ${col.visible ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{col.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleOpenBulkModal} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 flex items-center gap-1.5 text-xs border border-slate-200 transition-colors">
              <Icon name="upload_file" className="text-sm" /> Excel Yükle
            </button>
            <button onClick={handleOpenCreateModal} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 flex items-center gap-1.5 text-xs transition-colors">
              <Icon name="add" className="text-sm" /> Yeni İşlem
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="pb-3 pl-4 w-10 align-top pt-6 sticky left-0 bg-white z-20">
                  <label className="flex items-center justify-center w-4 h-4 border border-slate-300 rounded bg-white cursor-pointer hover:border-slate-500 relative">
                    <input type="checkbox" className="peer appearance-none w-full h-full" checked={processedTransactions.length > 0 && selectedIds.size === processedTransactions.length} onChange={() => toggleSelectAll(processedTransactions)} />
                    <Icon name="check" className="text-slate-800 text-xs absolute hidden peer-checked:block" />
                  </label>
                </th>
                {visibleColumns.map(col => (
                  <th key={col.id} className="pb-3 px-2 w-32 align-top pt-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1 cursor-pointer group" onClick={() => handleSort(col.id)}>
                        <span className="font-medium text-slate-400 text-[11px] uppercase tracking-wider group-hover:text-slate-700 truncate">{col.label}</span>
                        <div className="flex flex-col text-[10px] text-slate-300">
                          <Icon name="arrow_drop_up" className={`-mb-2 ${sortConfig.key === col.id && sortConfig.direction === 'asc' ? 'text-slate-800' : ''}`} />
                          <Icon name="arrow_drop_down" className={`${sortConfig.key === col.id && sortConfig.direction === 'desc' ? 'text-slate-800' : ''}`} />
                        </div>
                      </div>
                      <div className="relative">
                        <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-[13px]" />
                        <input type="text" value={filters[col.id] || ''} onChange={(e) => handleFilterChange(col.id, e.target.value)} className="w-full pl-7 pr-2 py-1 text-[11px] border border-slate-200 rounded bg-slate-50 focus:bg-white outline-none" />
                      </div>
                    </div>
                  </th>
                ))}
                <th className="pb-3 w-20 sticky right-0 bg-white z-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {processedTransactions.map((t) => (
                <React.Fragment key={t.id}>
                  <tr
                    onClick={(e) => toggleRowExpand(t.id, e)}
                    className={`group hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.has(t.id) ? 'bg-slate-50' : ''}`}
                  >
                    <td className={`${isCompact ? 'py-1.5' : 'py-3'} pl-4`}>
                      <div className="flex items-center gap-2">
                        <Icon
                          name={expandedRows.has(t.id) ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                          className="text-slate-300 text-lg group-hover:text-slate-500"
                        />
                        <label className="flex items-center justify-center w-4 h-4 border border-slate-300 rounded bg-white cursor-pointer hover:border-slate-500 relative" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="peer appearance-none w-full h-full" checked={selectedIds.has(t.id)} onChange={() => toggleSelection(t.id)} />
                          <Icon name="check" className="text-slate-800 text-xs absolute hidden peer-checked:block" />
                        </label>
                      </div>
                    </td>
                    {visibleColumns.map(col => (
                      <td key={`${t.id}-${col.id}`} className={`${isCompact ? 'py-1.5' : 'py-3'} px-2 truncate ${col.id === 'amount' ? 'text-right' : ''}`}>
                        {renderCell(t, col.id)}
                      </td>
                    ))}
                    <td className={`${isCompact ? 'py-1.5' : 'py-3'} text-right pr-4 relative`}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={(e) => handleOpenEditModal(t, e)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded z-10"><Icon name="edit" className="text-sm" /></button>
                        <button type="button" onClick={(e) => handleDeleteClick(t.id, e)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded z-10"><Icon name="delete" className="text-sm" /></button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded Detail Row */}
                  {expandedRows.has(t.id) && (
                    <tr className="bg-slate-50/30 border-l-2 border-slate-800">
                      <td colSpan={visibleColumns.length + 2} className="px-12 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px]">
                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-400 uppercase tracking-widest">Detaylı Bilgiler</h4>
                            <p className="text-slate-700"><span className="font-bold">Ödeme Yöntemi:</span> {t.method || '-'}</p>
                            <p className="text-slate-700"><span className="font-bold">Kimden/Kime:</span> {t.personnel || '-'}</p>
                            <p className="text-slate-700"><span className="font-bold">Muhatap:</span> {t.counterparty || '-'}</p>
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <h4 className="font-bold text-slate-400 uppercase tracking-widest">Açıklama</h4>
                            <p className="text-slate-600 leading-relaxed italic">"{t.description || 'Açıklama bulunmuyor.'}"</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Icon name="delete_forever" className="text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Emin misiniz?</h3>
            <p className="text-slate-500 text-sm mb-5">
              {deleteTarget?.type === 'BULK' ? `${selectedIds.size} kaydı silmek üzeresiniz.` : 'Bu işlemi silmek üzeresiniz.'}
            </p>
            <div className="flex gap-2">
              <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 text-sm">İptal</button>
              <button disabled={isDeleting} onClick={confirmDelete} className="flex-1 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 text-sm">{isDeleting ? 'Siliniyor...' : 'Evet, Sil'}</button>
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