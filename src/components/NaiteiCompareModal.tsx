import React, { useState, useMemo } from 'react';
import { X, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../db/database';
import type { Pokemon } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pokemons: Pokemon[];
  onUpdated?: () => void | Promise<void>;
}

const REFERENCE_URL = 'https://yakkun.com/ch/zukan/offer/';

function buildAliases(p: Pokemon): string[] {
  const name = p.nameJa;
  const form = p.formName || '通常';
  const aliases = new Set<string>();

  if (form === '通常') {
    aliases.add(name);
  } else {
    aliases.add(form);
    aliases.add(`${name}(${form})`);
    aliases.add(`${name}（${form}）`);

    if (form.includes('アローラ')) {
      aliases.add(`${name}(アローラ)`);
      aliases.add(`${name}（アローラ）`);
      aliases.add(`アローラ${name}`);
    } else if (form.includes('ガラル')) {
      aliases.add(`${name}(ガラル)`);
      aliases.add(`${name}（ガラル）`);
      aliases.add(`ガラル${name}`);
    } else if (form.includes('ヒスイ')) {
      aliases.add(`${name}(ヒスイ)`);
      aliases.add(`${name}（ヒスイ）`);
      aliases.add(`ヒスイ${name}`);
    } else if (form.includes('パルデア')) {
      aliases.add(`${name}(パルデア)`);
      aliases.add(`${name}（パルデア）`);
      aliases.add(`パルデア${name}`);
    } else if (form.includes('えいえん')) {
      aliases.add(`${name}(えいえん)`);
      aliases.add(`${name}（えいえん）`);
      aliases.add('えいえんのフラエッテ');
    } else if (form.includes('まひる')) {
      aliases.add(`${name}(まひる)`);
      aliases.add(`${name}（まひる）`);
      aliases.add('まひるのすがた');
    } else if (form.includes('まよなか')) {
      aliases.add(`${name}(まよなか)`);
      aliases.add(`${name}（まよなか）`);
      aliases.add('まよなかのすがた');
    } else if (form.includes('たそがれ')) {
      aliases.add(`${name}(たそがれ)`);
      aliases.add(`${name}（たそがれ）`);
      aliases.add('たそがれのすがた');
    } else if (form.includes('♂')) {
      aliases.add(`${name}♂`);
      aliases.add(`${name}(オス)`);
    } else if (form.includes('♀')) {
      aliases.add(`${name}♀`);
      aliases.add(`${name}(メス)`);
    }
  }

  return Array.from(aliases).filter(a => a.length >= 2);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function NaiteiCompareModal({ isOpen, onClose, pokemons, onUpdated }: Props) {
  const [pastedText, setPastedText] = useState('');
  const [applying, setApplying] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const comparison = useMemo(() => {
    const text = pastedText.trim();
    if (!text) return null;

    const toEnable: Pokemon[] = [];
    const toDisable: Pokemon[] = [];
    const matchedAll: Pokemon[] = [];

    for (const p of pokemons) {
      const aliases = buildAliases(p);
      let isMatched = false;

      for (const kw of aliases) {
        const regex = new RegExp(`(?<![ァ-ヶー一-龠])${escapeRegExp(kw)}(?![ァ-ヶー一-龠])`);
        if (regex.test(text)) {
          isMatched = true;
          break;
        }
      }

      if (isMatched) {
        matchedAll.push(p);
        if (!p.isAvailableInChampions) {
          toEnable.push(p);
        }
      } else {
        if (p.isAvailableInChampions) {
          toDisable.push(p);
        }
      }
    }

    const dbNames = new Set<string>();
    pokemons.forEach(p => {
      dbNames.add(p.nameJa);
      dbNames.add(p.formName);
      buildAliases(p).forEach(a => dbNames.add(a));
    });

    const missingCandidates = new Set<string>();
    const megaMatches = text.match(/メガ[ァ-ヶー]{2,10}(?:[XY♂♀])?/g) || [];
    for (const m of megaMatches) {
      if (!dbNames.has(m)) {
        missingCandidates.add(m);
      }
    }

    return {
      matchedAll,
      toEnable,
      toDisable,
      missingCandidates: Array.from(missingCandidates)
    };
  }, [pastedText, pokemons]);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (!comparison) return;
    setApplying(true);
    setDoneMessage(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updates: Pokemon[] = [];

      for (const p of comparison.toEnable) {
        updates.push({ ...p, isAvailableInChampions: true, updatedAt: today });
      }
      for (const p of comparison.toDisable) {
        updates.push({ ...p, isAvailableInChampions: false, updatedAt: today });
      }

      if (updates.length > 0) {
        await db.pokemons.bulkPut(updates);
        if (onUpdated) await onUpdated();
      }

      setDoneMessage(
        `比較結果を反映しました（新規内定: +${comparison.toEnable.length}体 / 対象外へ変更: -${comparison.toDisable.length}体 / 合計使用可能: ${comparison.matchedAll.length}体）`
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl shadow-xl border"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h2 className="text-lg font-bold">内定ポケモン比較ツール</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              ポケモン徹底攻略の内定一覧と現在のデータベースを比較し、使用可能フラグを一括判定します
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-3.5 rounded-lg border text-sm space-y-2" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">手順1：参照ページを開いて全選択コピー（Ctrl+A → Ctrl+C）</span>
              <a
                href={REFERENCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: '#315FA9' }}
              >
                ポケモン徹底攻略（内定一覧）を開く
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ※ブラウザのセキュリティ制限によりアプリから直接ページを取得できないため、開いたページを丸ごとコピーして下の欄に貼り付けてください。
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold">手順2：コピーしたページ内容をここに貼り付け</label>
              {pastedText && (
                <button
                  onClick={() => { setPastedText(''); setDoneMessage(null); }}
                  className="text-xs underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  クリア
                </button>
              )}
            </div>
            <textarea
              value={pastedText}
              onChange={e => { setPastedText(e.target.value); setDoneMessage(null); }}
              placeholder="ここにポケモン徹底攻略（https://yakkun.com/ch/zukan/offer/）のページ内容を貼り付けてください..."
              rows={5}
              className="w-full rounded-lg border p-3 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
            />
          </div>

          {comparison && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#EBF7F1', borderColor: '#23845D', color: '#1A5E42' }}>
                  <div className="text-xs font-semibold">一覧と一致（内定判定）</div>
                  <div className="text-2xl font-bold mt-0.5">{comparison.matchedAll.length} <span className="text-xs font-normal">体</span></div>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#EBF3FE', borderColor: '#315FA9', color: '#1E40AF' }}>
                  <div className="text-xs font-semibold">新規に「使用可」へ変更</div>
                  <div className="text-2xl font-bold mt-0.5">+{comparison.toEnable.length} <span className="text-xs font-normal">体</span></div>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: '#FEF2F2', borderColor: '#C53030', color: '#9B2C2C' }}>
                  <div className="text-xs font-semibold">「対象外」へ変更候補</div>
                  <div className="text-2xl font-bold mt-0.5">-{comparison.toDisable.length} <span className="text-xs font-normal">体</span></div>
                </div>
              </div>

              {comparison.toEnable.length > 0 && (
                <div className="p-3 rounded-lg border text-xs" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="font-bold mb-1 text-blue-700">新しく内定（使用可能）になるポケモン：</div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {comparison.toEnable.map(p => (
                      <span key={p.id} className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        {p.nameJa}{p.formName !== '通常' ? `(${p.formName})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {comparison.toDisable.length > 0 && (
                <div className="p-3 rounded-lg border text-xs" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="font-bold mb-1 text-red-700">一覧に見当たらず「対象外」になるポケモン：</div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {comparison.toDisable.map(p => (
                      <span key={p.id} className="px-2 py-0.5 rounded bg-red-100 text-red-800">
                        {p.nameJa}{p.formName !== '通常' ? `(${p.formName})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {comparison.missingCandidates.length > 0 && (
                <div className="p-3 rounded-lg border text-xs flex items-start gap-2" style={{ backgroundColor: '#FFFBEB', borderColor: '#D97706', color: '#92400E' }}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">データベースに未登録のフォルム候補が検出されました：</div>
                    <div className="mt-1">{comparison.missingCandidates.join('、')}</div>
                  </div>
                </div>
              )}

              {pokemons.length === 0 && (
                <div className="p-3 rounded-lg border text-xs flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', borderColor: '#C53030', color: '#9B2C2C' }}>
                  <AlertCircle size={16} />
                  <span>現在データベースにポケモンが0体しか登録されていません。先に「JSON復元」で全ポケモンデータを読み込んでから比較してください。</span>
                </div>
              )}
            </div>
          )}

          {doneMessage && (
            <div className="p-3 rounded-lg border text-sm flex items-center gap-2" style={{ backgroundColor: '#EBF7F1', borderColor: '#23845D', color: '#1A5E42' }}>
              <CheckCircle2 size={18} className="shrink-0" />
              <span className="font-semibold">{doneMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm font-medium"
            style={{ borderColor: 'var(--border-color)' }}
          >
            閉じる
          </button>
          <button
            onClick={handleApply}
            disabled={!comparison || pokemons.length === 0 || applying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: '#23845D' }}
          >
            <RefreshCw size={15} className={applying ? 'animate-spin' : ''} />
            比較結果をデータベースに一括反映
          </button>
        </div>
      </div>
    </div>
  );
}