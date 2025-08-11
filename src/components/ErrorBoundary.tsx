import React from 'react';

interface State { hasError: boolean; error?: Error; info?: React.ErrorInfo; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { this.setState({ info }); console.error('App error boundary caught', error, info); }
  reset = () => { this.setState({ hasError: false, error: undefined, info: undefined }); };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui' }} role="alert">
          <h2 style={{ marginTop:0 }}>Something went wrong.</h2>
          <pre style={{ background:'#200', color:'#f88', padding:'1rem', borderRadius:8, maxHeight:200, overflow:'auto' }}>{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} style={{ marginRight: '1rem' }}>Reload</button>
          <button onClick={this.reset}>Try Continue</button>
        </div>
      );
    }
    return this.props.children;
  }
}
