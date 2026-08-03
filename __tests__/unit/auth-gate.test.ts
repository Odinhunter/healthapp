/**
 * AuthGate routing logic tests
 *
 * The auth gate is the security perimeter of the app.
 * Incorrect routing here exposes health data to unauthenticated users
 * or prevents authenticated users from accessing their data.
 */

// Replicate the EXACT logic from app/_layout.tsx AuthGate
type Segment = string;
type RouteAction = 'redirect-to-welcome' | 'redirect-to-app' | 'stay';

const authGateDecision = (
  user: { id: string } | null,
  loading: boolean,
  segments: Segment[]
): RouteAction => {
  if (loading) return 'stay';

  const inAuthGroup = segments[0] === '(auth)';
  const segs = segments as string[];

  if (!user && !inAuthGroup) {
    return 'redirect-to-welcome';
  }

  if (user && inAuthGroup) {
    if (segs[1] === 'create-profile') return 'stay';
    return 'redirect-to-app';
  }

  return 'stay';
};

const mockUser = { id: 'user-123' };

describe('AuthGate — unauthenticated user routing', () => {
  it('unauthenticated user on app group is redirected to welcome', () => {
    expect(authGateDecision(null, false, ['(app)', 'index'])).toBe('redirect-to-welcome');
    expect(authGateDecision(null, false, ['(app)'])).toBe('redirect-to-welcome');
  });

  it('unauthenticated user on auth group stays', () => {
    expect(authGateDecision(null, false, ['(auth)', 'welcome'])).toBe('stay');
    expect(authGateDecision(null, false, ['(auth)', 'login'])).toBe('stay');
    expect(authGateDecision(null, false, ['(auth)', 'onboarding'])).toBe('stay');
    expect(authGateDecision(null, false, ['(auth)', 'verify'])).toBe('stay');
    expect(authGateDecision(null, false, ['(auth)', 'create-profile'])).toBe('stay');
  });

  it('unauthenticated user with no segments (root) is redirected', () => {
    // Root with no segments — not in auth group, not authenticated
    expect(authGateDecision(null, false, [])).toBe('redirect-to-welcome');
  });
});

describe('AuthGate — authenticated user routing', () => {
  it('authenticated user on auth screens (except create-profile) redirects to app', () => {
    expect(authGateDecision(mockUser, false, ['(auth)', 'welcome'])).toBe('redirect-to-app');
    expect(authGateDecision(mockUser, false, ['(auth)', 'login'])).toBe('redirect-to-app');
    expect(authGateDecision(mockUser, false, ['(auth)', 'onboarding'])).toBe('redirect-to-app');
    expect(authGateDecision(mockUser, false, ['(auth)', 'verify'])).toBe('redirect-to-app');
  });

  it('CRITICAL: authenticated user on create-profile stays — no redirect loop', () => {
    // If this returns 'redirect-to-app', the post-verify create-profile flow breaks
    expect(authGateDecision(mockUser, false, ['(auth)', 'create-profile'])).toBe('stay');
  });

  it('authenticated user on app group stays', () => {
    expect(authGateDecision(mockUser, false, ['(app)', 'index'])).toBe('stay');
    expect(authGateDecision(mockUser, false, ['(app)', 'records'])).toBe('stay');
    expect(authGateDecision(mockUser, false, ['(app)', 'visits'])).toBe('stay');
    expect(authGateDecision(mockUser, false, ['(app)', 'medications'])).toBe('stay');
  });

  it('authenticated user with empty segments stays', () => {
    expect(authGateDecision(mockUser, false, [])).toBe('stay');
  });
});

describe('AuthGate — loading state', () => {
  it('does nothing while loading regardless of user/segment state', () => {
    expect(authGateDecision(null, true, [])).toBe('stay');
    expect(authGateDecision(null, true, ['(app)', 'index'])).toBe('stay');
    expect(authGateDecision(mockUser, true, ['(auth)', 'welcome'])).toBe('stay');
    expect(authGateDecision(mockUser, true, [])).toBe('stay');
  });
});

describe('AuthGate — security invariants', () => {
  it('no unauthenticated path leads to app group without redirect', () => {
    const appPaths: Segment[][] = [
      ['(app)'],
      ['(app)', 'index'],
      ['(app)', 'records'],
      ['(app)', 'visits'],
      ['(app)', 'medications'],
    ];
    appPaths.forEach(segs => {
      const decision = authGateDecision(null, false, segs);
      expect(decision).toBe('redirect-to-welcome');
    });
  });

  it('no authenticated path stays on auth screens except create-profile', () => {
    const protectedAuthPaths: Segment[][] = [
      ['(auth)', 'welcome'],
      ['(auth)', 'login'],
      ['(auth)', 'onboarding'],
      ['(auth)', 'verify'],
    ];
    protectedAuthPaths.forEach(segs => {
      const decision = authGateDecision(mockUser, false, segs);
      expect(decision).toBe('redirect-to-app');
    });
  });

  it('create-profile is the ONLY auth screen that allows authenticated users', () => {
    const allAuthScreens = ['welcome', 'login', 'onboarding', 'verify', 'create-profile'];
    const exempted = allAuthScreens.filter(
      screen => authGateDecision(mockUser, false, ['(auth)', screen]) === 'stay'
    );
    expect(exempted).toEqual(['create-profile']);
    expect(exempted).toHaveLength(1);
  });
});
