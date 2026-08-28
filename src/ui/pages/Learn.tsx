import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRepository } from '../../app/store';
import { getRuleset } from '../../domain/rulesets';
import { COURSES } from '../../domain/quiz/courses';
import bankJson from '../../domain/quiz/bank.json';
import { gradeAnswer, type Grade, type QuizQuestion } from '../../domain/quiz/types';
import { generateDiscardQuiz } from '../../domain/quiz/generator';
import { tileName } from '../../domain/tiles';

import type { Mistake } from '../../data/repository';
import TileFace from '../components/TileFace';

const BANK = bankJson as unknown as QuizQuestion[];

const shorthandToIds = (s: string): string[] => {
  const ids: string[] = [];
  let digits = '';
  for (const ch of s) {
    if (ch >= '1' && ch <= '9') digits += ch;
    else if (['m', 'p', 's', 'z'].includes(ch)) {
      for (const d of digits) ids.push(`${ch}${d}`);
      digits = '';
    }
  }
  return ids;
};

function HandRow({ hand, seen }: { hand: string; seen?: string }) {
  const ids = shorthandToIds(hand);
  const seenSet = new Set(seen ? shorthandToIds(seen) : []);
  return (
    <div className="quiz-hand">
      {ids.map((t, i) => (
        <TileFace key={`${t}-${i}`} tile={t} size="sm" badge={seenSet.has(t) ? '见' : undefined} />
      ))}
    </div>
  );
}

function QuizCard({
  q,
  seedSuffix,
  onGraded,
}: {
  q: QuizQuestion;
  seedSuffix: string;
  onGraded: (q: QuizQuestion, choice: string, grade: Grade) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => setChoice(null), [q.id, seedSuffix]);
  const grade: Grade | null = choice ? gradeAnswer(q, choice) : null;
  return (
    <div className="calc-result quiz-card" data-testid={`quiz-${q.id}-${seedSuffix}`}>
      <p className="muted">
        {q.chapter === 'efficiency' ? '进张效率' : q.chapter === 'safety' ? '防守安全' : q.chapter === 'yaku' ? '番种判读' : '宣称取舍'}
        · 刚摸进 {q.type === 'choose-discard' ? '一张牌，打哪张？' : '请判断牌型番种'}
      </p>
      <HandRow hand={q.hand} seen={q.seen} />
      <div className="mode-row">
        {q.options.map((o) => (
          <button
            key={o}
            className="quiz-option"
            data-testid={`opt-${q.id}-${o}`}
            disabled={!!choice}
            onClick={() => {
              setChoice(o);
              onGraded(q, o, gradeAnswer(q, o));
            }}
          >
            <TileFace tile={o} size="sm" />
            <span>{tileName(o)}</span>
          </button>
        ))}
      </div>
      {grade && (
        <div data-testid={`feedback-${q.id}-${seedSuffix}`}>
          <p className={grade === 'wrong' ? 'calc-hint' : 'muted'}>
            {grade === 'best' ? '✓ 正确' : grade === 'acceptable' ? '△ 两者皆可' : '✗ 不推荐'}你打了「{tileName(choice!)}」
            {q.best !== choice && `，更优的是「${tileName(q.best)}」`}
          </p>
          <p>{q.explanation}</p>
        </div>
      )}
    </div>
  );
}

type Tab = 'fan' | 'course' | 'quiz' | 'random' | 'mistakes';

