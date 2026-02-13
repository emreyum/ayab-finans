
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
    <aside className="w-64 bg-white h-full hidden lg:flex flex-col border-r border-gray-100 sticky top-0 overflow-y-auto no-scrollbar">
      <div className="p-6 flex items-center gap-3">
        {appSettings?.logo_url ? (
          <img src={appSettings.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
        ) : (
          <div className="w-10 h-10 flex items-center justify-center">
            {/* Stylized AYAB Logo SVG */}
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M20 80 L40 20 L50 35 L35 80 H20Z" fill="#b91c1c" />
              <path d="M45 45 Q55 65 65 60 Q75 55 70 40" stroke="#b91c1c" strokeWidth="8" fill="none" />
              <path d="M60 70 L80 20" stroke="#b91c1c" strokeWidth="8" strokeLinecap="square" />
            </svg>
          </div>
        )}
        <span className="font-bold text-xl text-gray-800 tracking-tight truncate">
          {(appSettings?.app_name === 'HukukFinans' || !appSettings?.app_name) ? 'AYAB Finans' : appSettings.app_name}
        </span>
      </div>

      <div className="flex-1 px-4 py-2 space-y-1">
        {MENU_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              onTabChange(item.id);
            }}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.id
                ? 'bg-primary-700 text-white shadow-md shadow-primary-100'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
          >
            <Icon
              name={item.icon}
              className={`${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}
            />
            <span className="font-medium text-sm">{item.label}</span>
          </a>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 space-y-1">
        {BOTTOM_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={(e) => {
              e.preventDefault();
              onTabChange(item.id);
            }}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors group ${activeTab === item.id
                ? 'bg-primary-700 text-white shadow-md shadow-primary-100'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
          >
            <Icon
              name={item.icon}
              className={`${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}
            />
            <span className="font-medium text-sm">{item.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
};
