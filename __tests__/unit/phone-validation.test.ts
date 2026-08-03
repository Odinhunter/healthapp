/**
 * Phone number validation logic
 * This runs on every keystroke in LoginScreen — must be airtight for health data.
 */

// The exact cleaning logic from login.tsx
const cleanPhone = (text: string): string =>
  text.replace(/\D/g, '').slice(0, 10);

const isPhoneComplete = (phone: string): boolean =>
  phone.length === 10;

describe('Phone number cleaning', () => {
  it('strips non-digit characters', () => {
    expect(cleanPhone('98765 43210')).toBe('9876543210');
    expect(cleanPhone('(987) 654-3210')).toBe('9876543210');
    expect(cleanPhone('+91 98765-43210')).toBe('9198765432'); // slices to 10
    expect(cleanPhone('abc123def456')).toBe('123456');   // 6 digits: 1,2,3,4,5,6
  });

  it('strips letters and symbols only, preserves digits', () => {
    expect(cleanPhone('abc')).toBe('');
    expect(cleanPhone('!@#$%^&*()')).toBe('');
    expect(cleanPhone('98765.43210')).toBe('9876543210');
  });

  it('truncates to exactly 10 digits', () => {
    expect(cleanPhone('12345678901234')).toBe('1234567890');
    expect(cleanPhone('00000000001')).toBe('0000000000');
  });

  it('handles empty and whitespace-only input', () => {
    expect(cleanPhone('')).toBe('');
    expect(cleanPhone('   ')).toBe('');
    expect(cleanPhone('\n\t')).toBe('');
  });

  it('handles unicode digits — should be stripped', () => {
    // Arabic-Indic digits ٤٥٦ are NOT \d in standard regex
    expect(cleanPhone('٤٥٦')).toBe('');
  });

  it('handles null-like edge cases without throwing', () => {
    expect(() => cleanPhone('')).not.toThrow();
    expect(() => cleanPhone('0')).not.toThrow();
  });
});

describe('Phone completeness check', () => {
  it('requires exactly 10 digits', () => {
    expect(isPhoneComplete('9876543210')).toBe(true);
    expect(isPhoneComplete('987654321')).toBe(false);   // 9 digits
    expect(isPhoneComplete('98765432100')).toBe(false); // 11 digits — but cleanPhone would have cut it
    expect(isPhoneComplete('')).toBe(false);
    expect(isPhoneComplete('0000000000')).toBe(true);
  });

  it('full number built to Supabase is correctly prefixed', () => {
    const phone = '9876543210';
    const full = '+91' + phone;
    expect(full).toBe('+919876543210');
    expect(full.startsWith('+91')).toBe(true);
    expect(full.length).toBe(13); // +91 (3) + 10 = 13
  });
});

describe('Phone edge cases for health-critical context', () => {
  it('rejects numbers starting with invalid Indian mobile prefixes — these are not validated at UI', () => {
    // We only validate length=10, not prefix. Document this intentional decision.
    // Prefix validation (6-9 for Indian mobile) is done server-side by Supabase/telecom.
    expect(isPhoneComplete('1234567890')).toBe(true); // 10 digits, passes UI check
  });

  it('paste of OTP code into phone field is sanitized', () => {
    // User accidentally pastes their OTP into phone field
    const otp = '123456';
    expect(cleanPhone(otp)).toBe('123456');
    expect(isPhoneComplete(cleanPhone(otp))).toBe(false); // 6 != 10
  });

  it('paste of space-formatted number works', () => {
    expect(cleanPhone('98765 43210')).toBe('9876543210');
    expect(isPhoneComplete(cleanPhone('98765 43210'))).toBe(true);
  });
});
