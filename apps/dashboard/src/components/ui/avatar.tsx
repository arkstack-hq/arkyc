import { Avatar as Primitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Avatar({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof Primitive.Image>) {
  return <Primitive.Image className={cn('aspect-square size-full', className)} {...props} />
}

export function AvatarFallback({ className, ...props }: ComponentProps<typeof Primitive.Fallback>) {
  return (
    <Primitive.Fallback
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary',
        className,
      )}
      {...props}
    />
  )
}
