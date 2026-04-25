import { createSignal, createComponent } from 'solid-js'
import { render } from 'solid-js/web'
import { PlaysetsBoardRoot } from './PlaysetsBoardRoot'
import type { SceneData, EntityData } from './PlaysetsBoardRoot'

export interface HighlightCell {
  x: number
  y: number
  kind: 'move' | 'ability' | 'target' | 'drop' | 'dialog' | 'encounter'
}

class PlaysetsBoardElement extends HTMLElement {
  private _dispose: (() => void) | null = null
  private _setScene: ((v: SceneData) => void) | null = null
  private _setEntities: ((v: EntityData[]) => void) | null = null
  private _setMode: ((v: string) => void) | null = null
  private _setHighlights: ((v: HighlightCell[]) => void) | null = null

  static get observedAttributes() { return ['scene', 'entities', 'mode', 'highlights'] }

  connectedCallback() {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    this.appendChild(canvas)

    const host = this
    const initialMode = this.getAttribute('mode') ?? 'explore'
    const initialScene = this.getAttribute('scene')
    const initialEntities = this.getAttribute('entities')
    const initialHighlights = this.getAttribute('highlights')

    // Signals created inside render() so they have a proper reactive owner
    let _setScene: ((v: SceneData) => void) | null = null
    let _setEntities: ((v: EntityData[]) => void) | null = null
    let _setMode: ((v: string) => void) | null = null
    let _setHighlights: ((v: HighlightCell[]) => void) | null = null

    this._dispose = render(() => {
      const [scene, setScene] = createSignal<SceneData>(
        initialScene ? (() => { try { return JSON.parse(initialScene) as SceneData } catch { return {} } })() : {},
      )
      const [entities, setEntities] = createSignal<EntityData[]>(
        initialEntities ? (() => { try { return JSON.parse(initialEntities) as EntityData[] } catch { return [] } })() : [],
      )
      const [mode, setMode] = createSignal<string>(initialMode)
      const [highlights, setHighlights] = createSignal<HighlightCell[]>(
        initialHighlights ? (() => { try { return JSON.parse(initialHighlights) as HighlightCell[] } catch { return [] } })() : [],
      )

      _setScene = setScene
      _setEntities = setEntities
      _setMode = setMode
      _setHighlights = setHighlights

      return createComponent(PlaysetsBoardRoot, {
        host,
        canvas,
        get scene() { return scene() },
        get entities() { return entities() },
        get mode() { return mode() },
        get highlights() { return highlights() },
      })
    }, this)

    this._setScene = _setScene
    this._setEntities = _setEntities
    this._setMode = _setMode
    this._setHighlights = _setHighlights
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null) {
    if (!newVal) return
    try {
      if (name === 'scene') this._setScene?.(JSON.parse(newVal) as SceneData)
      else if (name === 'entities') this._setEntities?.(JSON.parse(newVal) as EntityData[])
      else if (name === 'mode') this._setMode?.(newVal)
      else if (name === 'highlights') this._setHighlights?.(JSON.parse(newVal) as HighlightCell[])
    } catch {
      console.warn(`[playsets-board] invalid JSON for attr:${name}`)
    }
  }

  disconnectedCallback() {
    this._dispose?.()
    this._dispose = null
    this._setScene = null
    this._setEntities = null
    this._setMode = null
    this._setHighlights = null
  }
}

if (!customElements.get('playsets-board')) {
  customElements.define('playsets-board', PlaysetsBoardElement)
}
