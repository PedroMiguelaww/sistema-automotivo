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
    // tempo suficiente para ler com calma
    setTimeout(() => setToast(null), 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-md px-4 py-3 rounded-[var(--raio)] text-sm font-semibold text-center shadow-lg text-white ${
            toast.tipo === 'sucesso' ? 'bg-green-700' : 'bg-red-700'
          }`}
        >
          {toast.tipo === 'sucesso' ? '✓ ' : '⚠ '}
          {toast.mensagem}
        </div>
      )}
    </ToastContext.Provider>
  )
}
