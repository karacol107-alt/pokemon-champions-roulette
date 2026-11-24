import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { exportBackupJson, validateBackupJson, restoreBackupJson, type BackupPayload } from '../db/backup';
import { SAMPLE_POKEMONS, SAMPLE_MOVES, SAMPLE_ITEMS, INITIAL_CHALLENGES } from '../data/sampleData';
import type { Pokemon, PokemonType } from '../types';
import { Download, Upload, Plus, Trash2, CheckCircle2, XCircle, Search, Sparkles, AlertTriangle } from 'lucide-react';

const POKEMON_TYPES: PokemonType[] = [
  'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり',
  'かくとう', 'どく', 'じめん', 'ひこう', 'エスパー', 'むし',
  'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー',
];

export const DatabasePage: React.FC = () => {
  const pokemons = useLiveQuery(() => db.pokemons.orderBy('dexNo').toArray(), []) || [];
  const moves = useLiveQuery(() => db.moves.toArray(), []) || [];
  const items = useLiveQuery(() => db.items.toArray(), []) || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAvailable, setFilterAvailable] = useState<'all' | 'available' | 'unavailable'>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // バックアップ復元確認用ステート
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新規ポケモン追加フォームステート
  const [newDexNo, setNewDexNo] = useState('1');
  const [newNameJa, setNewNameJa] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newFormName, setNewFormName] = useState('通常');
  const [newType1, setNewType1] = useState<PokemonType>('ノーマル');
  const [newType2, setNewType2] = useState<string>('');
  const [newStats, setNewStats] = useState({ hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 });
  const [newAbilities, setNewAbilities] = useState('');
  const [newColor, setNewColor] = useState('あか');
  const [newHeight, setNewHeight] = useState('1.0');
  const [newWeight, setNewWeight] = useState('30.0');
  const [newGen, setNewGen] = useState('1');
  const [newEvoStage, setNewEvoStage] = useState('1');
  const [newIsMega, setNewIsMega] = useState(false);
  const [newIsAvailable, setNewIsAvailable] = useState(true);

  const handleLoadSampleData = async () => {
    await db.pokemons.bulkPut(SAMPLE_POKEMONS);
    await db.moves.bulkPut(SAMPLE_MOVES);
    await db.items.bulkPut(SAMPLE_ITEMS);
    await db.challenges.bulkPut(INITIAL_CHALLENGES);
    setStatusMessage({ type: 'success', text: 'サンプルデータ（ポケモン・技・道具・初期企画）を登録しました。' });
  };

  const handleToggleAvailable = async (pokemon: Pokemon) => {
    await db.pokemons.update(pokemon.id, {
      isAvailableInChampions: !pokemon.isAvailableInChampions,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleDeletePokemon = async (pokemon: Pokemon) => {
    if (window.confirm(`「${pokemon.nameJa}（${pokemon.formName}）」をデータベースから削除しますか？`)) {
      await db.pokemons.delete(pokemon.id);
    }
  };

  const handleAddPokemon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameJa.trim()) return;

    const dex = Number(newDexNo) || 0;
    const formSlug = newFormName.trim() || '通常';
    const id = `${String(dex).padStart(4, '0')}-${formSlug}-${Date.now().toString(36)}`;

    const record: Pokemon = {
      id,
      dexNo: dex,
      nameJa: newNameJa.trim(),
      nameEn: newNameEn.trim() || newNameJa.trim(),
      formName: formSlug,
      type1: newType1,
      type2: newType2 ? (newType2 as PokemonType) : undefined,
      stats: {
        hp: Number(newStats.hp) || 50,
        atk: Number(newStats.atk) || 50,
        def: Number(newStats.def) || 50,
        spa: Number(newStats.spa) || 50,
        spd: Number(newStats.spd) || 50,
        spe: Number(newStats.spe) || 50,
      },
      abilities: newAbilities.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
      color: newColor,
      height: Number(newHeight) || 1.0,
      weight: Number(newWeight) || 10.0,
      generation: Number(newGen) || 1,
      evoStage: Number(newEvoStage) || 1,
      isMega: newIsMega,
      isAvailableInChampions: newIsAvailable,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    await db.pokemons.add(record);
    setNewNameJa('');
    setNewNameEn('');
    setShowAddForm(false);
    setStatusMessage({ type: 'success', text: `${record.nameJa}（${record.formName}）を追加しました。` });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = validateBackupJson(String(reader.result || ''));
      if (!result.valid || !result.payload) {
        setStatusMessage({ type: 'error', text: result.error || 'ファイルの読み込みに失敗しました。' });
        setPendingBackup(null);
      } else {
        setPendingBackup(result.payload);
        setStatusMessage(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!pendingBackup) return;
    await restoreBackupJson(pendingBackup);
    setStatusMessage({
      type: 'success',
      text: `バックアップ（${pendingBackup.exportedAt.slice(0, 10)} 作成）からデータを復元しました。`,
    });
    setPendingBackup(null);
  };

  const filteredPokemons = pokemons.filter((p) => {
    const matchesQuery =
      p.nameJa.includes(searchQuery) ||
      p.formName.includes(searchQuery) ||
      String(p.dexNo).includes(searchQuery) ||
      p.type1.includes(searchQuery) ||
      (p.type2 && p.type2.includes(searchQuery));
    if (!matchesQuery) return false;
    if (filterAvailable === 'available') return p.isAvailableInChampions;
    if (filterAvailable === 'unavailable') return !p.isAvailableInChampions;
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">ポケモンデータベース</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            登録ポケモン: {pokemons.length}体（使用可能: {pokemons.filter((p) => p.isAvailableInChampions).length}体） / 技: {moves.length}件 / 道具: {items.length}件
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLoadSampleData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <Sparkles size={16} />
            <span>サンプル投入</span>
          </button>

          <button
            onClick={() => exportBackupJson()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <Download size={16} />
            <span>JSONバックアップ</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <Upload size={16} />
            <span>JSON復元</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
        </div>
      </header>

      {/* ステータスメッセージ */}
      {statusMessage && (
        <div
          className="p-4 rounded-xl border text-sm flex items-center justify-between"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: statusMessage.type === 'error' ? '#dc2626' : 'var(--color-b)',
            color: statusMessage.type === 'error' ? '#dc2626' : 'var(--color-b)',
          }}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="underline text-xs ml-4 cursor-pointer">閉じる</button>
        </div>
      )}

      {/* 復元前の確認ダイアログ */}
      {pendingBackup && (
        <div className="p-5 rounded-xl border-2 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-c)' }}>
          <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-c)' }}>
            <AlertTriangle size={20} />
            <span>バックアップ復元の確認</span>
          </div>
          <p className="text-sm">
            現在の端末内データを上書きし、以下のデータ（{pendingBackup.exportedAt.slice(0, 10)} 出力）を復元しますか？
          </p>
          <ul className="text-xs space-y-1 opacity-80">
            <li>・ポケモンデータ：{pendingBackup.data.pokemons.length} 件</li>
            <li>・技データ：{pendingBackup.data.moves?.length || 0} 件</li>
            <li>・道具データ：{pendingBackup.data.items?.length || 0} 件</li>
            <li>・チャレンジ企画：{pendingBackup.data.challenges?.length || 0} 件</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <button
              onClick={confirmRestore}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--color-c)' }}
            >
              上書きして復元する
            </button>
            <button
              onClick={() => setPendingBackup(null)}
              className="px-4 py-2 rounded-lg text-sm border cursor-pointer"
              style={{ borderColor: 'var(--border-color)' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 検索＆追加バー */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 opacity-50" />
          <input
            type="text"
            placeholder="ポケモン名・フォルム・図鑑番号・タイプで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          />
        </div>

        <select
          value={filterAvailable}
          onChange={(e) => setFilterAvailable(e.target.value as 'all' | 'available' | 'unavailable')}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <option value="all">すべて表示</option>
          <option value="available">Champions使用可のみ</option>
          <option value="unavailable">使用不可・未確認のみ</option>
        </select>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer"
          style={{ backgroundColor: 'var(--color-b)' }}
        >
          <Plus size={16} />
          <span>新規登録</span>
        </button>
      </div>

      {/* 新規ポケモン・フォルム登録フォーム */}
      {showAddForm && (
        <form
          onSubmit={handleAddPokemon}
          className="p-5 rounded-xl border space-y-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <h3 className="font-bold text-base">ポケモン・フォルム新規登録</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs mb-1 opacity-75">全国図鑑No</label>
              <input type="number" required value={newDexNo} onChange={(e) => setNewDexNo(e.target.value)} className="w-full px-2.5 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">日本語名 *</label>
              <input type="text" required placeholder="例：リザードン" value={newNameJa} onChange={(e) => setNewNameJa(e.target.value)} className="w-full px-2.5 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">フォルム名（独立抽選枠）</label>
              <input type="text" placeholder="通常 / メガX / アローラ等" value={newFormName} onChange={(e) => setNewFormName(e.target.value)} className="w-full px-2.5 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">英語名</label>
              <input type="text" placeholder="Charizard" value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} className="w-full px-2.5 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>

            <div>
              <label className="block text-xs mb-1 opacity-75">タイプ1</label>
              <select value={newType1} onChange={(e) => setNewType1(e.target.value as PokemonType)} className="w-full px-2.5 py-1.5 rounded border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">タイプ2（任意）</label>
              <select value={newType2} onChange={(e) => setNewType2(e.target.value)} className="w-full px-2.5 py-1.5 rounded border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <option value="">なし</option>
                {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">特性（カンマ区切り）</label>
              <input type="text" placeholder="もうか, サンパワー" value={newAbilities} onChange={(e) => setNewAbilities(e.target.value)} className="w-full px-2.5 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">図鑑の色 / 世代</label>
              <div className="flex gap-1">
                <input type="text" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-1/2 px-2 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
                <input type="number" min="1" max="10" value={newGen} onChange={(e) => setNewGen(e.target.value)} className="w-1/2 px-2 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2 text-xs">
            {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map((stat) => (
              <div key={stat}>
                <label className="block uppercase mb-1 opacity-75">{stat}</label>
                <input
                  type="number"
                  value={newStats[stat]}
                  onChange={(e) => setNewStats({ ...newStats, [stat]: Number(e.target.value) })}
                  className="w-full px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block mb-1 opacity-75">高さ (m)</label>
              <input type="number" step="0.1" value={newHeight} onChange={(e) => setNewHeight(e.target.value)} className="w-full px-2 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
            <div>
              <label className="block mb-1 opacity-75">重さ (kg)</label>
              <input type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="w-full px-2 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
            <div>
              <label className="block mb-1 opacity-75">進化段階 (1〜3)</label>
              <input type="number" min="1" max="3" value={newEvoStage} onChange={(e) => setNewEvoStage(e.target.value)} className="w-full px-2 py-1.5 rounded border" style={{ borderColor: 'var(--border-color)' }} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={newIsMega} onChange={(e) => setNewIsMega(e.target.checked)} />
              <span>メガシンカフォルム</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={newIsAvailable} onChange={(e) => setNewIsAvailable(e.target.checked)} />
              <span>Championsで使用可能（確認済み）</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-b)' }}>
              データベースに保存
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg text-sm border cursor-pointer" style={{ borderColor: 'var(--border-color)' }}>
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* ポケモン一覧テーブル */}
      {filteredPokemons.length === 0 ? (
        <div className="p-8 rounded-xl border text-center space-y-2" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <p className="font-medium">該当するポケモンデータがありません</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            右上の「サンプル投入」または「新規登録」「JSON復元」からデータを登録してください。
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b text-xs" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
                <th className="p-3">No.</th>
                <th className="p-3">ポケモン / フォルム</th>
                <th className="p-3">タイプ</th>
                <th className="p-3">種族値 (H-A-B-C-D-S)</th>
                <th className="p-3">Champions使用可否</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPokemons.map((p) => (
                <tr key={p.id} className="border-b last:border-none" style={{ borderColor: 'var(--border-color)' }}>
                  <td className="p-3 font-mono text-xs">#{String(p.dexNo).padStart(4, '0')}</td>
                  <td className="p-3">
                    <div className="font-bold">{p.nameJa}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.formName} {p.isMega && <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px]">MEGA</span>}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {p.type1}{p.type2 ? ` / ${p.type2}` : ''}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {p.stats.hp}-{p.stats.atk}-{p.stats.def}-{p.stats.spa}-{p.stats.spd}-{p.stats.spe}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleAvailable(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
                      style={{
                        backgroundColor: p.isAvailableInChampions ? 'rgba(35, 132, 93, 0.15)' : 'rgba(220, 38, 38, 0.12)',
                        color: p.isAvailableInChampions ? 'var(--color-b)' : '#dc2626',
                      }}
                    >
                      {p.isAvailableInChampions ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      <span>{p.isAvailableInChampions ? '使用可能' : '使用不可 / 未確認'}</span>
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDeletePokemon(p)}
                      className="p-1.5 rounded hover:opacity-70 text-red-600 cursor-pointer"
                      title="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
