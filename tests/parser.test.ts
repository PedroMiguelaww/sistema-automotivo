import assert from 'node:assert/strict'
import { lerMensagem0800 } from '../lib/mensagem0800'
import { lerCampo } from '../lib/campos0800'
import { normalizarTexto } from '../lib/texto'
import { montarFiltroBusca } from '../lib/busca'

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

console.log('OK — todos os testes do parser passaram')
