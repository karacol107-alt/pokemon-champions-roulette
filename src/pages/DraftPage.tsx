import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Pokemon } from '../types';
import { Gavel, RefreshCw, Save, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  points: number;
  scoutLeft: number;
  roster: Pokemon[];
}

export const DraftPage: React.FC = () => {
  const allPokemons = useLiveQuery(() => db.pokemons.toArray(), []) || [];
  const availablePool = allPokemons.filter((p) => p.isAvailableInChampions);

  const [mode, setMode] = useState<'auction' | 'scout' | 'gacha' | 'random'>('auction');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'p1', name: 'プレイヤー1', points: 1000, scoutLeft: 3, roster: [] },
    { id: 'p2', name: 'プレイヤー2', points: 1000, scoutLeft: 3, roster: [] },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [initialPoints, setInitialPoints] = useState(1000);
  const [maxRosterSize, setMaxRosterSize] = useState(6);

  // 進行管理ステート
  const [turnIndex, setTurnIndex] = useState(0);
  const [candidates, setCandidates] = useState<Pokemon[]>([]);
  const [bidAmount, setBidAmount] = useState<number>(100);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>('p1');
  const [logs, setLogs] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // 対戦ルール設定
  const [ruleBannedText, setRuleBannedText] = useState('禁止伝説・幻ポケモンなし');
  const [ruleFixedLead, setRuleFixedLead] = useState('なし');
  const [ruleAfterBattle, setRuleAfterBattle] = useState('交換なし');

  const acquiredIds = new Set(participants.flatMap((p) => p.roster.map((r) => r.id)));
  const remainingPool = availablePool.filter((p) => !acquiredIds.has(p.id));

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleAddParticipant = () => {
    if (!newPlayerName.trim()) return;
    const id = `p-${Date.now()}`;
    setParticipants((prev) => [
      ...prev,
      { id, name: newPlayerName.trim(), points: initialPoints, scoutLeft: 3, roster: [] },
    ]);
    setNewPlayerName('');
  };

  const handleResetSession = () => {
    setParticipants((prev) =>
      prev.map((p) => ({ ...p, points: initialPoints, scoutLeft: 3, roster: [] }))
    );
    setCandidates([]);
    setTurnIndex(0);
    setLogs([]);
    showToast('ドラフト進行状況をリセットしました');
  };

  const drawCandidates = (count: number) => {
    if (remainingPool.length === 0) {
      showToast('抽選可能な残りポケモンがいません（データベースを確認してください）');
      return;
    }
    const copy = [...remainingPool];
    const picked: Pokemon[] = [];
    for (let i = 0; i < Math.min(count, copy.length); i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    setCandidates(picked);
  };

  // オークション落札処理
  const handleAuctionWin = (pokemon: Pokemon) => {
    const winner = participants.find((p) => p.id === selectedWinnerId);
    if (!winner) return;
    if (winner.points < bidAmount) {
      showToast(`${winner.name} のポイントが不足しています（残り: ${winner.points}pt）`);
      return;
    }
    if (winner.roster.length >= maxRosterSize) {
      showToast(`${winner.name} はすでに上限（${maxRosterSize}匹）まで獲得しています`);
      return;
    }

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === winner.id
          ? { ...p, points: p.points - bidAmount, roster: [...p.roster, pokemon] }
          : p
      )
    );
    setLogs((prev) => [`[落札] ${winner.name} が ${pokemon.nameJa}（${pokemon.formName}）を ${bidAmount}pt で獲得`, ...prev]);
    setCandidates([]);
  };

  // スカウト・ガチャ・ランダム指名での獲得処理
  const handlePickPokemon = (pokemon: Pokemon) => {
    const currentPlayer = participants[turnIndex % participants.length];
    if (!currentPlayer) return;

    if (mode === 'scout' && currentPlayer.scoutLeft <= 0) {
      showToast(`${currentPlayer.name} のスカウト残り回数が0回です`);
      return;
    }
    if (currentPlayer.roster.length >= maxRosterSize) {
      showToast(`${currentPlayer.name} はすでに上限（${maxRosterSize}匹）まで獲得しています`);
      return;
    }

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === currentPlayer.id
          ? {
              ...p,
              scoutLeft: mode === 'scout' ? p.scoutLeft - 1 : p.scoutLeft,
              roster: [...p.roster, pokemon],
            }
          : p
      )
    );
    setLogs((prev) => [`[${mode.toUpperCase()}] ${currentPlayer.name} が ${pokemon.nameJa}（${pokemon.formName}）を獲得`, ...prev]);
    setCandidates([]);
    setTurnIndex((prev) => prev + 1);
  };

  const handleSaveAllTeams = async () => {
    let savedCount = 0;
    for (const p of participants) {
      if (p.roster.length > 0) {
        await db.savedTeams.add({
          id: `draft-team-${p.id}-${Date.now()}`,
          name: `【ドラフト】${p.name}チーム`,
          format: 'シングル',
          memo: `禁止:${ruleBannedText} / 先発:${ruleFixedLead} / 勝敗後:${ruleAfterBattle}`,
          members: p.roster.map((pk) => ({ pokemon: pk, ability: pk.abilities[0], moves: [] })),
          createdAt: new Date().toLocaleString('ja-JP'),
        });
        savedCount++;
      }
    }
    if (savedCount > 0) {
      showToast(`${savedCount}名分の完成チームを保存データ・履歴に保存しました！`);
    }
  };

  const currentPlayer = participants[turnIndex % participants.length];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-c)' }}>
            C：ドラフト・対戦ルール
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            対象プール残り: {remainingPool.length}体 / 参加者: {participants.length}名
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleResetSession} className="px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            進行リセット
          </button>
          <button onClick={handleSaveAllTeams} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-c)' }}>
            <Save size={15} />
            <span>全チーム保存</span>
          </button>
        </div>
      </header>

      {notice && (
        <div className="p-3 rounded-lg text-sm font-bold text-white flex items-center gap-2" style={{ backgroundColor: 'var(--color-c)' }}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* ドラフト方式切り替え */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'auction', label: 'オークション' },
          { id: 'scout', label: 'スカウト' },
          { id: 'gacha', label: 'ガチャ' },
          { id: 'random', label: 'ランダムドラフト' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setMode(tab.id as typeof mode); setCandidates([]); }}
            className="px-4 py-2 rounded-lg text-sm font-bold border cursor-pointer"
            style={{
              backgroundColor: mode === tab.id ? 'var(--color-c)' : 'var(--bg-card)',
              color: mode === tab.id ? '#ffffff' : 'var(--text-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 参加者管理＆初期設定 */}
      <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="text"
            placeholder="参加者名を追加..."
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border-color)' }}
          />
          <button onClick={handleAddParticipant} className="px-3 py-1.5 rounded-lg font-bold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-c)' }}>
            追加
          </button>
          <span className="text-xs ml-auto opacity-75">初期pt:</span>
          <input
            type="number"
            value={initialPoints}
            onChange={(e) => setInitialPoints(Number(e.target.value))}
            className="w-20 px-2 py-1 rounded border text-xs"
            style={{ borderColor: 'var(--border-color)' }}
          />
          <span className="text-xs">上限枠:</span>
          <input
            type="number"
            min={1}
            max={6}
            value={maxRosterSize}
            onChange={(e) => setMaxRosterSize(Number(e.target.value))}
            className="w-14 px-2 py-1 rounded border text-xs"
            style={{ borderColor: 'var(--border-color)' }}
          />
        </div>

        {/* 参加者ごとの所持状況 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {participants.map((p, idx) => {
            const isTurn = mode !== 'auction' && currentPlayer?.id === p.id;
            return (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border-2 space-y-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: isTurn ? 'var(--color-c)' : 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>
                    {idx + 1}. {p.name}
                    {isTurn && <span className="ml-2 text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: 'var(--color-c)' }}>現在の指名者</span>}
                  </span>
                  <span className="text-xs font-mono">
                    {mode === 'auction' ? `残 ${p.points}pt` : mode === 'scout' ? `残スカウト ${p.scoutLeft}回` : ''} / {p.roster.length}/{maxRosterSize}枠
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {p.roster.length === 0 ? (
                    <span className="text-xs opacity-50">獲得ポケモンなし</span>
                  ) : (
                    p.roster.map((pk) => (
                      <span key={pk.id} className="px-2 py-0.5 rounded text-xs font-medium border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                        {pk.nameJa}({pk.formName})
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ドラフト実行エリア */}
      <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold flex items-center gap-2">
            <Gavel size={18} style={{ color: 'var(--color-c)' }} />
            <span>
              {mode === 'auction' && 'オークション出品抽選'}
              {mode === 'scout' && `スカウト候補抽選（手番: ${currentPlayer?.name}）`}
              {mode === 'gacha' && `ガチャ排出（手番: ${currentPlayer?.name}）`}
              {mode === 'random' && `ランダムドラフト指名候補（手番: ${currentPlayer?.name}）`}
            </span>
          </div>

          <button
            onClick={() => drawCandidates(mode === 'auction' || mode === 'gacha' ? 1 : 3)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--color-c)' }}
          >
            <RefreshCw size={16} />
            <span>{mode === 'auction' ? '出品ポケモンを抽選' : mode === 'gacha' ? 'ガチャを引く' : '候補を3体表示'}</span>
          </button>
        </div>

        {/* 候補ポケモン表示＆操作 */}
        {candidates.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {candidates.map((pk) => (
              <div key={pk.id} className="p-4 rounded-xl border-2 space-y-3" style={{ borderColor: 'var(--color-c)', backgroundColor: 'var(--bg-main)' }}>
                <div>
                  <div className="text-xs opacity-70">{pk.type1}{pk.type2 ? ` / ${pk.type2}` : ''}</div>
                  <div className="font-bold text-lg">{pk.nameJa}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{pk.formName}</div>
                </div>

                {mode === 'auction' ? (
                  <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <select
                      value={selectedWinnerId}
                      onChange={(e) => setSelectedWinnerId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border text-xs"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}（残{p.points}pt）</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step={50}
                        min={0}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded border text-xs"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                      <button
                        onClick={() => handleAuctionWin(pk)}
                        className="w-1/2 py-1.5 rounded text-xs font-bold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--color-c)' }}
                      >
                        落札確定
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handlePickPokemon(pk)}
                    className="w-full py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: 'var(--color-c)' }}
                  >
                    {currentPlayer?.name} が獲得する
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 進行ログ */}
        {logs.length > 0 && (
          <div className="text-xs space-y-1 pt-2 border-t max-h-32 overflow-y-auto" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}
      </div>

      {/* 対戦ルール設定 */}
      <div className="p-5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <h3 className="font-bold text-base flex items-center gap-2">
          <ShieldAlert size={18} style={{ color: 'var(--color-c)' }} />
          <span>対戦特殊ルール設定</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <label className="block text-xs font-bold mb-1">使用禁止条件（ポケモン・技・道具）</label>
            <input type="text" value={ruleBannedText} onChange={(e) => setRuleBannedText(e.target.value)} className="w-full px-3 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">固定先発・選出制限</label>
            <input type="text" value={ruleFixedLead} onChange={(e) => setRuleFixedLead(e.target.value)} className="w-full px-3 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">勝敗後の交換ルール</label>
            <input type="text" value={ruleAfterBattle} onChange={(e) => setRuleAfterBattle(e.target.value)} className="w-full px-3 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
