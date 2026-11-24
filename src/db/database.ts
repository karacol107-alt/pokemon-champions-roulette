import Dexie, { type Table } from 'dexie';
import type {
  Pokemon,
  Move,
  Item,
  Nature,
  RegulationRule,
  ChallengePreset,
  CustomRoulettePreset,
} from '../types';

export interface SavedTeam {
  id: string;
  name: string;
  format: 'シングル' | 'ダブル';
  memo: string;
  members: {
    pokemon: Pokemon;
    item?: string;
    ability?: string;
    nature?: string;
    moves: string[];
  }[];
  createdAt: string;
}

export interface DrawHistoryItem {
  id: string;
  feature: 'A' | 'B' | 'C';
  title: string;
  summary: string;
  createdAt: string;
}

export interface TournamentMatch {
  id: string;
  round: number;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  winner: string | null;
}

export interface TournamentRecord {
  id: string;
  name: string;
  format: 'トーナメント' | '個人総当たり' | 'チーム総当たり' | '勝ち抜き' | 'ポイント制' | '勝率ランキング' | '勝利数競争';
  battleRule: 'シングル' | 'ダブル' | '混合';
  participants: string[];
  matches: TournamentMatch[];
  status: '進行中' | '終了';
  createdAt: string;
}

export interface UpdateLogItem {
  id: string;
  description: string;
  createdAt: string;
}

export class ChampionsDatabase extends Dexie {
  pokemons!: Table<Pokemon, string>;
  moves!: Table<Move, string>;
  items!: Table<Item, string>;
  natures!: Table<Nature, string>;
  regulations!: Table<RegulationRule, string>;
  challenges!: Table<ChallengePreset, string>;
  roulettePresets!: Table<CustomRoulettePreset, string>;
  savedTeams!: Table<SavedTeam, string>;
  drawHistory!: Table<DrawHistoryItem, string>;
  tournaments!: Table<TournamentRecord, string>;
  updateLogs!: Table<UpdateLogItem, string>;

  constructor() {
    super('PokemonChampionsRouletteDB');
    this.version(4).stores({
      pokemons: 'id, dexNo, nameJa, type1, type2, generation, isMega, isAvailableInChampions',
      moves: 'id, nameJa, type, category, isAvailableInChampions',
      items: 'id, nameJa, category, isAvailableInChampions',
      natures: 'id, nameJa',
      regulations: 'id, name, updatedAt',
      challenges: 'id, category, title, isCustom',
      roulettePresets: 'id, name, mode, createdAt',
      savedTeams: 'id, name, format, createdAt',
      drawHistory: 'id, feature, createdAt',
      tournaments: 'id, name, format, status, createdAt',
      updateLogs: 'id, createdAt',
    });
  }
}

export const db = new ChampionsDatabase();