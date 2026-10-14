import NavBar from '@/components/NavBar'
import PerfilAvatar from '@/components/PerfilAvatar'
import { ToastProvider } from '@/components/Toast'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="h-dvh flex flex-col">
        <PerfilAvatar />
          <div className="flex-1 overflow-y-auto sem-scrollbar pt-14">
          {children}
        </div>
        <NavBar />
      </div>
    </ToastProvider>
  )
}