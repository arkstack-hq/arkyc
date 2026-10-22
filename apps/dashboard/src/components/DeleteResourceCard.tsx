import { useState } from 'react'
import { useRequest } from 'alova/client'
import type { Method } from 'alova'
import { errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'

/**
 * A danger-zone card that permanently deletes a project or organization once the
 * user types its exact name.
 */
export function DeleteResourceCard({
  kind,
  name,
  queuedAt,
  consequences,
  remove,
  onDeleted,
}: {
  kind: 'project' | 'organization'
  name: string
  /** When the resource was queued for deletion, if it has been. */
  queuedAt?: string | null
  /** What else disappears with it. */
  consequences: string
  remove: (typed: string) => Method
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [queued, setQueued] = useState(false)
  const { send, loading, error, onSuccess } = useRequest(() => remove(typed.trim()), { immediate: false })
  onSuccess(() => {
    setOpen(false)
    setQueued(true)
    onDeleted()
  })

  const matches = typed.trim() === name
  const pending = queued || Boolean(queuedAt)

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          {pending
            ? `This ${kind} is queued for deletion and will be removed shortly. ${consequences}`
            : `Deleting this ${kind} is permanent. ${consequences}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="destructive" disabled={pending} onClick={() => setOpen(true)}>
          {pending ? 'Deletion queued' : `Delete ${kind}`}
        </Button>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (matches) void send()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>This can't be undone. {consequences}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`delete-${kind}`}>
              Type <span className="font-mono font-semibold text-foreground">{name}</span> to confirm
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`delete-${kind}`}
                value={typed}
                autoComplete="off"
                autoFocus
                onChange={(e) => setTyped(e.target.value)}
              />
            </InputGroup>
            {error ? <FieldError>{errorMessage(error, `Failed to delete the ${kind}.`)}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || loading}>
              {loading ? <Spinner /> : null}
              Delete {kind}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Card>
  )
}
