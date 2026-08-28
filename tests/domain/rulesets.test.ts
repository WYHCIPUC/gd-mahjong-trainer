import { describe, it, expect } from 'vitest';
import tuidaohuJson from '../../src/domain/rulesets/tuidaohu.json';
import jipinghuJson from '../../src/domain/rulesets/jipinghu.json';
import gangshiJson from '../../src/domain/rulesets/gangshi.json';
import { PREDICATE_IDS } from '../../src/domain/yaku';
import type { Ruleset } from '../../src/domain/rulesets/types';

const RULESETS = [tuidaohuJson, jipinghuJson, gangshiJson] as unknown as Ruleset[];
const byId = (id: string): Ruleset => {
  const r = RULESETS.find((x) => x.id === id);
  if (!r) throw new Error(`缺少 ruleset ${id}`);
  return r;
};

describe('ruleset schema 校验', () => {
  it('三份内置 ruleset 均存在且 id 正确', () => {
    expect(RULESETS.map((r) => r.id).sort()).toEqual(['gangshi', 'jipinghu', 'tuidaohu']);
    for (const r of RULESETS) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.experimental).toBe(true); // 番种表内容待人工核对（Task 11）
    }
  });

  it('起胡/封顶数值合法', () => {
    for (const r of RULESETS) {
      expect(r.startingFan).toBeGreaterThanOrEqual(0);
      if (r.capFan !== null) expect(r.capFan).toBeGreaterThanOrEqual(r.startingFan);
    }
    expect(byId('tuidaohu').startingFan).toBe(0);
    expect(byId('tuidaohu').capFan).toBeNull();
    expect(byId('jipinghu').startingFan).toBe(3);
    expect(byId('jipinghu').capFan).toBe(8);
    expect(byId('gangshi').startingFan).toBe(3);
    expect(byId('gangshi').capFan).toBe(8);
  });

  it('番种表：id 唯一、谓词已注册、互斥/分组引用有效、恰一个保底番', () => {
    for (const r of RULESETS) {
      expect(r.yaku.length).toBeGreaterThan(5);
      const ids = r.yaku.map((y) => y.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const y of r.yaku) {
        expect(PREDICATE_IDS).toContain(y.when);
        for (const ex of y.excludes ?? []) expect(ids).toContain(ex);
      }
      const bases = r.yaku.filter((y) => y.base);
      expect(bases.length).toBe(1);
    }
  });

  it('forms 与番种表联动：启用的胡牌形必有对应番种', () => {
    for (const r of RULESETS) {
      const whens = r.yaku.map((y) => y.when);
      expect(whens).toContain('base');
      if (r.forms.chiitoi) expect(whens).toContain('chiitoi');
      if (r.forms.kokushi) expect(whens).toContain('shisanyao');
    }
    expect(byId('gangshi').allowsChi).toBe(false); // 港式不可吃
    expect(byId('gangshi').forms.kokushi).toBe(true);
    expect(byId('tuidaohu').allowsChi).toBe(true);
  });
});
