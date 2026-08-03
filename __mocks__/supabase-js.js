// Full controllable Supabase mock for testing
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  then: jest.fn((resolve) => resolve({ data: null, error: null })),
};

// Make chainable methods return a thenable
const makeChainable = () => {
  const builder = { ...mockQueryBuilder };
  // Override then to make it a proper Promise
  let resolvedValue = { data: null, error: null };
  builder.__setResolvedValue = (val) => { resolvedValue = val; };
  builder.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject);
  return builder;
};

const mockAuth = {
  signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
  verifyOtp: jest.fn().mockResolvedValue({
    data: { session: { user: { id: 'test-user-id' } }, user: { id: 'test-user-id' } },
    error: null,
  }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  getUser: jest.fn().mockResolvedValue({
    data: { user: { id: 'test-user-id', phone: '+919876543210' } },
    error: null,
  }),
  onAuthStateChange: jest.fn((cb) => {
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
};

const mockSupabase = {
  auth: mockAuth,
  from: jest.fn((table) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn((resolve) => resolve({ data: [], error: null })),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test.com/file' } })),
    })),
  },
  __mockAuth: mockAuth,
  __reset: () => {
    Object.values(mockAuth).forEach(fn => {
      if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
    });
    mockAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mockAuth.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } }, user: { id: 'test-user-id' } },
      error: null,
    });
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', phone: '+919876543210' } },
      error: null,
    });
    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    mockSupabase.from.mockClear();
  },
};

const createClient = jest.fn(() => mockSupabase);

module.exports = { createClient, __mockSupabase: mockSupabase };
