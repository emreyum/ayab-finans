
import { BankAccount, DashboardStats, Expense, Receivable, Transaction, TransactionStatus, TransactionType } from '../types';

export const MOCK_STATS: DashboardStats = {
  totalIncome: 250000,
  incomeGrowth: 12,
  pendingInvoicesTotal: 45500,
  pendingInvoicesCount: 12,
  expensesTotal: 78200,
  expensesGrowth: 5,
  cashBalance: 12450
};

export const MOCK_ACCOUNTS: BankAccount[] = [
  {
    id: '1',
    bankName: 'Garanti Bankası',
    accountNumber: 'TR...1234',
    balance: 110800.00,
    currency: 'TRY',
    type: 'Vadesiz TL Hesabı'
  },
  {
    id: '2',
    bankName: 'İş Bankası',
    accountNumber: 'TR...5678',
    balance: 15250.00,
    currency: 'USD',
    type: 'Vadesiz USD Hesabı'
  },
  {
    id: '6',
    bankName: 'Ofis Kasa',
    accountNumber: '-',
    balance: 2450.00,
    currency: 'TRY',
    type: 'Nakit Kasa'
  }
];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: '1',
    lawyerName: 'Av. Ayşe Çelik',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtZKcH7EIZGfPp0Efx6qdj-YlPuO5Ke-bgYCmzJ9DGWjxKFOdKamKV9NOaSymjF09-nMjNr_UxN71c_4KHySz3-YVeUY6oQRMkC1CHA18g330sc4sS2juW3kufyuqq_wBDxvIB_EMB0N81q03wAEe21QXAmblFmdPMAGoor9qNgnujk6VM7EuPafsag1p-Hv3_KWLiHT_aNsXRTji3kJMHB4raMZrQGuSWziTq1QUnxF31xovkj60WqB19Ze2yC_lBGqjWIp8I16g',
    description: 'Gider: Ulaşım Masrafı',
    amount: 250.00,
    status: TransactionStatus.APPROVED,
    currency: 'TRY'
  }
];

export const MOCK_RECEIVABLES: Receivable[] = [
  {
    id: '1',
    clientName: 'Tekno A.Ş.',
    invoiceNo: '2024001',
    amount: 15000,
    dueDate: '2024-11-28',
    isOverdue: false,
    companyType: 'Tech'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    transactionNumber: 'TRX-7829',
    date: '2024-11-24',
    description: 'Dava Dosya Harcı',
    category: 'Mahkeme Giderleri',
    amount: 1250.00,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.APPROVED,
    method: 'Banka Kartı',
    counterparty: 'İstanbul Adliyesi',
    account: 'Garanti Bankası',
    client: 'Tekno A.Ş.',
    group: 'Dava',
    personnel: 'Av. Mehmet Yılmaz'
  },
  {
    id: '2',
    transactionNumber: 'TRX-7830',
    date: '2024-11-24',
    description: 'Danışmanlık Hizmeti Ödemesi',
    category: 'Hizmet Geliri',
    amount: 5000.00,
    type: TransactionType.INCOME,
    status: TransactionStatus.APPROVED,
    method: 'Havale/EFT',
    counterparty: 'Ahmet Yılmaz',
    account: 'İş Bankası',
    client: 'Ahmet Yılmaz',
    group: 'Danışmanlık',
    personnel: 'Av. Ayşe Çelik'
  },
  {
    id: '3',
    transactionNumber: 'TRX-7831',
    date: '2024-11-23',
    description: 'Ofis Kirası (Kasım)',
    category: 'Kira',
    amount: 12000.00,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.APPROVED,
    method: 'Otomatik Ödeme',
    counterparty: 'Plaza Yönetimi',
    account: 'Garanti Bankası',
    client: '-',
    group: 'Ofis',
    personnel: 'Yönetim'
  }
];
