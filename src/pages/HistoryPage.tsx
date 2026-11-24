import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SavedTeam } from '../db/database';
import { Trash2, Search, Users, History, Trophy, Copy } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const savedTeams = useLiveQuery(() => db.savedTeams.reverse().toArray(), []) || [];
  const drawHistory = useLiveQuery(() => db.drawHistory.reverse().toArray(), []) || [];
  const tournaments = useLiveQuery(() => db.tournaments.reverse().toArray(), []) || [];

  const [tab, setTab] = useState<'teams' | 'draws' | 'tournaments'>('teams');
  const [query, setQuery] = useState('');

  const handleDuplicateTeam = async (team: SavedTeam) => {
    await db.savedTeams.add({
      ...team,
      id: `team-copy-${Date.now()}`,
      name: `${team.name} (コピー)`,
      createdAt: new Date().toLocaleString('ja-JP'),
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">保存データ・履歴</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          保存したチーム・抽選結果・大会記録の確認・複製・削除
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('teams')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border cursor-pointer"
          style={{
            backgroundColor: tab === 'teams' ? 'var(--color-b)' : 'var(--bg-card)',
            color: tab === 'teams' ? '#ffffff' : 'var(--text-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <Users size={16} />
          <span>保存チーム ({savedTeams.length})</span>
        </button>
        <button
          onClick={() => setTab('draws')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border cursor-pointer"
          style={{
            backgroundColor: tab === 'draws' ? 'var(--color-a)' : 'var(--bg-card)',
            color: tab === 'draws' ? '#ffffff' : 'var(--text-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <History size={16} />
          <span>抽選履歴 ({drawHistory.length})</span>
        </button>
        <button
          onClick={() => setTab('tournaments')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border cursor-pointer"
          style={{
            backgroundColor: tab === 'tournaments' ? 'var(--color-d)' : 'var(--bg-card)',
            color: tab === 'tournaments' ? '#ffffff' : 'var(--text-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <Trophy size={16} />
          <span>大会記録 ({tournaments.length})</span>
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 opacity-50" />
        <input
          type="text"
          placeholder="キーワードで検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        />
      </div>

      {tab === 'teams' && (
        <div className="space-y-3">
          {savedTeams.filter((t) => t.name.includes(query) || t.memo.includes(query)).map((team) => (
            <div key={team.id} className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded font-bold text-white mr-2" style={{ backgroundColor: 'var(--color-b)' }}>{team.format}</span>
                  <span className="font-bold text-base">{team.name}</span>
                  <span className="text-xs ml-2 opacity-60">{team.createdAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicateTeam(team)}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded border cursor-pointer"
                    style={{ borderColor: 'var(--border-color)' }}
                    title="チームを複製"
                  >
                    <Copy size={13} />
                    <span>複製</span>
                  </button>
                  <button
                    onClick={() => { if (window.confirm('このチームを削除しますか？')) db.savedTeams.delete(team.id); }}
                    className="text-red-600 p-1 cursor-pointer"
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {team.memo && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{team.memo}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {team.members.map((m, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}>
                    {m.pokemon.nameJa}（{m.pokemon.formName}）{m.item ? ` @${m.item}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {savedTeams.length === 0 && <p className="text-sm opacity-60">保存されたチームはまだありません。</p>}
        </div>
      )}

      {tab === 'draws' && (
        <div className="space-y-2">
          {drawHistory.filter((h) => h.title.includes(query) || h.summary.includes(query)).map((h) => (
            <div key={h.id} className="p-4 rounded-xl border flex items-start justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div>
                <div className="text-xs opacity-60">{h.createdAt}</div>
                <div className="font-bold text-sm mt-0.5">{h.title}</div>
                <pre className="text-xs mt-1 whitespace-pre-wrap font-sans" style={{ color: 'var(--text-muted)' }}>{h.summary}</pre>
              </div>
              <button onClick={() => db.drawHistory.delete(h.id)} className="text-red-600 p-1 cursor-pointer">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {drawHistory.length === 0 && <p className="text-sm opacity-60">保存された抽選履歴はまだありません。</p>}
        </div>
      )}

      {tab === 'tournaments' && (
        <div className="space-y-2">
          {tournaments.filter((t) => t.name.includes(query)).map((t) => (
            <div key={t.id} className="p-4 rounded-xl border flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div>
                <div className="font-bold text-base">{t.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t.format} / {t.battleRule} / 参加{t.participants.length}名 / {t.createdAt}
                </div>
              </div>
              <button
                onClick={() => { if (window.confirm('この大会記録を削除しますか？')) db.tournaments.delete(t.id); }}
                className="text-red-600 p-1 cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-sm opacity-60">大会記録はまだありません。</p>}
        </div>
      )}
    </div>
  );
};