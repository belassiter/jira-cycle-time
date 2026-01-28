import { describe, it, expect } from 'vitest';
import { interpolateColor } from './colors';

describe('interpolateColor', () => {
    it('returns green for the minimum value', () => {
        const result = interpolateColor(0, 0, 10);
        expect(result).toBe('rgb(64, 192, 87)'); // Green
    });

    it('returns orange for the maximum value', () => {
        const result = interpolateColor(10, 0, 10);
        expect(result).toBe('rgb(253, 126, 20)'); // Orange
    });

    it('returns a middle color for the midpoint', () => {
        const result = interpolateColor(5, 0, 10);
        expect(result.startsWith('rgb(')).toBe(true);
        expect(result.endsWith(')')).toBe(true);
        expect(result).not.toBe('rgb(64, 192, 87)');
        expect(result).not.toBe('rgb(253, 126, 20)');
    });

    it('handles zero range by returning blue (default)', () => {
        const result = interpolateColor(5, 5, 5);
        expect(result).toBe('#228be6');
    });

    it('caps values outside the range', () => {
        expect(interpolateColor(-10, 0, 10)).toBe('rgb(64, 192, 87)');
        expect(interpolateColor(20, 0, 10)).toBe('rgb(253, 126, 20)');
    });
});
