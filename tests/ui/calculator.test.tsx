import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Calculator from '../../src/ui/pages/Calculator';

afterEach(cleanup);

const HAND13 = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1', 'p2', 'z5', 'z5'];

function layHand(tiles: string[]): void {
  for (const t of tiles) fireEvent.click(screen.getByTestId(`pick-${t}`));
}

describe('计算器页面', () => {
  it('摆满 13 张显示听牌与番数明细', () => {
    render(<Calculator rulesetId="tuidaohu" />);
    layHand(HAND13);
    expect(screen.getByTestId('calc-wait-p3')).toBeTruthy();
    expect(screen.getByTestId('calc-result').textContent).toContain('剩 4 张');
    expect(screen.getByTestId('calc-result').textContent).toContain('合计 1 番');
  });

  it('记录已见牌后剩余张数扣减', () => {
    render(<Calculator rulesetId="tuidaohu" />);
    layHand(HAND13);
    fireEvent.click(screen.getByTestId('mode-seen'));
    fireEvent.click(screen.getByTestId('pick-p3'));
    expect(screen.getByTestId('calc-wait-p3').textContent).toContain('剩 3 张');
  });

  it('鸡平胡起胡提示可见', () => {
    render(<Calculator rulesetId="jipinghu" />);
    layHand(HAND13);
    const hint = screen.getByTestId('calc-hint');
    expect(hint.textContent).toContain('不满足 3 番起胡');
  });

  it('手牌满 13 张后选择器禁用，移除后恢复', () => {
    render(<Calculator rulesetId="tuidaohu" />);
    layHand(HAND13);
    expect((screen.getByTestId('pick-p3') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('hand-m1')); // 点手牌移除
    expect((screen.getByTestId('pick-p3') as HTMLButtonElement).disabled).toBe(false);
  });

  it('清空按钮重置手牌与已见', () => {
    render(<Calculator rulesetId="tuidaohu" />);
    layHand(HAND13);
    fireEvent.click(screen.getByTestId('mode-seen'));
    fireEvent.click(screen.getByTestId('pick-p4'));
    fireEvent.click(screen.getByTestId('calc-clear'));
    expect(screen.getByTestId('hand-tray').textContent).toContain('摆入');
    expect(screen.getByTestId('seen-tray').textContent).toContain('记录');
    expect(screen.getByTestId('calc-result').textContent).not.toContain('合计');
  });

  it('副露编辑：记碰后手牌上限变 10 张并参与计算', () => {
    render(<Calculator rulesetId="tuidaohu" />);
    fireEvent.click(screen.getByTestId('mode-meld'));
    fireEvent.click(screen.getByTestId('pick-z5')); // 记碰 z5（3 张）
    expect(screen.getByTestId('meld-tray').querySelectorAll('.tile-face').length).toBe(3);
    fireEvent.click(screen.getByTestId('pick-z5')); // 再点同牌升杠
    expect(screen.getByTestId('meld-tray').querySelectorAll('.tile-face').length).toBe(4);

    fireEvent.click(screen.getByTestId('mode-hand'));
    const hand10 = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'p1'];
    layHand(hand10); // 一组杠后手牌上限 10
    expect((screen.getByTestId('pick-p2') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('calc-result').textContent).not.toContain('摆满');
  });
});
