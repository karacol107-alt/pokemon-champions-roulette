import { db } from './database';
import type { Pokemon, Move, Item, ChallengePreset, PokemonType } from '../types';

export interface BackupPayload {
  appName: 'PokemonChampionsRoulette';
  version: number;
  exportedAt: string;
  importMode?: 'full' | 'pokemons' | 'moves' | 'items';
  data: {
    pokemons: Pokemon[];
    moves: Move[];
    items: Item[];
    challenges: ChallengePreset[];
  };
}

const VALID_TYPES: PokemonType[] = [
  'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり',
  'かくとう', 'どく', 'じめん', 'ひこう', 'エスパー', 'むし',
  'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー',
];

export async function exportBackupJson(): Promise<void> {
  const [pokemons, moves, items, challenges] = await Promise.all([
    db.pokemons.toArray(),
    db.moves.toArray(),
    db.items.toArray(),
    db.challenges.toArray(),
  ]);

  const payload: BackupPayload = {
    appName: 'PokemonChampionsRoulette',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { pokemons, moves, items, challenges },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `champions-roulette-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 1. 外部ポケモン配列の変換
function convertExternalPokemonArray(rawArray: unknown[]): Pokemon[] {
  const today = new Date().toISOString().slice(0, 10);
  const result: Pokemon[] = [];

  rawArray.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as Record<string, unknown>;
    const dexNo = Number(item.no ?? item.dexNo);
    const nameJa = typeof (item.name ?? item.nameJa) === 'string' ? String(item.name ?? item.nameJa).trim() : '';
    if (!dexNo || !nameJa) return;

    const formName = typeof (item.form ?? item.formName) === 'string' && String(item.form ?? item.formName).trim()
      ? String(item.form ?? item.formName).trim()
      : '通常';
    const rawTypes = Array.isArray(item.types) ? item.types.map(String) : [String(item.type1 || ''), String(item.type2 || '')].filter(Boolean);
    const type1: PokemonType = VALID_TYPES.includes(rawTypes[0] as PokemonType) ? (rawTypes[0] as PokemonType) : 'ノーマル';
    const type2: PokemonType | undefined = rawTypes[1] && VALID_TYPES.includes(rawTypes[1] as PokemonType) ? (rawTypes[1] as PokemonType) : undefined;

    const rawStats = (item.stats && typeof item.stats === 'object' ? item.stats : {}) as Record<string, unknown>;
    const abilities = [
      ...(Array.isArray(item.abilities) ? item.abilities.map(String) : []),
      ...(Array.isArray(item.hiddenAbilities) ? item.hiddenAbilities.map(String) : []),
    ];

    const isMega = formName.includes('メガ') || item.isMegaEvolution === true || item.isMega === true;

    result.push({
      id: `${String(dexNo).padStart(4, '0')}-${formName}-${index}`,
      dexNo,
      nameJa,
      nameEn: typeof item.nameEn === 'string' ? item.nameEn : nameJa,
      formName,
      type1,
      type2,
      stats: {
        hp: Number(rawStats.hp) || 50,
        atk: Number(rawStats.attack ?? rawStats.atk) || 50,
        def: Number(rawStats.defence ?? rawStats.def) || 50,
        spa: Number(rawStats.spAttack ?? rawStats.spa) || 50,
        spd: Number(rawStats.spDefence ?? rawStats.spd) || 50,
        spe: Number(rawStats.speed ?? rawStats.spe) || 50,
      },
      abilities,
      color: typeof item.color === 'string' ? item.color : '未設定',
      height: Number(item.height) || 1.0,
      weight: Number(item.weight) || 10.0,
      generation: Number(item.generation) || 1,
      evoStage: Number(item.evoStage) || 1,
      isMega,
      isAvailableInChampions: typeof item.isAvailableInChampions === 'boolean' ? item.isAvailableInChampions : false,
      availabilityStatus: item.isAvailableInChampions ? 'available' : 'unconfirmed',
      updatedAt: today,
    });
  });

  return result;
}

// 2. 外部技配列の変換
function convertExternalMoveArray(rawArray: unknown[]): Move[] {
  const result: Move[] = [];
  rawArray.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as Record<string, unknown>;
    const nameJa = String(item.nameJa ?? item.name ?? '').trim();
    if (!nameJa) return;

    const rawType = String(item.type ?? 'ノーマル') as PokemonType;
    const type: PokemonType = VALID_TYPES.includes(rawType) ? rawType : 'ノーマル';
    const rawCat = String(item.category ?? '物理');
    const category: '物理' | '特殊' | '変化' =
      rawCat === '物理' || rawCat === '特殊' || rawCat === '変化' ? rawCat : '物理';

    result.push({
      id: typeof item.id === 'string' ? item.id : `move-${index}-${Date.now().toString(36)}`,
      nameJa,
      type,
      category,
      power: item.power === null || item.power === undefined || item.power === '' ? null : Number(item.power),
      accuracy: item.accuracy === null || item.accuracy === undefined || item.accuracy === '' ? null : Number(item.accuracy),
      isAvailableInChampions: typeof item.isAvailableInChampions === 'boolean' ? item.isAvailableInChampions : true,
    });
  });
  return result;
}

// 3. 外部道具配列の変換
function convertExternalItemArray(rawArray: unknown[]): Item[] {
  const result: Item[] = [];
  rawArray.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as Record<string, unknown>;
    const nameJa = String(item.nameJa ?? item.name ?? '').trim();
    if (!nameJa) return;

    const rawCat = String(item.category ?? '通常');
    const category: 'きのみ' | 'メガストーン' | '通常' | '禁止' =
      rawCat === 'きのみ' || rawCat === 'メガストーン' || rawCat === '通常' || rawCat === '禁止' ? rawCat : '通常';

    result.push({
      id: typeof item.id === 'string' ? item.id : `item-${index}-${Date.now().toString(36)}`,
      nameJa,
      category,
      relatedPokemonOrType: typeof item.relatedPokemonOrType === 'string' ? item.relatedPokemonOrType : undefined,
      isAvailableInChampions: typeof item.isAvailableInChampions === 'boolean' ? item.isAvailableInChampions : true,
    });
  });
  return result;
}

export function validateBackupJson(rawText: string): { valid: boolean; error?: string; payload?: BackupPayload } {
  try {
    const parsed = JSON.parse(rawText);

    // 配列形式の外部JSONを自動判別
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return { valid: false, error: 'JSON配列が空です。' };
      }
      const first = parsed[0] as Record<string, unknown>;

      // ポケモンデータ判定（no または dexNo、または stats を持つ）
      if ('no' in first || 'dexNo' in first || 'stats' in first) {
        const converted = convertExternalPokemonArray(parsed);
        if (converted.length === 0) return { valid: false, error: '有効なポケモンデータが見つかりませんでした。' };
        return {
          valid: true,
          payload: {
            appName: 'PokemonChampionsRoulette',
            version: 1,
            exportedAt: new Date().toISOString(),
            importMode: 'pokemons',
            data: { pokemons: converted, moves: [], items: [], challenges: [] },
          },
        };
      }

      // 技データ判定（power または accuracy、または category が物理/特殊/変化）
      if ('power' in first || 'accuracy' in first || ['物理', '特殊', '変化'].includes(String(first.category))) {
        const converted = convertExternalMoveArray(parsed);
        if (converted.length === 0) return { valid: false, error: '有効な技データが見つかりませんでした。' };
        return {
          valid: true,
          payload: {
            appName: 'PokemonChampionsRoulette',
            version: 1,
            exportedAt: new Date().toISOString(),
            importMode: 'moves',
            data: { pokemons: [], moves: converted, items: [], challenges: [] },
          },
        };
      }

      // 道具データ判定（name / nameJa を持つ）
      if ('name' in first || 'nameJa' in first) {
        const converted = convertExternalItemArray(parsed);
        if (converted.length === 0) return { valid: false, error: '有効な道具データが見つかりませんでした。' };
        return {
          valid: true,
          payload: {
            appName: 'PokemonChampionsRoulette',
            version: 1,
            exportedAt: new Date().toISOString(),
            importMode: 'items',
            data: { pokemons: [], moves: [], items: converted, challenges: [] },
          },
        };
      }

      return { valid: false, error: '配列内のデータ形式を判別できませんでした。' };
    }

    // アプリ標準のバックアップJSON形式
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'JSONオブジェクト形式ではありません。' };
    }
    if (parsed.appName !== 'PokemonChampionsRoulette' || !parsed.data) {
      return { valid: false, error: '対応していないJSONファイル形式です。' };
    }
    if (!Array.isArray(parsed.data.pokemons)) {
      return { valid: false, error: 'ポケモンデータ（pokemons）が破損しているか配列ではありません。' };
    }
    return { valid: true, payload: { ...(parsed as BackupPayload), importMode: 'full' } };
  } catch {
    return { valid: false, error: 'JSONの構文が壊れています。正しいJSONファイルを選択してください。' };
  }
}

export async function restoreBackupJson(payload: BackupPayload): Promise<void> {
  if (payload.importMode === 'pokemons') {
    await db.transaction('rw', db.pokemons, async () => {
      await db.pokemons.clear();
      if (payload.data.pokemons?.length) await db.pokemons.bulkAdd(payload.data.pokemons);
    });
    return;
  }

  if (payload.importMode === 'moves') {
    await db.transaction('rw', db.moves, async () => {
      await db.moves.clear();
      if (payload.data.moves?.length) await db.moves.bulkAdd(payload.data.moves);
    });
    return;
  }

  if (payload.importMode === 'items') {
    await db.transaction('rw', db.items, async () => {
      await db.items.clear();
      if (payload.data.items?.length) await db.items.bulkAdd(payload.data.items);
    });
    return;
  }

  await db.transaction('rw', db.pokemons, db.moves, db.items, db.challenges, async () => {
    await db.pokemons.clear();
    await db.moves.clear();
    await db.items.clear();
    await db.challenges.clear();

    if (payload.data.pokemons?.length) await db.pokemons.bulkAdd(payload.data.pokemons);
    if (payload.data.moves?.length) await db.moves.bulkAdd(payload.data.moves);
    if (payload.data.items?.length) await db.items.bulkAdd(payload.data.items);
    if (payload.data.challenges?.length) await db.challenges.bulkAdd(payload.data.challenges);
  });
}
