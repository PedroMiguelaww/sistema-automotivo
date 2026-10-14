'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { lerTextoDaImagem } from '@/lib/ocr'
import { useToast } from '@/components/Toast'
import SeletorPlaca from '@/components/SeletorPlaca'
import type { PlacaLinha } from '@/components/ListaPlacas'

type Consultor = {
  id: string
  nome: string
}

type Peca = {
  id: string
  nome: string
  valor: number
  imagem: string | null
}

export default function PecasPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaLinha | null>(null)
  const [pecas, setPecas] = useState<Peca[]>([])
  const [nomePeca, setNomePeca] = useState('')
  const [valorPeca, setValorPeca] = useState('')
  const [imagemColada, setImagemColada] = useState<string | null>(null)
  const [lendoImagem, setLendoImagem] = useState(false)
  const [ultimaPecaId, setUltimaPecaId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const supabase = createClient()
  const { mostrarToast } = useToast()

  async function carregarConsultores() {
    const { data } = await supabase.from('profiles').select('id, nome')
    if (data) setConsultores(data)
  }

  async function carregarPecas(placaId: string) {
    const { data, error } = await supabase
      .from('pecas')
      .select('id, nome, valor, imagem')
      .eq('placa_id', placaId)
      .order('created_at', { ascending: false })

    if (error) {
      mostrarToast('Não foi possível carregar as peças.', 'erro')
      return
    }
    if (data) setPecas(data)
  }

  useEffect(() => {
    carregarConsultores()
  }, [])

  useEffect(() => {
    if (placaSelecionada) carregarPecas(placaSelecionada.id)
  }, [placaSelecionada?.id])

  async function processarImagem(base64: string) {
    // Base64 aumenta o tamanho em ~33% — 7MB de texto equivale a uns 5MB de imagem real
    if (base64.length > 7_000_000) {
      mostrarToast('Imagem muito grande (máx. 5MB)', 'erro')
      return
    }

    setImagemColada(base64)

    setLendoImagem(true)
    let texto = ''
    try {
      texto = await lerTextoDaImagem(base64)
    } catch {
      setLendoImagem(false)
      mostrarToast('Não foi possível ler a imagem. Preencha manualmente.', 'erro')
      return
    }
    setLendoImagem(false)

    const matchValor = texto.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/)
    if (matchValor) {
      setValorPeca(matchValor[1])
    }

    const primeiraLinha = texto.split('\n').find((l) => l.trim().length > 2)
    if (primeiraLinha && !nomePeca) {
      setNomePeca(primeiraLinha.trim())
    }
  }

  async function handleColar(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image'))
    if (!item) return

    const file = item.getAsFile()
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => processarImagem(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => processarImagem(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function adicionarPeca(e: React.FormEvent) {
    e.preventDefault()
    if (salvando) return
    if (!placaSelecionada || !nomePeca || !valorPeca) return

    const t = valorPeca.trim()
const milharBR = /^\d{1,3}(\.\d{3})+$/.test(t)
const valorNumerico = t.includes(',') || milharBR
  ? parseFloat(t.replace(/\./g, '').replace(',', '.'))
  : parseFloat(t)
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      mostrarToast('Informe um valor válido, maior que zero', 'erro')
      return
    }

    setSalvando(true)
    const { data, error } = await supabase
      .from('pecas')
      .insert({
        placa_id: placaSelecionada.id,
        nome: nomePeca,
        valor: valorNumerico,
        imagem: imagemColada,
      })
      .select()
      .single()
    setSalvando(false)

    if (error) {
      mostrarToast('Não foi possível adicionar a peça. Tente novamente.', 'erro')
      return
    }

    mostrarToast(`"${nomePeca}" adicionada`)
    setUltimaPecaId(data.id)
    setTimeout(() => setUltimaPecaId(null), 1200)

    setNomePeca('')
    setValorPeca('')
    setImagemColada(null)
    carregarPecas(placaSelecionada.id)
  }

  const total = pecas.reduce((soma, p) => soma + Number(p.valor), 0)

  const consultorResponsavel = consultores.find((c) => c.id === placaSelecionada?.consultor_id)

  return (
    <div className="pagina p-8 max-w-2xl">
      <h1 className="fonte-titulo text-xl font-bold mb-4">Peças</h1>

      <SeletorPlaca
        selecionada={placaSelecionada}
        onSelecionar={setPlacaSelecionada}
        consultores={consultores}
      />

      {placaSelecionada && (
        <p className="text-sm text-[var(--cor-texto-suave)] mb-6">
          Consultor responsável: <strong className="text-[var(--cor-texto)]">{consultorResponsavel?.nome || '—'}</strong>
        </p>
      )}

      {placaSelecionada && (
        <>
          <form onSubmit={adicionarPeca} className="cartao mb-6 space-y-3">
            <input
              type="text"
              placeholder="Nome da peça"
              value={nomePeca}
              onChange={(e) => setNomePeca(e.target.value)}
              className="campo-input"
            />
            <input
              type="text"
              placeholder="Valor (ex: 150,00)"
              value={valorPeca}
              onChange={(e) => setValorPeca(e.target.value)}
              className="campo-input"
            />

            <div
              onPaste={handleColar}
              className="border border-dashed border-[var(--cor-borda)] p-3 rounded-[var(--raio)] text-sm text-[var(--cor-texto-suave)]"
              tabIndex={0}
            >
              {imagemColada ? 'Print colado ✓' : 'Clique aqui e cole um print (Ctrl+V) — opcional'}
            </div>

            <label className="block text-center border border-[var(--cor-borda)] rounded-[var(--raio)] p-2 text-sm text-[var(--cor-texto-suave)] cursor-pointer hover:border-[var(--cor-primaria)] transition-colors">
              📷 Tirar foto da peça
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFoto}
                className="hidden"
              />
            </label>

            {lendoImagem && (
              <p className="text-xs text-[var(--cor-primaria)]">Lendo imagem, aguarde...</p>
            )}

            <button type="submit" disabled={salvando} className="botao-principal">
              {salvando ? 'Adicionando...' : 'Adicionar peça'}
            </button>
          </form>

          <div className="space-y-2 mb-4">
            {pecas.map((p) => (
              <div
                key={p.id}
                className={`cartao flex justify-between text-sm ${p.id === ultimaPecaId ? 'item-novo' : ''}`}
              >
                <span>{p.nome}</span>
                <span>R$ {Number(p.valor).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="cartao font-bold flex justify-between text-[var(--cor-primaria-clara)]">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  )
}