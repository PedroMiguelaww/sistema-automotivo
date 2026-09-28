'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type ToastContextType = {
  mostrarToast: (mensagem: string, tipo?: 'sucesso' | 'erro') => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'sucesso' | 'erro' } | null>(null)

  const mostrarToast = useCallback((mensagem: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setToast({ mensagem, tipo })
    setTimeout(() => setToast(null), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-[var(--raio)] text-sm font-medium shadow-lg toast-entrada ${
            toast.tipo === 'sucesso'
              ? 'bg-[var(--cor-primaria)] text-[#0a0a0a]'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.tipo === 'sucesso' ? '✓ ' : '⚠ '}
          {toast.mensagem}
        </div>
      )}
    </ToastContext.Provider>
  )
}