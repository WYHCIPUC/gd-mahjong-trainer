import { useEffect, useRef, useState } from 'react';
import { getRepository } from '../../app/store';
import { BUILTIN_RULESETS, getRuleset } from '../../domain/rulesets';
import type { Settings } from '../../data/repository';
import type { Difficulty } from '../../domain/ai/types';

const DIFF_NAMES: Record<Difficulty, string> = { novice: '新手（纯效率）', intermediate: '进阶（效率+防守）', expert: '老手（加番数规划）' };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gameCount, setGameCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const repo = await getRepository();
      setSettings(
        (await repo.getSettings()) ?? {
          rulesetId: 'tuidaohu',
          difficulty: 'intermediate',
          hintEnabled: true,
          gamesUntilBackupHint: 20,
        },
      );
      setGameCount((await repo.listGames()).length);
    })();
  }, []);

  const update = async (patch: Partial<Settings>): Promise<void> => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    const repo = await getRepository();
    await repo.saveSettings(next);
  };

  const exportData = async (): Promise<void> => {
    const repo = await getRepository();
    const json = await repo.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahjong-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('已导出备份文件');
  };

  const importData = async (file: File): Promise<void> => {
    const repo = await getRepository();
    try {
      await repo.importAll(await file.text(), 'replace');
      setMessage('导入成功，即将刷新');
      setTimeout(() => window.location.assign('/settings'), 800);
    } catch (e) {
      setMessage(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (!settings) return <div className="page">加载中…</div>;
  const ruleset = getRuleset(settings.rulesetId);

  return (
    <div className="page" data-testid="settings-page">
      <h2>设置</h2>

      <label className="ruleset-row">
        流派
        <select value={settings.rulesetId} onChange={(e) => void update({ rulesetId: e.target.value })} data-testid="settings-ruleset">
          {BUILTIN_RULESETS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ruleset-row">
        AI 难度
        <select value={settings.difficulty} onChange={(e) => void update({ difficulty: e.target.value as Difficulty })} data-testid="settings-difficulty">
          {(Object.keys(DIFF_NAMES) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFF_NAMES[d]}
            </option>
          ))}
        </select>
      </label>

      <label className="ruleset-row">
        <input
          type="checkbox"
          checked={settings.hintEnabled}
          onChange={(e) => void update({ hintEnabled: e.target.checked })}
          data-testid="settings-hint"
        />
        对局中显示教练提示
      </label>

      <details className="fan-preview" data-testid="fan-table">
        <summary>当前流派番种表（全文）</summary>
        <table>
          <tbody>
            {ruleset.yaku.map((y) => (
              <tr key={y.id}>
                <td>{y.name}</td>
                <td>{y.fan} 番</td>
              </tr>
            ))}
          </tbody>
        </table>
        <small>起胡 {ruleset.startingFan} 番；{ruleset.capFan === null ? '不封顶' : `${ruleset.capFan} 番封顶`}。⚠️ experimental：以常见规则初版为准。</small>
      </details>

      <div className="mode-row">
        <button onClick={() => void exportData()} data-testid="export-btn">
          导出全部数据
        </button>
        <button onClick={() => fileRef.current?.click()} data-testid="import-btn">
          导入备份
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
          }}
        />
      </div>
      {gameCount >= settings.gamesUntilBackupHint && (
        <p className="calc-hint" data-testid="backup-hint">
          你已累计 {gameCount} 局对局，建议导出备份（清缓存会丢数据）。
        </p>
      )}
      {message && <p className="muted" data-testid="settings-message">{message}</p>}
    </div>
  );
}
