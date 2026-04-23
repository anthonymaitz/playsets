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
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    this.appendChild(canvas)

    const [scene, setScene] = createSignal<SceneData>({})
    const [entities, setEntities] = createSignal<EntityData[]>([])
    const [mode, setMode] = createSignal<string>(this.getAttribute('mode') ?? 'explore')

    this._setScene = setScene
    this._setEntities = setEntities
    this._setMode = setMode

    // Parse attributes already present before connectedCallback
    const initScene = this.getAttribute('scene')
    if (initScene) try { setScene(JSON.parse(initScene) as SceneData) } catch { /* ignore */ }
    const initEntities = this.getAttribute('entities')
    if (initEntities) try { setEntities(JSON.parse(initEntities) as EntityData[]) } catch { /* ignore */ }

    const host = this
    this._dispose = render(
      // Reactive getters ensure props re-run effects inside PlaysetsBoardRoot when signals change
      () => createComponent(PlaysetsBoardRoot, {
        host,
        canvas,
        get scene() { return scene() },
        get entities() { return entities() },
        get mode() { return mode() },
      }),
      this,
    )
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
