
import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';
import { ImportTemplate, Transaction, TransactionStatus, TransactionType } from '../types';
import { formatDate } from '../utils';

declare const XLSX: any;

interface BulkTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void>;
}

const APP_FIELDS = [
  { key: 'date', label: 'Tarih', required: true, example: '2024-01-01' },
  { key: 'amount', label: 'Tutar', required: true, example: '1500.00' },
  { key: 'description', label: 'Açıklama', required: true, example: 'Ofis Kirası' },
  { key: 'type', label: 'İşlem Türü', required: false, example: 'Gider' },
  { key: 'category', label: 'Kategori', required: false, example: 'Kira' },
  { key: 'account', label: 'Banka/Kasa', required: false, example: 'Garanti Bankası' },
  { key: 'client', label: 'Müvekkil', required: false, example: 'Tekno A.Ş.' },
  { key: 'group', label: 'Proje/Grup', required: false, example: 'Dava' },
  { key: 'counterparty', label: 'Muhatap', required: false, example: 'Ahmet Yılmaz' },
];

export const BulkTransactionModal: React.FC<BulkTransactionModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<any[]>([]);
  
  // Templates
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [saveAsNewTemplate, setSaveAsNewTemplate] = useState(false);

  // Mapping state: AppField -> ExcelHeader
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [previewData, setPreviewData] = useState<Partial<Transaction>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    if (isOpen && supabase) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('transaction_import_templates').select('*');
      if (error) {
        if (error.code === '42P01') { // Table missing
             setShowSql(true);
        }
      } else if (data) {
        setTemplates(data);
      }
    } catch (err) {
      console.warn('Templates fetch error', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      readExcel(selectedFile);
    }
  };

  const readExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      // Get raw data with headers
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // array of arrays
      
      if (data.length > 0) {
        const headers = data[0] as string[];
        const rows = XLSX.utils.sheet_to_json(ws); // array of objects
        setExcelHeaders(headers);
        setExcelData(rows);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setMapping(template.mapping);
      }
    } else {
      setMapping({});
    }
  };

  const handleMappingChange = (appField: string, excelHeader: string) => {
    setMapping(prev => ({ ...prev, [appField]: excelHeader }));
  };

  const generatePreview = () => {
    // Basic validation
    const requiredFields = APP_FIELDS.filter(f => f.required).map(f => f.key);
    const missing = requiredFields.filter(key => !mapping[key]);
    
    if (missing.length > 0) {
      alert(`Lütfen zorunlu alanları eşleştirin: ${missing.join(', ')}`);
      return;
    }

    const mapped = excelData.slice(0, 5).map(row => mapRowToTransaction(row));
    setPreviewData(mapped);
    setStep(3);
  };

  const mapRowToTransaction = (row: any): Partial<Transaction> => {
    const tx: any = {};
    
    Object.keys(mapping).forEach(appKey => {
      const excelHeader = mapping[appKey];
      if (excelHeader) {
        let value = row[excelHeader];

        // Data transformation logic
        if (appKey === 'date') {
             if (value instanceof Date) {
                value = value.toISOString().split('T')[0];
             } else if (typeof value === 'string') {
                 // Try to parse DD.MM.YYYY
                 const parts = value.split('.');
                 if (parts.length === 3) {
                     value = `${parts[2]}-${parts[1]}-${parts[0]}`;
                 }
             }
        }

        if (appKey === 'amount') {
            // Clean currency symbols
            if (typeof value === 'string') {
                value = parseFloat(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
            }
        }

        if (appKey === 'type') {
             // normalize inputs
             const valStr = String(value).toLowerCase();
             if (valStr.includes('gelir') || valStr.includes('income') || valStr.includes('alacak')) tx.type = TransactionType.INCOME;
             else if (valStr.includes('gider') || valStr.includes('expense') || valStr.includes('borç')) tx.type = TransactionType.EXPENSE;
             else tx.type = TransactionType.EXPENSE; // default
        } else {
            tx[appKey] = value;
        }
      }
    });

    // Defaults if missing
    if (!tx.type) tx.type = TransactionType.EXPENSE;
    if (!tx.status) tx.status = TransactionStatus.APPROVED;
    
    return tx;
  };

  const performImport = async () => {
    setIsImporting(true);
    try {
        // 1. Save Template if requested
        if (saveAsNewTemplate && newTemplateName && supabase) {
            const { error } = await supabase.from('transaction_import_templates').insert([{
                name: newTemplateName,
                mapping: mapping
            }]);
            if (error) {
                console.error("Template save error", error);
                // Don't block import if template save fails
            }
        }

        // 2. Process all rows
        const transactionsToInsert: any[] = [];
        const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, ''); 
        
        let counter = 1;

        for (const row of excelData) {
            const tx = mapRowToTransaction(row);
            
            // Add missing required system fields
            const finalTx = {
                ...tx,
                transaction_number: `${datePrefix}-BLK-${Math.floor(Math.random() * 100000)}`,
                status: TransactionStatus.APPROVED,
                method: tx.method || 'Diğer',
                created_at: new Date().toISOString()
            };
            transactionsToInsert.push(finalTx);
            counter++;
        }

        if (supabase) {
            const { error } = await supabase.from('transactions').insert(transactionsToInsert);
            if (error) throw error;
        }

        alert(`${transactionsToInsert.length} işlem başarıyla aktarıldı.`);
        await onImportComplete();
        onClose();

    } catch (error: any) {
        alert("Aktarım sırasında hata: " + error.message);
    } finally {
        setIsImporting(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setFile(null);
    setExcelHeaders([]);
    setExcelData([]);
    setMapping({});
    setSaveAsNewTemplate(false);
    setPreviewData([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <Icon name="upload_file" /> Toplu İşlem / Excel Yükleme
            </h3>
            <p className="text-xs text-gray-500">Adım {step} / 3</p>
          </div>
          <button onClick={() => { onClose(); resetModal(); }} className="text-gray-400 hover:text-gray-600">
            <Icon name="close" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
            
            {showSql && (
                 <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-4 text-xs">
                     <h4 className="font-bold text-amber-800 mb-2">Veritabanı Tablosu Eksik</h4>
                     <p className="mb-2 text-amber-700">Şablonları kaydetmek için şu SQL kodunu Supabase SQL Editor'de çalıştırın:</p>
                     <pre className="bg-gray-800 text-white p-2 rounded overflow-x-auto">
{`create table if not exists public.transaction_import_templates (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  mapping jsonb not null
);
alter table public.transaction_import_templates enable row level security;
create policy "Public Access" on public.transaction_import_templates for all using (true) with check (true);`}
                     </pre>
                     <button onClick={() => setShowSql(false)} className="mt-2 text-amber-600 font-bold underline">Kapat</button>
                 </div>
            )}

            {step === 1 && (
                <div className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center hover:bg-gray-50 transition-all">
                        <Icon name="description" className="text-5xl text-gray-300 mb-4" />
                        <h4 className="text-lg font-bold text-gray-700">Excel Dosyasını Seçin</h4>
                        <p className="text-sm text-gray-500 mb-4">.xlsx veya .xls formatında</p>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer mx-auto max-w-xs"
                        />
                    </div>
                    
                    {file && excelHeaders.length > 0 && (
                        <div className="animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-gray-800">Şablon Seçimi (Opsiyonel)</h4>
                            </div>
                            <select 
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 bg-white outline-none"
                                value={selectedTemplateId}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                            >
                                <option value="">-- Yeni Eşleştirme Yap --</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            
                            <div className="mt-8 flex justify-end">
                                <button 
                                    onClick={() => setStep(2)} 
                                    className="px-6 py-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800 shadow-lg shadow-primary-200 flex items-center gap-2"
                                >
                                    Devam Et <Icon name="arrow_forward" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-3">
                            <Icon name="table_chart" className="text-blue-600 text-xl" />
                            <div>
                                <h4 className="font-bold text-blue-900">Sütun Eşleştirme</h4>
                                <p className="text-xs text-blue-700">Dosyanızdaki sütunları sistemdeki alanlarla eşleştirin.</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-blue-200 text-blue-600">
                            {excelData.length} Satır
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {APP_FIELDS.map(field => (
                            <div key={field.key} className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                                    {field.label}
                                    {field.required && <span className="text-red-500">* Zorunlu</span>}
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        className={`w-full px-3 py-2.5 rounded-lg border ${mapping[field.key] ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50'} focus:bg-white outline-none text-sm`}
                                        value={mapping[field.key] || ''}
                                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                    >
                                        <option value="">Seçiniz...</option>
                                        {excelHeaders.map(header => (
                                            <option key={header} value={header}>{header}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-100 pt-6 mt-6">
                        <label className="flex items-center gap-3 cursor-pointer mb-4 group w-fit">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${saveAsNewTemplate ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300'}`}>
                                {saveAsNewTemplate && <Icon name="check" className="text-sm" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={saveAsNewTemplate} onChange={(e) => setSaveAsNewTemplate(e.target.checked)} />
                            <span className="text-sm font-bold text-gray-700 group-hover:text-primary-700">Bu ayarları şablon olarak kaydet</span>
                        </label>
                        
                        {saveAsNewTemplate && (
                            <input 
                                type="text"
                                placeholder="Şablon Adı (Örn: Garanti Bankası Ekstresi)"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                className="w-full max-w-md px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none animate-fade-in"
                            />
                        )}
                    </div>

                    <div className="flex justify-between pt-4">
                        <button onClick={() => setStep(1)} className="px-6 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-bold">Geri</button>
                        <button 
                            onClick={generatePreview}
                            className="px-6 py-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800 shadow-lg shadow-primary-200 flex items-center gap-2"
                        >
                            Önizleme <Icon name="visibility" />
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6">
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                            <h4 className="font-bold text-gray-700 text-sm">Veri Önizlemesi (İlk 5 Satır)</h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-gray-500 border-b border-gray-200 bg-white">
                                        {APP_FIELDS.map(f => (mapping[f.key] ? <th key={f.key} className="p-3 font-bold whitespace-nowrap">{f.label}</th> : null))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx}>
                                            {APP_FIELDS.map(f => {
                                                if (!mapping[f.key]) return null;
                                                let val = (row as any)[f.key];
                                                if (f.key === 'date') val = formatDate(val);
                                                return <td key={f.key} className="p-3 whitespace-nowrap text-gray-700">{val}</td>
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-between pt-4">
                        <button onClick={() => setStep(2)} className="px-6 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-bold">Geri (Düzenle)</button>
                        <button 
                            onClick={performImport}
                            disabled={isImporting}
                            className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2"
                        >
                            {isImporting ? 'Aktarılıyor...' : 'İçe Aktarımı Tamamla'} <Icon name="check_circle" />
                        </button>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};