/**
 * Auth library function tests
 *
 * Tests the src/lib/auth.ts functions with mocked Supabase.
 * These are the only functions that actually call Supabase Auth.
 */

// moduleNameMapper in package.json already redirects @supabase/supabase-js → __mocks__/supabase-js.js
// No jest.mock() needed — the mapper injects the mock for all imports including src/lib/supabase.ts
import { signInWithOTP, verifyOTP, signOut, getCurrentUser } from '../../src/lib/auth';
import { __mockSupabase } from '@supabase/supabase-js';

const mockAuth = __mockSupabase.__mockAuth;

beforeEach(() => {
  __mockSupabase.__reset();
});

describe('signInWithOTP', () => {
  it('calls supabase.auth.signInWithOtp with correct phone', async () => {
    await signInWithOTP('+919876543210');
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
    });
    expect(mockAuth.signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it('throws when Supabase returns an error', async () => {
    mockAuth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: new Error('Phone number is invalid'),
    });
    await expect(signInWithOTP('+919876543210')).rejects.toThrow('Phone number is invalid');
  });

  it('throws on network failure (rejected promise)', async () => {
    mockAuth.signInWithOtp.mockRejectedValueOnce(new Error('Network error'));
    await expect(signInWithOTP('+919876543210')).rejects.toThrow('Network error');
  });

  it('does not throw on success', async () => {
    mockAuth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: null });
    await expect(signInWithOTP('+919876543210')).resolves.toBeUndefined();
  });
});

describe('verifyOTP', () => {
  it('calls supabase.auth.verifyOtp with phone, token, and sms type', async () => {
    await verifyOTP('+919876543210', '482917');
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      token: '482917',
      type: 'sms',
    });
  });

  it('throws when OTP is incorrect', async () => {
    mockAuth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: new Error('Token has expired or is invalid'),
    });
    await expect(verifyOTP('+919876543210', '000000')).rejects.toThrow(
      'Token has expired or is invalid'
    );
  });

  it('returns data on success', async () => {
    const mockData = {
      data: { session: { user: { id: 'uid' } }, user: { id: 'uid' } },
      error: null,
    };
    mockAuth.verifyOtp.mockResolvedValueOnce(mockData);
    const result = await verifyOTP('+919876543210', '482917');
    expect(result).toEqual(mockData.data);
  });
});

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    await signOut();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('throws on signOut failure', async () => {
    mockAuth.signOut.mockResolvedValueOnce({ error: new Error('SignOut failed') });
    await expect(signOut()).rejects.toThrow('SignOut failed');
  });
});

describe('getCurrentUser', () => {
  it('returns user when authenticated', async () => {
    const user = { id: 'user-123', phone: '+919876543210' };
    mockAuth.getUser.mockResolvedValueOnce({ data: { user }, error: null });
    const result = await getCurrentUser();
    expect(result).toEqual(user);
    expect(result?.id).toBe('user-123');
  });

  it('returns null when no user', async () => {
    mockAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });
});
