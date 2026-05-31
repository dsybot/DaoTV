/* eslint-disable no-console */

'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary to catch DOM manipulation errors caused by browser translation
 * extensions (Safari built-in, Google Translate, Immersive Translate, etc.).
 *
 * These extensions wrap text nodes in <font> tags and relocate them, causing
 * React to throw NotFoundError during removeChild operations when unmounting
 * components.
 */
export class DOMErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const isDOMError =
      error.name === 'NotFoundError' ||
      error.message.includes('removeChild') ||
      error.message.includes('The object can not be found here') ||
      error.message.includes('Node was not found');

    if (isDOMError) {
      console.warn(
        '[DOMErrorBoundary] Caught DOM manipulation error (likely from translation plugin):',
        error,
      );
      return { hasError: false, error: null };
    }

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isDOMError =
      error.name === 'NotFoundError' ||
      error.message.includes('removeChild') ||
      error.message.includes('The object can not be found here');

    if (isDOMError) {
      console.warn(
        '[DOMErrorBoundary] Translation plugin caused DOM error, recovering...',
        {
          error: error.message,
          componentStack: errorInfo.componentStack,
        },
      );
    } else {
      console.error('[DOMErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className='flex min-h-[200px] items-center justify-center p-4'>
            <div className='text-center'>
              <p className='mb-2 text-red-500'>出现错误</p>
              <button
                onClick={() =>
                  this.setState({ hasError: false, error: null })
                }
                className='rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600'
              >
                重试
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
