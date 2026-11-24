import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Pokemon } from '../types';
import { Gavel, RefreshCw, Save, ShieldAlert, CheckCircle2, Coins, ArrowUpCircle } from 'lucide-react';

interface AcquiredPokemon {
  pokemon: Pokemon;
  purchasePrice: number;
}

interface Participant {
  id: string;
  name: string;
  points: number;
  scoutLeft: number;
  roster: AcquiredPokemon[];
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
  const [logs, setLogs] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // オークション入札ステート
  const [currentBid, setCurrentBid] = useState<number>(0);
  const [highestBidderId, setHighestBidderId] = useState<string | null>(null);
  const [customBids, setCustomBids] = useState<Record<string, number>>({});

  // 対戦ルール設定
  const [ruleBannedText, setRuleBannedText] = useState('禁止伝説・幻ポケモンなし');
  const [ruleFixedLead, setRuleFixedLead] = useState('なし');
  const [ruleAfterBattle, setRuleAfterBattle] = useState('交換なし');

  const acquiredIds = new Set(participants.flatMap((p) => p.roster.map((r) => r.pokemon.id)));
  const remainingPool = availablePool.filter((p) => !acquiredIds.has(p.id));

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const resetAuctionBidState = () => {
    setCurrentBid(0);
    setHighestBidderId(null);
    setCustomBids({});
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
    resetAuctionBidState();
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
    resetAuctionBidState();
  };

  // オークション入札処理
  const handlePlaceBid = (bidderId: string, amount: number) => {
    const bidder = participants.find((p) => p.id === bidderId);
    if (!bidder) return;

    if (bidder.roster.length >= maxRosterSize) {
      showToast(`${bidder.name} はすでに上限（${maxRosterSize}匹）まで獲得しているため入札できません`);
      return;
    }
    if (amount <= currentBid) {
      showToast(`現在の最高入札額（${currentBid}pt）より高い金額で入札してください`);
      return;
    }
    if (bidder.points < amount) {
      showToast(`${bidder.name} の所持ポイントが不足しています（所持: ${bidder.points}pt）`);
      return;
    }

    setCurrentBid(amount);
    setHighestBidderId(bidder.id);
    setCustomBids((prev) => ({ ...prev, [bidder.id]: amount + 50 }));
    setLogs((prev) => [`[入札] ${bidder.name} が ${amount}pt で入札！`, ...prev]);
  };

