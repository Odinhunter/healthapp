const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
};

module.exports = {
  useRouter: jest.fn(() => mockRouter),
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
  usePathname: jest.fn(() => '/'),
  Link: ({ children, href, onPress }) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    return React.createElement(TouchableOpacity, { onPress }, children);
  },
  Redirect: ({ href }) => {
    const React = require('react');
    return React.createElement('View', { testID: `redirect-${href}` });
  },
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
  __mockRouter: mockRouter,
  __resetMocks: () => {
    Object.values(mockRouter).forEach(fn => {
      if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
    });
    mockRouter.canGoBack.mockReturnValue(true);
  },
};
