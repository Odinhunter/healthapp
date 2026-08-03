/**
 * Integration test: complete OTP verification flow
 *
 * Tests the full chain: verifyOTP → flush AsyncStorage → update profiles →
 * check family_members → route decision.
 *
 * This mirrors the exact logic in verify.tsx handleVerify.
 */

// moduleNameMapper handles @supabase/supabase-js and async-storage redirects globally

import AsyncStorage from '@react-native-async-storage/async-storage';
import { __mockSupabase } from '@supabase/supabase-js';
import { verifyOTP } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';

const mockAuth = __mockSupabase.__mockAuth;

// Simulate the handleVerify function from verify.tsx
const handleVerify = async (
  phone: string,
  otp: string
): Promise<{ route: string; error?: string }> => {
  try {
    await verifyOTP('+91' + phone, otp);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication failed');

    // Flush onboarding answers to profile
    const raw = await AsyncStorage.getItem('onboarding_answers');
    if (raw) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          onboarding_data: JSON.parse(raw) as Record<string, unknown>,
          onboarding_complete: true,
        })
        .eq('id', user.id);

      if (!updateError) {
        await AsyncStorage.removeItem('onboarding_answers');
      }
    }

    // Check for primary family member
    const { data: primary } = await supabase
      .from('family_members')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_primary', true)
      .maybeSingle();

    return { route: primary ? '/(app)' : '/(auth)/create-profile' };
  } catch (e) {
    return { route: '', error: (e as Error).message };
  }
};

beforeEach(() => {
  __mockSupabase.__reset();
  AsyncStorage.__reset();
});

describe('New user flow (no prior profile)', () => {
  beforeEach(() => {
    // verifyOtp succeeds
    mockAuth.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: 'new-user-id' } }, user: { id: 'new-user-id' } },
      error: null,
    });
    // getUser returns the new user
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    });
  });

  it('routes to create-profile when no primary family member', async () => {
    // No onboarding answers in storage
    // No primary member in DB
    __mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'family_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const result = await handleVerify('9876543210', '482917');
    expect(result.error).toBeUndefined();
    expect(result.route).toBe('/(auth)/create-profile');
  });

  it('flushes onboarding answers to Supabase before routing', async () => {
    const onboardingData = {
      records_location: 'whatsapp',
      test_frequency: 'once_year',
      top_priority: 'one_place',
      onboarding_completed_at: '2024-01-15T10:30:00.000Z',
    };
    // Pre-set AsyncStorage with onboarding answers
    await AsyncStorage.setItem('onboarding_answers', JSON.stringify(onboardingData));

    const mockUpdate = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });
    __mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { update: mockUpdate, eq: mockEq };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await handleVerify('9876543210', '482917');

    expect(mockUpdate).toHaveBeenCalledWith({
      onboarding_data: onboardingData,
      onboarding_complete: true,
    });
  });

  it('removes onboarding_answers from AsyncStorage after successful flush', async () => {
    await AsyncStorage.setItem('onboarding_answers', JSON.stringify({ records_location: 'whatsapp' }));

    __mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await handleVerify('9876543210', '482917');

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('onboarding_answers');
  });

  it('does not crash when AsyncStorage has no onboarding_answers (returning user)', async () => {
    // AsyncStorage is empty (no onboarding data)
    // This happens for returning users logging back in

    __mockSupabase.from.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const result = await handleVerify('9876543210', '482917');
    expect(result.error).toBeUndefined();
    expect(result.route).toBe('/(auth)/create-profile');
  });
});

describe('Returning user flow (has primary member)', () => {
  beforeEach(() => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: 'existing-user-id' } }, user: { id: 'existing-user-id' } },
      error: null,
    });
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'existing-user-id' } },
      error: null,
    });
  });

  it('routes to app when primary family member exists', async () => {
    __mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'family_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'fm-existing-123' },
            error: null,
          }),
        };
      }
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const result = await handleVerify('9876543210', '482917');
    expect(result.route).toBe('/(app)');
    expect(result.error).toBeUndefined();
  });
});

describe('Error handling', () => {
  it('handles incorrect OTP', async () => {
    mockAuth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: new Error('Token has expired or is invalid'),
    });

    const result = await handleVerify('9876543210', '000000');
    expect(result.error).toContain('Token has expired or is invalid');
    expect(result.route).toBe('');
  });

  it('handles auth.getUser failure after verify', async () => {
    mockAuth.verifyOtp.mockResolvedValueOnce({
      data: { session: { user: { id: 'uid' } }, user: { id: 'uid' } },
      error: null,
    });
    mockAuth.getUser.mockResolvedValueOnce({
      data: { user: null }, // user is null even after successful verify
      error: null,
    });

    const result = await handleVerify('9876543210', '482917');
    expect(result.error).toBe('Authentication failed');
  });

  it('handles Supabase profiles update failure gracefully', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'uid' } },
      error: null,
    });
    await AsyncStorage.setItem('onboarding_answers', JSON.stringify({ records_location: 'whatsapp' }));

    __mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: jest.fn().mockReturnThis(),
          // eq returns error — simulates write failure
          eq: jest.fn().mockResolvedValue({ data: null, error: new Error('Write failed') }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await handleVerify('9876543210', '482917');

    // Storage should NOT be cleared if update failed
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('onboarding_answers');
  });
});
