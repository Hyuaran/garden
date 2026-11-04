import { describe, expect, it } from 'vitest';
import { scheduleTimes, validateScheduledAt } from './scheduled';

const now = new Date('2026-11-04T00:00:00Z');
describe('予約日時', () => {
  it('日本時間の9時から20時50分だけを10分刻みで選べる', () => {
    expect(scheduleTimes).toHaveLength(72);
    expect(scheduleTimes[0]).toBe('09:00');
    expect(scheduleTimes.at(-1)).toBe('20:50');
    expect(validateScheduledAt('2026-11-04T09:10:00+09:00', now)).toBe('2026-11-04T00:10:00.000Z');
  });
  it.each([
    '2026-11-04T09:09:00+09:00', '2026-11-04T09:10:01+09:00',
    '2026-11-04T09:00:00+09:00', '2026-11-05T08:50:00+09:00',
    '2026-11-05T21:00:00+09:00', '2026-11-05T00:00:00+09:00',
    '2027-02-04T09:10:00+09:00', 'invalid', '',
  ])('%s は予約不可', value => {
    expect(() => validateScheduledAt(value, now)).toThrow();
  });
  it('3か月ちょうどまで。月末は3か月後の末日に合わせる', () => {
    expect(() => validateScheduledAt('2027-02-04T09:00:00+09:00', now)).not.toThrow();
    const end = new Date('2026-11-30T00:00:00Z');
    expect(() => validateScheduledAt('2027-02-28T09:00:00+09:00', end)).not.toThrow();
    expect(() => validateScheduledAt('2027-03-01T09:00:00+09:00', end)).toThrow();
  });
});
