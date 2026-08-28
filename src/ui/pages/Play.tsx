import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  newGame,
  applyAction,
  playerView,
  serializeSnapshot,
  deserializeSnapshot,
  type GameState,
} from '../../app/game-controller';
import { legalActions } from '../../domain/engine';
import { tileName, tileNames } from '../../domain/tiles';
import { evaluateTurn, type Divergence } from '../../app/coach';
import { getRepository } from '../../app/store';
import { getRuleset } from '../../domain/rulesets';
import { decide } from '../../domain/ai/decider';
import type { Difficulty } from '../../domain/ai/types';
import type { GameAction } from '../../domain/game-types';
import TileFace from '../components/TileFace';

const HUMAN_SEAT = 0;

interface Session {
  gameId: string;
  state: GameState;
}

function SeatPanel({ state, seat }: { state: GameState; seat: number }) {
  const windName = ['东', '南', '西', '北'];
  return (
    <div className="seat-panel" data-testid={`seat-${seat}`}>
      <span className={seat === state.turn ? 'seat active' : 'seat'}>
        {windName[seat]}
        {seat === state.dealer ? '(庄)' : ''} 家
      </span>
      <span className="muted">
        弃牌 {state.discards[seat].length} · 副露 {state.melds[seat].length}
      </span>
      <div className="meld-row">
        {state.melds[seat].map((m, i) => (
          <span key={i} className="meld">
            {m.tiles.map((t, j) => (
              <TileFace key={j} tile={t} size="sm" />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Play() {
  const [params] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<{ difficulty: Difficulty; hintEnabled: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [divergences, setDivergences] = useState<Divergence[]>([]);
  const [resumeCandidate, setResumeCandidate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // 自动模式（E2E/演示）：人类座位由同难度 AI 代打
  const autoMode = params.get('auto') === '1';
  const seed = params.get('seed');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const repo = await getRepository();
      const s = await repo.getSettings();
      if (s) setSettings({ difficulty: s.difficulty, hintEnabled: s.hintEnabled });

      // 崩溃恢复：存在进行中对局则询问（SC-7）
      if (!autoMode) {
        const ongoing = (await repo.listGames(5)).find((g) => g.outcome === 'ongoing');
        if (ongoing) {
          setResumeCandidate(ongoing.id);
          return;
        }
      }
      const state = newGame({ seed: Number(seed ?? Date.now() % 100000), rulesetId: s?.rulesetId ?? 'tuidaohu' });
      const gameId = crypto.randomUUID();
      await repo.createGame({ id: gameId, rulesetId: state.rulesetId, startedAt: Date.now(), finishedAt: null, outcome: 'ongoing' });
      await repo.appendSnapshot(gameId, state.snapshotSeq, serializeSnapshot(state));
      setSession({ gameId, state });
    })();
  }, [autoMode, seed]);

  const resume = useCallback(async (accept: boolean) => {
    const repo = await getRepository();
    const id = resumeCandidate;
    setResumeCandidate(null);
    if (!id || !accept) {
      const s = await repo.getSettings();
      const state = newGame({ seed: Date.now() % 100000, rulesetId: s?.rulesetId ?? 'tuidaohu' });
      const gameId = crypto.randomUUID();
      await repo.createGame({ id: gameId, rulesetId: state.rulesetId, startedAt: Date.now(), finishedAt: null, outcome: 'ongoing' });
      await repo.appendSnapshot(gameId, state.snapshotSeq, serializeSnapshot(state));
      setSession({ gameId, state });
      return;
    }
    const snaps = await repo.loadSnapshots(id);
    const last = snaps[snaps.length - 1];
    if (!last) {
      setError('快照损坏，无法恢复，请开新局');
      return;
    }
    setSession({ gameId: id, state: deserializeSnapshot(last.json) });
  }, [resumeCandidate]);

  // 落库单步快照 + 应用动作
  const step = useCallback((cur: Session, action: GameAction, claimant?: number): Session => {
    const next = { ...cur, state: applyAction(cur.state, action, claimant) };
    void getRepository()
      .then((repo) => repo.appendSnapshot(next.gameId, next.state.snapshotSeq, serializeSnapshot(next.state)))
      .catch((e) => setError(String(e)));
    return next;
  }, []);

  const persistFinish = useCallback((state: GameState): void => {
    const outcome = state.result?.type === 'win' ? (state.result.winner === HUMAN_SEAT ? 'win' : 'loss') : 'draw';
    void getRepository()
      .then((repo) => {
        if (!session) throw new Error('no session');
        return repo.finishGame(session.gameId, outcome);
      })
      .catch(() => undefined);
  }, [session]);

  // AI 驱动：非人类回合或宣称窗口自动处理
  useEffect(() => {
    if (!session || session.state.result || resumeCandidate) return;
    const st = session.state;
    if (st.phase === 'dealing') return;
    if (st.phase === 'over') {
      persistFinish(st);
      return;
    }
    const difficulty = settings?.difficulty ?? 'intermediate';
    const rs = getRuleset(st.rulesetId);
    const human = playerView(st, HUMAN_SEAT);

    if (st.phase === 'action' && (st.turn !== HUMAN_SEAT || autoMode)) {
      const timer = setTimeout(() => {
        const d = decide(playerView(st, st.turn), difficulty, rs);
        setSession((cur) => (cur ? step(cur, d.action) : cur));
      }, 120);
      return () => clearTimeout(timer);
    }
    if (st.phase === 'claims') {
      // 自动模式：四个座位都由 AI 决策；否则 AI 家决策 + 人类可宣称时等待操作
      const seatsToAsk = [0, 1, 2, 3].filter((x) => x !== st.lastDiscard!.from && (autoMode || x !== HUMAN_SEAT));
      const humanClaims = !autoMode && st.lastDiscard!.from !== HUMAN_SEAT ? legalActions(human, rs) : [];
      const timer = setTimeout(() => {
        let best: { priority: number; seat: number; action: GameAction } | null = null;
        for (const seat of seatsToAsk) {
          const d = decide(playerView(st, seat), difficulty, rs);
          const p = d.action.type === 'win' ? 3 : d.action.type === 'peng' || d.action.type === 'mingGang' ? 2 : d.action.type === 'chi' ? 1 : 0;
          if (p > 0 && (!best || p > best.priority)) best = { priority: p, seat, action: d.action };
        }
        if (!autoMode && humanClaims.length > 0) {
          const hp = (a: GameAction): number => (a.type === 'win' ? 3 : a.type === 'peng' || a.type === 'mingGang' ? 2 : 1);
          if (best && best.priority > Math.max(...humanClaims.map(hp))) {
            setSession((cur) => (cur ? step(cur, best!.action, best!.seat) : cur));
            return;
          }
          return; // 等待人类选择（UI 显示按钮）
        }
        setSession((cur) => (cur ? step(cur, best?.action ?? { type: 'pass' }, best?.seat) : cur));
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [session, settings, resumeCandidate, persistFinish, step, autoMode]);

  // 人类出牌（含教练评估）
  const humanAct = (action: GameAction): void => {
    if (!session) return;
    const st = session.state;
    if (st.phase === 'action' && st.turn === HUMAN_SEAT && action.type === 'discard' && !autoMode) {
      const ev = evaluateTurn(playerView(st, HUMAN_SEAT), action, settings?.difficulty ?? 'intermediate');
      setHint(ev.hint?.text ?? null);
      if (ev.divergence) setDivergences((d) => [...d, { ...ev.divergence!, step: st.snapshotSeq }]);
    } else {
      setHint(null);
    }
    setSession((cur) => (cur ? step(cur, action) : cur));
  };

  const view = useMemo(() => (session ? playerView(session.state, HUMAN_SEAT) : null), [session]);
  const myTurn = session?.state.phase === 'action' && session.state.turn === HUMAN_SEAT;
  const legal = useMemo(() => (view && myTurn ? legalActions(view, getRuleset(view.rulesetId)) : []), [view, myTurn]);
  const claimLegal = useMemo(
    () => (view && session?.state.phase === 'claims' && session.state.lastDiscard && session.state.lastDiscard.from !== HUMAN_SEAT ? legalActions(view, getRuleset(view.rulesetId)) : []),
    [view, session],
  );

  if (resumeCandidate) {
    return (
      <div className="page" data-testid="resume-dialog">
        <h2>检测到未完成的对局</h2>
        <p>是否从上次离开的地方继续？</p>
        <button className="primary" data-testid="resume-yes" onClick={() => void resume(true)}>
          继续上局
        </button>
        <button data-testid="resume-no" onClick={() => void resume(false)}>
          开新局
        </button>
      </div>
    );
  }
  if (!session || !view) return <div className="page">加载中…</div>;

  const result = session.state.result;
  const winAction = legal.find((a) => a.type === 'win');
  const gangActions = legal.filter((a) => a.type === 'anGang' || a.type === 'buGang');

  return (
    <div className="page play-page" data-testid="play-page">
      {error && <p className="calc-error">{error}</p>}
      {[1, 2, 3].map((seat) => (
        <SeatPanel key={seat} state={session.state} seat={seat} />
      ))}
      <div className="seat-panel" data-testid="seat-0">
        <span className={session.state.turn === HUMAN_SEAT ? 'seat active' : 'seat'}>
          你{session.state.dealer === HUMAN_SEAT ? '(庄)' : ''}
        </span>
        <span className="muted">
          弃牌 {session.state.discards[HUMAN_SEAT].length} · 副露 {session.state.melds[HUMAN_SEAT].length}
        </span>
        <div className="meld-row">
          {session.state.melds[HUMAN_SEAT].map((m, i) => (
            <span key={i} className="meld">
              {m.tiles.map((t, j) => (
                <TileFace key={j} tile={t} size="sm" />
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="muted wall-info">
        牌墙余 {session.state.wall.length} 张 · 第 {session.state.discardCount} 巡
      </div>

      {result && (
        <div className="calc-result" data-testid="result-panel">
          <h3>{result.type === 'draw' ? '流局' : `${result.winner === HUMAN_SEAT ? '你胡了！' : `${result.winner} 家胡`}`}</h3>
          {result.fan && (
            <p>
              {result.fan.total} 番：{result.fan.matched.map((m) => m.name).join('、')}
            </p>
          )}
          <p data-testid="score-deltas">
            得分变动：{result.deltas.map((d, i) => `${['你', '东家', '南家', '西家'][i]} ${d > 0 ? '+' : ''}${d}`).join('，')}
          </p>
          <div data-testid="divergence-list">
            <b>关键分歧点（{divergences.length}）</b>
            {divergences.length === 0 && <p className="muted">本局没有明显偏离 AI 建议的出牌。</p>}
            {divergences.map((d, i) => (
              <p key={i} className="muted">
                第 {d.step} 步：你打「{tileName(d.playerTile)}」（进张剩 {d.playerUkeire} 张），AI 会打「{tileName(d.aiTile)}」（进张 {d.aiUkeire} 张）
              </p>
            ))}
          </div>
          <button data-testid="new-game" onClick={() => window.location.assign('/play')}>
            再来一局
          </button>
        </div>
      )}

      {hint && !result && (
        <div className="calc-hint" data-testid="coach-hint">
          💡 {hint}
        </div>
      )}

      {myTurn && !result && (
        <div className="action-bar">
          {winAction && (
            <button className="primary" data-testid="btn-win" onClick={() => humanAct({ type: 'win', selfDraw: true })}>
              自摸胡！
            </button>
          )}
          {gangActions.map((a, i) =>
            a.type === 'anGang' ? (
              <button key={i} data-testid={`btn-angang-${a.tile}`} onClick={() => humanAct(a)}>
                暗杠「{tileName(a.tile)}」
              </button>
            ) : (
              <button key={i} data-testid={`btn-bugang-${a.tile}`} onClick={() => humanAct(a)}>
                补杠「{tileName(a.tile)}」
              </button>
            ),
          )}
          <span className="muted">点手牌中的牌打出</span>
        </div>
      )}

      {session.state.phase === 'claims' && claimLegal.length > 0 && !result && (
        <div className="action-bar" data-testid="claim-bar">
          {claimLegal.map((a, i) => {
            if (a.type === 'win') return <button key={i} className="primary" data-testid="claim-win" onClick={() => humanAct(a)}>胡！</button>;
            if (a.type === 'peng') return <button key={i} data-testid="claim-peng" onClick={() => humanAct(a)}>碰</button>;
            if (a.type === 'mingGang') return <button key={i} data-testid="claim-gang" onClick={() => humanAct(a)}>杠</button>;
            if (a.type === 'chi') {
              const sig = [...a.tiles].sort().join('');
              return (
                <button key={i} data-testid={`claim-chi-${sig}`} onClick={() => humanAct(a)}>
                  吃 {tileNames(a.tiles)}
                </button>
              );
            }
            return null;
          })}
          <button data-testid="claim-pass" onClick={() => humanAct({ type: 'pass' })}>
            过
          </button>
        </div>
      )}

      <div className="tray">
        <span>手牌</span>
        <div className="tray-tiles" data-testid="hand-tray">
          {view.hand.map((t, i) => (
            <TileFace
              key={`${t}-${i}`}
              tile={t}
              testId={`hand-${t}`}
              onClick={myTurn ? () => humanAct({ type: 'discard', tile: t }) : undefined}
            />
          ))}
        </div>
      </div>
      {autoMode && !result && <p className="muted">自动演示模式：AI 代打所有座位</p>}
    </div>
  );
}
