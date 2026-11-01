'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { lerTextoDaImagem } from '@/lib/ocr'
import { BUCKET_FOTOS, caminhoDaFoto, problemaNaFoto } from '@/lib/fotos'
import { formatarReais } from '@/lib/moeda'
import { IconeCamera } from '@/components/Icones'
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
}

export default function PecasPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaLinha | null>(null)
  const [pecas, setPecas] = useState<Peca[]>([])
  const [nomePeca, setNomePeca] = useState('')
  const [valorPeca, setValorPeca] = useState('')
  const [imagemColada, setImagemColada] = useState<File | null>(null)
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
    // A lista não exibe foto. As fotos ficam no Storage (imagem_path).
    const { data, error } = await supabase
      .from('pecas')
      .select('id, nome, valor')
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

  async function processarImagem(arquivo: File, base64: string) {
    setImagemColada(arquivo)

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
      setNomePeca(primeiraLinha.trim().slice(0, 300))
    }
  }

  function lerArquivo(file: File) {
    const problema = problemaNaFoto(file)
    if (problema) {
      mostrarToast(problema, 'erro')
      return
    }

    const reader = new FileReader()
    reader.onload = () => processarImagem(file, reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleColar(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image'))
    if (!item) return

    const file = item.getAsFile()
    if (!file) return

    lerArquivo(file)
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    lerArquivo(file)
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

    let imagemPath: string | null = null
    if (imagemColada) {
      imagemPath = caminhoDaFoto(placaSelecionada.id, imagemColada.type)
      const { error: erroFoto } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(imagemPath, imagemColada, { contentType: imagemColada.type })

      if (erroFoto) {
        setSalvando(false)
        mostrarToast('Não foi possível enviar a foto. Tente novamente.', 'erro')
        return
      }
    }

    const { data, error } = await supabase
      .from('pecas')
      .insert({
        placa_id: placaSelecionada.id,
        nome: nomePeca,
        valor: valorNumerico,
        imagem_path: imagemPath,
      })
      .select('id')
      .single()
    setSalvando(false)

    if (error) {
      // a peça não foi salva: não deixa a foto solta no Storage
      if (imagemPath) await supabase.storage.from(BUCKET_FOTOS).remove([imagemPath])
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
    <div className="conteudo">
      <h1 className="titulo-pagina">Peças</h1>

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
          <form onSubmit={adicionarPeca} className="cartao mb-6 space-y-4">
            <div>
              <label htmlFor="nome-peca" className="rotulo">Nome da peça</label>
              <input
                id="nome-peca"
                type="text"
                value={nomePeca}
                onChange={(e) => setNomePeca(e.target.value)}
                className="campo-input"
                maxLength={300}
              />
            </div>
            <div>
              <label htmlFor="valor-peca" className="rotulo">Valor</label>
              <input
                id="valor-peca"
                type="text"
                inputMode="decimal"
                placeholder="Ex: 150,00"
                value={valorPeca}
                onChange={(e) => setValorPeca(e.target.value)}
                className="campo-input"
              />
            </div>

            <div
              onPaste={handleColar}
              className="campo-arquivo !font-normal !cursor-text text-[var(--cor-texto-suave)]"
              tabIndex={0}
            >
              {imagemColada ? '✓ Imagem adicionada' : 'Opcional: clique aqui e cole um print (Ctrl+V)'}
            </div>

            <label className="campo-arquivo">
              <IconeCamera />
              Tirar foto da peça
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFoto}
                className="sr-only"
              />
            </label>

            {lendoImagem && (
              <p className="text-sm font-semibold text-[var(--cor-primaria-clara)]">Lendo imagem, aguarde...</p>
            )}

            <button type="submit" disabled={salvando} className="botao-principal w-full">
              {salvando ? 'Adicionando...' : 'Adicionar peça'}
            </button>
          </form>

          <div className="space-y-2 mb-4">
            {pecas.map((p) => (
              <div
                key={p.id}
                className={`cartao flex justify-between gap-3 !py-3.5 ${p.id === ultimaPecaId ? 'item-novo' : ''}`}
              >
                <span className="min-w-0 break-words">{p.nome}</span>
                <span className="shrink-0 font-semibold">{formatarReais(Number(p.valor))}</span>
              </div>
            ))}
          </div>

          <div className="cartao !bg-[var(--cor-fundo-destaque)] text-lg font-bold flex justify-between gap-3">
            <span>Total</span>
            <span>{formatarReais(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}