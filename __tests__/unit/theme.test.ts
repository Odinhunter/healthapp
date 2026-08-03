/**
 * Design system contract tests
 *
 * The theme is imported by every component. Missing or wrong values
 * cause silent visual bugs at scale. This tests the exact values
 * specified in the design brief.
 */
import { colors, typography, spacing, radius } from '../../src/constants/theme';

describe('Colors — exact hex values', () => {
  it('primary is correct teal', () => expect(colors.primary).toBe('#0F6E56'));
  it('primaryLight is correct light teal', () => expect(colors.primaryLight).toBe('#E1F5EE'));
  it('background is correct off-white', () => expect(colors.background).toBe('#FAFAF9'));
  it('surface is pure white', () => expect(colors.surface).toBe('#FFFFFF'));
  it('border is correct gray', () => expect(colors.border).toBe('#E8E6E1'));
  it('textPrimary is near-black', () => expect(colors.textPrimary).toBe('#1A1A1A'));
  it('textSecondary is medium gray', () => expect(colors.textSecondary).toBe('#6B6966'));
  it('textTertiary is light gray', () => expect(colors.textTertiary).toBe('#9C9A92'));
  it('success is correct green', () => expect(colors.success).toBe('#1D9E75'));
  it('danger is correct red', () => expect(colors.danger).toBe('#E24B4A'));

  it('all color values are valid hex format', () => {
    const hexPattern = /^#[0-9A-Fa-f]{3,8}$/;
    Object.entries(colors).forEach(([key, val]) => {
      expect(val).toMatch(hexPattern);
    });
  });
});

describe('Typography — exact pixel values', () => {
  it('xs = 11', () => expect(typography.xs).toBe(11));
  it('sm = 13', () => expect(typography.sm).toBe(13));
  it('base = 15', () => expect(typography.base).toBe(15));
  it('md = 17', () => expect(typography.md).toBe(17));
  it('lg = 20', () => expect(typography.lg).toBe(20));
  it('xl = 24', () => expect(typography.xl).toBe(24));
  it('xxl = 30', () => expect(typography.xxl).toBe(30));

  it('all sizes are positive integers', () => {
    Object.values(typography).forEach(size => {
      expect(size).toBeGreaterThan(0);
      expect(Number.isInteger(size)).toBe(true);
    });
  });

  it('sizes are in ascending order', () => {
    const sizes = [typography.xs, typography.sm, typography.base, typography.md, typography.lg, typography.xl, typography.xxl];
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });
});

describe('Spacing — exact pixel values', () => {
  it('xs = 4', () => expect(spacing.xs).toBe(4));
  it('sm = 8', () => expect(spacing.sm).toBe(8));
  it('md = 12', () => expect(spacing.md).toBe(12));
  it('lg = 16', () => expect(spacing.lg).toBe(16));
  it('xl = 20', () => expect(spacing.xl).toBe(20));
  it('xxl = 24 (standard screen padding)', () => expect(spacing.xxl).toBe(24));
  it('xxxl = 32', () => expect(spacing.xxxl).toBe(32));
  it('xxxxl = 40', () => expect(spacing.xxxxl).toBe(40));
  it('xxxxxl = 48', () => expect(spacing.xxxxxl).toBe(48));
});

describe('Border radius — exact values', () => {
  it('sm = 6', () => expect(radius.sm).toBe(6));
  it('md = 10', () => expect(radius.md).toBe(10));
  it('lg = 14 (used for inputs and cards)', () => expect(radius.lg).toBe(14));
  it('xl = 20', () => expect(radius.xl).toBe(20));
  it('full = 999 (pill shape)', () => expect(radius.full).toBe(999));
});
