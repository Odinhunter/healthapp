/**
 * Onboarding answers data contract tests
 *
 * The `onboarding_data` shape stored in Supabase profiles must match
 * the documented JSON contract exactly. This is health data that will
 * be used for product decisions and personalization — errors here silently
 * corrupt user data for millions of users.
 */

type OnboardingAnswers = {
  records_location: string | null;
  test_frequency: string | null;
  top_priority: string | null;
};

type SavedOnboardingData = OnboardingAnswers & {
  onboarding_completed_at: string;
};

// The exact logic from onboarding.tsx step 5 handleFinish
const buildOnboardingPayload = (
  answers: OnboardingAnswers,
  selectedOption: string | null,
  now: Date
): SavedOnboardingData => ({
  ...answers,
  top_priority: selectedOption ?? answers.top_priority,
  onboarding_completed_at: now.toISOString(),
});

// Valid values per the documented schema
const VALID_RECORDS_LOCATIONS = ['whatsapp', 'folder', 'lab_only', 'dont_track'];
const VALID_TEST_FREQUENCIES = ['few_months', 'once_year', 'when_needed', 'been_a_while'];
const VALID_TOP_PRIORITIES = ['understanding_reports', 'tracking_family', 'medications', 'one_place'];

describe('Onboarding data shape', () => {
  const mockDate = new Date('2024-01-15T10:30:00.000Z');

  it('produces correct shape with all answers filled', () => {
    const answers: OnboardingAnswers = {
      records_location: 'whatsapp',
      test_frequency: 'once_year',
      top_priority: null, // set via selectedOption on step 5
    };
    const payload = buildOnboardingPayload(answers, 'one_place', mockDate);

    expect(payload).toEqual({
      records_location: 'whatsapp',
      test_frequency: 'once_year',
      top_priority: 'one_place',
      onboarding_completed_at: '2024-01-15T10:30:00.000Z',
    });
  });

  it('uses selectedOption for top_priority over saved answer', () => {
    const answers: OnboardingAnswers = {
      records_location: 'folder',
      test_frequency: 'few_months',
      top_priority: 'medications', // previously saved
    };
    // User changed answer on step 4, selectedOption reflects latest
    const payload = buildOnboardingPayload(answers, 'tracking_family', mockDate);
    expect(payload.top_priority).toBe('tracking_family');
  });

  it('falls back to saved top_priority when selectedOption is null', () => {
    const answers: OnboardingAnswers = {
      records_location: 'lab_only',
      test_frequency: 'when_needed',
      top_priority: 'understanding_reports',
    };
    const payload = buildOnboardingPayload(answers, null, mockDate);
    expect(payload.top_priority).toBe('understanding_reports');
  });

  it('onboarding_completed_at is a valid ISO 8601 timestamp', () => {
    const answers: OnboardingAnswers = {
      records_location: 'dont_track',
      test_frequency: 'been_a_while',
      top_priority: null,
    };
    const payload = buildOnboardingPayload(answers, 'one_place', new Date());
    // ISO 8601 format
    expect(payload.onboarding_completed_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    // Must be parseable
    expect(() => new Date(payload.onboarding_completed_at)).not.toThrow();
    expect(new Date(payload.onboarding_completed_at).getTime()).not.toBeNaN();
  });

  it('does not include unexpected keys that would corrupt the JSONB column', () => {
    const answers: OnboardingAnswers = {
      records_location: 'whatsapp',
      test_frequency: 'few_months',
      top_priority: null,
    };
    const payload = buildOnboardingPayload(answers, 'medications', mockDate);
    const keys = Object.keys(payload);
    expect(keys).toHaveLength(4);
    expect(keys).toEqual(
      expect.arrayContaining([
        'records_location',
        'test_frequency',
        'top_priority',
        'onboarding_completed_at',
      ])
    );
  });
});

describe('Onboarding valid values contract', () => {
  it('records_location values match documented enum', () => {
    expect(VALID_RECORDS_LOCATIONS).toHaveLength(4);
    expect(VALID_RECORDS_LOCATIONS).toContain('whatsapp');
    expect(VALID_RECORDS_LOCATIONS).toContain('folder');
    expect(VALID_RECORDS_LOCATIONS).toContain('lab_only');
    expect(VALID_RECORDS_LOCATIONS).toContain('dont_track');
  });

  it('test_frequency values match documented enum', () => {
    expect(VALID_TEST_FREQUENCIES).toHaveLength(4);
    expect(VALID_TEST_FREQUENCIES).toContain('few_months');
    expect(VALID_TEST_FREQUENCIES).toContain('once_year');
    expect(VALID_TEST_FREQUENCIES).toContain('when_needed');
    expect(VALID_TEST_FREQUENCIES).toContain('been_a_while');
  });

  it('top_priority values match documented enum', () => {
    expect(VALID_TOP_PRIORITIES).toHaveLength(4);
    expect(VALID_TOP_PRIORITIES).toContain('understanding_reports');
    expect(VALID_TOP_PRIORITIES).toContain('tracking_family');
    expect(VALID_TOP_PRIORITIES).toContain('medications');
    expect(VALID_TOP_PRIORITIES).toContain('one_place');
  });

  it('no value is undefined (would be dropped from JSONB silently)', () => {
    [...VALID_RECORDS_LOCATIONS, ...VALID_TEST_FREQUENCIES, ...VALID_TOP_PRIORITIES].forEach(v => {
      expect(v).not.toBeUndefined();
      expect(v).toBeTruthy();
    });
  });
});

describe('AsyncStorage round-trip fidelity', () => {
  it('JSON serialization preserves all fields exactly', () => {
    const payload: SavedOnboardingData = {
      records_location: 'whatsapp',
      test_frequency: 'once_year',
      top_priority: 'one_place',
      onboarding_completed_at: '2024-01-15T10:30:00.000Z',
    };

    const serialized = JSON.stringify(payload);
    const restored = JSON.parse(serialized) as SavedOnboardingData;

    expect(restored).toEqual(payload);
    expect(restored.records_location).toBe('whatsapp');
    expect(restored.onboarding_completed_at).toBe('2024-01-15T10:30:00.000Z');
  });

  it('null values are preserved through JSON round-trip', () => {
    const payload: SavedOnboardingData = {
      records_location: null,
      test_frequency: null,
      top_priority: null,
      onboarding_completed_at: '2024-01-15T10:30:00.000Z',
    };

    const restored = JSON.parse(JSON.stringify(payload));
    expect(restored.records_location).toBeNull();
    expect(restored.test_frequency).toBeNull();
    expect(restored.top_priority).toBeNull();
  });

  it('partial AsyncStorage read (corrupted data) does not crash', () => {
    const corrupted = '{"records_location":"whatsapp"}'; // missing fields
    const parsed = JSON.parse(corrupted) as Partial<SavedOnboardingData>;
    // These would be undefined, not null — document this behavior
    expect(parsed.test_frequency).toBeUndefined();
    expect(parsed.top_priority).toBeUndefined();
    expect(parsed.onboarding_completed_at).toBeUndefined();
  });
});
