import React, { useState } from 'react';
import { Home, Dices, Users, Gavel, Trophy, History, Database, Settings, MoreHorizontal, X } from 'lucide-react';
import type { PageId } from '../types';

interface LayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentPage, onNavigate, children }) => {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const navItems: { id: PageId; label: string; shortLabel: string; icon: React.ReactNode; accentColor?: string; isPrimaryMobile?: boolean; }[] = [
    { id: 'home', label: 'ホーム', shortLabel: 'ホーム', icon: <Home size={20} />, isPrimaryMobile: true },
    { id: 'challenge', label: 'A：チャレンジ抽選', shortLabel: 'チャレンジ', icon: <Dices size={20} />, accentColor: 'var(--color-a)', isPrimaryMobile: true },
    { id: 'team', label: 'B：ポケモン・チーム作成', shortLabel: 'チーム', icon: <Users size={20} />, accentColor: 'var(--color-b)', isPrimaryMobile: true },
    { id: 'draft', label: 'C：ドラフト・対戦ルール', shortLabel: 'ドラフト', icon: <Gavel size={20} />, accentColor: 'var(--color-c)', isPrimaryMobile: true },
    { id: 'tournament', label: 'D：大会運営', shortLabel: '大会', icon: <Trophy size={20} />, accentColor: 'var(--color-d)', isPrimaryMobile: true },
    { id: 'history', label: '保存データ・履歴', shortLabel: '履歴', icon: <History size={20} /> },
    { id: 'database', label: 'ポケモンデータベース', shortLabel: 'DB', icon: <Database size={20} /> },
    { id: 'settings', label: '設定', shortLabel: '設定', icon: <Settings size={20} /> },
  ];

  const handleMobileNav = (page: PageId) => {
    onNavigate(page);
    setMobileMoreOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h1 className="font-bold text-lg tracking-tight leading-snug">
            Pokémon Champions
            <span className="block text-sm font-normal opacity-75">Roulette Manager</span>
          </h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer"
                style={{ backgroundColor: isActive ? item.accentColor || 'var(--text-main)' : 'transparent', color: isActive ? '#ffffff' : 'var(--text-main)' }}
              >
                <span style={{ color: isActive ? '#ffffff' : item.accentColor || 'var(--text-muted)' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 md:pl-64 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t flex items-center justify-around py-1.5 z-40" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
        {navItems.filter((item) => item.isPrimaryMobile).map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleMobileNav(item.id)}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-md text-xs"
              style={{ color: isActive ? item.accentColor || 'var(--text-main)' : 'var(--text-muted)', fontWeight: isActive ? 700 : 400 }}
            >
              {item.icon}
              <span className="mt-1 text-[10px]">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-md text-xs"
          style={{ color: ['history', 'database', 'settings'].includes(currentPage) ? 'var(--text-main)' : 'var(--text-muted)' }}
        >
          {mobileMoreOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
          <span className="mt-1 text-[10px]">その他</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-14 border-t p-3 shadow-lg z-30 space-y-1" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          {navItems.filter((item) => !item.isPrimaryMobile).map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMobileNav(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium"
                style={{ backgroundColor: isActive ? 'var(--bg-sidebar)' : 'transparent' }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
