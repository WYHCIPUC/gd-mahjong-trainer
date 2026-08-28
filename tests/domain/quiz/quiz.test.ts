import { describe, it, expect } from 'vitest';
import bankJson from '../../../src/domain/quiz/bank.json';
import { gradeAnswer, type QuizQuestion } from '../../../src/domain/quiz/types';
import { generateDiscardQuiz, validateQuizQuestion } from '../../../src/domain/quiz/generator';
import { parseHandShorthand } from '../../../src/domain/tiles';

const bank = bankJson as unknown as QuizQuestion[];

describe('题库 schema', () => {
  it('每道题结构合法：hand 可解析、options 互异、best 在 options 内', () => {
    expect(bank.length).toBeGreaterThanOrEqual(10);
    for (const q of bank) {
      const counts = parseHandShorthand(q.hand);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(13);
      const err = validateQuizQuestion(q);
      expect(err).toBeNull();
    }
  });
});

describe('gradeAnswer 判分（容差规则）', () => {
  const q = bank[0]; // best p1, acceptable [p2]
  it('选 best 判对', () => expect(gradeAnswer(q, 'p1')).toBe('best'));
  it('选 acceptable 判「两者皆可」', () => expect(gradeAnswer(q, 'p2')).toBe('acceptable'));
  it('其他选项判错', () => expect(gradeAnswer(q, 'm1')).toBe('wrong'));
});

describe('随机练习生成器', () => {
  it('同 seed 出题一致', () => {
    const a = generateDiscardQuiz(42);
    const b = generateDiscardQuiz(42);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });

  it('生成的题目结构合法', () => {
    const q = generateDiscardQuiz(7);
    expect(q).not.toBeNull();
    if (!q) return;
    expect(validateQuizQuestion(q)).toBeNull();
    const counts = parseHandShorthand(q.hand);
    expect(counts.reduce((x, y) => x + y, 0)).toBe(13);
    expect(gradeAnswer(q, q.best)).toBe('best');
  });
});
