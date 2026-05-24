import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:40,background:'#111',color:'#fff',fontFamily:'monospace',minHeight:'100vh'}}>
          <h2 style={{color:'#f87171'}}>App Error</h2>
          <pre style={{color:'#fca5a5',whiteSpace:'pre-wrap'}}>{this.state.error?.message}</pre>
          <pre style={{color:'#555',fontSize:11,marginTop:16,whiteSpace:'pre-wrap'}}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
