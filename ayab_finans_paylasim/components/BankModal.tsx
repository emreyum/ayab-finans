
import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';

interface BankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BankAccount>) => void;
  initialData?: BankAccount | null;
}

export const BankModal: React.FC<BankModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [bankNames, setBankNames] = useState<string[]>([]);

  const [formData, setFormData] = useState<Partial<BankAccount>>({
    bankName: '',
    accountNumber: '',
    balance: 0,
    currency: 'TRY',
    type: 'Vadesiz TL Hesabı'
  });

  useEffect(() => {
      const fetchBanks = async () => {
          if(supabase) {
              const { data } = await supabase.from('bank_definitions').select('name');
              if(data && data.length > 0) {
                  setBankNames(data.map((b: any) => b.name));
              } else {
                  setBankNames(['Garanti Bankası', 'İş Bankası', 'Akbank', 'Ziraat Bankası', 'QNB Finansbank']);
              }
          } else {
               setBankNames(['Garanti Bankası', 'İş Bankası', 'Akbank', 'Ziraat Bankası', 'QNB Finansbank']);
          }
      };
      fetchBanks();
  }, []);

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        bankName: '',
        accountNumber: '',
        balance: 0,
        currency: 'TRY',
        type: 'Vadesiz TL Hesabı'
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if(supabase) {
        const accountData = {
            bank_name: formData.bankName,
            account_number: formData.accountNumber,
            balance: formData.balance, // This acts as Initial Balance
            currency: formData.currency,
            type: formData.type
        };

        if (initialData && initialData.id) {
             // Update
             await supabase.from('bank_accounts').update(accountData).eq('id', initialData.id);
        } else {
            // Create
             await supabase.from('bank_accounts').insert([accountData]);
        }
    }
    
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">
            {initialData ? 'Hesabı Düzenle' : 'Yeni Hesap Ekle'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Banka Adı</label>
            <div className="relative">
                <input
                required
                list="bankNamesList"
                type="text"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="Örn: Garanti Bankası"
                />
                <datalist id="bankNamesList">
                    {bankNames.map(name => <option key={name} value={name} />)}
                </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hesap Numarası / IBAN</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              placeholder="TR..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Açılış Bakiyesi</label>
              <input
                required
                type="number"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-gray-700"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Para Birimi</label>
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hesap Türü</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="Vadesiz TL Hesabı">Vadesiz TL Hesabı</option>
              <option value="Vadesiz Döviz Hesabı">Vadesiz Döviz Hesabı</option>
              <option value="Vadeli Hesap">Vadeli Hesap</option>
              <option value="Katılım Hesabı">Katılım Hesabı</option>
              <option value="Nakit Kasa">Nakit Kasa</option>
              <option value="Kredi Kartı">Kredi Kartı</option>
              <option value="POS Hesabı">POS Hesabı</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800 transition-colors shadow-lg shadow-primary-200"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
