import type { Ruleset } from './types';
import tuidaohu from './tuidaohu.json';
import jipinghu from './jipinghu.json';
import gangshi from './gangshi.json';

export const BUILTIN_RULESETS: Ruleset[] = [tuidaohu, jipinghu, gangshi] as unknown as Ruleset[];

export const getRuleset = (id: string): Ruleset => {
  const r = BUILTIN_RULESETS.find((x) => x.id === id);
  if (!r) throw new Error(`未内置的流派: ${id}`);
  return r;
};
