import NavBar from '@/components/NavBar'
import Header from '@/components/Header'
import { ToastProvider } from '@/components/Toast'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="h-dvh flex flex-col">
        <Header />
        <div className="flex-1 overflow-y-auto sem-scrollbar">
          {children}
        </div>
        <NavBar />
      </div>
    </ToastProvider>
  )
}