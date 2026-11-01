import Image from 'next/image'
import GuardaAcesso from '@/components/GuardaAcesso'
import NavBar from '@/components/NavBar'
import PerfilAvatar from '@/components/PerfilAvatar'
import { ToastProvider } from '@/components/Toast'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GuardaAcesso>
        <div className="h-dvh flex flex-col">
          <header className="cabecalho">
            <Image
              src="/logo-proseg.png"
              alt="Proseg"
              width={124}
              height={36}
              priority
              className="h-9 w-auto shrink-0"
            />
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
