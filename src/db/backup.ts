import { db } from './database';
import type { Pokemon, Move, Item, ChallengePreset } from '../types';

export interface BackupPayload {
  appName: 'PokemonChampionsRoulette';
  version: number;
  exportedAt: string;
  data: {
    pokemons: Pokemon[];
    moves: Move[];
    items: Item[];
    challenges: ChallengePreset[];
  };
}

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

export function validateBackupJson(rawText: string): { valid: boolean; error?: string; payload?: BackupPayload } {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'JSONオブジェクト形式ではありません。' };
    }
    if (parsed.appName !== 'PokemonChampionsRoulette' || !parsed.data) {
      return { valid: false, error: 'Pokémon Champions Roulette のバックアップファイルではありません。' };
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
    return { valid: false, error: 'JSONの構文が壊れています。正しいバックアップファイルを選択してください。' };
  }
}

export async function restoreBackupJson(payload: BackupPayload): Promise<void> {
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
