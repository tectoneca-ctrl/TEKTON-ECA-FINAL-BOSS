import React, { Component, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    return this.state.err
      ? <div className="login"><div className="card"><h1>May nangyaring error</h1><p className="muted">{this.state.err.message}</p>
          <button onClick={() => { localStorage.clear(); location.reload() }}>Reset demo data</button></div></div>
      : this.props.children
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Boundary><App /></Boundary></React.StrictMode>)
