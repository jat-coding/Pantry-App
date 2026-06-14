import { Component } from 'react'
import { PantryIcon } from './icons.jsx'

// Catches any render/runtime error in the tree below it and shows a friendly
// recovery screen instead of a blank white page. (Class component because React
// error boundaries can't be written as hooks.)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card w-full max-w-sm space-y-4 p-8 text-center">
          <div className="flex justify-center text-cta"><PantryIcon className="h-12 w-12" /></div>
          <h1 className="text-xl font-extrabold">Something went wrong</h1>
          <p className="text-sm text-warm-soft">
            The app hit an unexpected error. Reloading usually fixes it — your saved
            recipes are safe.
          </p>
          <button className="btn-peach w-full" onClick={() => window.location.reload()}>
            Reload Pantry
          </button>
        </div>
      </div>
    )
  }
}
