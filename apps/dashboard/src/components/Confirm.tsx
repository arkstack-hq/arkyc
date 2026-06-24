import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Style the confirm button as destructive (red). Default true. */
  destructive?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/**
 * App-wide confirmation gate. Wrap the app once; call `useConfirm()` and
 * `await confirm({ title, description, destructive })` before any dangerous
 * action — proceed only when it resolves `true`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOptions(opts)
      }),
    [],
  )

  const close = (result: boolean) => {
    setOptions(null)
    resolver.current?.(result)
    resolver.current = null
  }

  const destructive = options?.destructive !== false

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onClose={() => close(false)} className="max-w-md">
        {options ? (
          <>
            <DialogHeader>
              <DialogTitle>{options.title}</DialogTitle>
              {options.description ? <DialogDescription>{options.description}</DialogDescription> : null}
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                {options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={destructive ? 'destructive' : 'default'} onClick={() => close(true)}>
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </ConfirmContext.Provider>
  )
}

/** Access the app-wide confirm gate. Throws if used outside {@link ConfirmProvider}. */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')

  return ctx
}
