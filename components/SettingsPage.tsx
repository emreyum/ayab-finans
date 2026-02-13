
import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';
import { Category, BankAccount, AppUser, OrganizationSettings, Personnel } from '../types';
import { BankModal } from './BankModal';

declare const XLSX: any;

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'accounts' | 'users' | 'personnel'>('general');

  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);

  // Error & UI States
  const [personnelTableMissing, setPersonnelTableMissing] = useState(false);
  const [showSql, setShowSql] = useState(false);

  // Input States for Categories
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('Gider');
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);

  // Input States for Users
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'User' });

  // Input States for Personnel (Extended)
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);
  const [newPersonnel, setNewPersonnel] = useState<Partial<Personnel>>({
    full_name: '',
    tckn: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: '',
    role: '',
    location: '',
    start_date: '',
    insurance_status: '',
    complementary_insurance: '',
    bonus_percentage: 0
  });

  // Modal States for Banks
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Settings Form State
  const [appName, setAppName] = useState('');
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (!supabase) return;

    if (activeTab === 'general') {
      const { data } = await supabase.from('organization_settings').select('*').single();
      if (data) {
        setSettings(data);
        setAppName(data.app_name);
        setLogoFile(data.logo_url || null);
      }
    } else if (activeTab === 'categories') {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } else if (activeTab === 'accounts') {
      const { data } = await supabase.from('bank_accounts').select('*').order('bank_name');
      if (data) {
        const mappedAccounts: BankAccount[] = data.map((a: any) => ({
          id: a.id,
          bankName: a.bank_name,
          accountNumber: a.account_number,
          balance: a.balance,
          currency: a.currency,
          type: a.type
        }));
        setAccounts(mappedAccounts);
      }
    } else if (activeTab === 'users') {
      const { data } = await supabase.from('app_users').select('*');
      if (data) setUsers(data);
    } else if (activeTab === 'personnel') {
      try {
        const { data, error } = await supabase.from('personnel_definitions').select('*').order('full_name');

        if (error) {
          console.error("Personnel Fetch Error:", error);
          // Check for "relation does not exist" error code (Postgres 42P01)
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            setPersonnelTableMissing(true);
          }
        } else if (data) {
          setPersonnelList(data);
          setPersonnelTableMissing(false);
        }
      } catch (e) {
        console.error("Unexpected fetch error", e);
      }
    }
  };

  // --- General Settings Handlers ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaveStatus('saving');

    const payload = {
      app_name: appName,
      logo_url: logoFile
    };

    let error;
    if (settings?.id) {
      const { error: updateError } = await supabase
        .from('organization_settings')
        .update(payload)
        .eq('id', settings.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('organization_settings')
        .insert([payload]);
      error = insertError;
    }

    if (!error) {
      setSaveStatus('success');
      fetchData();
      // Force refresh to update sidebar immediately
      setTimeout(() => window.location.reload(), 500);
    } else {
      setSaveStatus('error');
      console.error(error);
    }
  };

  // --- Category Handlers ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from('categories').insert([{ name: newCategory, type: newCategoryType }]);
    if (!error) {
      setNewCategory('');
      fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;
    await supabase.from('categories').delete().eq('id', id);
    fetchData();
  };

  // --- Download Templates ---

  const handleDownloadCategoryTemplate = () => {
    const templateData = [
      { "Kategori Adı": "Taksi Fişleri", "Tür": "Gider" },
      { "Kategori Adı": "Ofis Kirası", "Tür": "Gider" },
      { "Kategori Adı": "Dava Vekalet Ücreti", "Tür": "Gelir" },
      { "Kategori Adı": "Danışmanlık Geliri", "Tür": "Gelir" },
      { "Kategori Adı": "Diğer İşlemler", "Tür": "Diğer" }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wscols = [{ wch: 30 }, { wch: 15 }];
    ws['!cols'] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kategoriler");
    XLSX.writeFile(wb, "Kategori_Sablonu.xlsx");
  };

  const handleDownloadPersonnelTemplate = () => {
    const templateData = [
      {
        "İsim": "Ahmet Yılmaz",
        "TCKN": "12345678901",
        "E-posta": "ahmet@ornek.com",
        "Telefon": "05551234567",
        "Doğum Tarihi": "01.01.1990",
        "Cinsiyet": "Erkek",
        "Rol": "Avukat",
        "Lokasyon": "İstanbul",
        "İşe Başlama Tarihi": "01.01.2020",
        "Sigorta Durumu": "Tam",
        "Tamamlayıcı": "Var",
        "Hakediş Oranı": 40
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    const wscols = [{ wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personel_Listesi");
    XLSX.writeFile(wb, "Personel_Sablonu.xlsx");
  };

  // --- Bulk Uploads ---

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUploadLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert("Dosya boş veya okunamadı.");
          setBulkUploadLoading(false);
          return;
        }

        const formattedData = data.map((row: any) => ({
          name: row['Kategori Adı'],
          type: row['Tür'] || 'Diğer'
        })).filter((item: any) => item.name && item.name.trim() !== '');

        if (formattedData.length === 0) {
          alert("Geçerli kategori verisi bulunamadı. Lütfen şablonu kontrol edin.");
          setBulkUploadLoading(false);
          return;
        }

        if (supabase) {
          const { error } = await supabase.from('categories').insert(formattedData);
          if (error) throw error;
          alert(`${formattedData.length} adet kategori başarıyla eklendi.`);
          fetchData();
        } else {
          const newCats = formattedData.map((d: any) => ({ ...d, id: Math.random().toString() }));
          setCategories([...categories, ...newCats]);
          alert("Kategoriler eklendi (Mock Mode)");
        }
      } catch (error: any) {
        console.error("Upload Error:", error);
        alert("Yükleme sırasında bir hata oluştu: " + (error.message || JSON.stringify(error)));
      } finally {
        setBulkUploadLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePersonnelBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUploadLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert("Dosya boş veya okunamadı.");
          setBulkUploadLoading(false);
          return;
        }

        // Map Excel columns to DB columns
        const formattedData = data.map((row: any) => ({
          full_name: row['İsim'],
          tckn: row['TCKN'] ? String(row['TCKN']) : null,
          email: row['E-posta'] ? String(row['E-posta']) : null,
          phone: row['Telefon'] ? String(row['Telefon']) : null,
          birth_date: row['Doğum Tarihi'] ? String(row['Doğum Tarihi']) : null,
          gender: row['Cinsiyet'] ? String(row['Cinsiyet']) : null,
          role: row['Rol'] ? String(row['Rol']) : null,
          location: row['Lokasyon'] ? String(row['Lokasyon']) : null,
          start_date: row['İşe Başlama Tarihi'] ? String(row['İşe Başlama Tarihi']) : null,
          insurance_status: row['Sigorta Durumu'] ? String(row['Sigorta Durumu']) : null,
          complementary_insurance: row['Tamamlayıcı'] ? String(row['Tamamlayıcı']) : null,
          bonus_percentage: row['Hakediş Oranı'] ? Number(row['Hakediş Oranı']) : 0
        })).filter((item: any) => item.full_name && item.full_name.trim() !== '');

        if (formattedData.length === 0) {
          alert("Geçerli personel verisi bulunamadı. 'İsim' sütunu zorunludur. Lütfen şablonu kontrol ediniz.");
          setBulkUploadLoading(false);
          return;
        }

        if (supabase) {
          const { error } = await supabase.from('personnel_definitions').insert(formattedData);

          if (error) {
            // Check for table missing error specifically
            if (error.code === '42P01' || error.message.includes('bonus_percentage')) {
              setPersonnelTableMissing(true);
              setShowSql(true);
              alert("HATA: Veritabanı şemanız güncel değil (Sütun veya tablo eksik). Lütfen sayfadaki SQL kodunu çalıştırın.");
              return;
            }
            console.error("Supabase Error Details:", JSON.stringify(error, null, 2));
            throw new Error(error.message || JSON.stringify(error));
          }
          alert(`${formattedData.length} personel başarıyla eklendi.`);
          fetchData();
        } else {
          // Mock Fallback
          const newPers = formattedData.map((d: any) => ({ ...d, id: Math.random().toString() }));
          setPersonnelList([...personnelList, ...newPers]);
          alert("Personel eklendi (Mock Mode)");
        }
      } catch (error: any) {
        console.error("Personnel Upload Error:", error);
        const msg = error.message || JSON.stringify(error, null, 2);
        alert("Yükleme sırasında bir hata oluştu:\n" + msg);
      } finally {
        setBulkUploadLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };


  // --- Bank Account Handlers ---
  const handleOpenAddBank = () => {
    setEditingAccount(null);
    setIsBankModalOpen(true);
  };

  const handleEditBank = (account: BankAccount) => {
    setEditingAccount(account);
    setIsBankModalOpen(true);
  };

  const handleSaveBank = async () => {
    await fetchData(); // Refresh list after modal save
  };

  const handleDeleteAccount = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Bu banka hesabını silmek istediğinize emin misiniz? İlgili işlemler etkilenebilir.")) return;
    await supabase.from('bank_accounts').delete().eq('id', id);
    fetchData();
  };

  // --- User Handlers ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from('app_users').insert([newUser]);
    if (!error) {
      setNewUser({ username: '', password: '', full_name: '', role: 'User' });
      fetchData();
    } else {
      alert("Kullanıcı eklenirken hata: " + error.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Kullanıcıyı silmek istediğinize emin misiniz?")) return;
    await supabase.from('app_users').delete().eq('id', id);
    fetchData();
  }

  // --- Personnel Handlers ---
  const handleEditPersonnel = (person: Personnel) => {
    setEditingPersonnelId(person.id);
    setNewPersonnel({
      full_name: person.full_name,
      tckn: person.tckn || '',
      email: person.email || '',
      phone: person.phone || '',
      birth_date: person.birth_date || '',
      gender: person.gender || '',
      role: person.role || '',
      location: person.location || '',
      start_date: person.start_date || '',
      insurance_status: person.insurance_status || '',
      complementary_insurance: person.complementary_insurance || '',
      bonus_percentage: person.bonus_percentage || 0
    });
    // Optional: Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditPersonnel = () => {
    setEditingPersonnelId(null);
    setNewPersonnel({
      full_name: '',
      tckn: '',
      email: '',
      phone: '',
      birth_date: '',
      gender: '',
      role: '',
      location: '',
      start_date: '',
      insurance_status: '',
      complementary_insurance: '',
      bonus_percentage: 0
    });
  };

  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (supabase) {
      let error;

      if (editingPersonnelId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('personnel_definitions')
          .update(newPersonnel)
          .eq('id', editingPersonnelId);
        error = updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('personnel_definitions')
          .insert([newPersonnel]);
        error = insertError;
      }

      if (error) {
        if (error.code === '42P01' || error.message.includes('bonus_percentage')) {
          setPersonnelTableMissing(true);
          setShowSql(true);
          alert("HATA: Veritabanında 'bonus_percentage' sütunu eksik. Lütfen sayfada açılan SQL kodunu çalıştırın.");
        } else {
          alert("Personel işlemi sırasında hata: " + (error.message || JSON.stringify(error)));
        }
      } else {
        fetchData();
        handleCancelEditPersonnel(); // Reset form
      }
    } else {
      // Mock
      if (editingPersonnelId) {
        setPersonnelList(personnelList.map(p => p.id === editingPersonnelId ? { ...p, ...newPersonnel } as Personnel : p));
      } else {
        setPersonnelList([...personnelList, { ...newPersonnel, id: Math.random().toString() } as Personnel]);
      }
      handleCancelEditPersonnel();
    }
  };

  const handleDeletePersonnel = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Personeli listeden silmek istediğinize emin misiniz?")) return;

    const { error } = await supabase.from('personnel_definitions').delete().eq('id', id);
    if (error) {
      alert("Silme hatası: " + error.message);
    } else {
      fetchData();
    }
  };

  // --- SQL Setup Helper ---
  const renderSqlSetup = () => (
    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-slate-100 text-slate-500 rounded-lg">
          <Icon name="database" className="text-2xl" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-700 text-lg mb-2">Veritabanı Güncellemesi Gerekli</h3>
            <button onClick={() => setShowSql(false)} className="text-slate-500 hover:text-slate-700"><Icon name="close" /></button>
          </div>
          <p className="text-slate-600 text-sm mb-4">
            'personnel_definitions' tablosu eksik veya yeni eklenen özellikler (Hakediş Oranı) için güncellenmesi gerekiyor.
            Aşağıdaki SQL kodunu Supabase <strong>SQL Editor</strong> bölümünde çalıştırarak sorunu çözebilirsiniz.
          </p>
          <div className="bg-slate-800 text-slate-200 p-4 rounded-lg font-mono text-xs overflow-x-auto relative group">
            <pre>{`-- 1. Tabloyu Oluştur (Eğer yoksa)
create table if not exists public.personnel_definitions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text not null,
  tckn text,
  email text,
  phone text,
  birth_date text,
  gender text,
  role text,
  location text,
  start_date text,
  insurance_status text,
  complementary_insurance text,
  bonus_percentage numeric default 0
);

-- 2. Yeni Sütunu Ekle (Eğer tablo zaten varsa ama sütun yoksa)
alter table public.personnel_definitions add column if not exists bonus_percentage numeric default 0;

-- 3. Güvenlik Politikalarını Aç
alter table public.personnel_definitions enable row level security;

create policy "Public Access" 
on public.personnel_definitions 
for all 
using (true) 
with check (true);`}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(`create table if not exists public.personnel_definitions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text not null,
  tckn text,
  email text,
  phone text,
  birth_date text,
  gender text,
  role text,
  location text,
  start_date text,
  insurance_status text,
  complementary_insurance text,
  bonus_percentage numeric default 0
);
alter table public.personnel_definitions add column if not exists bonus_percentage numeric default 0;
alter table public.personnel_definitions enable row level security;
create policy "Public Access" on public.personnel_definitions for all using (true) with check (true);`)}
              className="absolute top-2 right-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors"
            >
              Kopyala
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="glass-card rounded-2xl border border-white/40 overflow-hidden min-h-[600px]">
        {/* Tabs */}
        <div className="flex border-b border-white/20 overflow-x-auto bg-white/20 backdrop-blur">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'bg-white/40 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-white/20 hover:text-slate-700'
              }`}
          >
            <Icon name="settings" /> Genel Ayarlar
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'categories' ? 'bg-white/40 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-white/20 hover:text-slate-700'
              }`}
          >
            <Icon name="category" /> İşlem Kategorileri
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'accounts' ? 'bg-white/40 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-white/20 hover:text-slate-700'
              }`}
          >
            <Icon name="account_balance" /> Banka Hesapları
          </button>
          <button
            onClick={() => setActiveTab('personnel')}
            className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'personnel' ? 'bg-white/40 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-white/20 hover:text-slate-700'
              }`}
          >
            <Icon name="badge" /> Personel Listesi
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'bg-white/40 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-white/20 hover:text-slate-700'
              }`}
          >
            <Icon name="people" /> Kullanıcılar
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8">

          {/* GENERAL SETTINGS TAB */}
          {activeTab === 'general' && (
            <div className="max-w-xl mx-auto space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800">Uygulama Ayarları</h3>
                <p className="text-slate-500">Uygulama ismini ve logosunu buradan değiştirebilirsiniz.</p>
              </div>

              <form onSubmit={handleSaveGeneral} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Uygulama Adı</label>
                  <div className="relative">
                    <Icon name="badge" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none"
                      placeholder="Şirket veya Uygulama Adı"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Uygulama Logosu</label>
                  <div className="border-2 border-dashed border-white/40 rounded-xl p-8 text-center hover:bg-white/20 transition-colors relative">
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handleLogoUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {logoFile ? (
                      <div className="flex flex-col items-center">
                        <img src={logoFile} alt="Logo Preview" className="h-24 object-contain mb-4" />
                        <p className="text-sm text-slate-600 font-medium">Logo seçildi. Değiştirmek için tıklayın.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Icon name="cloud_upload" className="text-4xl text-slate-400 mb-2" />
                        <p className="text-slate-600 font-medium">Logo yüklemek için tıklayın veya sürükleyin</p>
                        <p className="text-xs text-slate-400 mt-1">PNG veya JPEG (Max 2MB önerilir)</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saveStatus === 'saving'}
                  className="w-full py-4 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-all flex justify-center items-center gap-2"
                >
                  {saveStatus === 'saving' ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                  {saveStatus === 'success' && <Icon name="check" />}
                </button>

                {saveStatus === 'success' && (
                  <p className="text-center text-slate-600 text-sm font-medium">Ayarlar başarıyla güncellendi! Sayfa yenileniyor...</p>
                )}
              </form>
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Single Add */}
                <div className="bg-white/30 backdrop-blur p-6 rounded-xl border border-white/40">
                  <h3 className="font-bold text-slate-800 mb-4">Hızlı Kategori Ekle</h3>
                  <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
                    <input
                      type="text"
                      placeholder="Kategori Adı (Örn: Taksi, Yemek)"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none"
                      required
                    />
                    <div className="flex gap-2">
                      <select
                        value={newCategoryType}
                        onChange={(e) => setNewCategoryType(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none bg-white"
                      >
                        <option value="Gider">Gider</option>
                        <option value="Gelir">Gelir</option>
                        <option value="Diğer">Diğer</option>
                      </select>
                      <button type="submit" className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-all">
                        Ekle
                      </button>
                    </div>
                  </form>
                </div>

                {/* Bulk Upload */}
                <div className="bg-white/30 backdrop-blur p-6 rounded-xl border border-white/40">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-800">Toplu Kategori Yükleme</h3>
                    <div className="p-2 bg-white rounded-lg text-slate-600">
                      <Icon name="table_view" />
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mb-4">Excel (.xlsx) dosyası ile çok sayıda kategoriyi tek seferde sisteme yükleyebilirsiniz.</p>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadCategoryTemplate}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Icon name="download" className="text-lg" />
                      Örnek Şablon
                    </button>
                    <label className={`flex-1 py-2.5 ${bulkUploadLoading ? 'bg-slate-400' : 'bg-slate-800 hover:bg-slate-900'} text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm cursor-pointer`}>
                      <Icon name="upload" className="text-lg" />
                      {bulkUploadLoading ? 'Yükleniyor...' : 'Excel Yükle'}
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        disabled={bulkUploadLoading}
                        onChange={handleBulkUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Icon name="list" className="text-slate-400" />
                  Tanımlı Kategoriler
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-white/40 backdrop-blur border border-white/40 rounded-xl transition-all group hover:bg-white/60">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 rounded-full ${cat.type === 'Gelir' ? 'bg-slate-500' : cat.type === 'Gider' ? 'bg-slate-500' : 'bg-slate-400'}`}></div>
                        <div>
                          <p className="font-semibold text-slate-800">{cat.name}</p>
                          <p className="text-xs text-slate-400">{cat.type}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-300 hover:text-slate-400 transition-colors p-2">
                        <Icon name="delete" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BANK ACCOUNTS TAB */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button onClick={handleOpenAddBank} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2">
                  <Icon name="add_card" /> Yeni Hesap Ekle
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map(account => (
                  <div key={account.id} className="bg-white/40 backdrop-blur p-5 rounded-xl border border-white/40 flex justify-between items-center group hover:bg-white/60 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${account.currency === 'USD' ? 'bg-slate-100 text-slate-600' : account.currency === 'EUR' ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-600'}`}>
                        <Icon name="account_balance" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{account.bankName}</h4>
                        <p className="text-xs text-slate-500">{account.type} • {account.accountNumber}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-bold text-slate-800">{account.currency} {account.balance.toLocaleString()}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditBank(account)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg hover:text-slate-600"><Icon name="edit" className="text-sm" /></button>
                        <button onClick={() => handleDeleteAccount(account.id)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg hover:text-slate-500"><Icon name="delete" className="text-sm" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <BankModal isOpen={isBankModalOpen} onClose={() => setIsBankModalOpen(false)} onSave={handleSaveBank} initialData={editingAccount} />
            </div>
          )}

          {/* PERSONNEL TAB */}
          {activeTab === 'personnel' && (
            <div className="space-y-8">

              {(personnelTableMissing || showSql) && renderSqlSetup()}

              {/* Add/Edit Personnel Form & Upload */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Form */}
                <div className="xl:col-span-2 bg-white/30 backdrop-blur p-6 rounded-xl border border-white/40 relative">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Icon name={editingPersonnelId ? 'edit' : 'person_add'} />
                      {editingPersonnelId ? 'Personel Düzenle' : 'Yeni Personel Kartı'}
                    </h3>
                    <div className="flex gap-3">
                      {editingPersonnelId && (
                        <button
                          onClick={handleCancelEditPersonnel}
                          className="text-xs text-slate-500 hover:text-red-800 font-bold flex items-center gap-1"
                        >
                          <Icon name="close" className="text-xs" /> Vazgeç
                        </button>
                      )}
                      <button
                        onClick={() => setShowSql(!showSql)}
                        className="text-xs text-slate-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <Icon name="database" className="text-xs" /> Veritabanı Kurulumu
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleAddPersonnel} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input required placeholder="İsim Soyisim" value={newPersonnel.full_name} onChange={e => setNewPersonnel({ ...newPersonnel, full_name: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />
                    <input placeholder="TCKN" value={newPersonnel.tckn} onChange={e => setNewPersonnel({ ...newPersonnel, tckn: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />
                    <input placeholder="E-posta" type="email" value={newPersonnel.email} onChange={e => setNewPersonnel({ ...newPersonnel, email: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />
                    <input placeholder="Telefon" value={newPersonnel.phone} onChange={e => setNewPersonnel({ ...newPersonnel, phone: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />

                    <input placeholder="Doğum Tarihi (GG.AA.YYYY)" value={newPersonnel.birth_date} onChange={e => setNewPersonnel({ ...newPersonnel, birth_date: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />
                    <select value={newPersonnel.gender} onChange={e => setNewPersonnel({ ...newPersonnel, gender: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 bg-white outline-none">
                      <option value="">Cinsiyet Seçiniz</option>
                      <option value="Erkek">Erkek</option>
                      <option value="Kadın">Kadın</option>
                    </select>

                    <input placeholder="Rol / Unvan" value={newPersonnel.role} onChange={e => setNewPersonnel({ ...newPersonnel, role: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />
                    <input placeholder="Lokasyon" value={newPersonnel.location} onChange={e => setNewPersonnel({ ...newPersonnel, location: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />

                    <input placeholder="İşe Başlama Tarihi" type="date" value={newPersonnel.start_date} onChange={e => setNewPersonnel({ ...newPersonnel, start_date: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />
                    <input placeholder="Sigorta Durumu" value={newPersonnel.insurance_status} onChange={e => setNewPersonnel({ ...newPersonnel, insurance_status: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />

                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input placeholder="Tamamlayıcı Sağlık Sigortası" value={newPersonnel.complementary_insurance} onChange={e => setNewPersonnel({ ...newPersonnel, complementary_insurance: e.target.value })} className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none" />

                      <div className="relative">
                        <select
                          value={newPersonnel.bonus_percentage || 0}
                          onChange={e => setNewPersonnel({ ...newPersonnel, bonus_percentage: Number(e.target.value) })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 outline-none appearance-none"
                        >
                          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100].map(rate => (
                            <option key={rate} value={rate}>%{rate} - Hakediş Primi</option>
                          ))}
                        </select>
                        <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="sm:col-span-2 mt-2">
                      <button type="submit" className={`w-full py-3 ${editingPersonnelId ? 'bg-slate-600 hover:bg-amber-700' : 'bg-slate-800 hover:bg-slate-900'} text-white rounded-lg font-bold transition-all`}>
                        {editingPersonnelId ? 'Değişiklikleri Kaydet' : 'Personeli Kaydet'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Bulk Upload */}
                <div className="bg-white/30 backdrop-blur p-6 rounded-xl border border-white/40 h-fit">
                  <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><Icon name="upload_file" /> Toplu Personel Yükleme</h3>
                  <p className="text-sm text-slate-700 mb-6">Çok sayıda personeli Excel şablonu ile hızlıca içeri aktarın.</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleDownloadPersonnelTemplate}
                      className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Icon name="download" /> Şablon İndir
                    </button>
                    <label className={`w-full py-3 ${bulkUploadLoading ? 'bg-slate-400' : 'bg-slate-600 hover:bg-blue-700'} text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer`}>
                      <Icon name="upload" />
                      {bulkUploadLoading ? 'Yükleniyor...' : 'Excel Yükle'}
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handlePersonnelBulkUpload} disabled={bulkUploadLoading} />
                    </label>
                  </div>
                </div>
              </div>

              {/* List */}
              <div>
                <h3 className="font-bold text-slate-800 mb-4">Personel Listesi ({personnelList.length})</h3>
                <div className="bg-white/30 backdrop-blur rounded-xl border border-white/40 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-white/20 border-b border-white/20">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">İsim</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">Rol</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">İletişim</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase hidden lg:table-cell">Lokasyon</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase hidden xl:table-cell">Hakediş %</th>
                        <th className="p-4 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {personnelList.map(p => (
                        <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${editingPersonnelId === p.id ? 'bg-slate-50' : ''}`}>
                          <td className="p-4 font-bold text-slate-800">{p.full_name}</td>
                          <td className="p-4 text-sm text-slate-600 hidden sm:table-cell">{p.role || '-'}</td>
                          <td className="p-4 text-sm text-slate-600 hidden md:table-cell">
                            <div className="flex flex-col">
                              <span>{p.email}</span>
                              <span className="text-xs text-slate-400">{p.phone}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600 hidden lg:table-cell">{p.location || '-'}</td>
                          <td className="p-4 text-sm text-slate-800 font-bold hidden xl:table-cell">%{p.bonus_percentage || 0}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEditPersonnel(p)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-50 transition-all" title="Düzenle">
                                <Icon name="edit" />
                              </button>
                              <button onClick={() => handleDeletePersonnel(p.id)} className="text-slate-400 hover:text-slate-400 p-2 rounded-lg hover:bg-slate-50 transition-all" title="Sil">
                                <Icon name="delete" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {personnelList.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Henüz personel eklenmemiş.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="space-y-8">
              <div className="bg-white/30 backdrop-blur p-6 rounded-xl border border-white/40">
                <h3 className="font-bold text-slate-800 mb-4">Yeni Kullanıcı Ekle</h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Kullanıcı Adı"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                    className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Şifre"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    value={newUser.full_name}
                    onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="px-4 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-400 outline-none"
                    required
                  />
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white outline-none"
                  >
                    <option value="User">Kullanıcı</option>
                    <option value="Admin">Yönetici</option>
                    <option value="Viewer">İzleyici</option>
                  </select>
                  <div className="md:col-span-2">
                    <button type="submit" className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900">Kullanıcı Oluştur</button>
                  </div>
                </form>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4">Sistem Kullanıcıları</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map(u => (
                    <div key={u.id} className="bg-white/40 backdrop-blur p-4 rounded-xl border border-white/40 flex items-center justify-between group hover:bg-white/60 transition-all">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.full_name}&background=random`}
                          alt={u.username}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="font-bold text-slate-800">{u.full_name}</p>
                          <p className="text-xs text-slate-500">@{u.username} • {u.role}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-300 hover:text-slate-400 hover:bg-slate-50 rounded-lg transition-all"><Icon name="delete" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
