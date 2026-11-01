import assert from 'node:assert/strict'
import { lerMensagem0800 } from '../lib/mensagem0800'
import { lerCampo } from '../lib/campos0800'
import { normalizarTexto } from '../lib/texto'
import { montarFiltroBusca } from '../lib/busca'
import { identificarConsultor } from '../lib/consultor'
import { lerLinkExterno } from '../lib/links'
import { caminhoDaFoto, problemaNaFoto } from '../lib/fotos'
import { formatarReais } from '../lib/moeda'
import { nomeDoPapel } from '../lib/papeis'

// 1) mensagem como vem do 0800, com acento
const comAcento = lerMensagem0800(`
Protocolo: 2026-998877
Data/Hora: 30/10/2026 10:45
Veículo: ABC1D23 - STRADA VOLCANO 1.3
Beneficiário: João da Silva
Adesão: 123456
Consultor: Maria Souza
Cidade: Curitiba
Telefones: (41) 99999-0000 / (41) 3333-0000
Link Origem: https://exemplo.com/x
Observação: Cliente pediu para ligar
antes das 18h.
--------------------------------------------------
`)

assert.equal(comAcento['veiculo'], 'ABC1D23 - STRADA VOLCANO 1.3')
assert.equal(comAcento['beneficiario'], 'João da Silva')
assert.equal(comAcento['adesao'], '123456')
assert.equal(comAcento['consultor'], 'Maria Souza')
assert.equal(comAcento['link origem'], 'https://exemplo.com/x')
assert.equal(comAcento['data/hora'], '30/10/2026 10:45')
assert.equal(comAcento['observacao'], 'Cliente pediu para ligar\nantes das 18h.')
assert.equal(comAcento['Beneficiário' as keyof typeof comAcento], undefined)

// 2) mesma mensagem sem acento (era o bug)
const semAcento = lerMensagem0800(`
Veiculo: XYZ9K88 - ONIX 1.0
Beneficiario: Ana Paula
Adesao: 9988
Observacao: sem acento
`)
assert.equal(semAcento['beneficiario'], 'Ana Paula')
assert.equal(semAcento['adesao'], '9988')
assert.equal(semAcento['observacao'], 'sem acento')

// 3) campo conhecido encerra a observação
const comCampoDepois = lerMensagem0800(`
Observação: linha um
linha dois
Cidade: Londrina
`)
assert.equal(comCampoDepois['observacao'], 'linha um\nlinha dois')
assert.equal(comCampoDepois['cidade'], 'Londrina')

// 4) lerCampo entende registro antigo (chave com acento)
const antigo = { 'Beneficiário': 'Carlos', 'Adesão': '555', Veículo: 'ABC1D23 - GOL' }
assert.equal(lerCampo(antigo, 'beneficiario'), 'Carlos')
assert.equal(lerCampo(antigo, 'adesao'), '555')
assert.equal(lerCampo(antigo, 'veiculo'), 'ABC1D23 - GOL')

// 5) lerCampo entende registro novo e lida com nulo
assert.equal(lerCampo({ beneficiario: 'Novo' }, 'beneficiario'), 'Novo')
assert.equal(lerCampo(null, 'beneficiario'), undefined)
assert.equal(lerCampo({}, 'beneficiario'), undefined)

// 6) normalização e busca
assert.equal(normalizarTexto('  JOÃO   da Silva '), 'joao da silva')
const filtro = montarFiltroBusca('João')
assert.ok(filtro?.includes('dados_extra->>beneficiario'))
assert.ok(filtro?.includes('dados_extra->>Beneficiário'))
assert.equal(montarFiltroBusca('   '), undefined)

// 7) consultor: só o nome idêntico é escolhido sozinho
const equipe = [
  { id: '1', nome: 'Maria Souza' },
  { id: '2', nome: 'João Lima' },
  { id: '3', nome: 'a' },
  { id: '4', nome: '' },
]
assert.equal(identificarConsultor('MARIA  SOUZA', equipe).exato?.id, '1')
assert.equal(identificarConsultor('Maria', equipe).exato, undefined)
assert.deepEqual(identificarConsultor('Maria', equipe).sugestoes.map((c) => c.id), ['1'])
// conta com nome curto ou vazio não "pega" as placas dos outros
assert.deepEqual(identificarConsultor('Carlos Andrade', equipe).sugestoes, [])
assert.equal(identificarConsultor('   ', equipe).exato, undefined)

// 8) links: destino real à vista
assert.equal(lerLinkExterno('https://maps.google.com/?q=1')?.conhecido, true)
assert.equal(lerLinkExterno('https://exemplo.com/x')?.conhecido, false)
assert.equal(lerLinkExterno('https://exemplo.com/x')?.site, 'exemplo.com')
assert.equal(lerLinkExterno('https://google.com.site-falso.com/')?.conhecido, false)
assert.equal(lerLinkExterno('https://google.com@site-falso.com/'), null)
assert.equal(lerLinkExterno('javascript:alert(1)'), null)
assert.equal(lerLinkExterno('http://maps.google.com/'), null)
assert.equal(lerLinkExterno(undefined), null)

// 9) fotos: tipo e tamanho
assert.equal(problemaNaFoto({ type: 'image/jpeg', size: 1000 }), null)
assert.ok(problemaNaFoto({ type: 'image/svg+xml', size: 1000 }))
assert.ok(problemaNaFoto({ type: 'image/png', size: 6 * 1024 * 1024 }))
assert.match(caminhoDaFoto('placa-1', 'image/png'), /^placa-1\/[0-9a-f-]+\.png$/)

// 10) textos da tela
assert.equal(formatarReais(1500.5).replace(/\s/g, ' '), 'R$ 1.500,50')
assert.equal(nomeDoPapel('super_admin'), 'Administrador')
assert.equal(nomeDoPapel('desconhecido'), 'desconhecido')

console.log('OK — todos os testes do parser passaram')
