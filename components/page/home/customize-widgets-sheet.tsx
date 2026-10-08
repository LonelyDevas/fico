'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { resolveOrder, useHomeWidgets, WIDGETS } from '@/store/home-widgets-store'

export function CustomizeWidgetsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { order, hidden, move, toggle, reset } = useHomeWidgets()
  const items = resolveOrder(order).map((id) => WIDGETS.find((w) => w.id === id)!)

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-h-[94dvh] p-0 md:max-h-none md:max-w-md" showCloseButton={false}>
        <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
          <div className="px-5 pb-2 pt-1">
            <SheetTitle className="font-heading text-lg font-semibold text-foreground">Customize Home</SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              Show or hide cards and use the arrows to put them in the order you like.
            </SheetDescription>
          </div>

          <ul data-vaul-no-drag className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
            {items.map((widget, index) => {
              const visible = !hidden.includes(widget.id)
              return (
                <li key={widget.id} className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 p-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={visible}
                    aria-label={`Show ${widget.label}`}
                    onClick={() => toggle(widget.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${visible ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${visible ? 'translate-x-5' : ''}`}
                    />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${visible ? 'text-foreground' : 'text-muted-foreground'}`}>{widget.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{widget.hint}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${widget.label} up`}
                    disabled={index === 0}
                    onClick={() => move(widget.id, -1)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-card disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${widget.label} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(widget.id, 1)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-card disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>

          <div data-vaul-no-drag className="flex shrink-0 gap-2 border-t border-border px-4 pb-4 pt-3">
            <button type="button" onClick={reset} className="h-12 rounded-2xl border border-border px-5 text-sm font-semibold text-foreground">
              Reset
            </button>
            <button type="button" onClick={onClose} className="h-12 flex-1 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-ios">
              Done
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
