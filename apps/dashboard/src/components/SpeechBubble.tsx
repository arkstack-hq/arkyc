import { useCallback, useState } from 'react'

import { RgbColorPicker, type RgbColor } from 'react-colorful'
import type { ReactNode } from 'react'
import { useClickAway } from '@uidotdev/usehooks'

export default function SpeechBubble({ children, open = true }: { children: ReactNode; open?: boolean }) {
  if (!open) return null

  return <div className="speech-bubble">{children}</div>
}

export const PopoverPicker = ({
  color,
  onChange,
}: {
  color: RgbColor
  onChange?: ((newColor: RgbColor) => void) | undefined
}) => {
  const [isOpen, toggle] = useState(false)

  const close = useCallback(() => toggle(false), [])
  const ref = useClickAway(close)
  return (
    <div className="relative">
      <div
        className="color-board"
        style={{
          backgroundColor: `rgb(${[color.r, color.g, color.b].join(',')})`,
        }}
        onClick={() => toggle(true)}
      />

      {isOpen && (
        <div className="speech-bubble" ref={ref as never}>
          <RgbColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
