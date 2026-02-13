
import React from 'react';
import { NavItem, OrganizationSettings } from '../types';
import { Icon } from './Icons';

const MENU_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Anasayfa', icon: 'widgets', href: '#' },
  { id: 'transactions', label: 'İşlemler', icon: 'sync_alt', href: '#' },
  { id: 'workflow', label: 'İş Akışı', icon: 'list_alt', href: '#' },
  { id: 'clients', label: 'Müvekkiller', icon: 'groups', href: '#' },
  { id: 'accounts', label: 'Hesap/Avans', icon: 'account_balance_wallet', href: '#' },
  { id: 'personnel', label: 'Personel Hesapları', icon: 'work', href: '#' },
  { id: 'bank', label: 'Kasa ve Banka', icon: 'account_balance', href: '#' },
  { id: 'reports', label: 'Raporlar', icon: 'assessment', href: '#' },
  { id: 'activity', label: 'Aktivite Kayıtları', icon: 'history', href: '#' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'admin', label: 'Yönetim', icon: 'shield', href: '#' },
  { id: 'settings', label: 'Ayarlar', icon: 'settings', href: '#' },
  { id: 'help', label: 'Kılavuz', icon: 'help_outline', href: '#' },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  appSettings?: OrganizationSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, appSettings }) => {
  return (
    <aside className="w-60 bg-white h-full hidden lg:flex flex-col border-r border-slate-200 sticky top-0 overflow-y-auto no-scrollbar">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-100">
        {appSettings?.logo_url ? (
          <img src={appSettings.logo_url} alt="Logo" className="w-8 h-8 object-contain" />
        ) : (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M20 80 L40 20 L50 35 L35 80 H20Z" fill="#334155" />
              <path d="M45 45 Q55 65 65 60 Q75 55 70 40" stroke="#334155" strokeWidth="8" fill="none" />
              <path d="M60 70 L80 20" stroke="#334155" strokeWidth="8" strokeLinecap="square" />
            </svg>
          </div>
        )}
        <span className="font-semibold text-lg text-slate-800 tracking-tight truncate">
          {(appSettings?.app_name === 'HukukFinans' || !appSettings?.app_name) ? 'AYAB Finans' : appSettings.app_name}
        </span>
      </div>

      <div className="flex-1 px-3 py-4 space-y-0.5">
        {MENU_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              onTabChange(item.id);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-[13px] ${activeTab === item.id
              ? 'bg-slate-100 text-slate-900 font-medium'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
          >
            <Icon
              name={item.icon}
              className={`text-[20px] ${activeTab === item.id ? 'text-slate-700' : 'text-slate-400'}`}
            />
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      <div className="px-3 py-3 border-t border-slate-100 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              onTabChange(item.id);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-[13px] ${activeTab === item.id
              ? 'bg-slate-100 text-slate-900 font-medium'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
          >
            <Icon
              name={item.icon}
              className={`text-[20px] ${activeTab === item.id ? 'text-slate-700' : 'text-slate-400'}`}
            />
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
};
