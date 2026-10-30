'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { lerTextoDaImagem } from '@/lib/ocr'
import { useToast } from '@/components/Toast'
import ListaPlacas from '@/components/ListaPlacas'
import { lerMensagem0800 } from '@/lib/mensagem0800'
import { lerCampo } from '@/lib/campos0800'
import { normalizarTexto } from '@/lib/texto'

type Consultor = {
  id: string
  nome: string
}

function placaValida(valor: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(valor) || /^[A-Z]{3}[0-9]{4}$/.test(valor)
}

export default function PlacasPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [atualizarLista, setAtualizarLista] = useState(0)
  const [mensagem, setMensagem] = useState('')
  const [placaDetectada, setPlacaDetectada] = useState('')
  const [consultorSelecionado, setConsultorSelecionado] = useState('')
  const [dadosExtra, setDadosExtra] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [lendoImagem, setLendoImagem] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const supabase = createClient()
  const { mostrarToast } = useToast()

  async function carregarConsultores() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('role', 'consultor')

    if (error) {
      mostrarToast('Não foi possível carregar os dados. Verifique sua conexão.', 'erro')
    }
    if (data) setConsultores(data)
  }

  useEffect(() => {
    carregarConsultores()
  }, [])

  function processarMensagem(texto: string) {
    setMensagem(texto)
    setAviso('')

    const campos = lerMensagem0800(texto)

    let placaEncontrada = ''
    const veiculo = lerCampo(campos, 'veiculo')
    if (veiculo) {
      const matchPlaca = veiculo.match(/^([A-Z]{3}[0-9][A-Z0-9][0-9]{2})/)
      if (matchPlaca) {
        placaEncontrada = matchPlaca[1]
      }
    }

    setPlacaDetectada(placaEncontrada)
    if (!placaEncontrada) {
      setAviso('Não consegui identificar a placa automaticamente. Confira o campo Veículo na mensagem.')
    }

    const consultor = lerCampo(campos, 'consultor')
    if (consultor) {
      const nomeConsultor = normalizarTexto(consultor)

      let encontrado = consultores.find(
        (c) => normalizarTexto(c.nome || '') === nomeConsultor
      )

      if (!encontrado) {
        encontrado = consultores.find((c) => {
          const nomeCadastrado = normalizarTexto(c.nome || '')
          return nomeCadastrado.includes(nomeConsultor) || nomeConsultor.includes(nomeCadastrado)
        })
      }

      if (encontrado) {
        setConsultorSelecionado(encontrado.id)
        if (normalizarTexto(encontrado.nome) !== nomeConsultor) {
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
    setAtualizarLista((n) => n + 1)
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

      <h2 className="fonte-titulo text-lg font-bold mb-3">Placas em andamento</h2>
      <ListaPlacas consultores={consultores} refreshKey={atualizarLista} />
    </div>
  )
}