// Lê a mensagem do 0800 e separa em campos ("Campo: valor").
// A Observação pode ter várias linhas: tudo que vem depois dela (até uma linha
// de traços ou até outro campo conhecido) entra como parte da Observação.

const CAMPOS_CONHECIDOS = [
  'id',
  'protocolo',
  'data/hora',
  'motivo',
  'atendente',
  'cliente',
  'consultor',
  'veículo',
  'veiculo',
  'adesão',
  'adesao',
  'cor',
  'marca',
  'beneficiário',
  'beneficiario',
  'cidade',
  'telefones',
  'link origem',
]

const LINHA_DE_CAMPO = /^\s*([A-Za-zÀ-ú0-9\/ ]+):\s*(.*)$/
const LINHA_DE_TRACOS = /^\s*[-–—_=*]{3,}\s*$/

export function lerMensagem0800(texto: string): Record<string, string> {
  const campos: Record<string, string> = {}
  let emObservacao = false
  const observacao: string[] = []

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trimEnd()

    if (LINHA_DE_TRACOS.test(linha)) {
      emObservacao = false
      continue
    }

    const match = linha.match(LINHA_DE_CAMPO)
    const rotulo = match ? match[1].trim() : ''
    const valor = match ? match[2].trim() : ''
    const rotuloMin = rotulo.toLowerCase()

    if (match && rotuloMin === 'observação') {
      emObservacao = true
      observacao.length = 0
      if (valor) observacao.push(valor)
      continue
    }

    if (emObservacao) {
      // outro campo conhecido encerra a observação
      if (match && CAMPOS_CONHECIDOS.includes(rotuloMin) && valor) {
        emObservacao = false
      } else {
        observacao.push(linha.trim())
        continue
      }
    }

    if (match && valor) {
      campos[rotulo] = valor
    }
  }

  const textoObservacao = observacao.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (textoObservacao) campos['Observação'] = textoObservacao

  return campos
}
