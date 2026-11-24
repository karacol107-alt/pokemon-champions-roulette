import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TournamentRecord, type TournamentMatch } from '../db/database';
import { Trophy, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export const TournamentPage: React.FC = () => {
  const tournaments = useLiveQuery(() => db.tournaments.reverse().toArray(), []) || [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentRecord['format']>('個人総当たり');
  const [battleRule, setBattleRule] = useState<'シングル' | 'ダブル' | '混合'>('シングル');
  const [playersText, setPlayersText] = useState('プレイヤー1\nプレイヤー2\nプレイヤー3\nプレイヤー4');

  const activeTournament = tournaments.find((t) => t.id === activeId) || tournaments[0] || null;

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const participants = playersText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (participants.length < 2) {
      alert('参加者を2名（または2チーム）以上入力してください。');
      return;
    }

    const matches: TournamentMatch[] = [];
    if (format === 'トーナメント' || format === '勝ち抜き') {
      for (let i = 0; i < participants.length; i += 2) {
        const p1 = participants[i];
        const p2 = participants[i + 1] || '（不戦勝）';
        matches.push({
          id: `m-${i}`,
          round: 1,
          player1: p1,
          player2: p2,
          score1: p2 === '（不戦勝）' ? 1 : 0,
          score2: 0,
          winner: p2 === '（不戦勝）' ? p1 : null,
        });
      }
    } else {
      let idx = 0;
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          matches.push({
            id: `m-${idx++}`,
            round: 1,
            player1: participants[i],
            player2: participants[j],
            score1: 0,
            score2: 0,
            winner: null,
          });
        }
      }
    }

    const id = `tour-${Date.now()}`;
    await db.tournaments.add({
      id,
      name: name.trim() || `${format}大会 (${new Date().toLocaleDateString('ja-JP')})`,
      format,
      battleRule,
      participants,
      matches,
      status: '進行中',
      createdAt: new Date().toLocaleString('ja-JP'),
    });
    setActiveId(id);
    setName('');
  };

  const handleRecordResult = async (tournament: TournamentRecord, matchId: string, winner: string, s1: number, s2: number) => {
    const updatedMatches = tournament.matches.map((m) =>
      m.id === matchId ? { ...m, winner, score1: s1, score2: s2 } : m
    );

    if (tournament.format === 'トーナメント' || tournament.format === '勝ち抜き') {
      const currentRound = Math.max(...updatedMatches.map((m) => m.round));
      const roundMatches = updatedMatches.filter((m) => m.round === currentRound);
      if (roundMatches.length >= 2 && roundMatches.every((m) => m.winner !== null)) {
        const winners = roundMatches.map((m) => m.winner!);
        for (let i = 0; i < winners.length; i += 2) {
          const p1 = winners[i];
          const p2 = winners[i + 1] || '（不戦勝）';
          updatedMatches.push({
            id: `m-r${currentRound + 1}-${i}`,
            round: currentRound + 1,
            player1: p1,
            player2: p2,
            score1: p2 === '（不戦勝）' ? 1 : 0,
            score2: 0,
            winner: p2 === '（不戦勝）' ? p1 : null,
          });
        }
      }
    }

    const allDone = updatedMatches.every((m) => m.winner !== null);
    await db.tournaments.update(tournament.id, {
      matches: updatedMatches,
      status: allDone ? '終了' : '進行中',
    });
  };

  // 仕様書9：1.勝ち点 → 2.勝率 → 3.直接対決 → 4.得失点差 → 5.同順位
  const calculateStandings = (tournament: TournamentRecord) => {
    const stats = tournament.participants.map((pName) => {
      let wins = 0;
      let losses = 0;
      let ptsFor = 0;
      let ptsAgainst = 0;

      for (const m of tournament.matches) {
        if (!m.winner) continue;
        if (m.player1 === pName) {
          if (m.winner === pName) wins++;
          else losses++;
          ptsFor += m.score1;
          ptsAgainst += m.score2;
        } else if (m.player2 === pName) {
          if (m.winner === pName) wins++;
          else losses++;
          ptsFor += m.score2;
          ptsAgainst += m.score1;
        }
      }
      const games = wins + losses;
      const winRate = games > 0 ? wins / games : 0;
      const points = wins * 3;
      const diff = ptsFor - ptsAgainst;
      return { name: pName, wins, losses, points, winRate, diff };
    });

    const getDirectWinner = (aName: string, bName: string): number => {
      let aWins = 0;
      let bWins = 0;
      for (const m of tournament.matches) {
        if (!m.winner) continue;
        if ((m.player1 === aName && m.player2 === bName) || (m.player1 === bName && m.player2 === aName)) {
          if (m.winner === aName) aWins++;
          if (m.winner === bName) bWins++;
        }
      }
      return bWins - aWins;
    };

    const sorted = [...stats].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (Math.abs(b.winRate - a.winRate) > 0.0001) return b.winRate - a.winRate;
      const direct = getDirectWinner(a.name, b.name);
      if (direct !== 0) return direct;
      return b.diff - a.diff;
    });

    // 同順位の割り当て
    return sorted.map((row, index) => {
      if (index === 0) return { ...row, rank: 1 };
      const prev = sorted[index - 1];
      const isTied =
        row.points === prev.points &&
        Math.abs(row.winRate - prev.winRate) <= 0.0001 &&
        getDirectWinner(row.name, prev.name) === 0 &&
        row.diff === prev.diff;
      return { ...row, rank: isTied ? -1 : index + 1 };
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-d)' }}>
          D：大会運営
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          順位基準：①勝ち点 → ②勝率 → ③直接対決 → ④得失点差 → ⑤同順位
        </p>
      </header>

      <form onSubmit={handleCreateTournament} className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="font-bold text-base flex items-center gap-2">
          <Plus size={18} style={{ color: 'var(--color-d)' }} />
          <span>新しい大会を作成</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <label className="block text-xs font-bold mb-1">大会名</label>
            <input type="text" placeholder="例：第1回 Champions杯" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--border-color)' }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">大会形式</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as TournamentRecord['format'])} className="w-full px-3 py-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <option value="個人総当たり">個人総当たり</option>
              <option value="チーム総当たり">チーム総当たり</option>
              <option value="トーナメント">トーナメント</option>
              <option value="勝ち抜き">勝ち抜き</option>
              <option value="ポイント制">ポイント制</option>
              <option value="勝率ランキング">勝率ランキング</option>
              <option value="勝利数競争">勝利数競争</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">対戦ルール</label>
            <select value={battleRule} onChange={(e) => setBattleRule(e.target.value as typeof battleRule)} className="w-full px-3 py-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <option value="シングル">シングル</option>
              <option value="ダブル">ダブル</option>
              <option value="混合">混合</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">参加者・チームリスト（1行に1件）</label>
          <textarea rows={3} value={playersText} onChange={(e) => setPlayersText(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border-color)' }} />
        </div>
        <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-bold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-d)' }}>
          大会を作成して開始（自動保存）
        </button>
      </form>

      {tournaments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer"
              style={{
                backgroundColor: activeTournament?.id === t.id ? 'var(--color-d)' : 'var(--bg-card)',
                color: activeTournament?.id === t.id ? '#ffffff' : 'var(--text-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {t.name} [{t.status}]
            </button>
          ))}
        </div>
      )}

      {activeTournament && (
        <div className="p-5 rounded-xl border space-y-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{activeTournament.name}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                形式: {activeTournament.format} / ルール: {activeTournament.battleRule} / 状態: {activeTournament.status}
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('この大会データを削除しますか？')) db.tournaments.delete(activeTournament.id);
              }}
              className="text-red-600 p-1.5 cursor-pointer"
              title="大会を削除"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm">対戦カード・勝敗入力</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeTournament.matches.map((m) => (
                <div key={m.id} className="p-3.5 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-main)', borderColor: m.winner ? 'var(--color-d)' : 'var(--border-color)' }}>
                  <div className="flex items-center justify-between text-xs opacity-70">
                    <span>第{m.round}回戦</span>
                    {m.winner && <span className="font-bold flex items-center gap-1" style={{ color: 'var(--color-d)' }}><CheckCircle2 size={12} /> 勝者: {m.winner}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <button
                      onClick={() => handleRecordResult(activeTournament, m.id, m.player1, 1, 0)}
                      className="flex-1 py-2 px-2 rounded border text-center cursor-pointer"
                      style={{
                        backgroundColor: m.winner === m.player1 ? 'var(--color-d)' : 'var(--bg-card)',
                        color: m.winner === m.player1 ? '#ffffff' : 'var(--text-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {m.player1} 勝利
                    </button>
                    <span className="text-xs opacity-50">VS</span>
                    <button
                      onClick={() => handleRecordResult(activeTournament, m.id, m.player2, 0, 1)}
                      className="flex-1 py-2 px-2 rounded border text-center cursor-pointer"
                      style={{
                        backgroundColor: m.winner === m.player2 ? 'var(--color-d)' : 'var(--bg-card)',
                        color: m.winner === m.player2 ? '#ffffff' : 'var(--text-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {m.player2} 勝利
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-sm flex items-center gap-1.5">
              <Trophy size={16} style={{ color: 'var(--color-d)' }} />
              <span>リアルタイム順位表</span>
            </h4>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b text-xs" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
                    <th className="p-2.5">順位</th>
                    <th className="p-2.5">参加者</th>
                    <th className="p-2.5">勝ち点</th>
                    <th className="p-2.5">勝敗</th>
                    <th className="p-2.5">勝率</th>
                    <th className="p-2.5">得失点差</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateStandings(activeTournament).map((row, idx) => {
                    const displayRank = row.rank === -1 ? '同順位' : `${row.rank}位`;
                    return (
                      <tr key={`${row.name}-${idx}`} className="border-b last:border-none" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="p-2.5 font-bold">{displayRank}</td>
                        <td className="p-2.5 font-bold">{row.name}</td>
                        <td className="p-2.5 font-mono">{row.points}pt</td>
                        <td className="p-2.5 font-mono">{row.wins}勝 {row.losses}敗</td>
                        <td className="p-2.5 font-mono">{Math.round(row.winRate * 100)}%</td>
                        <td className="p-2.5 font-mono">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};