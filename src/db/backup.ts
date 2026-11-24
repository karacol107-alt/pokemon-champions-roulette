import { db } from './database';
import type { Pokemon, Move, Item, ChallengePreset, PokemonType } from '../types';

export interface BackupPayload {
  appName: 'PokemonChampionsRoulette';
  version: number;
  exportedAt: string;
  isExternalPokemonImport?: boolean;
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

// kotofurumiya/pokemon_data 形式の配列をアプリの Pokemon 型へ変換
function convertExternalPokemonArray(rawArray: unknown[]): Pokemon[] {
  const today = new Date().toISOString().slice(0, 10);
  const result: Pokemon[] = [];

  rawArray.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as Record<string, unknown>;
    const dexNo = Number(item.no);
    const nameJa = typeof item.name === 'string' ? item.name.trim() : '';
    if (!dexNo || !nameJa) return;

    const formName = typeof item.form === 'string' && item.form.trim() ? item.form.trim() : '通常';
    const rawTypes = Array.isArray(item.types) ? item.types.map(String) : [];
    const type1: PokemonType = VALID_TYPES.includes(rawTypes[0] as PokemonType)
      ? (rawTypes[0] as PokemonType)
      : 'ノーマル';
    const type2: PokemonType | undefined =
      rawTypes[1] && VALID_TYPES.includes(rawTypes[1] as PokemonType)
        ? (rawTypes[1] as PokemonType)
        : undefined;

    const rawStats = (item.stats && typeof item.stats === 'object' ? item.stats : {}) as Record<string, unknown>;
    const abilities = [
      ...(Array.isArray(item.abilities) ? item.abilities.map(String) : []),
      ...(Array.isArray(item.hiddenAbilities) ? item.hiddenAbilities.map(String) : []),
    ];

    const isMega = formName.includes('メガ') || item.isMegaEvolution === true;

    result.push({
      id: `${String(dexNo).padStart(4, '0')}-${formName}-${index}`,
      dexNo,
      nameJa,
      nameEn: nameJa,
      formName,
      type1,
      type2,
      stats: {
        hp: Number(rawStats.hp) || 50,
        atk: Number(rawStats.attack) || 50,
        def: Number(rawStats.defence) || 50,
        spa: Number(rawStats.spAttack) || 50,
        spd: Number(rawStats.spDefence) || 50,
        spe: Number(rawStats.speed) || 50,
      },
      abilities,
      color: '未設定',
      height: 1.0,
      weight: 10.0,
      generation: 1,
      evoStage: 1,
      isMega,
      // 仕様書3-4: 未確認データは安全のため初期状態は使用不可（未確認）として登録
      isAvailableInChampions: false,
      availabilityStatus: 'unconfirmed',
      updatedAt: today,
    });
  });

  return result;
}

export function validateBackupJson(rawText: string): { valid: boolean; error?: string; payload?: BackupPayload } {
  try {
    const parsed = JSON.parse(rawText);

    // 1. kotofurumiya/pokemon_data 等の外部配列JSON形式に対応
    if (Array.isArray(parsed)) {
      const converted = convertExternalPokemonArray(parsed);
      if (converted.length === 0) {
        return { valid: false, error: '有効なポケモンデータが見つかりませんでした。' };
      }
      return {
        valid: true,
        payload: {
          appName: 'PokemonChampionsRoulette',
          version: 1,
          exportedAt: new Date().toISOString(),
          isExternalPokemonImport: true,
          data: {
            pokemons: converted,
            moves: [],
            items: [],
            challenges: [],
          },
        },
      };
    }

    // 2. アプリ標準のバックアップJSON形式
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'JSONオブジェクト形式ではありません。' };
    }
    if (parsed.appName !== 'PokemonChampionsRoulette' || !parsed.data) {
      return { valid: false, error: '対応していないJSONファイル形式です。' };
    }
    if (!Array.isArray(parsed.data.pokemons)) {
      return { valid: false, error: 'ポケモンデータ（pokemons）が破損しているか配列ではありません。' };
    }
    for (const p of parsed.data.pokemons) {
      if (!p.id || typeof p.dexNo !== 'number' || !p.nameJa || !p.type1 || typeof p.isAvailableInChampions !== 'boolean') {
        return { valid: false, error: `不正なポケモンデータが含まれています（ID: ${p?.id || '不明'}）。` };
      }
    }
    return { valid: true, payload: parsed as BackupPayload };
  } catch {
    return { valid: false, error: 'JSONの構文が壊れています。正しいJSONファイルを選択してください。' };
  }
}

export async function restoreBackupJson(payload: BackupPayload): Promise<void> {
  // 外部のポケモンデータ単体インポート時は、既存の技・道具・企画を消さずにポケモンだけ更新する
  if (payload.isExternalPokemonImport) {
    await db.transaction('rw', db.pokemons, async () => {
      await db.pokemons.clear();
      if (payload.data.pokemons?.length) {
        await db.pokemons.bulkAdd(payload.data.pokemons);
      }
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
