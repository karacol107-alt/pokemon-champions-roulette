import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TournamentRecord, type TournamentMatch } from '../db/database';
import { Trophy, Plus, Trash2, CheckCircle2, Users, ClipboardList, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';

interface IndividualBout {
  id: string;
  label: string;
  p1Member: string;
  p2Member: string;
  winnerSide: 'p1' | 'p2' | null;
  p1Remaining: number;
  p2Remaining: number;
  note: string;
}

interface DetailedMatchMeta {
  bouts: IndividualBout[];
  matchNote: string;
}

interface ExtendedTournamentRecord extends TournamentRecord {
  teamRosters?: Record<string, string[]>;
  matchDetails?: Record<string, DetailedMatchMeta>;
}

export const TournamentPage: React.FC = () => {
  const tournaments = (useLiveQuery(() => db.tournaments.reverse().toArray(), []) || []) as ExtendedTournamentRecord[];

  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentRecord['format']>('チーム総当たり');
  const [battleRule, setBattleRule] = useState<'シングル' | 'ダブル' | '混合'>('シングル');
  const [playersText, setPlayersText] = useState('チームA: 選手1, 選手2, 選手3\nチームB: 選手4, 選手5, 選手6');

  // 進行中の詳細編集用ステート
  const [expandedMatchIds, setExpandedMatchIds] = useState<Record<string, boolean>>({});
  const [newMemberInputs, setNewMemberInputs] = useState<Record<string, string>>({});

  const activeTournament = tournaments.find((t) => t.id === activeId) || tournaments[0] || null;

  const isTeamFormat = (fmt: string) => fmt.includes('チーム');

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = playersText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      alert('参加者またはチームを2件以上入力してください。');
      return;
    }

    const participants: string[] = [];
    const teamRosters: Record<string, string[]> = {};

    for (const line of lines) {
      if (line.includes(':') || line.includes('：')) {
        const sep = line.includes('：') ? '：' : ':';
        const [teamPart, membersPart] = line.split(sep);
        const teamName = teamPart.trim();
        const members = (membersPart || '')
          .split(/[,、/／]/)
          .map((m) => m.trim())
          .filter(Boolean);
        participants.push(teamName);
        teamRosters[teamName] = members.length > 0 ? members : [`${teamName} メンバー1`];
      } else {
        participants.push(line);
        if (isTeamFormat(format)) {
          teamRosters[line] = [`${line} 選手1`, `${line} 選手2`, `${line} 選手3`];
        }
      }
    }

    const matches: TournamentMatch[] = [];
    const matchDetails: Record<string, DetailedMatchMeta> = {};

    const createInitialDetails = (mId: string, p1: string, p2: string) => {
      const m1List = teamRosters[p1] || [p1];
      const m2List = teamRosters[p2] || [p2];
      const count = isTeamFormat(format) ? Math.max(m1List.length, m2List.length, 1) : 1;
      const bouts: IndividualBout[] = [];
      for (let k = 0; k < count; k++) {
        bouts.push({
          id: `${mId}-b${k + 1}`,
          label: isTeamFormat(format) ? `第${k + 1}試合` : '本戦',
          p1Member: m1List[k] || m1List[0] || p1,
          p2Member: m2List[k] || m2List[0] || p2,
          winnerSide: null,
          p1Remaining: 0,
          p2Remaining: 0,
          note: '',
        });
      }
      matchDetails[mId] = { bouts, matchNote: '' };
    };

    if (format === 'トーナメント' || format === '勝ち抜き') {
      for (let i = 0; i < participants.length; i += 2) {
        const p1 = participants[i];
        const p2 = participants[i + 1] || '（不戦勝）';
        const mId = `m-${i}`;
        matches.push({
          id: mId,
          round: 1,
          player1: p1,
          player2: p2,
          score1: p2 === '（不戦勝）' ? 1 : 0,
          score2: 0,
          winner: p2 === '（不戦勝）' ? p1 : null,
        });
        if (p2 !== '（不戦勝）') createInitialDetails(mId, p1, p2);
      }
    } else {
      let idx = 0;
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          const mId = `m-${idx++}`;
          matches.push({
            id: mId,
            round: 1,
            player1: participants[i],
            player2: participants[j],
            score1: 0,
            score2: 0,
            winner: null,
          });
          createInitialDetails(mId, participants[i], participants[j]);
        }
      }
    }

    const id = `tour-${Date.now()}`;
    const newRecord: ExtendedTournamentRecord = {
      id,
      name: name.trim() || `${format}大会 (${new Date().toLocaleDateString('ja-JP')})`,
      format,
      battleRule,
      participants,
      matches,
      status: '進行中',
      createdAt: new Date().toLocaleString('ja-JP'),
      teamRosters,
      matchDetails,
    };

    await db.tournaments.add(newRecord as TournamentRecord);
    setActiveId(id);
    setName('');
  };

  // チームメンバーの追加・削除
  const handleAddTeamMember = async (tournament: ExtendedTournamentRecord, teamName: string) => {
    const memberName = (newMemberInputs[teamName] || '').trim();
    if (!memberName) return;

    const currentRosters = { ...(tournament.teamRosters || {}) };
    const existing = currentRosters[teamName] || [];
    currentRosters[teamName] = [...existing, memberName];

    await db.tournaments.update(tournament.id, { teamRosters: currentRosters } as Partial<TournamentRecord>);
    setNewMemberInputs((prev) => ({ ...prev, [teamName]: '' }));
  };

  const handleRemoveTeamMember = async (tournament: ExtendedTournamentRecord, teamName: string, memberIdx: number) => {
    const currentRosters = { ...(tournament.teamRosters || {}) };
    const existing = currentRosters[teamName] || [];
    currentRosters[teamName] = existing.filter((_, idx) => idx !== memberIdx);

    await db.tournaments.update(tournament.id, { teamRosters: currentRosters } as Partial<TournamentRecord>);
  };

  // 対戦カード全体の勝敗確定
  const handleRecordResult = async (
    tournament: ExtendedTournamentRecord,
    matchId: string,
    winner: string,
    s1: number,
    s2: number
  ) => {
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

  // 詳細戦績（個人試合）の更新
  const updateMatchDetails = async (
    tournament: ExtendedTournamentRecord,
    match: TournamentMatch,
    nextMeta: DetailedMatchMeta,
    autoSyncTeamScore = false
  ) => {
    const nextDetails = {
      ...(tournament.matchDetails || {}),
      [match.id]: nextMeta,
    };

    const p1Wins = nextMeta.bouts.filter((b) => b.winnerSide === 'p1').length;
    const p2Wins = nextMeta.bouts.filter((b) => b.winnerSide === 'p2').length;

    let updatedMatches = tournament.matches;
    if (autoSyncTeamScore) {
      let winner = match.winner;
      if (p1Wins > p2Wins) winner = match.player1;
      else if (p2Wins > p1Wins) winner = match.player2;
      updatedMatches = tournament.matches.map((m) =>
        m.id === match.id ? { ...m, score1: p1Wins, score2: p2Wins, winner } : m
      );
    }

    await db.tournaments.update(tournament.id, {
      matches: updatedMatches,
      matchDetails: nextDetails,
    } as Partial<TournamentRecord>);
  };

  // チーム・個人順位計算
  const calculateStandings = (tournament: ExtendedTournamentRecord) => {
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
      return { name: pName, wins, losses, points, winRate, diff, ptsFor, ptsAgainst };
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

  // 個人別通算戦績の集計
  const calculateIndividualStats = (tournament: ExtendedTournamentRecord) => {
    const map = new Map<
      string,
      { member: string; team: string; wins: number; losses: number; remDiff: number; notes: string[] }
    >();

    // 登録済みメンバーを初期化
    if (tournament.teamRosters) {
      Object.entries(tournament.teamRosters).forEach(([team, members]) => {
        members.forEach((m) => {
          map.set(`${team}::${m}`, { member: m, team, wins: 0, losses: 0, remDiff: 0, notes: [] });
        });
      });
    }

    const details = tournament.matchDetails || {};
    for (const m of tournament.matches) {
      const meta = details[m.id];
      if (!meta) continue;
      for (const b of meta.bouts) {
        if (!b.winnerSide) continue;
        const k1 = `${m.player1}::${b.p1Member}`;
        const k2 = `${m.player2}::${b.p2Member}`;

        if (!map.has(k1)) {
          map.set(k1, { member: b.p1Member, team: m.player1, wins: 0, losses: 0, remDiff: 0, notes: [] });
        }
        if (!map.has(k2)) {
          map.set(k2, { member: b.p2Member, team: m.player2, wins: 0, losses: 0, remDiff: 0, notes: [] });
        }

        const r1 = map.get(k1)!;
        const r2 = map.get(k2)!;

        if (b.winnerSide === 'p1') {
          r1.wins++;
          r2.losses++;
        } else {
          r2.wins++;
          r1.losses++;
        }
        r1.remDiff += b.p1Remaining - b.p2Remaining;
        r2.remDiff += b.p2Remaining - b.p1Remaining;

        if (b.note.trim()) {
          r1.notes.push(`${b.note.trim()} (vs ${b.p2Member})`);
          r2.notes.push(`${b.note.trim()} (vs ${b.p1Member})`);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      if (Math.abs(rateB - rateA) > 0.0001) return rateB - rateA;
      return b.remDiff - a.remDiff;
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-d)' }}>
          D：大会運営
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          順位基準：①勝ち点 → ②勝率 → ③直接対決 → ④得失点差 → ⑤同順位（チーム戦のメンバー・個人戦績記録対応）
        </p>
      </header>

      <form
        onSubmit={handleCreateTournament}
        className="p-5 rounded-xl border space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h3 className="font-bold text-base flex items-center gap-2">
          <Plus size={18} style={{ color: 'var(--color-d)' }} />
          <span>新しい大会を作成</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <label className="block text-xs font-bold mb-1">大会名</label>
            <input
              type="text"
              placeholder="例：第1回 Championsチーム杯"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">大会形式</label>
            <select
              value={format}
              onChange={(e) => {
                const nextFmt = e.target.value as TournamentRecord['format'];
                setFormat(nextFmt);
                if (nextFmt.includes('チーム') && !playersText.includes(':')) {
                  setPlayersText('チームA: 選手1, 選手2, 選手3\nチームB: 選手4, 選手5, 選手6');
                }
              }}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <option value="チーム総当たり">チーム総当たり</option>
              <option value="個人総当たり">個人総当たり</option>
              <option value="トーナメント">トーナメント</option>
              <option value="勝ち抜き">勝ち抜き</option>
              <option value="ポイント制">ポイント制</option>
              <option value="勝率ランキング">勝率ランキング</option>
              <option value="勝利数競争">勝利数競争</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">対戦ルール</label>
            <select
              value={battleRule}
              onChange={(e) => setBattleRule(e.target.value as typeof battleRule)}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <option value="シングル">シングル</option>
              <option value="ダブル">ダブル</option>
              <option value="混合">混合</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">
            {isTeamFormat(format)
              ? 'チーム＆メンバーリスト（1行に1チーム。「チーム名: メンバー1, メンバー2, メンバー3」形式で入力）'
              : '参加者・チームリスト（1行に1件）'}
          </label>
          <textarea
            rows={3}
            value={playersText}
            onChange={(e) => setPlayersText(e.target.value)}
            placeholder={
              isTeamFormat(format)
                ? 'チームA: 選手1, 選手2, 選手3\nチームB: 選手4, 選手5, 選手6'
                : 'プレイヤー1\nプレイヤー2'
            }
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--border-color)' }}
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-white cursor-pointer"
          style={{ backgroundColor: 'var(--color-d)' }}
        >
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
        <div
          className="p-5 rounded-xl border space-y-6"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
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

          {/* チーム戦メンバー管理セクション */}
          {isTeamFormat(activeTournament.format) && (
            <div
              className="p-4 rounded-xl border space-y-3"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <Users size={16} style={{ color: 'var(--color-d)' }} />
                <span>チームメンバー編成（追加・編集）</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeTournament.participants.map((teamName) => {
                  const members = activeTournament.teamRosters?.[teamName] || [];
                  return (
                    <div
                      key={teamName}
                      className="p-3 rounded-lg border space-y-2"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="font-bold text-sm flex items-center justify-between">
                        <span>{teamName}</span>
                        <span className="text-xs opacity-70">{members.length}名</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((m, idx) => (
                          <span
                            key={`${m}-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
                            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
                          >
                            <span>
                              {idx + 1}. {m}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTeamMember(activeTournament, teamName, idx)}
                              className="text-red-500 hover:opacity-75 cursor-pointer ml-0.5"
                              title="メンバー削除"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="メンバー名を追加..."
                          value={newMemberInputs[teamName] || ''}
                          onChange={(e) =>
                            setNewMemberInputs((prev) => ({ ...prev, [teamName]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTeamMember(activeTournament, teamName);
                            }
                          }}
                          className="flex-1 px-2.5 py-1 rounded border text-xs"
                          style={{ borderColor: 'var(--border-color)' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTeamMember(activeTournament, teamName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-white cursor-pointer"
                          style={{ backgroundColor: 'var(--color-d)' }}
                        >
                          <UserPlus size={12} />
                          追加
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 対戦カード・詳細戦績入力 */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm">対戦カード・勝敗＆詳細戦績入力</h4>
            <div className="grid grid-cols-1 gap-3">
              {activeTournament.matches.map((m) => {
                const isExpanded = !!expandedMatchIds[m.id];
                const meta: DetailedMatchMeta = activeTournament.matchDetails?.[m.id] || {
                  bouts: [
                    {
                      id: `${m.id}-b1`,
                      label: '第1試合',
                      p1Member: (activeTournament.teamRosters?.[m.player1] || [m.player1])[0],
                      p2Member: (activeTournament.teamRosters?.[m.player2] || [m.player2])[0],
                      winnerSide: null,
                      p1Remaining: 0,
                      p2Remaining: 0,
                      note: '',
                    },
                  ],
                  matchNote: '',
                };

                const p1Members = activeTournament.teamRosters?.[m.player1] || [m.player1];
                const p2Members = activeTournament.teamRosters?.[m.player2] || [m.player2];

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border space-y-3"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: m.winner ? 'var(--color-d)' : 'var(--border-color)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-80">
                      <span>
                        第{m.round}回戦 / スコア: <strong>{m.score1} - {m.score2}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        {m.winner && (
                          <span className="font-bold flex items-center gap-1" style={{ color: 'var(--color-d)' }}>
                            <CheckCircle2 size={13} /> 勝者: {m.winner}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMatchIds((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border font-bold cursor-pointer"
                          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                        >
                          <ClipboardList size={13} />
                          <span>詳細戦績（個人勝敗・残数・メモ）</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* チーム全体の勝敗ボタン */}
                    <div className="flex items-center justify-between gap-2 text-sm font-bold">
                      <button
                        onClick={() =>
                          handleRecordResult(activeTournament, m.id, m.player1, Math.max(m.score1, 1), m.score2)
                        }
                        className="flex-1 py-2 px-2 rounded border text-center cursor-pointer"
                        style={{
                          backgroundColor: m.winner === m.player1 ? 'var(--color-d)' : 'var(--bg-card)',
                          color: m.winner === m.player1 ? '#ffffff' : 'var(--text-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        {m.player1} 勝利 ({m.score1})
                      </button>
                      <span className="text-xs opacity-50">VS</span>
                      <button
                        onClick={() =>
                          handleRecordResult(activeTournament, m.id, m.player2, m.score1, Math.max(m.score2, 1))
                        }
                        className="flex-1 py-2 px-2 rounded border text-center cursor-pointer"
                        style={{
                          backgroundColor: m.winner === m.player2 ? 'var(--color-d)' : 'var(--bg-card)',
                          color: m.winner === m.player2 ? '#ffffff' : 'var(--text-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        {m.player2} 勝利 ({m.score2})
                      </button>
                    </div>

                    {/* 詳細戦績（個人戦ごとの星取表・残ポケ数・メモ） */}
                    {isExpanded && (
                      <div
                        className="p-3.5 rounded-lg border space-y-3 text-xs"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">個人別対戦レコード（入力すると本数が自動集計されます）</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextIdx = meta.bouts.length + 1;
                              const nextMeta: DetailedMatchMeta = {
                                ...meta,
                                bouts: [
                                  ...meta.bouts,
                                  {
                                    id: `${m.id}-b${Date.now()}`,
                                    label: `第${nextIdx}試合`,
                                    p1Member: p1Members[(nextIdx - 1) % p1Members.length] || m.player1,
                                    p2Member: p2Members[(nextIdx - 1) % p2Members.length] || m.player2,
                                    winnerSide: null,
                                    p1Remaining: 0,
                                    p2Remaining: 0,
                                    note: '',
                                  },
                                ],
                              };
                              updateMatchDetails(activeTournament, m, nextMeta, false);
                            }}
                            className="px-2.5 py-1 rounded font-bold text-white cursor-pointer"
                            style={{ backgroundColor: 'var(--color-d)' }}
                          >
                            + 対戦枠を追加
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {meta.bouts.map((bout, bIdx) => (
                            <div
                              key={bout.id}
                              className="p-2.5 rounded-lg border space-y-2"
                              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold w-14">{bout.label}</span>

                                {/* チーム1メンバー選択 */}
                                <select
                                  value={bout.p1Member}
                                  onChange={(e) => {
                                    const nextBouts = meta.bouts.map((b, i) =>
                                      i === bIdx ? { ...b, p1Member: e.target.value } : b
                                    );
                                    updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, true);
                                  }}
                                  className="px-2 py-1 rounded border"
                                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                                >
                                  {p1Members.map((mem) => (
                                    <option key={mem} value={mem}>
                                      {mem}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextBouts = meta.bouts.map((b, i) =>
                                      i === bIdx ? { ...b, winnerSide: 'p1' as const } : b
                                    );
                                    updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, true);
                                  }}
                                  className="px-2 py-1 rounded border font-bold cursor-pointer"
                                  style={{
                                    backgroundColor: bout.winnerSide === 'p1' ? 'var(--color-d)' : 'var(--bg-card)',
                                    color: bout.winnerSide === 'p1' ? '#ffffff' : 'var(--text-main)',
                                    borderColor: 'var(--border-color)',
                                  }}
                                >
                                  勝
                                </button>

                                <span className="opacity-50">vs</span>

                                {/* チーム2メンバー選択 */}
                                <select
                                  value={bout.p2Member}
                                  onChange={(e) => {
                                    const nextBouts = meta.bouts.map((b, i) =>
                                      i === bIdx ? { ...b, p2Member: e.target.value } : b
                                    );
                                    updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, true);
                                  }}
                                  className="px-2 py-1 rounded border"
                                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                                >
                                  {p2Members.map((mem) => (
                                    <option key={mem} value={mem}>
                                      {mem}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextBouts = meta.bouts.map((b, i) =>
                                      i === bIdx ? { ...b, winnerSide: 'p2' as const } : b
                                    );
                                    updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, true);
                                  }}
                                  className="px-2 py-1 rounded border font-bold cursor-pointer"
                                  style={{
                                    backgroundColor: bout.winnerSide === 'p2' ? 'var(--color-d)' : 'var(--bg-card)',
                                    color: bout.winnerSide === 'p2' ? '#ffffff' : 'var(--text-main)',
                                    borderColor: 'var(--border-color)',
                                  }}
                                >
                                  勝
                                </button>

                                {/* 残ポケ数入力 */}
                                <div className="flex items-center gap-1 ml-auto">
                                  <span>残ポケ:</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={6}
                                    value={bout.p1Remaining}
                                    onChange={(e) => {
                                      const nextBouts = meta.bouts.map((b, i) =>
                                        i === bIdx ? { ...b, p1Remaining: Number(e.target.value) } : b
                                      );
                                      updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, false);
                                    }}
                                    className="w-11 px-1.5 py-0.5 rounded border text-center font-mono"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  />
                                  <span>-</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={6}
                                    value={bout.p2Remaining}
                                    onChange={(e) => {
                                      const nextBouts = meta.bouts.map((b, i) =>
                                        i === bIdx ? { ...b, p2Remaining: Number(e.target.value) } : b
                                      );
                                      updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, false);
                                    }}
                                    className="w-11 px-1.5 py-0.5 rounded border text-center font-mono"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  />
                                </div>
                              </div>

                              {/* 試合詳細メモ（使用軸・MVP・選出など） */}
                              <input
                                type="text"
                                placeholder="詳細戦績メモ（例：ガブリアス3タテ / 選出: カイリュー・サーフゴー・ウーラオス）"
                                value={bout.note}
                                onChange={(e) => {
                                  const nextBouts = meta.bouts.map((b, i) =>
                                    i === bIdx ? { ...b, note: e.target.value } : b
                                  );
                                  updateMatchDetails(activeTournament, m, { ...meta, bouts: nextBouts }, false);
                                }}
                                className="w-full px-2.5 py-1 rounded border"
                                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* リアルタイム順位表（チーム・参加者） */}
          <div className="space-y-2 pt-2">
            <h4 className="font-bold text-sm flex items-center gap-1.5">
              <Trophy size={16} style={{ color: 'var(--color-d)' }} />
              <span>リアルタイム順位表（チーム / 参加者）</span>
            </h4>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr
                    className="border-b text-xs"
                    style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
                  >
                    <th className="p-2.5">順位</th>
                    <th className="p-2.5">チーム / 参加者</th>
                    <th className="p-2.5">勝ち点</th>
                    <th className="p-2.5">勝敗</th>
                    <th className="p-2.5">勝率</th>
                    <th className="p-2.5">得失本数差</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateStandings(activeTournament).map((row, idx) => {
                    const displayRank = row.rank === -1 ? '同順位' : `${row.rank}位`;
                    return (
                      <tr
                        key={`${row.name}-${idx}`}
                        className="border-b last:border-none"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <td className="p-2.5 font-bold">{displayRank}</td>
                        <td className="p-2.5 font-bold">{row.name}</td>
                        <td className="p-2.5 font-mono">{row.points}pt</td>
                        <td className="p-2.5 font-mono">
                          {row.wins}勝 {row.losses}敗
                        </td>
                        <td className="p-2.5 font-mono">{Math.round(row.winRate * 100)}%</td>
                        <td className="p-2.5 font-mono">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 個人別詳細戦績テーブル */}
          {isTeamFormat(activeTournament.format) && (
            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <Users size={16} style={{ color: 'var(--color-d)' }} />
                <span>個人別 詳細戦績・星取集計</span>
              </h4>
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr
                      className="border-b text-xs"
                      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
                    >
                      <th className="p-2.5">選手名</th>
                      <th className="p-2.5">所属チーム</th>
                      <th className="p-2.5">個人勝敗</th>
                      <th className="p-2.5">勝率</th>
                      <th className="p-2.5">残ポケ差</th>
                      <th className="p-2.5">戦績メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateIndividualStats(activeTournament).map((st, idx) => {
                      const games = st.wins + st.losses;
                      const rate = games > 0 ? Math.round((st.wins / games) * 100) : 0;
                      return (
                        <tr
                          key={`${st.team}-${st.member}-${idx}`}
                          className="border-b last:border-none"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <td className="p-2.5 font-bold">{st.member}</td>
                          <td className="p-2.5 text-xs">{st.team}</td>
                          <td className="p-2.5 font-mono">
                            {st.wins}勝 {st.losses}敗
                          </td>
                          <td className="p-2.5 font-mono">{rate}%</td>
                          <td className="p-2.5 font-mono">
                            {st.remDiff > 0 ? `+${st.remDiff}` : st.remDiff}
                          </td>
                          <td className="p-2.5 text-xs opacity-80">
                            {st.notes.length > 0 ? st.notes.join(' / ') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};