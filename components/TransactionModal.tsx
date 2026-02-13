
import React, { useState, useEffect, useRef } from 'react';
import { TransactionType, TransactionStatus, Transaction } from '../types';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, id?: string) => Promise<void>;
  initialData?: Transaction | null;
}

// --- CUSTOM AUTOCOMPLETE COMPONENT ---
interface AutocompleteProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options);

  useEffect(() => {
    if (!value) {
      setFilteredOptions(options);
    } else {
      setFilteredOptions(
        options.filter(opt => opt.toLowerCase().includes(value.toLowerCase()))
      );
    }
  }, [value, options]);

  // Handle selection
  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          required={required}
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm transition-colors ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        />
        {!disabled && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Icon name={isOpen ? "expand_less" : "expand_more"} />
          </div>
        )}
      </div>

      {isOpen && filteredOptions.length > 0 && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <div
              key={`${option}-${index}`}
              className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-0"
              onClick={() => handleSelect(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [bankAccounts, setBankAccounts] = useState<string[]>([]);
  const [personnelList, setPersonnelList] = useState<string[]>([]);

  const [existingClients, setExistingClients] = useState<string[]>([]);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [existingCounterparties, setExistingCounterparties] = useState<string[]>([]);

  const [cariDirection, setCariDirection] = useState<'PLUS' | 'MINUS'>('PLUS');

  // Form Data
  const [formData, setFormData] = useState({
    transactionNumber: '',
    type: TransactionType.EXPENSE,
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    counterparty: '',
    method: 'Havale/EFT',
    status: TransactionStatus.APPROVED,
    account: '',
    client: '',
    group: '',
    personnel: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (supabase) {
        const { data: catData } = await supabase.from('categories').select('name');
        if (catData) setCategories(catData.map((c: any) => c.name));

        const { data: accData } = await supabase.from('bank_accounts').select('bank_name');
        if (accData) {
          const uniqueNames = Array.from(new Set(accData.map((b: any) => b.bank_name as string)));
          setBankAccounts(uniqueNames as string[]);
        }

        // Fetch from NEW personnel_definitions table with safety check
        try {
          const { data: personnelData, error } = await supabase.from('personnel_definitions').select('full_name');
          if (error) {
            console.warn("Personnel table not found or error, using default.", error.message);
            setPersonnelList(['Av. Mehmet Yılmaz', 'Stj. Ali Veli']);
          } else if (personnelData) {
            setPersonnelList(personnelData.map((u: any) => u.full_name));
          }
        } catch (e) {
          setPersonnelList(['Av. Mehmet Yılmaz', 'Stj. Ali Veli']);
        }

        const { data: txData } = await supabase.from('transactions').select('client, group, counterparty');
        if (txData) {
          const clients = txData
            .map((t: any) => t.client)
            .filter((c: any): c is string => typeof c === 'string' && c.length > 0);
          setExistingClients(Array.from(new Set(clients)));

          const groups = txData
            .map((t: any) => t.group)
            .filter((g: any): g is string => typeof g === 'string' && g.length > 0);
          setExistingGroups(Array.from(new Set(groups)));

          const counterparties = txData
            .map((t: any) => t.counterparty)
            .filter((c: any): c is string => typeof c === 'string' && c.length > 0);
          setExistingCounterparties(Array.from(new Set(counterparties)));
        }

      } else {
        setCategories(['Dava Geliri', 'Danışmanlık', 'Kira', 'Maaş', 'Ofis Giderleri']);
        setBankAccounts(['Garanti Bankası', 'İş Bankası', 'Ofis Kasa']);
        setPersonnelList(['Av. Mehmet Yılmaz', 'Stj. Ali Veli']);
        setExistingClients(['Tekno A.Ş.']);
        setExistingGroups(['Dava']);
        setExistingCounterparties(['İstanbul Adliyesi']);
      }
    };
    fetchData();
  }, [isOpen]);

  // Logic to handle Edit vs Create Mode
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // --- EDIT MODE ---
        const isNegative = initialData.amount < 0;
        setFormData({
          transactionNumber: initialData.transactionNumber,
          type: initialData.type,
          amount: Math.abs(initialData.amount).toString(),
          description: initialData.description,
          category: initialData.category,
          date: initialData.date,
          counterparty: initialData.counterparty,
          method: initialData.method,
          status: initialData.status,
          account: initialData.account || '',
          client: initialData.client || '',
          group: initialData.group || '',
          personnel: initialData.personnel || ''
        });
        if (initialData.type === TransactionType.CURRENT) {
          setCariDirection(isNegative ? 'MINUS' : 'PLUS');
        }
      } else {
        // --- CREATE MODE: Generate Sequential Number ---
        const generateNumber = async () => {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const datePrefix = `${yyyy}${mm}${dd}`; // e.g. 20241120

          let sequence = '001';

          if (supabase) {
            // Find the latest transaction for TODAY
            const { data, error } = await supabase
              .from('transactions')
              .select('transaction_number')
              .ilike('transaction_number', `${datePrefix}-%`) // Filter by date prefix
              .order('transaction_number', { ascending: false })
              .limit(1);

            if (!error && data && data.length > 0) {
              const lastCode = data[0].transaction_number; // e.g. 20241120-005
              const parts = lastCode.split('-');
              if (parts.length === 2) {
                const lastSeq = parseInt(parts[1], 10);
                if (!isNaN(lastSeq)) {
                  sequence = String(lastSeq + 1).padStart(3, '0');
                }
              }
            }
          }

          const newNumber = `${datePrefix}-${sequence}`;

          setFormData({
            transactionNumber: newNumber,
            type: TransactionType.EXPENSE,
            amount: '',
            description: '',
            category: '',
            date: new Date().toISOString().split('T')[0],
            counterparty: '',
            method: 'Havale/EFT',
            status: TransactionStatus.APPROVED,
            account: '',
            client: '',
            group: '',
            personnel: ''
          });
          setCariDirection('PLUS');
        };

        generateNumber();
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (formData.type === TransactionType.CURRENT) {
      if (formData.category !== 'Danışmanlık' && formData.category !== 'Hesap' && formData.category !== 'Tahsilat') {
        setFormData(prev => ({ ...prev, category: 'Danışmanlık' }));
      }
      setFormData(prev => ({
        ...prev,
        method: 'Cari Hesaba İşle',
        account: '',
        status: TransactionStatus.APPROVED
      }));
    }
  }, [formData.type]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let amountVal = parseFloat(formData.amount);
    if (formData.type === TransactionType.CURRENT && cariDirection === 'MINUS') {
      amountVal = -Math.abs(amountVal);
    } else {
      amountVal = Math.abs(amountVal);
    }

    const finalCounterparty = formData.type === TransactionType.CURRENT
      ? (formData.client || '-')
      : formData.counterparty;

    try {
      const payload = {
        ...formData,
        transaction_number: formData.transactionNumber,
        amount: isNaN(amountVal) ? 0 : amountVal,
        counterparty: finalCounterparty,
      };

      await onSave(payload, initialData?.id);
      onClose();
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setLoading(false);
    }
  };

  const TypeButton = ({ type, label, activeColor, icon }: { type: TransactionType, label: string, activeColor: string, icon: string }) => {
    const isActive = formData.type === type;
    return (
      <button
        type="button"
        onClick={() => setFormData({ ...formData, type })}
        className={`flex-1 py-2 px-1 rounded-md text-xs font-medium transition-all flex flex-col items-center gap-1 border ${isActive
            ? 'bg-white text-slate-800 border-slate-300 shadow-sm'
            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100'
          }`}
      >
        <Icon name={icon} className={isActive ? 'text-slate-700' : 'text-slate-400'} />
        {label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm text-slate-800">
              {initialData ? 'İşlemi Düzenle' : 'Yeni İşlem Ekle'}
            </h3>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded mt-1 inline-block w-fit">
              {formData.transactionNumber || 'No Oluşturuluyor...'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          <div className="bg-slate-50 p-1 rounded-lg flex gap-0.5">
            <TypeButton type={TransactionType.INCOME} label="Gelir" activeColor="" icon="arrow_downward" />
            <TypeButton type={TransactionType.EXPENSE} label="Gider" activeColor="" icon="arrow_upward" />
            <TypeButton type={TransactionType.RECEIVABLE} label="Alacak" activeColor="" icon="account_balance_wallet" />
            <TypeButton type={TransactionType.DEBT} label="Borç" activeColor="" icon="money_off" />
            <TypeButton type={TransactionType.CURRENT} label="Cari" activeColor="" icon="sync_alt" />
          </div>

          {formData.type === TransactionType.CURRENT && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 text-center">Cari İşlem Yönü</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCariDirection('PLUS')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${cariDirection === 'PLUS'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <Icon name="add_circle" className="text-sm" />
                  Tahakkuk / Borç Yansıt (+)
                </button>
                <button
                  type="button"
                  onClick={() => setCariDirection('MINUS')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${cariDirection === 'MINUS'
                      ? 'bg-slate-600 text-white border-slate-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <Icon name="remove_circle" className="text-sm" />
                  Tahsilat / Alacak Düş (-)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Tutar (₺)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-1 focus:border-slate-300 outline-none font-semibold text-base ${formData.type === TransactionType.CURRENT && cariDirection === 'MINUS'
                    ? 'text-slate-500 border-slate-300 focus:ring-slate-400'
                    : 'text-slate-800 border-slate-200 focus:ring-slate-400'
                  }`}
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Tarih</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Kategori</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {formData.type === TransactionType.CURRENT ? (
                  <>
                    <optgroup label="Tahakkuk / Borçlandırma">
                      <option value="Danışmanlık">Danışmanlık</option>
                      <option value="Hesap">Hesap / Masraf</option>
                    </optgroup>
                    <optgroup label="Tahsilat / Düşüm">
                      <option value="Tahsilat">Tahsilat Sayılan</option>
                      <option value="İade">İade / Düzeltme</option>
                    </optgroup>
                  </>
                ) : (
                  <>
                    <option value="">Seçiniz</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </>
                )}
              </select>
            </div>

            {formData.type !== TransactionType.CURRENT && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Hesap / Kasa</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  {bankAccounts.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Ödeme Yöntemi</label>
              {formData.type === TransactionType.CURRENT ? (
                <input
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
                  value="Cari Hesaba İşle"
                />
              ) : (
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                >
                  <option value="Havale/EFT">Havale/EFT</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                  <option value="Nakit">Nakit</option>
                  <option value="Çek">Çek</option>
                  <option value="Senet">Senet</option>
                  <option value="Otomatik Ödeme">Otomatik Ödeme</option>
                  <option value="Banka Kartı">Banka Kartı</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Autocomplete
                label="Müvekkil"
                value={formData.client}
                onChange={(val) => setFormData({ ...formData, client: val })}
                options={existingClients}
                placeholder="Örn: Tekno A.Ş."
              />
            </div>

            {formData.type !== TransactionType.CURRENT && (
              <div>
                <Autocomplete
                  label="Muhatap (Karşı Taraf)"
                  value={formData.counterparty}
                  onChange={(val) => setFormData({ ...formData, counterparty: val })}
                  options={existingCounterparties}
                  placeholder="Örn: Ahmet Yılmaz"
                />
              </div>
            )}

            <div>
              <Autocomplete
                label="Grup / Proje"
                value={formData.group}
                onChange={(val) => setFormData({ ...formData, group: val })}
                options={existingGroups}
                placeholder="Örn: Dava, Ofis, Özel"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Kimden (Personel)</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
                value={formData.personnel}
                onChange={(e) => setFormData({ ...formData, personnel: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Açıklama</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
                placeholder="İşlem açıklaması"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Durum</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 focus:border-slate-300 outline-none bg-white text-sm"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
            >
              <option value={TransactionStatus.APPROVED}>Onaylandı</option>
              <option value={TransactionStatus.PENDING}>İnceleniyor</option>
              <option value={TransactionStatus.REJECTED}>Reddedildi</option>
            </select>
          </div>

          <div className="flex gap-2 mt-6 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm">İptal</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors text-sm">
              {loading ? 'Kaydediliyor...' : initialData ? 'Değişiklikleri Kaydet' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
