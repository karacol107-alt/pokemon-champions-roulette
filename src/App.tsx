import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/database';
import { Layout } from './components/Layout';
import { DatabasePage } from './pages/DatabasePage';
import { ChallengePage } from './pages/ChallengePage';
import { TeamBuilderPage } from './pages/TeamBuilderPage';
import { DraftPage } from './pages/DraftPage';
import { TournamentPage } from './pages/TournamentPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import type { PageId } from './types';
import { Dices, Users, Gavel, Trophy } from 'lucide-react';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [buttonSize, setButtonSize] = useState<'normal' | 'large'>('normal');
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [inheritedChallenge, setInheritedChallenge] = useState<string>('');

  const recentHistory = useLiveQuery(() => db.drawHistory.reverse().limit(3).toArray(), []) || [];
  const savedTeams = useLiveQuery(() => db.savedTeams.reverse().limit(3).toArray(), []) || [];
  const activeTournaments = useLiveQuery(() => db.tournaments.reverse().limit(2).toArray(), []) || [];

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const sizeMap = { normal: '16px', large: '18px', xlarge: '20px' };
    document.documentElement.style.fontSize = sizeMap[fontSize];
  }, [fontSize]);

  const handleSendToTeamBuilder = (challengeTitle: string) => {
    setInheritedChallenge(challengeTitle);
    setCurrentPage('team');
  };

  return (
    <div className={buttonSize === 'large' ? '[&_button]:py-3.5 [&_button]:text-base' : ''}>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {currentPage === 'home' && (
          <div className="space-y-8">
            <header>
              <h2 className="text-2xl font-bold">ホーム</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                企画抽選からチーム編成・ドラフト・大会運営まで一括管理
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => setCurrentPage('challenge')} className="p-5 rounded-xl border text-left transition-transform hover:scale-[1.01] cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderLeftWidth: '6px', borderLeftColor: 'var(--color-a)' }}>
                <div className="flex items-center gap-3 font-bold text-lg" style={{ color: 'var(--color-a)' }}>
                  <Dices size={24} />
                  <span>A：チャレンジ抽選</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>8カテゴリーの企画・縛りルールをランダム抽選</p>
              </button>

              <button onClick={() => setCurrentPage('team')} className="p-5 rounded-xl border text-left transition-transform hover:scale-[1.01] cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderLeftWidth: '6px', borderLeftColor: 'var(--color-b)' }}>
                <div className="flex items-center gap-3 font-bold text-lg" style={{ color: 'var(--color-b)' }}>
                  <Users size={24} />
                  <span>B：ポケモン・チーム作成</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>ポケモン・技・特性・道具・タイプを抽選して6匹編成</p>
              </button>

              <button onClick={() => setCurrentPage('draft')} className="p-5 rounded-xl border text-left transition-transform hover:scale-[1.01] cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderLeftWidth: '6px', borderLeftColor: 'var(--color-c)' }}>
                <div className="flex items-center gap-3 font-bold text-lg" style={{ color: 'var(--color-c)' }}>
                  <Gavel size={24} />
                  <span>C：ドラフト・対戦ルール</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>オークション・スカウト・ガチャ・交互指名ドラフト</p>
              </button>

              <button onClick={() => setCurrentPage('tournament')} className="p-5 rounded-xl border text-left transition-transform hover:scale-[1.01] cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderLeftWidth: '6px', borderLeftColor: 'var(--color-d)' }}>
                <div className="flex items-center gap-3 font-bold text-lg" style={{ color: 'var(--color-d)' }}>
                  <Trophy size={24} />
                  <span>D：大会運営</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>トーナメント・総当たり・ポイント制と自動順位計算</p>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="font-bold text-sm">最近の抽選結果</h3>
                {recentHistory.length === 0 ? (
                  <p className="text-xs opacity-60">履歴はまだありません</p>
                ) : (
                  recentHistory.map((h) => (
                    <div key={h.id} className="text-xs border-b pb-1.5 last:border-none" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="font-bold">{h.title}</div>
                      <div className="opacity-60">{h.createdAt}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="font-bold text-sm">保存済みチーム</h3>
                {savedTeams.length === 0 ? (
                  <p className="text-xs opacity-60">保存チームはまだありません</p>
                ) : (
                  savedTeams.map((t) => (
                    <div key={t.id} className="text-xs border-b pb-1.5 last:border-none" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="font-bold">{t.name} ({t.members.length}匹)</div>
                      <div className="opacity-60">{t.format} / {t.createdAt}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="font-bold text-sm">進行中の大会</h3>
                {activeTournaments.length === 0 ? (
                  <p className="text-xs opacity-60">大会データはまだありません</p>
                ) : (
                  activeTournaments.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCurrentPage('tournament')}
                      className="w-full text-left text-xs border-b pb-1.5 last:border-none cursor-pointer hover:underline"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="font-bold">{t.name}</div>
                      <div className="opacity-60">{t.format} / 参加{t.participants.length}名</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {currentPage === 'challenge' && <ChallengePage onSendToTeamBuilder={handleSendToTeamBuilder} />}
        {currentPage === 'team' && <TeamBuilderPage inheritedChallenge={inheritedChallenge} />}
        {currentPage === 'draft' && <DraftPage />}
        {currentPage === 'tournament' && <TournamentPage />}
        {currentPage === 'history' && <HistoryPage />}
        {currentPage === 'database' && <DatabasePage />}
        {currentPage === 'settings' && (
          <SettingsPage
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            fontSize={fontSize}
            setFontSize={setFontSize}
            buttonSize={buttonSize}
            setButtonSize={setButtonSize}
            skipAnimation={skipAnimation}
            setSkipAnimation={setSkipAnimation}
          />
        )}
      </Layout>
    </div>
  );
}

export default App;