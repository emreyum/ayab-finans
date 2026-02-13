
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
  const [editingCell, setEditingCell] = useState<{id: string, field: string} | null>(null);
  
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState<{ [key: string]: string }>({});

  // --- DELETE MODAL STATE ---
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
      case TransactionType.INCOME: return { color: 'text-emerald-600', bg: 'bg-emerald-100' };
      case TransactionType.EXPENSE: return { color: 'text-red-600', bg: 'bg-red-100' };
      case TransactionType.RECEIVABLE: return { color: 'text-blue-600', bg: 'bg-blue-100' };
      case TransactionType.DEBT: return { color: 'text-orange-600', bg: 'bg-orange-100' };
      case TransactionType.CURRENT: return { color: 'text-purple-600', bg: 'bg-purple-100' };
      default: return { color: 'text-gray-600', bg: 'bg-gray-100' };
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
        const commonInputClass = "w-full h-full p-2 border-2 border-primary-400 rounded shadow-sm outline-none text-sm font-medium z-50 relative";
        
        switch(colId) {
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
                return <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded cursor-not-allowed">{displayTxNumber}</span>;
            default:
                return (
                    <input 
                        type="text" 
                        defaultValue={(t as any)[colId]} 
                        autoFocus
                        className={commonInputClass}
                        onBlur={(e) => handleCellSave(t.id, colId, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                );
        }
      }

      // DISPLAY MODE RENDER
      const wrap = (content: React.ReactNode) => (
         <div 
            onDoubleClick={() => colId !== 'transactionNumber' && setEditingCell({ id: t.id, field: colId })}
            className={`w-full h-full cursor-text flex items-center ${colId === 'amount' ? 'justify-end' : ''}`}
            title="Düzenlemek için çift tıklayın"
         >
             {content}
         </div>
      );

      switch(colId) {
          case 'transactionNumber':
              return <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{displayTxNumber}</span>;
          case 'date': return wrap(<span className="text-sm font-bold text-gray-700">{formatDate(t.date)}</span>);
          case 'type': return wrap(<span className={`px-2 py-1 rounded-md text-xs font-bold border ${style.color} ${style.bg} bg-opacity-50`}>{t.type}</span>);
          case 'category': return wrap(<span className="text-sm text-gray-600">{t.category}</span>);
          case 'account': return wrap(<span className="text-sm text-gray-900 font-medium">{t.account || '-'}</span>);
          case 'client': return wrap(<span className="text-sm text-gray-600">{t.client || '-'}</span>);
          case 'group': return wrap(t.group ? <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">{t.group}</span> : <span className="text-gray-300">-</span>);
          case 'counterparty': return wrap(<span className="text-sm text-gray-700 font-medium">{t.counterparty}</span>);
          case 'personnel': return wrap(<span className="text-sm text-gray-600">{t.personnel || '-'}</span>);
          case 'description': return wrap(<span className="text-sm text-gray-500 block max-w-[200px] truncate" title={t.description}>{t.description}</span>);
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
          case 'status': return wrap(<div className={`inline-block w-3 h-3 rounded-full ${t.status === TransactionStatus.APPROVED ? 'bg-emerald-500' : t.status === TransactionStatus.PENDING ? 'bg-yellow-500' : 'bg-red-500'}`} title={t.status}></div>);
          default: return null;
      }
  };

  const visibleColumns = columns.filter(c => c.visible);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs font-bold uppercase mb-1">Ofis Gelirleri</p>
          <h3 className="text-2xl font-bold text-gray-900">₺{totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs font-bold uppercase mb-1">Ofis Giderleri</p>
          <h3 className="text-2xl font-bold text-gray-900">₺{totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs font-bold uppercase mb-1">Alacaklar</p>
          <h3 className="text-2xl font-bold text-gray-900">₺{totalReceivable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs font-bold uppercase mb-1">Borçlar</p>
          <h3 className="text-2xl font-bold text-gray-900">₺{totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
        </div>
      </div>

      {/* Table Controls */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-2">
                 {selectedIds.size > 0 && (
                    <button 
                        onClick={handleBulkDeleteClick} 
                        className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center gap-2 text-xs shadow-md transition-colors"
                    >
                        <Icon name="delete" className="text-sm" /> Seçilenleri Sil ({selectedIds.size})
                    </button>
                 )}
                 <span className="text-xs text-gray-400 italic ml-2 flex items-center gap-1">
                    <Icon name="edit" className="text-xs" /> Hücreye çift tıklayarak düzenleyebilirsiniz
                 </span>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-xl text-sm font-medium flex items-center gap-2">
                        <Icon name="view_column" /> Sütunlar
                    </button>
                    {isColumnMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4">
                            <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                                <h4 className="font-bold text-sm text-gray-800">Sütun Yönetimi</h4>
                                <button onClick={() => setIsColumnMenuOpen(false)}><Icon name="close" className="text-gray-400 text-sm" /></button>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {columns.map((col, idx) => (
                                    <div key={col.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleColumnVisibility(col.id)} className={`p-1 rounded hover:bg-gray-200 ${col.visible ? 'text-primary-600' : 'text-gray-400'}`}>
                                                <Icon name={col.visible ? 'visibility' : 'visibility_off'} className="text-sm" />
                                            </button>
                                            <span className={`text-sm ${col.visible ? 'text-gray-800 font-medium' : 'text-gray-400 line-through'}`}>{col.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={handleOpenBulkModal} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2 text-sm">
                    <Icon name="upload_file" className="text-lg" /> Excel Yükle
                </button>
                <button onClick={handleOpenCreateModal} className="px-5 py-2 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800 shadow-lg shadow-primary-200 flex items-center gap-2 text-sm">
                    <Icon name="add_circle" className="text-lg" /> Yeni İşlem
                </button>
            </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-4 pl-4 w-10 align-top pt-7">
                   <label className="flex items-center justify-center w-5 h-5 border-2 border-gray-300 rounded bg-white cursor-pointer hover:border-primary-500 relative">
                      <input type="checkbox" className="peer appearance-none w-full h-full" checked={processedTransactions.length > 0 && selectedIds.size === processedTransactions.length} onChange={() => toggleSelectAll(processedTransactions)} />
                      <Icon name="check" className="text-primary-600 text-sm absolute hidden peer-checked:block font-bold" />
                   </label>
                </th>
                {visibleColumns.map(col => (
                    <th key={col.id} className="pb-4 px-2 w-32">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1 cursor-pointer group" onClick={() => handleSort(col.id)}>
                                <span className="font-bold text-gray-500 text-xs uppercase tracking-wider group-hover:text-primary-700 truncate">{col.label}</span>
                                <div className="flex flex-col text-[10px] text-gray-300">
                                    <Icon name="arrow_drop_up" className={`-mb-2 ${sortConfig.key === col.id && sortConfig.direction === 'asc' ? 'text-primary-600' : ''}`} />
                                    <Icon name="arrow_drop_down" className={`${sortConfig.key === col.id && sortConfig.direction === 'desc' ? 'text-primary-600' : ''}`} />
                                </div>
                            </div>
                            <div className="relative">
                                <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]" />
                                <input type="text" value={filters[col.id] || ''} onChange={(e) => handleFilterChange(col.id, e.target.value)} className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white outline-none" />
                            </div>
                        </div>
                    </th>
                ))}
                <th className="pb-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {processedTransactions.map((t) => (
                <tr key={t.id} className={`group hover:bg-gray-50 transition-colors ${selectedIds.has(t.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="py-4 pl-4">
                         <label className="flex items-center justify-center w-5 h-5 border-2 border-gray-300 rounded bg-white cursor-pointer hover:border-primary-500 relative">
                            <input type="checkbox" className="peer appearance-none w-full h-full" checked={selectedIds.has(t.id)} onChange={() => toggleSelection(t.id)} />
                            <Icon name="check" className="text-primary-600 text-sm absolute hidden peer-checked:block font-bold" />
                         </label>
                    </td>
                    {visibleColumns.map(col => (
                        <td key={`${t.id}-${col.id}`} className={`py-4 px-2 truncate ${col.id === 'amount' ? 'text-right' : ''}`}>
                            {renderCell(t, col.id)}
                        </td>
                    ))}
                    <td className="py-4 text-right pr-4 relative">
                      <div className="flex items-center justify-end gap-2 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={(e) => handleOpenEditModal(t, e)} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg shadow-sm z-10"><Icon name="edit" className="text-sm" /></button>
                        <button type="button" onClick={(e) => handleDeleteClick(t.id, e)} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shadow-sm z-10"><Icon name="delete" className="text-sm" /></button>
                      </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-gray-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="delete_forever" className="text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Emin misiniz?</h3>
            <p className="text-gray-500 text-sm mb-6">
              {deleteTarget?.type === 'BULK' ? `${selectedIds.size} kaydı silmek üzeresiniz.` : 'Bu işlemi silmek üzeresiniz.'}
            </p>
            <div className="flex gap-3">
              <button disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">İptal</button>
              <button disabled={isDeleting} onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg">{isDeleting ? 'Siliniyor...' : 'Evet, Sil'}</button>
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