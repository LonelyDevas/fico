"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Drawer as VaulDrawer } from "vaul"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * Adaptive sheet: a real bottom sheet (vaul, drag-to-dismiss) on mobile,
 * a right-side panel (Radix Dialog) on md+ screens. Call sites don't need
 * to know which — they just use Sheet/SheetContent/etc. as before.
 */
const SheetModeContext = React.createContext(false)

function usePrimitive(mobileImpl: React.ElementType, desktopImpl: React.ElementType): React.ElementType {
  const isMobile = React.useContext(SheetModeContext)
  return isMobile ? mobileImpl : desktopImpl
}

function Sheet({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const isMobile = useIsMobile()
  const Root = (isMobile ? VaulDrawer.Root : DialogPrimitive.Root) as React.ElementType

  return (
    <SheetModeContext.Provider value={isMobile}>
      <Root data-slot="sheet" {...(isMobile ? { repositionInputs: false } : {})} {...props}>
        {children}
      </Root>
    </SheetModeContext.Provider>
  )
}

function SheetTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  const Trigger = usePrimitive(VaulDrawer.Trigger, DialogPrimitive.Trigger)
  return <Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const Portal = usePrimitive(VaulDrawer.Portal, DialogPrimitive.Portal)
  return <Portal data-slot="sheet-portal" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const Close = usePrimitive(VaulDrawer.Close, DialogPrimitive.Close)
  return <Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const Overlay = usePrimitive(VaulDrawer.Overlay, DialogPrimitive.Overlay)
  return (
    <Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const isMobile = React.useContext(SheetModeContext)
  const Content = usePrimitive(VaulDrawer.Content, DialogPrimitive.Content)
  const Close = usePrimitive(VaulDrawer.Close, DialogPrimitive.Close)

  return (
    <SheetPortal>
      <SheetOverlay />
      <Content
        data-slot="sheet-content"
        data-sheet-mobile={isMobile ? '' : undefined}
        className={cn(
          "bg-background outline-none flex flex-col gap-4",
          isMobile
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-2xl border-t border-border shadow-ios-lg safe-bottom"
            : "fixed inset-y-4 right-4 left-auto z-50 h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[min(48rem,calc(100vw-2rem))] rounded-2xl border border-border shadow-ios-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right",
          className
        )}
        {...props}
      >
        {isMobile && <VaulDrawer.Handle className="sheet-handle mt-3 mb-1" />}
        {children}
        {showCloseButton && !isMobile && (
          <Close
            data-slot="sheet-close"
            className="absolute top-4 right-4 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Close>
        )}
      </Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2 border-b border-border px-6 py-5 text-left", className)}
      {...props}
    />
  )
}

function SheetFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const Close = usePrimitive(VaulDrawer.Close, DialogPrimitive.Close)
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Close asChild>
          <Button variant="outline">Close</Button>
        </Close>
      )}
    </div>
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const Title = usePrimitive(VaulDrawer.Title, DialogPrimitive.Title)
  return (
    <Title
      data-slot="sheet-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  const Description = usePrimitive(VaulDrawer.Description, DialogPrimitive.Description)
  return (
    <Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
