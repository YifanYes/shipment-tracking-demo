import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export class SceneBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <output className="scene-fallback">
          No se ha podido cargar la vista 3D. Puedes continuar desde el listado de envíos.
        </output>
      )
    }

    return this.props.children
  }
}
