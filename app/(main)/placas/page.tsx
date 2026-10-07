'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { lerTextoDaImagem } from '@/lib/ocr'
import { useToast } from '@/components/Toast'

type Consultor = {
  id: string
  nome: string
}

type Placa = {
  id: string
  placa: string
  consultor_id: string
  created_at: string
  dados_extra: Record<string, string> | null
}

function placaValida(valor: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(valor) || /^[A-Z]{3}[0-9]{4}$/.test(valor)
}

export default function PlacasPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [placas, setPlacas] = useState<Placa[]>([])
  const [mensagem, setMensagem] = useState('')
  const [placaDetectada, setPlacaDetectada] = useState('')
  const [consultorSelecionado, setConsultorSelecionado] = useState('')
  const [dadosExtra, setDadosExtra] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [lendoImagem, setLendoImagem] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const supabase = createClient()
  const { mostrarToast } = useToast()

  async function carregarDados() {
    const { data: consultoresData, error: erroConsultores } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('role', 'consultor')

    const { data: placasData, error: erroPlacas } = await supabase
      .from('placas')
      .select('id, placa, consultor_id, created_at, dados_extra')
      .order('created_at', { ascending: false })

    if (erroConsultores || erroPlacas) {
      mostrarToast('Não foi possível carregar os dados. Verifique sua conexão.', 'erro')
    }

    if (consultoresData) setConsultores(consultoresData)
    if (placasData) setPlacas(placasData)
  }

  useEffect(() => {
    carregarDados()
  }, [])

  function normalizarNome(nome: string) {
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  function processarMensagem(texto: string) {
    setMensagem(texto)
    setAviso('')

    const campos: Record<string, string> = {}
    const linhas = texto.split('\n')

    for (const linha of linhas) {
      const match = linha.match(/^([A-Za-zÀ-ú0-9\/ ]+):\s*(.+)$/)
      if (match) {
        const campo = match[1].trim()
        const valor = match[2].trim()
        campos[campo] = valor
      }
    }

    let placaEncontrada = ''
    if (campos['Veículo']) {
      const matchPlaca = campos['Veículo'].match(/^([A-Z]{3}[0-9][A-Z0-9][0-9]{2})/)
      if (matchPlaca) {
        placaEncontrada = matchPlaca[1]
      }
    }

    setPlacaDetectada(placaEncontrada)
    if (!placaEncontrada) {
      setAviso('Não consegui identificar a placa automaticamente. Confira o campo Veículo na mensagem.')
    }

    if (campos['Consultor']) {
      const nomeConsultor = normalizarNome(campos['Consultor'])

      let encontrado = consultores.find(
        (c) => normalizarNome(c.nome || '') === nomeConsultor
      )

      if (!encontrado) {
        encontrado = consultores.find((c) => {
          const nomeCadastrado = normalizarNome(c.nome || '')
          return nomeCadastrado.includes(nomeConsultor) || nomeConsultor.includes(nomeCadastrado)
        })
      }

      if (encontrado) {
        setConsultorSelecionado(encontrado.id)
        if (normalizarNome(encontrado.nome) !== nomeConsultor) {
          setAviso('Consultor identificado por aproximação — confira se está correto.')
        }
      } else {
        setAviso((prev) => prev + ' Consultor não encontrado na lista — selecione manualmente.')
      }
    }

    setDadosExtra(campos)
  }

  async function handleFotoPlaca(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string

      if (base64.length > 7_000_000) {
        setAviso('Imagem muito grande (máx. 5MB) — tente uma foto mais leve.')
        return
      }

      setLendoImagem(true)
      let texto = ''
      try {
        texto = await lerTextoDaImagem(base64)
      } catch {
        setLendoImagem(false)
        setAviso('Não foi possível ler a imagem. Tente novamente ou digite a placa manualmente.')
        return
      }
      setLendoImagem(false)

      const matchPlaca = texto.toUpperCase().match(/([A-Z]{3}[0-9][A-Z0-9][0-9]{2})/)

      if (matchPlaca) {
        setPlacaDetectada(matchPlaca[1])
        setAviso('Placa lida da foto — confira se está correta antes de salvar.')
      } else {
        setAviso('Não consegui ler a placa nessa foto. Tente tirar de novo, ou digite manualmente.')
      }
    }
    reader.readAsDataURL(file)
  }

  async function salvarPlaca(e: React.FormEvent) {
    e.preventDefault()
    if (salvando) return

    if (!placaDetectada || !placaValida(placaDetectada)) {
      setAviso('Preencha uma placa em formato válido (ex: ABC1D23).')
      return
    }

    if (!consultorSelecionado) {
      setAviso('Selecione o consultor antes de salvar.')
      return
    }

    setSalvando(true)
    const { error } = await supabase.from('placas').insert({
      placa: placaDetectada,
      consultor_id: consultorSelecionado,
      dados_extra: dadosExtra,
    })
    setSalvando(false)

        if (error) {
      if (error.code === '23505') {
        mostrarToast('Essa placa já está cadastrada no sistema.', 'erro')
      } else {
        mostrarToast('Não foi possível salvar a placa. Tente novamente.', 'erro')
      }
      return
    }

    mostrarToast(`Placa ${placaDetectada} cadastrada`)
    setMensagem('')
    setPlacaDetectada('')
    setConsultorSelecionado('')
    setDadosExtra({})
    setAviso('')
    carregarDados()
  }

  return (
    <div className="pagina p-8 max-w-2xl">
      <h1 className="fonte-titulo text-xl font-bold mb-4">Cadastro de Placas</h1>

      <form onSubmit={salvarPlaca} className="cartao mb-8 space-y-3">
        <label className="block mb-1 text-sm font-medium text-[var(--cor-texto-suave)]">
          Colar mensagem do 0800
        </label>
        <textarea
          value={mensagem}
          onChange={(e) => processarMensagem(e.target.value)}
          className="campo-input h-40 text-sm"
          placeholder="Cole aqui a mensagem completa recebida..."
        />

        <label className="block text-center border border-[var(--cor-borda)] rounded-[var(--raio)] p-2 text-sm text-[var(--cor-texto-suave)] cursor-pointer hover:border-[var(--cor-primaria)] transition-colors">
          📷 Ou tirar foto da placa
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFotoPlaca}
            className="hidden"
          />
        </label>

        <label className="block mb-1 text-sm font-medium text-[var(--cor-texto-suave)]">
          Ou digitar a placa manualmente
        </label>
        <input
          type="text"
          placeholder="Ex: TST1A23"
          value={placaDetectada}
          onChange={(e) => {
            const valor = e.target.value.toUpperCase()
            setPlacaDetectada(valor)

            if (valor.length === 0) {
              setAviso('')
            } else if (placaValida(valor)) {
              setAviso('')
            } else {
              setAviso('Formato de placa inválido. Use o padrão ABC1D23 ou ABC1234.')
            }
          }}
          className="campo-input"
          maxLength={7}
        />

        {lendoImagem && (
          <p className="text-xs text-[var(--cor-primaria)]">Lendo foto, aguarde...</p>
        )}

        {placaDetectada && placaValida(placaDetectada) && (
          <p className="text-sm text-green-500">
            Formato válido: <strong>{placaDetectada}</strong>
          </p>
        )}

        <label className="block mb-1 text-sm font-medium text-[var(--cor-texto-suave)]">
          Consultor responsável
        </label>
        <select
          value={consultorSelecionado}
          onChange={(e) => setConsultorSelecionado(e.target.value)}
          className="campo-input"
        >
          <option value="">Selecione...</option>
          {consultores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        {aviso && <p className="text-[var(--cor-primaria-clara)] text-sm">{aviso}</p>}

        <button type="submit" disabled={salvando} className="botao-principal">
          {salvando ? 'Salvando...' : 'Salvar placa'}
        </button>
      </form>

      <h2 className="fonte-titulo text-lg font-bold mb-2">Placas cadastradas</h2>
      <div className="space-y-2">
        {placas.map((p) => (
          <div key={p.id} className="cartao text-sm flex justify-between">
            <span>
              <strong>{p.placa}</strong> — {consultores.find((c) => c.id === p.consultor_id)?.nome || 'Consultor não identificado'}
            </span>
            {p.dados_extra?.Cliente && (
              <span className="text-[var(--cor-texto-suave)]">Cliente: {p.dados_extra.Cliente}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}