export default function Learn() {
  const [tab, setTab] = useState<Tab>('fan');
  const [rulesetId, setRulesetId] = useState('tuidaohu');
  const [courseIdx, setCourseIdx] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [randomSeed, setRandomSeed] = useState<number>(() => Date.now() % 100000);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const randomKey = useMemo(() => `gen-${randomSeed}`, [randomSeed]);

  useEffect(() => {
    void getRepository()
      .then(async (repo) => {
        const s = await repo.getSettings();
        if (s) setRulesetId(s.rulesetId);
        setMistakes(await repo.listMistakes());
      })
      .catch(() => undefined);
  }, [tab]);

  const onGraded = useCallback((q: QuizQuestion, choice: string, grade: Grade) => {
    void (async () => {
      const repo = await getRepository();
      if (grade !== 'best') {
        await repo.addMistake({
          id: `${q.id}-${Date.now()}`,
          questionId: q.id,
          chapterId: q.chapter,
          wrongAnswer: choice,
          at: Date.now(),
        });
      }
      const prev = await repo.getQuizProgress(q.chapter);
      const done = new Set(prev?.doneQuestionIds ?? []);
      const correct = new Set(prev?.correctIds ?? []);
      done.add(q.id);
      if (grade !== 'wrong') correct.add(q.id);
      await repo.saveQuizProgress({ chapterId: q.chapter, doneQuestionIds: [...done], correctIds: [...correct] });
      if (tab === 'mistakes') setMistakes(await repo.listMistakes());
    })();
  }, [tab]);

  const ruleset = getRuleset(rulesetId);
  const question = BANK[quizIdx % BANK.length];

  const mistakeQuestions = mistakes
    .map((m) => BANK.find((b) => b.id === m.questionId))
    .filter((q): q is QuizQuestion => !!q);

  return (
    <div className="page" data-testid="learn-page">
      <h2>学习中心</h2>
      <div className="mode-row">
        {(
          [
            ['fan', '番种表'],
            ['course', '课程'],
            ['quiz', '章节练习'],
            ['random', '随机练习'],
            ['mistakes', `错题本${mistakes.length ? ` (${mistakes.length})` : ''}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? 'active' : ''} data-testid={`learn-tab-${t}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'fan' && (
        <div className="calc-result" data-testid="fan-table-body">
          <p className="muted">
            当前流派：{ruleset.name} · 起胡 {ruleset.startingFan} 番 ·{' '}
            {ruleset.capFan === null ? '不封顶' : `${ruleset.capFan} 番封顶`} · ⚠️ experimental
          </p>
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
        </div>
      )}

      {tab === 'course' && (
        <div data-testid="course-body">
          <div className="mode-row">
            {COURSES.map((c, i) => (
              <button key={c.id} className={i === courseIdx ? 'active' : ''} onClick={() => setCourseIdx(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          <h3>{COURSES[courseIdx].title}</h3>
          {COURSES[courseIdx].body.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      {tab === 'quiz' && (
        <div data-testid="quiz-body">
          <QuizCard
            q={question}
            seedSuffix="static"
            onGraded={(q2, choice, grade) => onGraded(q2, choice, grade)}
          />
          <div className="mode-row">
            <button data-testid="quiz-prev" onClick={() => setQuizIdx((i) => (i + BANK.length - 1) % BANK.length)}>
              上一题
            </button>
            <button data-testid="quiz-next" onClick={() => setQuizIdx((i) => (i + 1) % BANK.length)}>
              下一题
            </button>
            <span className="muted">
              第 {quizIdx + 1} / {BANK.length} 题
            </span>
          </div>
        </div>
      )}

      {tab === 'random' && (
        <div data-testid="random-body">
          <QuizCard
            key={randomKey}
            q={generateDiscardQuiz(randomSeed) ?? BANK[0]}
            seedSuffix="random"
            onGraded={(q2, choice, grade) => onGraded(q2, choice, grade)}
          />
          <button data-testid="random-next" onClick={() => setRandomSeed((s) => s + 7919)}>
            出下一题
          </button>
        </div>
      )}

      {tab === 'mistakes' && (
        <div data-testid="mistakes-body">
          {mistakeQuestions.length === 0 && <p className="muted">还没有错题，先去做几道练习吧。</p>}
          {mistakeQuestions.map((q) => (
            <QuizCard key={`m-${q.id}-${mistakes.length}`} q={q} seedSuffix="mistake" onGraded={onGraded} />
          ))}
        </div>
      )}
    </div>
  );
}

