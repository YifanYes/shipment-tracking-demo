import { Toast } from '@base-ui/react/toast'
import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Single manager so any part of the app can announce a result without prop drilling. */
export const toastManager = Toast.createToastManager()

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="pointer-events-auto relative w-full rounded-xl border border-border bg-popover p-4 pr-10 text-popover-foreground shadow-lg transition-[opacity,translate] duration-200 data-ending-style:translate-x-4 data-ending-style:opacity-0 data-starting-style:translate-x-4 data-starting-style:opacity-0 motion-reduce:transition-none"
    >
      <Toast.Content className="grid gap-1.5">
        <Toast.Title className="text-sm font-semibold" />
        <Toast.Description className="text-xs text-muted-foreground" />
      </Toast.Content>
      <Toast.Close
        aria-label="Cerrar aviso"
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <XIcon className="size-3.5" aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  ))
}

/** Top-right stack of toasts. Mount once near the root. */
export function Toaster({ children }: { children?: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed top-20 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
