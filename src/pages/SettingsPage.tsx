import React from 'react';
import { exportBackupJson } from '../db/backup';
import { Download, AlertTriangle } from 'lucide-react';

interface SettingsPageProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  fontSize: 'normal' | 'large' | 'xlarge';
  setFontSize: (v: 'normal' | 'large' | 'xlarge') => void;
  buttonSize: 'normal' | 'large';
  setButtonSize: (v: 'normal' | 'large') => void;
  skipAnimation: boolean;
  setSkipAnimation: (v: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  darkMode,
  setDarkMode,
  fontSize,
  setFontSize,
  buttonSize,
  setButtonSize,
  skipAnimation,
  setSkipAnimation,
}) => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">設定</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          画面テーマ・文字サイズ・ボタンサイズ・データバックアップ管理
        </p>
      </header>

      <div className="space-y-4">
        <div className="p-5 rounded-xl border flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div>
            <div className="font-bold">テーマ切り替え（ライト / ダーク）</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>目に優しい Soft Natural 配色を切り替えます</div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-4 py-2 rounded-lg font-bold border cursor-pointer"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {darkMode ? 'ダークモード中' : 'ライトモード中'}
          </button>
        </div>

        <div className="p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div>
            <div className="font-bold">文字サイズ変更</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>PC・スマホでの視認性に合わせて拡大できます</div>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'normal', label: '標準' },
              { id: 'large', label: '大' },
              { id: 'xlarge', label: '特大' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFontSize(opt.id as typeof fontSize)}
                className="px-4 py-2 rounded-lg text-sm font-bold border cursor-pointer"
                style={{
                  backgroundColor: fontSize === opt.id ? 'var(--text-main)' : 'transparent',
                  color: fontSize === opt.id ? 'var(--bg-card)' : 'var(--text-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div>
            <div className="font-bold">ボタンサイズ変更</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>タップ・クリックしやすい大きさに調整します</div>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'normal', label: '標準ボタン' },
              { id: 'large', label: '大きめボタン' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setButtonSize(opt.id as typeof buttonSize)}
                className="px-4 py-2 rounded-lg text-sm font-bold border cursor-pointer"
                style={{
                  backgroundColor: buttonSize === opt.id ? 'var(--text-main)' : 'transparent',
                  color: buttonSize === opt.id ? 'var(--bg-card)' : 'var(--text-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl border flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div>
            <div className="font-bold">抽選アニメーションスキップ</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>演出を省略して即座に抽選結果を表示します</div>
          </div>
          <input
            type="checkbox"
            checked={skipAnimation}
            onChange={(e) => setSkipAnimation(e.target.checked)}
            className="w-5 h-5 cursor-pointer"
          />
        </div>

        <div className="p-5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-c)' }}>
          <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-c)' }}>
            <AlertTriangle size={20} />
            <span>端末内データ保存とバックアップのお願い</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            このアプリはクラウドを使用せず、ブラウザ内（IndexedDB）にすべてのデータを保存します。ブラウザの履歴やサイトデータを消去するとデータが失われるため、定期的にJSONファイルへバックアップしてください。
          </p>
          <button
            onClick={() => exportBackupJson()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--color-c)' }}
          >
            <Download size={16} />
            <span>今すぐJSONバックアップを保存</span>
          </button>
        </div>
      </div>
    </div>
  );
};