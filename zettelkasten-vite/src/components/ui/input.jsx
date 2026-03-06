import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex w-full rounded-md border border-wombat-splitBg bg-white/[0.05] px-3 py-1.5 text-[12px] text-wombat-fg placeholder:text-wombat-fgMuted/60 transition-colors',
        'focus:outline-none focus:border-wombat-blue/50 focus:bg-white/[0.07]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'font-sans',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
