import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors font-sans tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-wombat-comment/12 border border-wombat-comment/30 text-wombat-comment',
        blue:    'bg-wombat-blue/10 border border-wombat-blue/25 text-wombat-blue',
        orange:  'bg-wombat-orange/10 border border-wombat-orange/25 text-wombat-orange',
        yellow:  'bg-wombat-yellow/10 border border-wombat-yellow/25 text-wombat-yellow',
        muted:   'bg-white/5 border border-white/10 text-wombat-fgMuted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
