import GuardaAcesso from '@/components/GuardaAcesso'
import Marca from '@/components/Marca'
import NavBar from '@/components/NavBar'
import PerfilAvatar from '@/components/PerfilAvatar'
import { ToastProvider } from '@/components/Toast'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GuardaAcesso>
        <div className="h-dvh flex flex-col">
          <header className="cabecalho">
            <Marca />
            <NavBar posicao="topo" />
            <PerfilAvatar />
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <NavBar posicao="rodape" />
        </div>
      </GuardaAcesso>
    </ToastProvider>
  )
}
