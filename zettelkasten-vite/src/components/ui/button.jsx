import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[11px] font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-wombat-blue disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] select-none font-sans',
  {
    variants: {
      variant: {
        default:    'bg-wombat-comment text-wombat-bg border border-wombat-comment hover:bg-[#b2d96a] hover:border-[#b2d96a]',
        secondary:  'bg-transparent border border-wombat-splitBg text-wombat-fgMuted hover:text-wombat-fg hover:border-[#4a5258] hover:bg-white/[0.04]',
        ghost:      'bg-transparent border border-transparent text-wombat-fgMuted hover:text-wombat-fg hover:bg-white/[0.04]',
        active:     'bg-wombat-blue/[0.08] border border-wombat-blue/40 text-wombat-blue hover:bg-wombat-blue/[0.14]',
        activeGreen:'bg-wombat-comment/[0.12] border border-wombat-comment/40 text-wombat-comment hover:bg-wombat-comment/[0.18]',
        danger:     'bg-transparent border border-wombat-orange/35 text-wombat-orange hover:bg-wombat-orange/10',
        outline:    'bg-transparent border border-wombat-splitBg text-wombat-fgMuted hover:text-wombat-fg hover:border-[#4a5258]',
      },
      size: {
        default: 'px-[11px] py-[4px]',
        sm:      'px-[8px] py-[3px] text-[10px]',
        lg:      'px-[14px] py-[6px] text-[12px]',
        icon:    'w-7 h-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
