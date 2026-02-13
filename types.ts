

export enum TransactionStatus {
  APPROVED = 'Onaylandı',
  PENDING = 'İnceleniyor',
  REJECTED = 'Reddedildi'
}

export enum TransactionType {
  INCOME = 'Gelir',
  EXPENSE = 'Gider',
  RECEIVABLE = 'Alacak',
  DEBT = 'Borç',
  CURRENT = 'Cari'
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  currency: 'TRY' | 'USD' | 'EUR';
  type: string;
}

export interface Expense {
  id: string;
  lawyerName: string;
  avatarUrl: string;
  description: string;
  amount: number;
  status: TransactionStatus;
  currency: string;
}

export interface Receivable {
  id: string;
  clientName: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  isOverdue: boolean;
  companyType: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string; // Yeni: İşlem Numarası (Otomatik)
  date: string;
  // time alanı kaldırıldı
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  method: string;
  counterparty: string;
  
  // Yeni Alanlar
  account?: string;
  client?: string;
  group?: string;
  personnel?: string;
}

export interface ClientSummary {
  name: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  lastTransactionDate: string;
  projectCount: number;
  transactionCount: number;
  groups: string[];
}

export interface GroupSummary {
  name: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  clientCount: number;
  transactionCount: number;
  clients: string[];
  lastTransactionDate: string;
}

export interface DashboardStats {
  totalIncome: number;
  incomeGrowth: number;
  pendingInvoicesTotal: number;
  pendingInvoicesCount: number;
  expensesTotal: number;
  expensesGrowth: number;
  cashBalance: number;
}

export interface NavItem {
  label: string;
  icon: string;
  href: string;
  id: string;
}

// Settings Types
export interface Category {
  id: string;
  name: string;
  type: string;
}

export interface BankDefinition {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

export interface Personnel {
  id: string;
  full_name: string; // İsim (Zorunlu)
  tckn?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  role?: string; // Rol (Eski title yerine)
  location?: string;
  start_date?: string;
  insurance_status?: string;
  complementary_insurance?: string;
  title?: string; // Geriye dönük uyumluluk için (opsiyonel)
  bonus_percentage?: number; // Hakediş/Prim Oranı (%)
}

export interface OrganizationSettings {
  id?: string;
  app_name: string;
  logo_url?: string;
}

export interface ImportTemplate {
  id: string;
  name: string;
  mapping: Record<string, string>; // AppFieldKey -> ExcelColumnHeader
}