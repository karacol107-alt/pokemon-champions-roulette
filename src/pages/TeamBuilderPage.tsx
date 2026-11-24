import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  drawPokemons,
  drawMoves,
  drawItems,
  drawTypes,
  drawSameAbilityTeam,
  type PokemonFilterOptions,
} from '../engine/rouletteEngine';
import type { Pokemon, PokemonType } from '../types';
import { Users, Dices, Save, Trash2, AlertCircle, CheckCircle2, BookmarkPlus, RefreshCw } from 'lucide-react';

const POKEMON_TYPES: PokemonType[] = [
  'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり',
  'かくとう', 'どく', 'じめん', 'ひこう', 'エスパー', 'むし',
  'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー',
];

const NATURES = ['いじっぱり', 'ようき', 'ひかえめ', 'おくびょう', 'ずぶとい', 'おだやか', 'わんぱく', 'しんちょう', 'ゆうかん', 'れいせい', 'まじめ'];

interface TeamBuilderPageProps {
  inheritedChallenge?: string;
}

export const TeamBuilderPage: React.FC<TeamBuilderPageProps> = ({ inheritedChallenge }) => {
  const allPokemons = useLiveQuery(() => db.pokemons.toArray(), []) || [];
  const allMoves = useLiveQuery(() => db.moves.toArray(), []) || [];
  const allItems = useLiveQuery(() => db.items.toArray(), []) || [];
  const presets = useLiveQuery(() => db.roulettePresets.reverse().toArray(), []) || [];

  const availablePokemons = allPokemons.filter((p) => p.isAvailableInChampions);

  const [mode, setMode] = useState<'pokemon' | 'combo' | 'sameAbility' | 'type' | 'move' | 'item'>('pokemon');
  const [drawCount, setDrawCount] = useState<number>(6);
  const [allowDuplicates, setAllowDuplicates] = useState<boolean>(false);

  const [filterType, setFilterType] = useState<PokemonType | ''>('');
  const [singleTypeOnly, setSingleTypeOnly] = useState<boolean>(false);
  const [megaOnly, setMegaOnly] = useState<boolean>(false);
  const [maxSpeed, setMaxSpeed] = useState<string>('');
  const [minWeight, setMinWeight] = useState<string>('');

  const [teamSlots, setTeamSlots] = useState<{ pokemon: Pokemon; item?: string; ability?: string; nature?: string; moves: string[] }[]>([]);
  const [extraResults, setExtraResults] = useState<string[]>([]);
  const [errorInfo, setErrorInfo] = useState<{ reason: string; action: string } | null>(null);

  const [teamName, setTeamName] = useState(inheritedChallenge || '新規ランダムチーム');
  const [format, setFormat] = useState<'シングル' | 'ダブル'>('シングル');
  const [presetName, setPresetName] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleDraw = () => {
    setErrorInfo(null);
    setExtraResults([]);

    const options: PokemonFilterOptions = {
      type: filterType,
      singleTypeOnly,
      megaOnly,
      maxSpeed: maxSpeed ? Number(maxSpeed) : '',
      minWeight: minWeight ? Number(minWeight) : '',
    };

    if (mode === 'sameAbility') {
      const res = drawSameAbilityTeam(allPokemons, 6);
      if (!res.ok) {
        setErrorInfo({ reason: res.errorReason!, action: res.errorAction! });
        return;
      }
      setTeamSlots(
        res.items.map((p) => ({
          pokemon: p,
          ability: res.chosenAbility,
          nature: 'まじめ',
          moves: [],
        }))
      );
      showToast(`特性「${res.chosenAbility}」統一チームを抽選しました！`);
    } else if (mode === 'pokemon') {
      const res = drawPokemons(allPokemons, drawCount, allowDuplicates, options);
      if (!res.ok) {
        setErrorInfo({ reason: res.errorReason!, action: res.errorAction! });
        return;
      }
      setTeamSlots(
        res.items.map((p) => ({
          pokemon: p,
          ability: p.abilities[0] || '未設定',
          nature: 'まじめ',
          moves: [],
        }))
      );
    } else if (mode === 'combo') {
      const pRes = drawPokemons(allPokemons, drawCount, allowDuplicates, options);
      if (!pRes.ok) {
        setErrorInfo({ reason: pRes.errorReason!, action: pRes.errorAction! });
        return;
      }
      const iRes = drawItems(allItems, drawCount, true);
      setTeamSlots(
        pRes.items.map((p, idx) => ({
          pokemon: p,
          ability: p.abilities[Math.floor(Math.random() * Math.max(1, p.abilities.length))] || '未設定',
          item: iRes.ok ? iRes.items[idx]?.nameJa : undefined,
          nature: NATURES[Math.floor(Math.random() * NATURES.length)],
          moves: [],
        }))
      );
    } else if (mode === 'type') {
      const tRes = drawTypes(drawCount, allowDuplicates);
      if (!tRes.ok) {
        setErrorInfo({ reason: tRes.errorReason!, action: tRes.errorAction! });
        return;
      }
      setExtraResults(tRes.items.map((t) => `タイプ：${t}`));
    } else if (mode === 'move') {
      const mRes = drawMoves(allMoves, drawCount, allowDuplicates);
      if (!mRes.ok) {
        setErrorInfo({ reason: mRes.errorReason!, action: mRes.errorAction! });
        return;
      }
      setExtraResults(mRes.items.map((m) => `技：${m.nameJa}（${m.type} / ${m.category}）`));
    } else if (mode === 'item') {
      const iRes = drawItems(allItems, drawCount, allowDuplicates);
      if (!iRes.ok) {
        setErrorInfo({ reason: iRes.errorReason!, action: iRes.errorAction! });
        return;
      }
      setExtraResults(iRes.items.map((i) => `道具：${i.nameJa}（${i.category}）`));
    }
  };

  // 手動変更：指定枠のポケモンを差し替える
  const handleManualSwapPokemon = (slotIndex: number, newPokemonId: string) => {
    const found = availablePokemons.find((p) => p.id === newPokemonId);
    if (!found) return;
    setTeamSlots((prev) =>
      prev.map((slot, idx) =>
        idx === slotIndex
          ? { ...slot, pokemon: found, ability: found.abilities[0] || '未設定' }
          : slot
      )
    );
  };

  // 個別枠の再抽選
  const handleRerollSingleSlot = (slotIndex: number) => {
    const currentIds = teamSlots.map((s) => s.pokemon.id);
    const res = drawPokemons(allPokemons, 1, false, {
      type: filterType,
      singleTypeOnly,
      megaOnly,
      excludedIds: allowDuplicates ? [] : currentIds,
    });
    if (!res.ok) {
      setErrorInfo({ reason: res.errorReason!, action: res.errorAction! });
      return;
    }
    const p = res.items[0];
    setTeamSlots((prev) =>
      prev.map((slot, idx) =>
        idx === slotIndex ? { ...slot, pokemon: p, ability: p.abilities[0] || '未設定' } : slot
      )
    );
  };

  // オリジナル抽選セットの保存
  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    await db.roulettePresets.add({
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      mode,
      drawCount,
      allowDuplicates,
      filterType,
      singleTypeOnly,
      megaOnly,
      maxSpeed,
      minWeight,
      createdAt: new Date().toLocaleDateString('ja-JP'),
    });
    setPresetName('');
    showToast('オリジナル抽選セットを保存しました');
  };

  const handleSaveTeam = async () => {
    if (teamSlots.length === 0) return;
    await db.savedTeams.add({
      id: `team-${Date.now()}`,
      name: teamName.trim() || '無題のチーム',
      format,
      memo: inheritedChallenge ? `企画: ${inheritedChallenge}` : '',
      members: teamSlots.slice(0, 6),
      createdAt: new Date().toLocaleString('ja-JP'),
    });
    showToast('チームを保存データ・履歴に保存しました！');
  };

  const [dismissedChallenge, setDismissedChallenge] = useState<string | null>(null);
  const activeInheritedChallenge = inheritedChallenge && inheritedChallenge !== dismissedChallenge ? inheritedChallenge : null;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-b)' }}>
          B：ポケモン・チーム作成
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          使用可能ポケモン（{availablePokemons.length}体）から条件抽選＆手動調整して6匹編成
        </p>
      </header>

      {activeInheritedChallenge && (
        <div className="p-3.5 rounded-xl border text-sm flex items-center justify-between gap-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-a)' }}>
          <div>
            <span className="font-bold" style={{ color: 'var(--color-a)' }}>引き継ぎ企画：</span>
            <span>{activeInheritedChallenge}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDismissedChallenge(inheritedChallenge || null);
              sessionStorage.removeItem('inheritedChallenge');
              localStorage.removeItem('inheritedChallenge');
            }}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border hover:opacity-80 cursor-pointer"
            style={{ borderColor: 'var(--color-a)', color: 'var(--color-a)' }}
            title="引き継ぎ企画を解除"
          >
            × 解除
          </button>
        </div>
      )}

      {savedNotice && (
        <div className="p-3 rounded-lg text-sm font-bold text-white flex items-center gap-2" style={{ backgroundColor: 'var(--color-b)' }}>
          <CheckCircle2 size={18} />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 抽選カテゴリー選択タブ */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'pokemon', label: 'ポケモン抽選' },
          { id: 'combo', label: '複合（ポケモン＋特性＋道具＋性格）' },
          { id: 'sameAbility', label: '同じ特性で統一（6匹以上条件）' },
          { id: 'type', label: 'タイプ抽選' },
          { id: 'move', label: '技抽選' },
          { id: 'item', label: '道具抽選' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id as typeof mode)}
            className="px-3.5 py-2 rounded-lg text-sm font-bold border cursor-pointer"
            style={{
              backgroundColor: mode === tab.id ? 'var(--color-b)' : 'var(--bg-card)',
              color: mode === tab.id ? '#ffffff' : 'var(--text-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 保存済みオリジナル抽選セットの呼び出し */}
      {presets.length > 0 && (
        <div className="p-3.5 rounded-xl border flex flex-wrap items-center gap-2 text-xs" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <span className="font-bold">保存済み抽選セット：</span>
          {presets.map((pr) => (
            <button
              key={pr.id}
              onClick={() => {
                setMode(pr.mode);
                setDrawCount(pr.drawCount);
                setAllowDuplicates(pr.allowDuplicates);
                setFilterType(pr.filterType);
                setSingleTypeOnly(pr.singleTypeOnly);
                setMegaOnly(pr.megaOnly);
                setMaxSpeed(pr.maxSpeed);
                setMinWeight(pr.minWeight);
                showToast(`抽選セット「${pr.name}」を読み込みました`);
              }}
              className="px-2.5 py-1 rounded border font-medium cursor-pointer hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              {pr.name}
            </button>
          ))}
        </div>
      )}

      {/* 抽選設定フォーム */}
      <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <label className="block text-xs font-bold mb-1">抽選数</label>
            <input
              type="number"
              min={1}
              max={6}
              disabled={mode === 'sameAbility'}
              value={mode === 'sameAbility' ? 6 : drawCount}
              onChange={(e) => setDrawCount(Math.min(6, Math.max(1, Number(e.target.value))))}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          {(mode === 'pokemon' || mode === 'combo') && (
            <>
              <div>
                <label className="block text-xs font-bold mb-1">タイプ指定</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as PokemonType | '')}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <option value="">指定なし</option>
                  {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">素早さ上限 (S以下)</label>
                <input
                  type="number"
                  placeholder="例: 60"
                  value={maxSpeed}
                  onChange={(e) => setMaxSpeed(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">体重下限 (kg以上)</label>
                <input
                  type="number"
                  placeholder="例: 100"
                  value={minWeight}
                  onChange={(e) => setMinWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} />
            <span>重複許可</span>
          </label>
          {(mode === 'pokemon' || mode === 'combo') && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={singleTypeOnly} onChange={(e) => setSingleTypeOnly(e.target.checked)} />
                <span>単タイプのみ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={megaOnly} onChange={(e) => setMegaOnly(e.target.checked)} />
                <span>メガシンカのみ</span>
              </label>
            </>
          )}
        </div>

        <button
          onClick={handleDraw}
          className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-base cursor-pointer"
          style={{ backgroundColor: 'var(--color-b)' }}
        >
          <Dices size={20} />
          <span>抽選を実行する</span>
        </button>

        {/* オリジナル抽選セット保存 */}
        <div className="pt-3 border-t flex gap-2 text-xs" style={{ borderColor: 'var(--border-color)' }}>
          <input
            type="text"
            placeholder="この条件をオリジナル抽選セットとして保存（例：ヘビー級6匹抽選）"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border-color)' }}
          />
          <button
            type="button"
            onClick={handleSavePreset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border cursor-pointer"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <BookmarkPlus size={14} />
            <span>条件セット保存</span>
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {errorInfo && (
        <div className="p-4 rounded-xl border-2 space-y-1 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: '#dc2626' }}>
          <div className="flex items-center gap-2 font-bold text-red-600">
            <AlertCircle size={18} />
            <span>条件を満たせないため抽選を中止しました</span>
          </div>
          <p><strong>原因：</strong>{errorInfo.reason}</p>
          <p><strong>対処法：</strong>{errorInfo.action}</p>
        </div>
      )}

      {/* タイプ・技・道具の抽選結果 */}
      {extraResults.length > 0 && (
        <div className="p-5 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-b)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--color-b)' }}>抽選結果</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {extraResults.map((txt, i) => (
              <div key={i} className="p-3 rounded-lg border font-bold text-sm" style={{ borderColor: 'var(--border-color)' }}>
                {i + 1}. {txt}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* チーム編成スロット（手動変更＆個別再抽選対応） */}
      {teamSlots.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users size={20} style={{ color: 'var(--color-b)' }} />
              <span>編成チーム（{teamSlots.length} / 6匹）※手動変更・個別再抽選可</span>
            </h3>
            <button onClick={() => setTeamSlots([])} className="text-xs text-red-600 flex items-center gap-1 cursor-pointer">
              <Trash2 size={14} />
              <span>クリア</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {teamSlots.map((slot, index) => (
              <div
                key={`${slot.pokemon.id}-${index}`}
                className="p-4 rounded-xl border space-y-2"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono opacity-60">枠 {index + 1} (#{String(slot.pokemon.dexNo).padStart(4, '0')})</span>
                  <button
                    onClick={() => handleRerollSingleSlot(index)}
                    className="text-xs flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer hover:opacity-75"
                    style={{ borderColor: 'var(--border-color)' }}
                    title="この枠だけ引き直す"
                  >
                    <RefreshCw size={12} />
                    <span>再抽選</span>
                  </button>
                </div>

                {/* ポケモン手動差し替えセレクト */}
                <select
                  value={slot.pokemon.id}
                  onChange={(e) => handleManualSwapPokemon(index, e.target.value)}
                  className="w-full font-bold text-sm px-2 py-1.5 rounded border"
                  style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
                >
                  {availablePokemons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameJa}（{p.formName}）
                    </option>
                  ))}
                </select>

                <div className="text-xs space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center justify-between">
                    <span>タイプ：</span>
                    <strong>{slot.pokemon.type1}{slot.pokemon.type2 ? ` / ${slot.pokemon.type2}` : ''}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>特性：</span>
                    <input
                      type="text"
                      value={slot.ability || ''}
                      onChange={(e) =>
                        setTeamSlots((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, ability: e.target.value } : s))
                        )
                      }
                      className="w-32 px-1.5 py-0.5 rounded border text-right"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>持ち物：</span>
                    <input
                      type="text"
                      placeholder="なし"
                      value={slot.item || ''}
                      onChange={(e) =>
                        setTeamSlots((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, item: e.target.value } : s))
                        )
                      }
                      className="w-32 px-1.5 py-0.5 rounded border text-right"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>性格：</span>
                    <select
                      value={slot.nature || 'まじめ'}
                      onChange={(e) =>
                        setTeamSlots((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, nature: e.target.value } : s))
                        )
                      }
                      className="px-1.5 py-0.5 rounded border"
                      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    >
                      {NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* チーム保存バー */}
          <div className="p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-stretch sm:items-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="チーム名を入力..."
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border-color)' }}
            />
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'シングル' | 'ダブル')}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <option value="シングル">シングル</option>
              <option value="ダブル">ダブル</option>
            </select>
            <button
              onClick={handleSaveTeam}
              className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--color-b)' }}
            >
              <Save size={16} />
              <span>チームを保存</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};