
import React from 'react';
import { Icon } from './Icons';
import { AppUser } from '../types';

interface HeaderProps {
  user: AppUser | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <header className="flex justify-between items-center py-4 px-6 bg-white border-b border-slate-200">
      <div className="relative w-full max-w-sm hidden md:block">
        <Icon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"
        />
        <input
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-300 focus:border-slate-300 outline-none text-sm text-slate-600 placeholder-slate-400"
          placeholder="Ara..."
          type="text"
        />
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 transition-colors relative">
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
            <Icon name="email" className="text-lg" />
          </button>
          <button className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 transition-colors">
            <Icon name="notifications" className="text-lg" />
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-medium">
            {(user?.full_name || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="font-medium text-sm text-slate-800 leading-tight">{user?.full_name || 'Kullanıcı'}</p>
            <p className="text-xs text-slate-400">{user?.role || 'Yetkili'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
