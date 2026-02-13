-- ============================================================
-- AYAB FİNANS - Supabase Veritabanı Kurulum SQL'i
-- Bu dosyanın TAMAMINI Supabase SQL Editor'de çalıştırın.
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- 1. ORGANIZATION SETTINGS (Uygulama Ayarları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  app_name text DEFAULT 'AYAB Finans',
  logo_url text
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_settings_public" ON public.organization_settings FOR ALL USING (true) WITH CHECK (true);

-- Başlangıç verisi
INSERT INTO public.organization_settings (app_name) 
SELECT 'AYAB Finans' 
WHERE NOT EXISTS (SELECT 1 FROM public.organization_settings);

-- ============================================================
-- 2. CATEGORIES (Gelir/Gider Kategorileri)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'Gider'
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- Başlangıç kategorileri
INSERT INTO public.categories (name, type) VALUES
  ('Dava Geliri', 'Gelir'),
  ('Danışmanlık Geliri', 'Gelir'),
  ('İcra Geliri', 'Gelir'),
  ('Arabuluculuk Geliri', 'Gelir'),
  ('Diğer Gelir', 'Gelir'),
  ('Maaş', 'Gider'),
  ('Kira', 'Gider'),
  ('Ofis Giderleri', 'Gider'),
  ('Ulaşım', 'Gider'),
  ('Yemek', 'Gider'),
  ('Vergi / SGK', 'Gider'),
  ('Avukatlık Barışı', 'Gider'),
  ('Posta / Kargo', 'Gider'),
  ('Diğer Gider', 'Gider')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. BANK DEFINITIONS (Banka Tanımları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  name text NOT NULL UNIQUE
);

ALTER TABLE public.bank_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_defs_public" ON public.bank_definitions FOR ALL USING (true) WITH CHECK (true);

-- Türkiye'deki yaygın bankalar
INSERT INTO public.bank_definitions (name) VALUES
  ('Garanti BBVA'),
  ('İş Bankası'),
  ('Yapı Kredi'),
  ('Ziraat Bankası'),
  ('Halkbank'),
  ('Vakıfbank'),
  ('Akbank'),
  ('QNB Finansbank'),
  ('Denizbank'),
  ('TEB'),
  ('ING'),
  ('HSBC'),
  ('Şekerbank'),
  ('Enpara')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. BANK ACCOUNTS (Banka Hesapları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  bank_name text NOT NULL,
  account_number text,
  balance numeric DEFAULT 0,
  currency text DEFAULT 'TRY',
  type text DEFAULT 'Vadesiz'
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_public" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true);

-- Örnek hesaplar
INSERT INTO public.bank_accounts (bank_name, account_number, balance, currency, type) VALUES
  ('Garanti BBVA', 'TR12 0006 2000 0000 0000 0001', 0, 'TRY', 'Vadesiz TL'),
  ('İş Bankası', 'TR34 0006 4000 0000 0000 0002', 0, 'TRY', 'Vadesiz TL'),
  ('Ofis Kasa', 'KASA-001', 0, 'TRY', 'Nakit Kasa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. TRANSACTIONS (İşlemler / Finansal Hareketler)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  transaction_number text,
  date text,
  description text,
  category text,
  amount numeric DEFAULT 0,
  type text DEFAULT 'Gider',
  status text DEFAULT 'Onaylandı',
  method text DEFAULT 'Havale/EFT',
  counterparty text,
  account text,
  client text,
  "group" text,
  personnel text
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_public" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. APP USERS (Uygulama Kullanıcıları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  username text NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'User',
  avatar_url text
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_users_public" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- Varsayılan admin kullanıcı
INSERT INTO public.app_users (username, full_name, role) VALUES
  ('admin', 'Yönetici', 'Admin')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. PERSONNEL DEFINITIONS (Personel Tanımları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.personnel_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  full_name text NOT NULL,
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
  bonus_percentage numeric DEFAULT 0
);

ALTER TABLE public.personnel_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personnel_public" ON public.personnel_definitions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 8. TRANSACTION IMPORT TEMPLATES (Excel Import Şablonları)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transaction_import_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  name text NOT NULL,
  mapping jsonb DEFAULT '{}'
);

ALTER TABLE public.transaction_import_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_public" ON public.transaction_import_templates FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- KURULUM TAMAMLANDI ✅
-- Tüm tablolar ve güvenlik politikaları oluşturuldu.
-- ============================================================
