import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ChallengePreset } from '../types';
import { Dices, Plus, RotateCcw, Save, ArrowRight, Ban, Copy, Trash2, AlertCircle } from 'lucide-react';

const CATEGORIES: ChallengePreset['category'][] = [
  'ポケモンの特徴',
  '種族値',
  '技・特性・戦術',
  '図鑑番号・名前・タイプ',
  '抽選・ドラフト',
  '外部テーマ・モチーフ',
  '特殊ルール・連戦ルール',
  '大会・対戦形式',
];

interface ChallengePageProps {
  onSendToTeamBuilder: (challengeTitle: string) => void;
}

export const ChallengePage: React.FC<ChallengePageProps> = ({ onSendToTeamBuilder }) => {
  const challenges = useLiveQuery(() => db.challenges.toArray(), []) || [];

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [drawCount, setDrawCount] = useState<number>(1);
  const [allowDuplicates, setAllowDuplicates] = useState<boolean>(false);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  const [results, setResults] = useState<ChallengePreset[]>([]);
  const [errorInfo, setErrorInfo] = useState<{ reason: string; action: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newCategory, setNewCategory] = useState<ChallengePreset['category']>('ポケモンの特徴');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDraw = () => {
    setErrorInfo(null);
    let pool = challenges.filter((c) => !excludedIds.includes(c.id));
    if (selectedCategory !== 'ALL') {
      pool = pool.filter((c) => c.category === selectedCategory);
    }

    if (pool.length === 0) {
      setErrorInfo({
        reason: '条件に一致する企画が0件です（またはすべて除外されています）。',
        action: 'カテゴリーを「すべて」に戻すか、「除外リセット」、またはデータベース画面でサンプルデータを投入してください。',
      });
      setResults([]);
      return;
    }

    if (!allowDuplicates && pool.length < drawCount) {
      setErrorInfo({
        reason: `重複禁止で ${drawCount} 件抽選できません（対象企画数: ${pool.length} 件）。`,
        action: '抽選数を減らすか、重複許可をONにしてください。',
      });
      setResults([]);
      return;
    }

    const picked: ChallengePreset[] = [];
    const copy = [...pool];
    for (let i = 0; i < drawCount; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy[idx]);
      if (!allowDuplicates) copy.splice(idx, 1);
    }
    setResults(picked);
  };

  const handleExcludeCurrent = () => {
    const newEx = results.map((r) => r.id);
    setExcludedIds((prev) => Array.from(new Set([...prev, ...newEx])));
    showToast('現在の抽選結果を除外リストに追加しました');
  };

  const handleSaveHistory = async () => {
    if (results.length === 0) return;
    await db.drawHistory.add({
      id: `hist-${Date.now()}`,
      feature: 'A',
      title: results.map((r) => r.title).join(' / '),
      summary: results.map((r) => `[${r.category}] ${r.title}`).join('\n'),
      createdAt: new Date().toLocaleString('ja-JP'),
    });
    showToast('抽選履歴に保存しました');
  };

  const handleCopy = () => {
    if (results.length === 0) return;
    const text = results.map((r) => `【${r.category}】${r.title}\n${r.description}`).join('\n\n');
    navigator.clipboard.writeText(text);
    showToast('結果をクリップボードにコピーしました');
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await db.challenges.add({
      id: `custom-${Date.now()}`,
      category: newCategory,
      title: newTitle.trim(),
      description: newDesc.trim() || 'カスタム企画ルール',
      isCustom: true,
    });
    setNewTitle('');
    setNewDesc('');
    setShowCreate(false);
    showToast('オリジナル企画を追加しました');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-a)' }}>
            A：チャレンジ・企画抽選
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            登録企画数: {challenges.length}件（除外中: {excludedIds.length}件）
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer"
          style={{ backgroundColor: 'var(--color-a)' }}
        >
          <Plus size={16} />
          <span>オリジナル企画作成</span>
        </button>
      </header>

      {toast && (
        <div className="p-3 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-a)' }}>
          {toast}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateChallenge} className="p-5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <h3 className="font-bold">オリジナル企画を追加</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs mb-1 opacity-75">カテゴリー</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ChallengePreset['category'])}
                className="w-full px-3 py-2 rounded-lg border"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-75">企画タイトル *</label>
              <input
                type="text"
                required
                placeholder="例：色違いポケモン1匹絶対選出バトル"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 opacity-75">詳細ルール説明</label>
            <textarea
              rows={2}
              placeholder="詳しい縛り条件や勝利条件を入力..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-a)' }}>
              保存する
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border cursor-pointer" style={{ borderColor: 'var(--border-color)' }}>
              キャンセル
            </button>
          </div>
        </form>
      )}

      <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-bold mb-1">カテゴリー絞り込み</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <option value="ALL">全8カテゴリーから抽選</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">抽選数</label>
            <input
              type="number"
              min={1}
              max={10}
              value={drawCount}
              onChange={(e) => setDrawCount(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} />
              <span>重複を許可する</span>
            </label>
            {excludedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setExcludedIds([])}
                className="text-xs underline text-left cursor-pointer"
                style={{ color: 'var(--color-a)' }}
              >
                除外リストをリセット（{excludedIds.length}件）
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleDraw}
          className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-base shadow-sm cursor-pointer transition-opacity hover:opacity-95"
          style={{ backgroundColor: 'var(--color-a)' }}
        >
          <Dices size={20} />
          <span>企画ルーレットを回す</span>
        </button>
      </div>

      {errorInfo && (
        <div className="p-4 rounded-xl border-2 space-y-1 text-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: '#dc2626' }}>
          <div className="flex items-center gap-2 font-bold text-red-600">
            <AlertCircle size={18} />
            <span>抽選を実行できませんでした</span>
          </div>
          <p><strong>原因：</strong>{errorInfo.reason}</p>
          <p><strong>対処法：</strong>{errorInfo.action}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {results.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="p-5 rounded-xl border-2 space-y-2"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-a)' }}
              >
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'var(--color-a)' }}>
                  {item.category}
                </span>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleDraw} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <RotateCcw size={16} />
              <span>引き直し</span>
            </button>
            <button onClick={handleSaveHistory} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <Save size={16} />
              <span>履歴に保存</span>
            </button>
            <button onClick={handleExcludeCurrent} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <Ban size={16} />
              <span>現在の結果を除外</span>
            </button>
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <Copy size={16} />
              <span>コピー</span>
            </button>
            <button
              onClick={() => onSendToTeamBuilder(results.map((r) => r.title).join(' ＋ '))}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer ml-auto"
              style={{ backgroundColor: 'var(--color-b)' }}
            >
              <span>Bのチーム作成へ移動</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 pt-4">
        <h3 className="font-bold text-base">登録済み企画一覧（{challenges.length}件）</h3>
        <div className="divide-y rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          {challenges.map((c) => (
            <div key={c.id} className="p-3.5 flex items-start justify-between gap-3 text-sm">
              <div>
                <span className="text-xs font-bold mr-2" style={{ color: 'var(--color-a)' }}>[{c.category}]</span>
                <span className="font-bold">{c.title}</span>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
              </div>
              {c.isCustom && (
                <button
                  onClick={() => db.challenges.delete(c.id)}
                  className="text-red-600 p-1 hover:opacity-70 cursor-pointer"
                  title="カスタム企画を削除"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
