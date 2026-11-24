import type { Pokemon, Move, Item, PokemonType } from '../types';

export interface DrawResult<T> {
  ok: boolean;
  items: T[];
  chosenAbility?: string;
  errorReason?: string;
  errorAction?: string;
}

export interface PokemonFilterOptions {
  type?: PokemonType | '';
  singleTypeOnly?: boolean;
  generation?: number | '';
  megaOnly?: boolean;
  excludeMega?: boolean;
  maxSpeed?: number | '';
  minWeight?: number | '';
  sameAbility?: string;
  excludedIds?: string[];
}

function pickRandom<T>(pool: T[], count: number, allowDuplicates: boolean): T[] {
  const result: T[] = [];
  if (allowDuplicates) {
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool[idx]);
    }
  } else {
    const copy = [...pool];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
  }
  return result;
}

export function drawPokemons(
  allPokemons: Pokemon[],
  count: number,
  allowDuplicates: boolean,
  options: PokemonFilterOptions = {}
): DrawResult<Pokemon> {
  let pool = allPokemons.filter((p) => p.isAvailableInChampions);

  if (pool.length === 0) {
    return {
      ok: false,
      items: [],
      errorReason: 'Pokémon Champions で使用可能なポケモンが1体も登録されていません。',
      errorAction: '「ポケモンデータベース」画面からサンプルデータを投入するか、使用可能フラグをONにしてください。',
    };
  }

  if (options.excludedIds && options.excludedIds.length > 0) {
    pool = pool.filter((p) => !options.excludedIds!.includes(p.id));
  }
  if (options.type) {
    pool = pool.filter((p) => p.type1 === options.type || p.type2 === options.type);
  }
  if (options.singleTypeOnly) {
    pool = pool.filter((p) => !p.type2);
  }
  if (options.generation) {
    pool = pool.filter((p) => p.generation === options.generation);
  }
  if (options.megaOnly) {
    pool = pool.filter((p) => p.isMega);
  }
  if (options.excludeMega) {
    pool = pool.filter((p) => !p.isMega);
  }
  if (options.maxSpeed !== undefined && options.maxSpeed !== '') {
    pool = pool.filter((p) => p.stats.spe <= Number(options.maxSpeed));
  }
  if (options.minWeight !== undefined && options.minWeight !== '') {
    pool = pool.filter((p) => p.weight >= Number(options.minWeight));
  }
  if (options.sameAbility) {
    pool = pool.filter((p) => p.abilities.includes(options.sameAbility!));
  }

  if (pool.length === 0) {
    return {
      ok: false,
      items: [],
      errorReason: '指定された条件に一致する使用可能ポケモンが0体です。',
      errorAction: 'タイプ・種族値・メガシンカなどの絞り込み条件を緩めるか、データベースに該当ポケモンを追加してください。',
    };
  }

  if (!allowDuplicates && pool.length < count) {
    return {
      ok: false,
      items: [],
      errorReason: `重複禁止で ${count} 体の抽選が必要ですが、条件に合うポケモンが ${pool.length} 体しかいません。`,
      errorAction: '抽選数を減らすか、「重複許可」をONにする、または絞り込み条件を緩和してください。',
    };
  }

  return {
    ok: true,
    items: pickRandom(pool, count, allowDuplicates),
  };
}

// 仕様書7：同じ特性で統一する企画（条件に合う使用可能ポケモンが6匹以上存在する場合に限る）
export function drawSameAbilityTeam(allPokemons: Pokemon[], teamSize = 6): DrawResult<Pokemon> {
  const available = allPokemons.filter((p) => p.isAvailableInChampions);
  const abilityMap = new Map<string, Pokemon[]>();

  for (const p of available) {
    for (const ab of p.abilities) {
      if (!ab) continue;
      const list = abilityMap.get(ab) || [];
      list.push(p);
      abilityMap.set(ab, list);
    }
  }

  const eligibleAbilities = Array.from(abilityMap.entries()).filter(([, list]) => list.length >= teamSize);

  if (eligibleAbilities.length === 0) {
    return {
      ok: false,
      items: [],
      errorReason: `同じ特性を持つ使用可能ポケモンが ${teamSize} 匹以上揃っている特性がデータベースに存在しません。`,
      errorAction: `「ポケモンデータベース」で同じ特性を持つポケモンを ${teamSize} 匹以上登録してから再実行してください。`,
    };
  }

  const [chosenAbility, candidates] = eligibleAbilities[Math.floor(Math.random() * eligibleAbilities.length)];
  return {
    ok: true,
    chosenAbility,
    items: pickRandom(candidates, teamSize, false),
  };
}

export function drawMoves(
  allMoves: Move[],
  count: number,
  allowDuplicates: boolean,
  category?: '物理' | '特殊' | '変化' | ''
): DrawResult<Move> {
  let pool = allMoves.filter((m) => m.isAvailableInChampions);
  if (category) {
    pool = pool.filter((m) => m.category === category);
  }
  if (pool.length === 0 || (!allowDuplicates && pool.length < count)) {
    return {
      ok: false,
      items: [],
      errorReason: `条件に合う使用可能な技が不足しています（対象: ${pool.length}件 / 必要: ${count}件）。`,
      errorAction: '技カテゴリーの指定を解除するか、データベースに技を追加してください。',
    };
  }
  return { ok: true, items: pickRandom(pool, count, allowDuplicates) };
}

export function drawItems(
  allItems: Item[],
  count: number,
  allowDuplicates: boolean,
  category?: 'きのみ' | 'メガストーン' | '通常' | ''
): DrawResult<Item> {
  let pool = allItems.filter((i) => i.isAvailableInChampions && i.category !== '禁止');
  if (category) {
    pool = pool.filter((i) => i.category === category);
  }
  if (pool.length === 0 || (!allowDuplicates && pool.length < count)) {
    return {
      ok: false,
      items: [],
      errorReason: `条件に合う使用可能な道具が不足しています（対象: ${pool.length}件 / 必要: ${count}件）。`,
      errorAction: '重複許可をONにするか、道具カテゴリーの絞り込みを解除してください。',
    };
  }
  return { ok: true, items: pickRandom(pool, count, allowDuplicates) };
}

export function drawTypes(count: number, allowDuplicates: boolean, bannedTypes: PokemonType[] = []): DrawResult<PokemonType> {
  const ALL_TYPES: PokemonType[] = [
    'ノーマル', 'ほのお', 'みず', 'でんき', 'くさ', 'こおり',
    'かくとう', 'どく', 'じめん', 'ひこう', 'エスパー', 'むし',
    'いわ', 'ゴースト', 'ドラゴン', 'あく', 'はがね', 'フェアリー',
  ];
  const pool = ALL_TYPES.filter((t) => !bannedTypes.includes(t));
  if (pool.length === 0 || (!allowDuplicates && pool.length < count)) {
    return {
      ok: false,
      items: [],
      errorReason: `抽選可能なタイプ数が不足しています（対象: ${pool.length}種類 / 必要: ${count}種類）。`,
      errorAction: '禁止タイプの指定を減らすか、抽選数を下げてください。',
    };
  }
  return { ok: true, items: pickRandom(pool, count, allowDuplicates) };
}