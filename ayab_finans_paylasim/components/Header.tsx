
import React from 'react';
import { Icon } from './Icons';
import { AppUser } from '../types';

interface HeaderProps {
  user: AppUser | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <header className="flex justify-between items-center py-6 px-8 bg-transparent">
      <div className="relative w-full max-w-md hidden md:block">
        <Icon
          name="search"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"
        />
        <input
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-shadow shadow-sm"
          placeholder="Fatura veya müvekkil ara..."
          type="text"
        />
      </div>

      <div className="flex items-center gap-6 ml-auto">
        <div className="flex items-center gap-3">
          <button className="p-2.5 bg-white rounded-full hover:bg-gray-50 text-gray-500 transition-colors shadow-sm border border-gray-100 relative">
             <div className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
            <Icon name="email" className="text-xl" />
          </button>
          <button className="p-2.5 bg-white rounded-full hover:bg-gray-50 text-gray-500 transition-colors shadow-sm border border-gray-100">
            <Icon name="notifications" className="text-xl" />
          </button>
        </div>

        <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <img
            alt="Kullanıcı avatarı"
            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
            src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.full_name || 'Admin'}&background=ef4444&color=fff`}
          />
          <div className="hidden sm:block">
            <p className="font-bold text-sm text-gray-800">{user?.full_name || 'Kullanıcı'}</p>
            <p className="text-xs text-gray-500">{user?.role || 'Yetkili'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
