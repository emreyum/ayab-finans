
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, TransactionStatus, Personnel } from '../types';
import { Icon } from './Icons';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils';

declare const XLSX: any;

interface PersonnelPageProps {
    transactions: Transaction[];
    onDataChange: () => Promise<void>;
}

interface QuarterlyStat {
    year: number;
    quarter: number;
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    shareAmount: number;
    transactionCount: number;
}

interface PersonnelSummary extends Personnel {
    totalIncome: number;
    totalExpense: number;

    totalDebt: number;
    totalReceivable: number;
    currentAccountBalance: number;

    transactionCount: number;
    lastTransactionDate: string;
    currentYearShare: number;
    quarterlyStats: QuarterlyStat[];
}

type SortOption = 'name-asc' | 'name-desc' | 'count-desc';
type ViewMode = 'performance' | 'current_account';

export const PersonnelPage: React.FC<PersonnelPageProps> = ({ transactions, onDataChange }) => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<PersonnelSummary | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('current_account');
    const [searchTerm, setSearchTerm] = useState('');
    const [groupSort, setGroupSort] = useState<SortOption>('name-asc');
    const [expandedQuarter, setExpandedQuarter] = useState<string | null>(null);

    useEffect(() => {
        const fetchPersonnel = async () => {
            if (supabase) {
                const { data, error } = await supabase.from('personnel_definitions').select('*').order('full_name');
                if (error) {
                    console.warn("Personnel definitions table missing or error:", error.message);
                    setPersonnelList([
                        { id: '1', full_name: 'Av. Mehmet Yılmaz', role: 'Kıdemli Avukat', bonus_percentage: 40 },
                        { id: '2', full_name: 'Stj. Ali Veli', role: 'Stajyer', bonus_percentage: 0 }
                    ]);
                } else if (data) {
                    setPersonnelList(data);
                }
            } else {
                setPersonnelList([
                    { id: '1', full_name: 'Av. Mehmet Yılmaz', role: 'Kıdemli Avukat', bonus_percentage: 40 },
                    { id: '2', full_name: 'Stj. Ali Veli', role: 'Stajyer', bonus_percentage: 10 }
                ]);
            }
        };
        fetchPersonnel();
    }, []);

    const summaries = useMemo<PersonnelSummary[]>(() => {
        return personnelList.map(person => {
            const personTransactions = transactions.filter(t =>
                t.personnel === person.full_name && t.status !== TransactionStatus.REJECTED
            );

            const income = personTransactions
                .filter(t => t.type === TransactionType.INCOME)
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const expense = personTransactions
                .filter(t => t.type === TransactionType.EXPENSE)
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const debt = personTransactions
                .filter(t => t.type === TransactionType.DEBT)
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const receivable = personTransactions
                .filter(t => t.type === TransactionType.RECEIVABLE)
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const accountBalance = debt - receivable;
            const sortedDates = personTransactions.map(t => t.date).sort().reverse();

            const statsMap: { [key: string]: QuarterlyStat } = {};
            const currentYear = new Date().getFullYear();
            const bonusRate = (person.bonus_percentage || 0) / 100;

            personTransactions.forEach(t => {
                const d = new Date(t.date);
                const year = d.getFullYear();
                const quarter = Math.floor(d.getMonth() / 3) + 1;
                const key = `${year}-Q${quarter}`;

                if (!statsMap[key]) {
                    statsMap[key] = {
                        year,
                        quarter,
                        totalIncome: 0,
                        totalExpense: 0,
                        netBalance: 0,
                        shareAmount: 0,
                        transactionCount: 0
                    };
                }

                const stat = statsMap[key];
                if (t.type === TransactionType.INCOME) {
                    stat.totalIncome += Number(t.amount);
                } else if (t.type === TransactionType.EXPENSE) {
                    stat.totalExpense += Number(t.amount);
                }
                stat.transactionCount += 1;
            });

            const quarterlyStats: QuarterlyStat[] = Object.values(statsMap).map(stat => {
                const net = stat.totalIncome - stat.totalExpense;
                return {
                    ...stat,
                    netBalance: net,
                    shareAmount: net * bonusRate
                };
            }).sort((a, b) => {
                if (b.year !== a.year) return b.year - a.year;
                return b.quarter - a.quarter;
            });

            const currentYearShare = quarterlyStats
                .filter(q => q.year === currentYear)
                .reduce((sum, q) => sum + q.shareAmount, 0);

            return {
                ...person,
                totalIncome: income,
                totalExpense: expense,
                totalDebt: debt,
                totalReceivable: receivable,
                currentAccountBalance: accountBalance,
                transactionCount: personTransactions.length,
                lastTransactionDate: sortedDates[0] || '-',
                quarterlyStats,
                currentYearShare
            } as PersonnelSummary;
        }).filter(p => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [personnelList, transactions, searchTerm]);

    const { operationalTransactions, financialTransactions } = useMemo(() => {
        if (!selectedPerson) return { operationalTransactions: [], financialTransactions: [] };

        const all = transactions
            .filter(t => t.personnel === selectedPerson.full_name && t.status !== TransactionStatus.REJECTED)
            .sort((a, b) => b.date.localeCompare(a.date));

        const financial = all.filter(t =>
            t.type === TransactionType.DEBT ||
            t.type === TransactionType.RECEIVABLE ||
            t.type === TransactionType.CURRENT
        );

        const operational = all.filter(t =>
            t.type === TransactionType.INCOME ||
            t.type === TransactionType.EXPENSE
        );

        return { operationalTransactions: operational, financialTransactions: financial };
    }, [selectedPerson, transactions]);

    const sortedPersonnel = useMemo(() => {
        const sorted = [...summaries];
        if (groupSort === 'name-asc') sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'));
        if (groupSort === 'name-desc') sorted.sort((a, b) => b.full_name.localeCompare(a.full_name, 'tr'));
        if (groupSort === 'count-desc') sorted.sort((a, b) => b.transactionCount - a.transactionCount);
        return sorted;
    }, [summaries, groupSort]);

    const toggleQuarter = (key: string) => {
        if (expandedQuarter === key) {
            setExpandedQuarter(null);
        } else {
            setExpandedQuarter(key);
        }
    };

    const handleBackToList = () => {
        setSelectedPerson(null);
        setViewMode('current_account');
        setExpandedQuarter(null);
    };

    const getTransactionsForQuarter = (year: number, quarter: number) => {
        if (!selectedPerson) return [];

        return operationalTransactions.filter(t => {
            const d = new Date(t.date);
            const tYear = d.getFullYear();
            const tQuarter = Math.floor(d.getMonth() / 3) + 1;
            return tYear === year && tQuarter === quarter;
        });
    };

    const handleQuarterExport = (e: React.MouseEvent, stat: QuarterlyStat) => {
        e.stopPropagation();
        if (!selectedPerson) return;

        const quarterTransactions = getTransactionsForQuarter(stat.year, stat.quarter);

        const summaryData = [{
            "Personel": selectedPerson.full_name,
            "Dönem": `${stat.year} - ${stat.quarter}. Çeyrek`,
            "Toplam Gelir": stat.totalIncome,
            "Toplam Gider": stat.totalExpense,
            "Net Ofis Kârı": stat.netBalance,
            "Hakediş Oranı": `%${selectedPerson.bonus_percentage}`,
            "Hakediş (%40'lar) Tutarı": stat.shareAmount
        }];

        const detailData = quarterTransactions.map(t => ({
            "Tarih": formatDate(t.date),
            "İşlem No": t.transactionNumber,
            "Tür": t.type,
            "Kategori": t.category,
            "Açıklama": t.description,
            "Müvekkil/Muhatap": t.client || t.counterparty,
            "Tutar": t.amount
        }));

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Ozet");

        const wsDetail = XLSX.utils.json_to_sheet(detailData);
        wsDetail['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsDetail, "Islem_Dokumu");

        const safeName = selectedPerson.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        XLSX.writeFile(wb, `${safeName}_${stat.year}_Q${stat.quarter}_hakedis.xlsx`);
    };

    const handleFinancialExport = () => {
        if (!selectedPerson) return;

        const dataToExport = financialTransactions.map(t => ({
            "Tarih": formatDate(t.date),
            "İşlem No": t.transactionNumber,
            "Tür": t.type,
            "Açıklama": t.description,
            "Kategori": t.category,
            "Tutar": t.amount
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }];

        XLSX.utils.book_append_sheet(wb, ws, "Cari_Hareketler");
        const safeName = selectedPerson.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        XLSX.writeFile(wb, `${safeName}_cari_hesap_dokumu.xlsx`);
    };

    const getRoleIcon = (roleName: string) => {
        const lower = (roleName || '').toLowerCase();
        if (lower.includes('avukat') || lower.includes('hukuk')) return 'gavel';
        if (lower.includes('staj')) return 'school';
        if (lower.includes('tahsilat') || lower.includes('muhasebe') || lower.includes('finans')) return 'account_balance_wallet';
        if (lower.includes('sekreter') || lower.includes('asistan') || lower.includes('katip')) return 'support_agent';
        if (lower.includes('yönet') || lower.includes('admin') || lower.includes('ortak')) return 'admin_panel_settings';
        return 'badge';
    };

    // ── Detail View ──
    if (selectedPerson) {
        return (
            <div className="space-y-6 pb-20">
                {/* Back + Header */}
                <div className="glass-card rounded-2xl p-6 border border-white/40" style={{ animationDelay: '0s' }} >
                    <div className="flex items-center justify-between mb-5">
                        <button onClick={handleBackToList} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm">
                            <span className="material-icons text-lg">arrow_back</span>
                            <span className="font-medium">Listeye Dön</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-white/60 backdrop-blur text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wide border border-white/40">{selectedPerson.role || 'Personel'}</span>
                            {selectedPerson.bonus_percentage && selectedPerson.bonus_percentage > 0 ? (
                                <span className="px-3 py-1 bg-white/60 backdrop-blur text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wide border border-white/40">%{selectedPerson.bonus_percentage} Prim</span>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                                {selectedPerson.full_name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedPerson.full_name}</h2>
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                    {selectedPerson.phone && <span className="flex items-center gap-1"><span className="material-icons text-[12px]">phone</span>{selectedPerson.phone}</span>}
                                    {selectedPerson.email && <span className="flex items-center gap-1"><span className="material-icons text-[12px]">email</span>{selectedPerson.email}</span>}
                                    <span className="flex items-center gap-1"><span className="material-icons text-[12px]">receipt</span>{selectedPerson.transactionCount} İşlem</span>
                                </div>
                            </div>
                        </div>

                        {/* View Mode Tabs */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('current_account')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'current_account'
                                        ? 'bg-slate-800 text-white shadow-lg'
                                        : 'bg-white/60 text-slate-500 hover:bg-white border border-white/40'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="material-icons text-sm">account_balance_wallet</span>
                                    Cari Hesap
                                </span>
                            </button>
                            <button
                                onClick={() => setViewMode('performance')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'performance'
                                        ? 'bg-slate-800 text-white shadow-lg'
                                        : 'bg-white/60 text-slate-500 hover:bg-white border border-white/40'
                                    }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="material-icons text-sm">verified</span>
                                    %40'lar Raporu
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card rounded-xl p-4 border border-white/40">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cari Bakiye</p>
                        <p className={`text-xl font-bold mt-1 ${selectedPerson.currentAccountBalance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            ₺{selectedPerson.currentAccountBalance.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{selectedPerson.currentAccountBalance < 0 ? 'Borçlu' : 'Alacaklı'}</p>
                    </div>
                    <div className="glass-card rounded-xl p-4 border border-white/40">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dosya Geliri</p>
                        <p className="text-xl font-bold mt-1 text-slate-800">₺{selectedPerson.totalIncome.toLocaleString()}</p>
                    </div>
                    <div className="glass-card rounded-xl p-4 border border-white/40">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dosya Gideri</p>
                        <p className="text-xl font-bold mt-1 text-slate-500">₺{selectedPerson.totalExpense.toLocaleString()}</p>
                    </div>
                    <div className="glass-card rounded-xl p-4 border border-white/40">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Yıllık Hakediş</p>
                        <p className="text-xl font-bold mt-1 text-indigo-600">₺{selectedPerson.currentYearShare.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'performance' ? (
                    <div className="glass-card rounded-2xl border border-white/40 overflow-hidden">
                        {/* Explainer */}
                        <div className="px-6 py-4 border-b border-white/20 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                            <p className="text-xs text-slate-600">
                                <span className="font-bold">Hesaplama:</span> (Dosya Geliri − Dosya Gideri) × %{selectedPerson.bonus_percentage || 0} = Hakediş
                            </p>
                        </div>

                        {/* Quarter Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Dönem</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">İşlem</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Gelir</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Gider</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Net Kâr</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">%{selectedPerson.bonus_percentage} Hakediş</th>
                                        <th className="px-4 py-3 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedPerson.quarterlyStats.map((q) => {
                                        const key = `${q.year}-Q${q.quarter}`;
                                        const isExpanded = expandedQuarter === key;

                                        return (
                                            <React.Fragment key={key}>
                                                <tr
                                                    onClick={() => toggleQuarter(key)}
                                                    className={`cursor-pointer transition-all border-b border-white/10 ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-white/40'}`}
                                                >
                                                    <td className="px-6 py-3.5 font-bold text-slate-700 flex items-center gap-2">
                                                        <span className="material-icons text-slate-400 text-base">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                                        {q.year} - {q.quarter}. Çeyrek
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className="px-2 py-0.5 bg-white/60 rounded text-[10px] font-bold text-slate-500 border border-white/40">{q.transactionCount}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right text-slate-600 font-medium">₺{q.totalIncome.toLocaleString()}</td>
                                                    <td className="px-4 py-3.5 text-right text-slate-400 font-medium">₺{q.totalExpense.toLocaleString()}</td>
                                                    <td className="px-4 py-3.5 text-right font-bold text-slate-800">₺{q.netBalance.toLocaleString()}</td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <span className={`font-bold text-base ${q.shareAmount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            ₺{q.shareAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <button
                                                            onClick={(e) => handleQuarterExport(e, q)}
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors"
                                                        >
                                                            <span className="material-icons text-xs">download</span> Excel
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={7} className="p-4 bg-slate-50/50">
                                                            <div className="glass-card rounded-xl border border-white/40 overflow-hidden">
                                                                <div className="px-4 py-2 bg-white/40 border-b border-white/20 flex justify-between">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{key} İşlem Dökümü</span>
                                                                    <span className="text-[10px] text-slate-400">{q.transactionCount} kayıt</span>
                                                                </div>
                                                                <table className="w-full text-left text-xs">
                                                                    <thead>
                                                                        <tr className="border-b border-white/20 text-slate-400">
                                                                            <th className="px-4 py-2 font-bold text-[10px]">Tarih</th>
                                                                            <th className="px-4 py-2 font-bold text-[10px]">Açıklama</th>
                                                                            <th className="px-4 py-2 font-bold text-[10px]">Müvekkil</th>
                                                                            <th className="px-4 py-2 font-bold text-[10px] text-right">Tutar</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {getTransactionsForQuarter(q.year, q.quarter).map(t => (
                                                                            <tr key={t.id} className="hover:bg-white/30 transition-colors border-b border-white/10">
                                                                                <td className="px-4 py-2 text-slate-500 font-mono">{formatDate(t.date)}</td>
                                                                                <td className="px-4 py-2 text-slate-700">{t.description}</td>
                                                                                <td className="px-4 py-2 text-slate-500">{t.client || t.counterparty || '-'}</td>
                                                                                <td className={`px-4 py-2 font-bold text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-400'}`}>
                                                                                    {t.type === TransactionType.INCOME ? '+' : '-'} ₺{t.amount.toLocaleString()}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                {selectedPerson.quarterlyStats.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200/50 bg-white/30">
                                            <td colSpan={5} className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-xs">Genel Toplam</td>
                                            <td className="px-4 py-4 text-right font-bold text-lg text-indigo-600">
                                                ₺{selectedPerson.quarterlyStats.reduce((acc, curr) => acc + curr.shareAmount, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card rounded-2xl border border-white/40 overflow-hidden">
                        {/* Cari Header */}
                        <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <span className="material-icons text-indigo-500 text-lg">account_balance_wallet</span>
                                    Cari Hesap Hareketleri
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Borç, alacak ve avans işlemleri</p>
                            </div>
                            <button
                                onClick={handleFinancialExport}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                            >
                                <span className="material-icons text-sm">download</span> Excel
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Tarih</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Tür</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Açıklama</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Kategori</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financialTransactions.map((t) => {
                                        const isDebt = t.type === TransactionType.DEBT || (t.type === TransactionType.CURRENT && t.amount > 0);
                                        return (
                                            <tr key={t.id} className="hover:bg-white/30 transition-colors border-b border-white/10">
                                                <td className="px-6 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{formatDate(t.date)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${t.type === TransactionType.DEBT ? 'bg-orange-50/80 text-orange-600 border-orange-200/50' :
                                                            t.type === TransactionType.RECEIVABLE ? 'bg-emerald-50/80 text-emerald-600 border-emerald-200/50' :
                                                                'bg-indigo-50/80 text-indigo-600 border-indigo-200/50'
                                                        }`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-700">{t.description}</td>
                                                <td className="px-4 py-3 text-xs text-slate-400">{t.category}</td>
                                                <td className={`px-4 py-3 text-right font-bold text-xs ${isDebt ? 'text-orange-500' : 'text-emerald-600'}`}>
                                                    {isDebt ? '(Borç) +' : '(Alacak) -'} ₺{Math.abs(t.amount).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200/50 bg-white/30">
                                        <td colSpan={4} className="px-6 py-3 text-right font-bold text-slate-500 uppercase text-xs">Güncel Bakiye</td>
                                        <td className={`px-4 py-3 text-right font-bold text-base ${selectedPerson.currentAccountBalance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                            ₺{selectedPerson.currentAccountBalance.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── List View ──
    return (
        <div className="space-y-6 pb-20">
            {/* Search + Sort */}
            <div className="glass-card rounded-2xl p-4 border border-white/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex gap-3 w-full sm:w-auto flex-1">
                    <div className="relative flex-1 sm:max-w-xs">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Personel ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/60 backdrop-blur border border-white/40 rounded-xl focus:ring-1 focus:ring-slate-300 outline-none text-sm text-slate-600 placeholder-slate-400"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={groupSort}
                            onChange={(e) => setGroupSort(e.target.value as SortOption)}
                            className="pl-3 pr-8 py-2 bg-white/60 backdrop-blur border border-white/40 rounded-xl focus:ring-1 focus:ring-slate-300 outline-none text-xs font-medium text-slate-600 appearance-none cursor-pointer"
                        >
                            <option value="name-asc">İsim (A-Z)</option>
                            <option value="name-desc">İsim (Z-A)</option>
                            <option value="count-desc">İşlem Sayısı</option>
                        </select>
                        <span className="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">expand_more</span>
                    </div>
                </div>
                <span className="text-xs text-slate-400">Toplam <strong className="text-slate-700">{summaries.length}</strong> Personel</span>
            </div>

            {/* Personnel Grid */}
            {sortedPersonnel.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sortedPersonnel.map((person, idx) => (
                        <div
                            key={person.id}
                            onClick={() => { setSelectedPerson(person); setViewMode('current_account'); }}
                            className="glass-card rounded-2xl p-5 border border-white/40 cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all group"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center text-sm font-bold shadow">
                                    {person.full_name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate group-hover:text-slate-900">{person.full_name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                            <span className="material-icons text-[10px]">{getRoleIcon(person.role || '')}</span>
                                            {person.role || 'Personel'}
                                        </span>
                                        {person.bonus_percentage && person.bonus_percentage > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50/80 text-indigo-500 rounded font-bold border border-indigo-100/50">%{person.bonus_percentage}</span>
                                        )}
                                    </div>
                                </div>
                                <span className="material-icons text-slate-300 group-hover:text-slate-500 transition-colors text-lg">chevron_right</span>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/40 rounded-lg p-2.5 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Cari</p>
                                    <p className={`text-sm font-bold mt-0.5 ${person.currentAccountBalance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                        ₺{person.currentAccountBalance.toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-white/40 rounded-lg p-2.5 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">İşlem</p>
                                    <p className="text-sm font-bold mt-0.5 text-slate-700">{person.transactionCount}</p>
                                </div>
                                <div className="bg-white/40 rounded-lg p-2.5 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Hakediş</p>
                                    <p className="text-sm font-bold mt-0.5 text-indigo-600">₺{person.currentYearShare.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>

                            {/* Last Activity */}
                            {person.lastTransactionDate !== '-' && (
                                <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-1 text-[10px] text-slate-400">
                                    <span className="material-icons text-[10px]">schedule</span>
                                    Son: {formatDate(person.lastTransactionDate)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card rounded-2xl p-12 text-center border border-white/40">
                    <div className="w-16 h-16 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="material-icons text-3xl text-slate-300">person_off</span>
                    </div>
                    <p className="text-slate-500 font-medium">Kayıtlı personel bulunamadı.</p>
                    <p className="text-xs text-slate-400 mt-1">Ayarlar sayfasından personel ekleyebilirsiniz.</p>
                </div>
            )}
        </div>
    );
};