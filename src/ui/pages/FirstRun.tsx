import { useEffect, useState } from 'react';
import { getRepository } from '../../app/store';
import { BUILTIN_RULESETS } from '../../domain/rulesets';

/** 首次启动引导：三选一流派 + 番种表预览（设计文档·数据流） */
export default function FirstRun({ onDone }: { onDone: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('tuidaohu');

  useEffect(() => {
    // 预载番种表预览文本
    const rs = BUILTIN_RULESETS.find((r) => r.id === selected);
    if (rs) setPreview(rs.yaku.map((y) => `${y.name} ${y.fan}番`).join(' · '));
  }, [selected]);

  const confirm = async (): Promise<void> => {
    const repo = await getRepository();
    await repo.saveSettings({
      rulesetId: selected,
      difficulty: 'intermediate',
      hintEnabled: true,
      gamesUntilBackupHint: 20,
    });
    onDone();
  };

  return (
    <div className="page" data-testid="first-run">
      <h2>选择你的麻将流派</h2>
      <p className="muted">番种表与起胡规则随流派变化，之后可在设置中更换。</p>
      {BUILTIN_RULESETS.map((r) => (
        <label key={r.id} className="radio-card">
          <input
            type="radio"
            name="ruleset"
            value={r.id}
            checked={selected === r.id}
            onChange={() => setSelected(r.id)}
            data-testid={`first-run-radio-${r.id}`}
          />
          <span>
            <b>{r.name}</b>
            <br />
            <small>
              起胡 {r.startingFan} 番 · {r.capFan === null ? '不封顶' : `${r.capFan} 番封顶`} ·{' '}
              {r.allowsChi ? '可吃' : '不可吃'}
            </small>
          </span>
        </label>
      ))}
      {preview && (
        <details className="fan-preview">
          <summary>番种表预览</summary>
          <p data-testid="fan-preview">{preview}</p>
          <small>⚠️ 番种表为常见规则初版，可在设置中查看全文。</small>
        </details>
      )}
      <button className="primary" data-testid="first-run-confirm" onClick={() => void confirm()}>
        开始使用
      </button>
    </div>
  );
}