  // オークション落札確定処理
  const handleAuctionWin = (pokemon: Pokemon) => {
    if (!highestBidderId || currentBid <= 0) {
      showToast('先に入札を行ってください');
      return;
    }
    const winner = participants.find((p) => p.id === highestBidderId);
    if (!winner) return;

    if (winner.points < currentBid) {
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
          ? {
              ...p,
              points: p.points - currentBid,
              roster: [...p.roster, { pokemon, purchasePrice: currentBid }],
            }
          : p
      )
    );
    setLogs((prev) => [
      `[落札] ${winner.name} が ${pokemon.nameJa}（${pokemon.formName}）を ${currentBid}pt で獲得`,
      ...prev,
    ]);
    setCandidates([]);
    resetAuctionBidState();
  };

  // 購入金額の半額で売却する処理
  const handleSellPokemon = (participantId: string, item: AcquiredPokemon) => {
    const refund = Math.floor(item.purchasePrice / 2);
    if (
      !confirm(
        `${item.pokemon.nameJa}（${item.pokemon.formName}）を売却しますか？\n購入額 ${item.purchasePrice}pt の半額（+${refund}pt）が返還されます。`
      )
    ) {
      return;
    }

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? {
              ...p,
              points: p.points + refund,
              roster: p.roster.filter((r) => r.pokemon.id !== item.pokemon.id),
            }
          : p
      )
    );
    setLogs((prev) => [
      `[売却] ${item.pokemon.nameJa}（${item.pokemon.formName}）を売却し +${refund}pt 獲得（購入額: ${item.purchasePrice}pt）`,
      ...prev,
    ]);
    showToast(`${item.pokemon.nameJa} を売却し +${refund}pt 返還されました`);
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
              roster: [...p.roster, { pokemon, purchasePrice: 0 }],
            }
          : p
      )
    );
    setLogs((prev) => [
      `[${mode.toUpperCase()}] ${currentPlayer.name} が ${pokemon.nameJa}（${pokemon.formName}）を獲得`,
      ...prev,
    ]);
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
          members: p.roster.map((item) => ({
            pokemon: item.pokemon,
            ability: item.pokemon.abilities[0],
            moves: [],
          })),
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
  const highestBidder = participants.find((p) => p.id === highestBidderId);

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
          <button
            onClick={handleResetSession}
            className="px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            進行リセット
          </button>
          <button
            onClick={handleSaveAllTeams}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--color-c)' }}
          >
            <Save size={15} />
            <span>全チーム保存</span>
          </button>
        </div>
      </header>

      {notice && (
        <div
          className="p-3 rounded-lg text-sm font-bold text-white flex items-center gap-2"
          style={{ backgroundColor: 'var(--color-c)' }}
        >
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
            onClick={() => {
              setMode(tab.id as typeof mode);
              setCandidates([]);
              resetAuctionBidState();
            }}
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

      {/* 参加者管理・初期設定 */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="text"
            placeholder="参加者名を追加..."
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border-color)' }}
          />
          <button
            onClick={handleAddParticipant}
            className="px-3 py-1.5 rounded-lg font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--color-c)' }}
          >
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

        {/* 参加者ごとの所持状況（半額売却機能付き） */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {participants.map((p, idx) => {
            const isTurn = mode !== 'auction' && currentPlayer?.id === p.id;
            const isLeading = mode === 'auction' && highestBidderId === p.id;
            return (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border-2 space-y-2"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: isTurn || isLeading ? 'var(--color-c)' : 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>
                    {idx + 1}. {p.name}
                    {isTurn && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: 'var(--color-c)' }}
                      >
                        現在の指名者
                      </span>
                    )}
                    {isLeading && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: 'var(--color-c)' }}
                      >
                        最高入札中
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-mono">
                    {mode === 'auction'
                      ? `残 ${p.points}pt`
                      : mode === 'scout'
                      ? `残スカウト ${p.scoutLeft}回`
                      : ''}{' '}
                    / {p.roster.length}/{maxRosterSize}枠
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {p.roster.length === 0 ? (
                    <span className="text-xs opacity-50">獲得ポケモンなし</span>
                  ) : (
                    p.roster.map((item) => {
                      const sellPrice = Math.floor(item.purchasePrice / 2);
                      return (
                        <span
                          key={item.pokemon.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border"
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <span>
                            {item.pokemon.nameJa}({item.pokemon.formName})
                            {item.purchasePrice > 0 && (
                              <span className="ml-1 opacity-60">[{item.purchasePrice}pt]</span>
                            )}
                          </span>
                          {mode === 'auction' && item.purchasePrice > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSellPokemon(p.id, item)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                              title={`購入金額（${item.purchasePrice}pt）の半額で売却`}
                            >
                              <Coins size={11} />
                              売却(+{sellPrice}pt)
                            </button>
                          )}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ドラフト実行エリア */}
      <div
        className="p-5 rounded-xl border space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold flex items-center gap-2">
            <Gavel size={18} style={{ color: 'var(--color-c)' }} />
            <span>
              {mode === 'auction' && 'オークション出品抽選・リアルタイム入札'}
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
            <span>
              {mode === 'auction'
                ? '出品ポケモンを抽選'
                : mode === 'gacha'
                ? 'ガチャを引く'
                : '候補を3体表示'}
            </span>
          </button>
        </div>

        {/* 候補ポケモン表示・操作 */}
        {candidates.length > 0 && (
          <div
            className={
              mode === 'auction'
                ? 'grid grid-cols-1 gap-4 pt-2'
                : 'grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2'
            }
          >
            {candidates.map((pk) => (
              <div
                key={pk.id}
                className="p-4 rounded-xl border-2 space-y-3"
                style={{ borderColor: 'var(--color-c)', backgroundColor: 'var(--bg-main)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs opacity-70">
                      {pk.type1}
                      {pk.type2 ? ` / ${pk.type2}` : ''}
                    </div>
                    <div className="font-bold text-xl">{pk.nameJa}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {pk.formName}
                    </div>
                  </div>

                  {mode === 'auction' && (
                    <div
                      className="px-4 py-2 rounded-xl border text-right"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--color-c)',
                      }}
                    >
                      <div className="text-xs opacity-75">現在の最高入札額</div>
                      <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-c)' }}>
                        {currentBid} <span className="text-sm font-normal">pt</span>
                      </div>
                      <div className="text-xs font-bold mt-0.5">
                        {highestBidder ? `筆頭: ${highestBidder.name}` : '入札待ち'}
                      </div>
                    </div>
                  )}
                </div>

                {mode === 'auction' ? (
                  <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="text-xs font-bold opacity-80">各プレイヤーの入札操作：</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {participants.map((p) => {
                        const next50 = currentBid + 50;
                        const next100 = currentBid + 100;
                        const inputVal = customBids[p.id] ?? next50;
                        const isFull = p.roster.length >= maxRosterSize;

                        return (
                          <div
                            key={p.id}
                            className="p-3 rounded-lg border space-y-2"
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              borderColor:
                                highestBidderId === p.id ? 'var(--color-c)' : 'var(--border-color)',
                            }}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>{p.name}</span>
                              <span className="font-mono">所持: {p.points}pt</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={isFull || p.points < next50}
                                onClick={() => handlePlaceBid(p.id, next50)}
                                className="flex-1 py-1.5 px-2 rounded text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                                style={{ backgroundColor: 'var(--color-c)' }}
                              >
                                +50 ({next50}pt)
                              </button>
                              <button
                                type="button"
                                disabled={isFull || p.points < next100}
                                onClick={() => handlePlaceBid(p.id, next100)}
                                className="flex-1 py-1.5 px-2 rounded text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                                style={{ backgroundColor: 'var(--color-c)' }}
                              >
                                +100 ({next100}pt)
                              </button>
                            </div>

                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                step={10}
                                min={currentBid + 1}
                                max={p.points}
                                value={inputVal}
                                onChange={(e) =>
                                  setCustomBids((prev) => ({
                                    ...prev,
                                    [p.id]: Number(e.target.value),
                                  }))
                                }
                                className="w-1/2 px-2 py-1 rounded border text-xs font-mono"
                                style={{ borderColor: 'var(--border-color)' }}
                              />
                              <button
                                type="button"
                                disabled={isFull || inputVal <= currentBid || p.points < inputVal}
                                onClick={() => handlePlaceBid(p.id, inputVal)}
                                className="w-1/2 py-1 px-2 rounded text-xs font-bold border hover:opacity-80 disabled:opacity-40 cursor-pointer inline-flex items-center justify-center gap-1"
                                style={{
                                  borderColor: 'var(--color-c)',
                                  color: 'var(--color-c)',
                                }}
                              >
                                <ArrowUpCircle size={13} />
                                指定入札
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={!highestBidder || currentBid <= 0}
                      onClick={() => handleAuctionWin(pk)}
                      className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
                      style={{ backgroundColor: '#23845D' }}
                    >
                      {highestBidder
                        ? `${highestBidder.name} が ${currentBid}pt で落札確定！`
                        : '入札が行われると落札確定できます'}
                    </button>
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
          <div
            className="text-xs space-y-1 pt-2 border-t max-h-32 overflow-y-auto"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>

      {/* 対戦ルール設定 */}
      <div
        className="p-5 rounded-xl border space-y-3"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h3 className="font-bold text-base flex items-center gap-2">
          <ShieldAlert size={18} style={{ color: 'var(--color-c)' }} />
          <span>対戦特殊ルール設定</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <label className="block text-xs font-bold mb-1">使用禁止条件（ポケモン・技・道具）</label>
            <input
              type="text"
              value={ruleBannedText}
              onChange={(e) => setRuleBannedText(e.target.value)}
              className="w-full px-3 py-1.5 rounded border"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">固定先発・選出制限</label>
            <input
              type="text"
              value={ruleFixedLead}
              onChange={(e) => setRuleFixedLead(e.target.value)}
              className="w-full px-3 py-1.5 rounded border"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">勝敗後の交換ルール</label>
            <input
              type="text"
              value={ruleAfterBattle}
              onChange={(e) => setRuleAfterBattle(e.target.value)}
              className="w-full px-3 py-1.5 rounded border"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};