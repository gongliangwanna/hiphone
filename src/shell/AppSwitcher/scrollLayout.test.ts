import { describe, it, expect } from 'vitest';
import { computeSpacerWidth, CARD_WIDTH_RATIO, CARD_GAP } from './AppSwitcher';

/**
 * Layout model:
 *   [first card: marginLeft=spacer+gap, width=cw] [card: ml=gap, w=cw] ... [trailing spacer div: w=spacer+gap, has content]
 *
 * totalWidth = (spacer+gap) + n*cw + (n-1)*gap + (spacer+gap)
 * maxScrollLeft = totalWidth - viewportWidth
 * lastCardCenter = (spacer+gap) + (n-1)*(cw+gap) + cw/2
 * requiredScroll = lastCardCenter - vw/2
 */

function verifyLayout(viewportWidth: number, cardCount: number) {
  const cardWidth = Math.round(viewportWidth * CARD_WIDTH_RATIO);
  const gap = CARD_GAP;
  const spacer = computeSpacerWidth(viewportWidth, cardWidth, gap);
  const sideMargin = spacer + gap;

  const totalWidth = sideMargin + cardCount * cardWidth + (cardCount - 1) * gap + sideMargin;
  const maxScrollLeft = totalWidth - viewportWidth;

  const firstCardCenter = sideMargin + cardWidth / 2;
  const firstRequired = firstCardCenter - viewportWidth / 2;

  const lastCardCenter = sideMargin + (cardCount - 1) * (cardWidth + gap) + cardWidth / 2;
  const lastRequired = lastCardCenter - viewportWidth / 2;

  return { viewportWidth, cardWidth, spacer, sideMargin, totalWidth, maxScrollLeft, firstRequired, lastRequired };
}

describe('AppSwitcher scroll layout math', () => {
  const viewports = [320, 375, 390, 393, 414, 430];
  const cardCounts = [1, 2, 3, 5, 10];

  for (const vw of viewports) {
    for (const n of cardCounts) {
      it(`vw=${vw}, ${n} card(s): first card centered at scrollLeft≈0`, () => {
        const r = verifyLayout(vw, n);
        expect(Math.abs(r.firstRequired)).toBeLessThanOrEqual(1);
      });

      it(`vw=${vw}, ${n} card(s): last card can be centered`, () => {
        const r = verifyLayout(vw, n);
        expect(r.maxScrollLeft).toBeGreaterThanOrEqual(r.lastRequired - 1);
      });
    }
  }

  it('concrete: vw=430, 2 cards — the exact bug scenario', () => {
    const r = verifyLayout(430, 2);
    // cw = round(430*0.66) = 284
    // spacer = (430-284)/2 - 10 = 73-10 = 63
    // sideMargin = 73
    // total = 73 + 2*284 + 10 + 73 = 724
    // maxScroll = 724-430 = 294
    // lastCenter = 73 + 294 + 142 = 73+284+10+142 = 509... no:
    //   lastCenter = 73 + 1*(284+10) + 284/2 = 73+294+142 = 509
    // required = 509 - 215 = 294
    expect(r.totalWidth).toBe(724);
    expect(r.maxScrollLeft).toBe(294);
    expect(r.lastRequired).toBe(294);
    expect(r.maxScrollLeft).toBeGreaterThanOrEqual(r.lastRequired);
  });
});
