import { describe, it, expect } from 'vitest';
import { formatWorkDays } from './formatting';

describe('formatWorkDays', () => {
  it('formats small numbers with 1 decimal', () => {
    expect(formatWorkDays(1.125)).toBe('1.1 work days');
    expect(formatWorkDays(5.678)).toBe('5.7 work days');
  });

  it('formats large numbers (>=10) with no decimals', () => {
    expect(formatWorkDays(10.1)).toBe('10 work days');
    expect(formatWorkDays(12.9)).toBe('13 work days'); // Rounding? Usually implied.
    expect(formatWorkDays(100)).toBe('100 work days');
  });

  it('handles integers cleanly below 10', () => {
    // "Never show more than one" - so 5 is fine.
    expect(formatWorkDays(5)).toBe('5 work days');
  });
});
