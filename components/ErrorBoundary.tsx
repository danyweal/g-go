import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Optional: log to a service
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
