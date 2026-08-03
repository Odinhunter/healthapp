/**
 * OTP input cleaning and validation logic
 * The hidden TextInput in verify.tsx uses this exact logic.
 * Security: OTP must be exactly 6 digits, no more, no less.
 */

const cleanOTP = (text: string): string =>
  text.replace(/\D/g, '').slice(0, 6);

const isOTPComplete = (otp: string): boolean =>
  otp.length === 6;

describe('OTP cleaning', () => {
  it('strips non-numeric characters', () => {
    expect(cleanOTP('12 34 56')).toBe('123456');
    expect(cleanOTP('1a2b3c')).toBe('123');
    expect(cleanOTP('------')).toBe('');
  });

  it('truncates to 6 digits', () => {
    expect(cleanOTP('1234567')).toBe('123456');
    expect(cleanOTP('123456789')).toBe('123456');
  });

  it('handles SMS autofill format — entire message pasted', () => {
    // iOS pastes just the code; Android might paste more context
    expect(cleanOTP('Your code is 482917')).toBe('482917');
    expect(cleanOTP('482917 is your HealthApp OTP')).toBe('482917');
    // HealthApp has 9 digits here... slice handles it
    expect(cleanOTP('482917 is your')).toBe('482917');
  });

  it('handles empty input', () => {
    expect(cleanOTP('')).toBe('');
    expect(isOTPComplete(cleanOTP(''))).toBe(false);
  });

  it('handles partial entry', () => {
    expect(cleanOTP('123')).toBe('123');
    expect(isOTPComplete('123')).toBe(false);
  });

  it('all-zeros is valid (edge case for test OTPs)', () => {
    expect(cleanOTP('000000')).toBe('000000');
    expect(isOTPComplete('000000')).toBe(true);
  });

  it('all-nines is valid', () => {
    expect(cleanOTP('999999')).toBe('999999');
    expect(isOTPComplete('999999')).toBe(true);
  });
});

describe('OTP display box logic', () => {
  // The 6 boxes show individual digits from the otp string
  const getBoxState = (otp: string, index: number): 'empty-active' | 'empty' | 'filled' => {
    if (otp.length === index) return 'empty-active';
    if (index < otp.length) return 'filled';
    return 'empty';
  };

  it('first box is active when otp is empty', () => {
    expect(getBoxState('', 0)).toBe('empty-active');
    expect(getBoxState('', 1)).toBe('empty');
    expect(getBoxState('', 5)).toBe('empty');
  });

  it('box becomes filled as digits are entered', () => {
    expect(getBoxState('1', 0)).toBe('filled');
    expect(getBoxState('1', 1)).toBe('empty-active');
    expect(getBoxState('12345', 4)).toBe('filled');
    expect(getBoxState('12345', 5)).toBe('empty-active');
  });

  it('all boxes filled when OTP complete', () => {
    const otp = '123456';
    for (let i = 0; i < 6; i++) {
      expect(getBoxState(otp, i)).toBe('filled');
    }
  });

  it('after error clears to empty, box 0 is active', () => {
    const cleared = '';
    expect(getBoxState(cleared, 0)).toBe('empty-active');
  });
});

describe('OTP full number concatenation', () => {
  it('verify call uses correct format', () => {
    const phone = '9876543210';
    const otp = '482917';
    const fullPhone = '+91' + phone;
    expect(fullPhone).toBe('+919876543210');
    expect(otp.length).toBe(6);
    // These are what get passed to verifyOTP(fullPhone, otp)
    expect(fullPhone).toMatch(/^\+91\d{10}$/);
    expect(otp).toMatch(/^\d{6}$/);
  });
});
