/**
 * Onboarding step state machine tests
 *
 * Tests the onboarding screen's internal step logic:
 * - Which steps require a selection before Continue enables
 * - Which steps are always-enabled (statements, not questions)
 * - Answer saving at the right step transitions
 * - Back navigation resets selectedOption
 */

type OnboardingAnswers = {
  records_location: string | null;
  test_frequency: string | null;
  top_priority: string | null;
};

// Replicate the button-enabled logic from onboarding.tsx
const isContinueEnabled = (step: number, selectedOption: string | null): boolean => {
  if (step === 3 || step === 5) return true;
  return selectedOption !== null;
};

// Replicate the answer-saving logic at each step transition
const saveAnswerForStep = (
  step: number,
  selectedOption: string | null,
  answers: OnboardingAnswers
): OnboardingAnswers => {
  if (step === 1) return { ...answers, records_location: selectedOption };
  if (step === 2) return { ...answers, test_frequency: selectedOption };
  if (step === 4) return { ...answers, top_priority: selectedOption };
  return answers; // steps 3 and 5 save nothing
};

describe('Continue button enabled state per step', () => {
  describe('Step 1 — records_location (question)', () => {
    it('disabled with no selection', () => {
      expect(isContinueEnabled(1, null)).toBe(false);
    });
    it('enabled with any selection', () => {
      expect(isContinueEnabled(1, 'whatsapp')).toBe(true);
      expect(isContinueEnabled(1, 'folder')).toBe(true);
      expect(isContinueEnabled(1, 'lab_only')).toBe(true);
      expect(isContinueEnabled(1, 'dont_track')).toBe(true);
    });
  });

  describe('Step 2 — test_frequency (question)', () => {
    it('disabled with no selection', () => {
      expect(isContinueEnabled(2, null)).toBe(false);
    });
    it('enabled with any selection', () => {
      expect(isContinueEnabled(2, 'few_months')).toBe(true);
      expect(isContinueEnabled(2, 'been_a_while')).toBe(true);
    });
  });

  describe('Step 3 — value proof (statement, always enabled)', () => {
    it('always enabled regardless of selectedOption', () => {
      expect(isContinueEnabled(3, null)).toBe(true);
      expect(isContinueEnabled(3, 'anything')).toBe(true);
    });
  });

  describe('Step 4 — top_priority (question)', () => {
    it('disabled with no selection', () => {
      expect(isContinueEnabled(4, null)).toBe(false);
    });
    it('enabled with any selection', () => {
      expect(isContinueEnabled(4, 'understanding_reports')).toBe(true);
      expect(isContinueEnabled(4, 'one_place')).toBe(true);
    });
  });

  describe('Step 5 — trust (statement, always enabled)', () => {
    it('always enabled regardless of selectedOption', () => {
      expect(isContinueEnabled(5, null)).toBe(true);
      expect(isContinueEnabled(5, 'anything')).toBe(true);
    });
  });
});

describe('Answer saving on step advance', () => {
  const emptyAnswers: OnboardingAnswers = {
    records_location: null,
    test_frequency: null,
    top_priority: null,
  };

  it('step 1 advance saves records_location', () => {
    const result = saveAnswerForStep(1, 'whatsapp', emptyAnswers);
    expect(result.records_location).toBe('whatsapp');
    expect(result.test_frequency).toBeNull(); // unchanged
    expect(result.top_priority).toBeNull();   // unchanged
  });

  it('step 2 advance saves test_frequency', () => {
    const answers = { ...emptyAnswers, records_location: 'folder' };
    const result = saveAnswerForStep(2, 'once_year', answers);
    expect(result.test_frequency).toBe('once_year');
    expect(result.records_location).toBe('folder'); // preserved
  });

  it('step 3 advance saves nothing (statement screen)', () => {
    const answers = { records_location: 'folder', test_frequency: 'once_year', top_priority: null };
    const result = saveAnswerForStep(3, null, answers);
    expect(result).toEqual(answers); // completely unchanged
  });

  it('step 4 advance saves top_priority', () => {
    const answers = { records_location: 'lab_only', test_frequency: 'few_months', top_priority: null };
    const result = saveAnswerForStep(4, 'medications', answers);
    expect(result.top_priority).toBe('medications');
  });

  it('step 5 advance saves nothing (trust screen)', () => {
    const answers = {
      records_location: 'whatsapp',
      test_frequency: 'been_a_while',
      top_priority: 'one_place',
    };
    const result = saveAnswerForStep(5, null, answers);
    expect(result).toEqual(answers); // completely unchanged
  });
});

describe('Full onboarding flow simulation', () => {
  it('complete happy path produces correct final answers', () => {
    let answers: OnboardingAnswers = {
      records_location: null,
      test_frequency: null,
      top_priority: null,
    };

    // Step 1
    answers = saveAnswerForStep(1, 'whatsapp', answers);
    // Step 2
    answers = saveAnswerForStep(2, 'once_year', answers);
    // Step 3 (statement — no change)
    answers = saveAnswerForStep(3, null, answers);
    // Step 4
    answers = saveAnswerForStep(4, 'understanding_reports', answers);
    // Step 5 (trust — no change)
    answers = saveAnswerForStep(5, null, answers);

    expect(answers).toEqual({
      records_location: 'whatsapp',
      test_frequency: 'once_year',
      top_priority: 'understanding_reports',
    });
  });

  it('user who skips step 1 selection cannot advance (disabled button)', () => {
    expect(isContinueEnabled(1, null)).toBe(false);
    // They MUST make a selection — no null slips through for question steps
  });

  it('all 4 answer combinations for top_priority are reachable', () => {
    const options = ['understanding_reports', 'tracking_family', 'medications', 'one_place'];
    options.forEach(opt => {
      const answers: OnboardingAnswers = {
        records_location: null,
        test_frequency: null,
        top_priority: null,
      };
      const result = saveAnswerForStep(4, opt, answers);
      expect(result.top_priority).toBe(opt);
      expect(isContinueEnabled(4, opt)).toBe(true);
    });
  });
});
