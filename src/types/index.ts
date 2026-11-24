export type PokemonType =
  | 'ノーマル' | 'ほのお' | 'みず' | 'でんき' | 'くさ' | 'こおり'
  | 'かくとう' | 'どく' | 'じめん' | 'ひこう' | 'エスパー' | 'むし'
  | 'いわ' | 'ゴースト' | 'ドラゴン' | 'あく' | 'はがね' | 'フェアリー';

export type AvailabilityStatus = 'available' | 'unavailable' | 'unconfirmed';

export interface Pokemon {
  id: string;
  dexNo: number;
  nameJa: string;
  nameEn: string;
  formName: string;
  type1: PokemonType;
  type2?: PokemonType;
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; };
  abilities: string[];
  learnableMoves?: string[];
  color: string;
  height: number;
  weight: number;
  generation: number;
  evoStage: number;
  isMega: boolean;
  isAvailableInChampions: boolean;
  availabilityStatus?: AvailabilityStatus;
  usageRank?: number;
  updatedAt: string;
}

export interface Move {
  id: string;
  nameJa: string;
  type: PokemonType;
  category: '物理' | '特殊' | '変化';
  power: number | null;
  accuracy: number | null;
  isAvailableInChampions: boolean;
}

export interface Item {
  id: string;
  nameJa: string;
  category: 'きのみ' | 'メガストーン' | '通常' | '禁止';
  relatedPokemonOrType?: string;
  isAvailableInChampions: boolean;
}

export interface Nature {
  id: string;
  nameJa: string;
  upStat: string;
  downStat: string;
}

export interface RegulationRule {
  id: string;
  name: string;
  allowDuplicateItems: boolean;
  allowMega: boolean;
  bannedPokemonIds: string[];
  notes: string;
  updatedAt: string;
}

export interface ChallengePreset {
  id: string;
  category:
    | 'ポケモンの特徴'
    | '種族値'
    | '技・特性・戦術'
    | '図鑑番号・名前・タイプ'
    | '抽選・ドラフト'
    | '外部テーマ・モチーフ'
    | '特殊ルール・連戦ルール'
    | '大会・対戦形式';
  title: string;
  description: string;
  isCustom: boolean;
}

export interface CustomRoulettePreset {
  id: string;
  name: string;
  mode: 'pokemon' | 'type' | 'move' | 'item' | 'combo' | 'sameAbility';
  drawCount: number;
  allowDuplicates: boolean;
  filterType: PokemonType | '';
  singleTypeOnly: boolean;
  megaOnly: boolean;
  maxSpeed: string;
  minWeight: string;
  createdAt: string;
}

export type PageId =
  | 'home'
  | 'challenge'
  | 'team'
  | 'draft'
  | 'tournament'
  | 'history'
  | 'database'
  | 'settings';