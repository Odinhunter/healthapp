/**
 * Exercises the real ErrorBoundary component — it imports from src/, renders it,
 * and asserts on rendered output. Most of this repo's other tests define the
 * logic they check inside the test file, which means they cannot fail when the
 * app changes. This one can.
 */
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ErrorBoundary from '../../src/components/common/ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('kaboom');
  return <Text>healthy content</Text>;
}

describe('ErrorBoundary', () => {
  // React logs caught render errors to console.error; silence it so the
  // suite output stays readable, and restore afterwards.
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('healthy content')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('catches a render error and shows the fallback instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText('healthy content')).toBeNull();
  });

  it('reassures the user that their data is intact', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    // The copy matters: this screen appears in front of beta families.
    expect(screen.getByText(/nothing was lost/i)).toBeTruthy();
  });

  it('reports the error to onError so a crash reporter can be wired in', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('kaboom');
  });

  it('recovers when the underlying problem is gone', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // Simulate the transient cause clearing, then hitting "Try again".
    rerender(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByLabelText('Try again'));

    expect(screen.getByText('healthy content')).toBeTruthy();
  });

  it('hides the escape hatch unless a handler is supplied', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.queryByLabelText('Back to home')).toBeNull();
  });

  it('calls onGoHome so a deterministic error does not trap the user', () => {
    const onGoHome = jest.fn();

    render(
      <ErrorBoundary onGoHome={onGoHome}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    fireEvent.press(screen.getByLabelText('Back to home'));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
