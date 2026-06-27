/**
 * Tiny dependency-free DOM hyperscript — the widget's deliberate alternative to
 * a virtual-DOM library (the widget is a lightweight, framework-agnostic embed,
 * so it ships no UI framework).
 *
 * `h(tag, props, children)` builds an element in one expression; `append` adds
 * children to an existing node. Both are bound to a `Document` so they work
 * against the real DOM in the browser and against an injected fake in tests.
 *
 * ```ts
 * const { h } = createDom(document)
 * const card = h('div', { class: 'card', on: { click: onClick } }, [
 *   h('h2', { text: 'Title' }),
 *   subtitle && h('p', { text: subtitle }), // falsy children are skipped
 * ])
 * ```
 */

/** A child accepted by {@link Dom.h}: a node, text, or a falsy value to skip. */
export type ElChild = Node | string | false | null | undefined

/** Props for {@link Dom.h}: class/text/html, known DOM properties, attributes, and `on` listeners. */
export interface ElProps {
  class?: string
  text?: string
  html?: string
  type?: string
  src?: string
  accept?: string
  placeholder?: string
  value?: string
  /** Event listeners keyed by event name, e.g. `{ click: () => … }`. */
  on?: Record<string, EventListener>
  [attr: string]: string | Record<string, EventListener> | undefined
}

/** A `<select>` choice: a bare value, or a value with a distinct display label. */
export type FieldChoice = string | { value: string; label?: string }

/** Options for {@link Dom.field}. With `choices`, a `<select>` is built; otherwise a text `<input>`. */
export interface FieldOptions {
  /** CSS class (defaults to `arkyc-addr-input`). */
  class?: string
  name?: string
  /** Input type (text inputs only; ignored for selects). */
  type?: string
  autocomplete?: string
  value?: string
  /** When present, render a `<select>` with `placeholder` as the leading empty option, then these. */
  choices?: FieldChoice[]
}

/** The hyperscript helpers bound to a {@link Document}. */
export interface Dom {
  h<T extends HTMLElement = HTMLElement>(tag: string, props?: ElProps, children?: ElChild | ElChild[]): T
  append(parent: HTMLElement, children?: ElChild | ElChild[]): void
  /**
   * Build a form control: a text `<input>`, or a `<select>` when `opts.choices`
   * is given (with `placeholder` as the leading empty option). Returns the
   * element — the caller appends it.
   *
   * @param placeholder
   * @param opts
   */
  field(placeholder: string, opts?: FieldOptions): HTMLInputElement | HTMLSelectElement
}

/**
 * Bind the hyperscript helpers to a specific `Document`. Pass the real
 * `document` in the browser, or an injected fake in tests.
 *
 * @param doc
 * @returns
 */
export function createDom(doc: Document): Dom {
  function append(parent: HTMLElement, children?: ElChild | ElChild[]): void {
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null || child === false) continue
      parent.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child)
    }
  }

  function h<T extends HTMLElement = HTMLElement>(tag: string, props: ElProps = {}, children?: ElChild | ElChild[]): T {
    const node = doc.createElement(tag) as T
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue
      if (key === 'on') {
        for (const [event, handler] of Object.entries(value as Record<string, EventListener>)) {
          node.addEventListener(event, handler)
        }
      } else if (key === 'class') node.className = value as string
      else if (key === 'text') node.textContent = value as string
      else if (key === 'html') node.innerHTML = value as string
      else if (key === 'value' || key === 'src' || key === 'type' || key === 'accept' || key === 'placeholder') {
        ;(node as unknown as Record<string, string>)[key] = value as string
      } else node.setAttribute(key, value as string)
    }
    append(node, children)
    return node
  }

  function field(placeholder: string, opts: FieldOptions = {}): HTMLInputElement | HTMLSelectElement {
    const cls = opts.class ?? 'arkyc-addr-input'
    if (opts.choices) {
      return h<HTMLSelectElement>(
        'select',
        { class: cls, name: opts.name, autocomplete: opts.autocomplete, 'aria-label': opts.name ?? placeholder },
        [
          h('option', { value: '', text: placeholder }),
          ...opts.choices.map((choice) => {
            const value = typeof choice === 'string' ? choice : choice.value
            const label = typeof choice === 'string' ? choice : (choice.label ?? choice.value)
            return h('option', { value, text: label })
          }),
        ],
      )
    }
    return h<HTMLInputElement>('input', {
      class: cls,
      type: opts.type ?? 'text',
      placeholder,
      name: opts.name,
      autocomplete: opts.autocomplete,
      value: opts.value,
    })
  }

  return { h, append, field }
}

/**
 * Browser-default helpers, bound lazily to `globalThis.document` for
 * non-test call sites.
 */
let browser: Dom | undefined
const lazy = (): Dom => (browser ??= createDom(globalThis.document))

/**
 * {@link Dom.h} bound to the browser `document`.
 * Import this from any browser-only module.
 *
 * @param tag
 * @param props
 * @param children
 * @returns
 */
export const h = <T extends HTMLElement = HTMLElement>(
  tag: string,
  props?: ElProps,
  children?: ElChild | ElChild[],
): T => lazy().h<T>(tag, props, children)

/**
 * {@link Dom.append} bound to the browser `document`.
 *
 * @param parent
 * @param children
 * @returns
 */
export const append = (parent: HTMLElement, children?: ElChild | ElChild[]): void => lazy().append(parent, children)

/**
 * {@link Dom.field} bound to the browser `document`.
 *
 * @param placeholder
 * @param opts
 * @returns
 */
export const field = (placeholder: string, opts?: FieldOptions): HTMLInputElement | HTMLSelectElement =>
  lazy().field(placeholder, opts)
