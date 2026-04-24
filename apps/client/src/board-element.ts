import { createSignal, createComponent } from 'solid-js'
import { render } from 'solid-js/web'
import { PlaysetsBoardRoot } from './PlaysetsBoardRoot'
import type { SceneData, EntityData } from './PlaysetsBoardRoot'

class PlaysetsBoardElement extends HTMLElement {
  private _dispose: (() => void) | null = null
  private _setScene: ((v: SceneData) => void) | null = null
  private _setEntities: ((v: EntityData[]) => void) | null = null
  private _setMode: ((v: string) => void) | null = null

  static get observedAttributes() { return ['scene', 'entities', 'mode'] }

  connectedCallback() {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;'
    this.appendChild(canvas)

    const host = this
    const initialMode = this.getAttribute('mode') ?? 'explore'
    const initialScene = this.getAttribute('scene')
    const initialEntities = this.getAttribute('entities')

    // Signals created inside render() so they have a proper reactive owner
    let _setScene: ((v: SceneData) => void) | null = null
    let _setEntities: ((v: EntityData[]) => void) | null = null
    let _setMode: ((v: string) => void) | null = null

    this._dispose = render(() => {
      const [scene, setScene] = createSignal<SceneData>(
        initialScene ? (() => { try { return JSON.parse(initialScene) as SceneData } catch { return {} } })() : {},
      )
      const [entities, setEntities] = createSignal<EntityData[]>(
        initialEntities ? (() => { try { return JSON.parse(initialEntities) as EntityData[] } catch { return [] } })() : [],
      )
      const [mode, setMode] = createSignal<string>(initialMode)

      _setScene = setScene
      _setEntities = setEntities
      _setMode = setMode

      return createComponent(PlaysetsBoardRoot, {
        host,
        canvas,
        get scene() { return scene() },
        get entities() { return entities() },
        get mode() { return mode() },
      })
    }, this)

    this._setScene = _setScene
    this._setEntities = _setEntities
    this._setMode = _setMode
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null) {
    if (!newVal) return
    try {
      if (name === 'scene') this._setScene?.(JSON.parse(newVal) as SceneData)
      else if (name === 'entities') this._setEntities?.(JSON.parse(newVal) as EntityData[])
      else if (name === 'mode') this._setMode?.(newVal)
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
  }
}

if (!customElements.get('playsets-board')) {
  customElements.define('playsets-board', PlaysetsBoardElement)
}
