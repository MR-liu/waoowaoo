'use client'

import { Component, type ReactNode } from 'react'
import { logError } from '@/lib/logging/core'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logError('[ErrorBoundary] Uncaught render error', {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="glass-surface p-6 max-w-md text-center rounded-xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--glass-tone-danger-bg)] flex items-center justify-center">
              <span className="text-[var(--glass-tone-danger-fg)] text-xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--glass-text-primary)] mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--glass-text-secondary)] mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleReset}
              className="glass-btn-base glass-btn-primary px-6 py-2 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
