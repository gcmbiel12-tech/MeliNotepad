/**
 * xpt-regras.js
 * Regras do módulo XPT — funções puras, testáveis. Só o que foi especificado:
 * nada de identificadores de gaiola fixos, nada de regras operacionais inventadas.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};
  var DIA = 86400000;
  var MAX_INTERVALO = 2000;

  var CATEGORIAS = [
    { id: 'bingo', rotulo: 'Bingo', ajuda: 'Produto encontrado na gaiola errada' },
    { id: 'faltante', rotulo: 'Faltante', ajuda: 'Produto esperado, mas não encontrado' },
    { id: 'duplicado', rotulo: 'Duplicado', ajuda: 'Mesmo identificador registrado mais de uma vez' },
    { id: 'avaria', rotulo: 'Avaria', ajuda: '' },
    { id: 'retirado', rotulo: 'Produto retirado', ajuda: '' },
    { id: 'outra', rotulo: 'Outra (descreva)', ajuda: 'Categoria ainda não definida pela operação' }
  ];
  // Estados legados são aceitos para preservar operações já salvas.
  var ESTADOS_AUDITORIA = {
    nao_iniciada: 'Não auditado', pendente: 'Não auditado', auditando: 'Auditando', concluida: 'Concluído',
    concluida_sem_divergencia: 'Concluído', concluida_com_divergencia: 'Concluído com divergência'
  };
  function limpar(t) { return String(t == null ? '' : t).trim().replace(/\s+/g, ' '); }
  function chave(c) { return limpar(c).toUpperCase(); }
  function iso(ms) { return new Date(ms).toISOString(); }
  function novoId(p) { var U = NS.Utils; return U && U.gerarId ? U.gerarId(p) : p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function dois(n) { return n < 10 ? '0' + n : String(n); }
  function diaRef(ms) { var d = new Date(ms); return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }

  // ---------------------------------------------------------------- códigos e intervalos
  function validarCodigo(texto) {
    var U = NS.Utils;
    if (!U) return { ok: true, id: limpar(texto) };
    var r = U.extrairIdentificadorDeCodigo(limpar(texto));   // aceita também o JSON do QR
    return r.ok ? { ok: true, id: r.id } : { ok: false, motivo: r.motivo };
  }

  function lerNumeroFinal(s) { var m = /^(.*?)(\d+)$/.exec(s); return m ? { prefixo: m[1], num: m[2] } : null; }

  /** Tenta ler "100-120", "G100-G120", "G100-120", "100..120", "100 a 120". null = não é intervalo. */
  function lerIntervalo(token, hifenComoCodigo) {
    var m = /^(\S+)\s+(?:a|até)\s+(\S+)$/i.exec(token) || /^(.+?)\s*\.\.\s*(.+)$/.exec(token) ||
            (hifenComoCodigo ? null : /^([^-–—]+?)\s*[-–—]\s*([^-–—]+)$/.exec(token));
    if (!m) return null;
    var e = lerNumeroFinal(m[1].trim()); if (!e) return null;
    var d = /^\d+$/.test(m[2].trim()) ? { prefixo: e.prefixo, num: m[2].trim() } : lerNumeroFinal(m[2].trim());
    if (!d || d.prefixo !== e.prefixo) return null;
    return { prefixo: e.prefixo, de: e.num, ate: d.num };
  }

  function expandir(iv) {
    var a = parseInt(iv.de, 10), b = parseInt(iv.ate, 10);
    if (b < a) return { erro: 'Intervalo invertido (' + iv.de + ' → ' + iv.ate + ').' };
    if (b - a + 1 > MAX_INTERVALO) return { erro: 'Intervalo grande demais (' + (b - a + 1) + ' códigos; máximo ' + MAX_INTERVALO + ').' };
    var larg = iv.de.length === iv.ate.length || /^0/.test(iv.de) ? iv.de.length : 0, out = [];
    for (var n = a; n <= b; n++) { var s = String(n); while (s.length < larg) s = '0' + s; out.push(iv.prefixo + s); }
    return { codigos: out };
  }

  /**
   * Interpreta o texto digitado (um item por linha ou separado por vírgula/;) para REVISÃO antes de gravar.
   * Cada linha informa como foi entendida; nada é gravado aqui. `existentes` = códigos já registrados.
   */
  function interpretarCodigos(texto, opcoes, existentes) {
    opcoes = opcoes || {};
    var jaTem = {}; (existentes || []).forEach(function (c) { jaTem[chave(c)] = true; });
    var vistos = {}, linhas = [], novos = [], repetidos = [], existentesEncontrados = [], erros = [];
    // Objetos JSON de QR ({"id":"9","t":"lm"}) têm vírgula interna: protege antes de separar a lista.
    var protegido = String(texto || '').replace(/\{[^{}]*\}/g, function (m) { return '\n' + m.replace(/,/g, '\u0001') + '\n'; });
    protegido.split(/[\n,;\t]+/).forEach(function (bruto) {
      var tok = limpar(bruto.replace(/\u0001/g, ',')); if (!tok) return;
      var partes = /\s/.test(tok) && !lerIntervalo(tok, opcoes.hifenComoCodigo) ? tok.split(/\s+/) : [tok];
      partes.forEach(function (p) {
        var linha = { entrada: p, tipo: 'codigo', codigos: [] };
        var iv = lerIntervalo(p, opcoes.hifenComoCodigo);
        if (iv) {
          var ex = expandir(iv);
          if (ex.erro) { linha.tipo = 'erro'; linha.erro = ex.erro; erros.push(p + ': ' + ex.erro); linhas.push(linha); return; }
          linha.tipo = 'intervalo'; linha.codigos = ex.codigos;
        } else {
          var v = validarCodigo(p);
          if (!v.ok) { linha.tipo = 'erro'; linha.erro = v.motivo; erros.push(p + ': ' + v.motivo); linhas.push(linha); return; }
          linha.codigos = [v.id];
        }
        linhas.push(linha);
        linha.codigos.forEach(function (c) {
          var k = chave(c);
          if (jaTem[k]) { existentesEncontrados.push(c); return; }
          if (vistos[k]) { repetidos.push(c); return; }
          vistos[k] = true; novos.push(c);
        });
      });
    });
    return { linhas: linhas, novos: novos, repetidosNoLote: repetidos, jaExistentes: existentesEncontrados, erros: erros };
  }

  // ---------------------------------------------------------------- operação
  function novaOperacao(agoraMs, inicioMs) {
    var ini = inicioMs == null ? agoraMs : inicioMs;
    return {
      id: novoId('xop'), criadaEm: iso(agoraMs), inicioAt: iso(ini), diaRef: diaRef(ini),
      fimCarregamentoAt: null, encerradaAt: null,
      quantidades: { pacotes: null, volumosos: null, extraVolumosos: null, paletes: null, redes: null, totalBK: null },
      gaiolas: [], ocorrencias: [], veiculos: []
    };
  }
  function situacaoOperacao(op) { return op.encerradaAt ? 'encerrada' : op.fimCarregamentoAt ? 'carregamento_encerrado' : 'em_andamento'; }
  var ROTULO_SITUACAO = { em_andamento: 'Em andamento', carregamento_encerrado: 'Carregamento encerrado', encerrada: 'Encerrada' };
  function diasAberta(op, agoraMs) { return op.encerradaAt ? 0 : Math.max(0, Math.floor((agoraMs - Date.parse(op.inicioAt)) / DIA)); }

  // ---------------------------------------------------------------- gaiolas e auditoria
  function novaGaiola(codigo, agoraMs) {
    return { id: novoId('gai'), codigo: codigo, criadaEm: iso(agoraMs),
             auditoria: { estado: 'nao_iniciada', auditor: null, em: null, quantidades: { g: null, v: null, p: null }, historico: [] } };
  }
  function adicionarGaiolas(op, codigos, agoraMs) {
    var tem = {}; op.gaiolas.forEach(function (g) { tem[chave(g.codigo)] = true; });
    var add = [], ign = [];
    codigos.forEach(function (c) {
      var k = chave(c); if (tem[k]) { ign.push(c); return; }
      tem[k] = true; var g = novaGaiola(limpar(c), agoraMs); op.gaiolas.push(g); add.push(g);
    });
    return { adicionadas: add, ignoradas: ign };
  }
  function definirAuditoria(g, estado, auditor, agoraMs, quantidades) {
    if (!ESTADOS_AUDITORIA[estado]) return { ok: false, erro: 'Estado de auditoria inválido.' };
    var concluida = estado === 'concluida' || estado.indexOf('concluida_') === 0;
    auditor = limpar(auditor);
    if (concluida && !auditor) return { ok: false, erro: 'Informe o nome de quem realizou a auditoria.' };
    var q = quantidades || g.auditoria.quantidades || { g: null, v: null, p: null };
    if (concluida && quantidades) {
      var invalida = ['g', 'v', 'p'].some(function (k) {
        var valor = inteiroOuNulo(q[k]);
        if (!valor.ok || valor.valor === null) return true;
        q[k] = valor.valor;
        return false;
      });
      if (invalida) return { ok: false, erro: 'Informe G, V e P como inteiros não negativos.' };
    }
    g.auditoria.historico = g.auditoria.historico || [];
    g.auditoria.historico.push({ em: iso(agoraMs), de: g.auditoria.estado, para: estado, auditor: concluida ? auditor : null });
    g.auditoria.estado = estado; g.auditoria.auditor = concluida ? auditor : null; g.auditoria.em = concluida ? iso(agoraMs) : null;
    if (concluida && quantidades) g.auditoria.quantidades = { g: q.g, v: q.v == null ? (g.auditoria.quantidades && g.auditoria.quantidades.v != null ? g.auditoria.quantidades.v : 0) : q.v, p: q.p };
    return { ok: true };
  }
  function iniciarAuditoria(g, auditor, agoraMs) {
    auditor = limpar(auditor);
    if (!auditor) return { ok: false, erro: 'Informe o nome de quem está realizando a auditoria.' };
    g.auditoria.historico = g.auditoria.historico || [];
    g.auditoria.historico.push({ em: iso(agoraMs), de: g.auditoria.estado, para: 'auditando', auditor: auditor });
    g.auditoria.estado = 'auditando'; g.auditoria.auditor = auditor; g.auditoria.em = iso(agoraMs);
    return { ok: true };
  }
  function statusAuditoria(g, ocorrencias) {
    var e = g && g.auditoria && g.auditoria.estado;
    if (e === 'auditando') return 'Auditando';
    if (e === 'concluida' || (e && e.indexOf('concluida_') === 0)) {
      var codigo = chave(g.codigo);
      var divergencia = (ocorrencias || []).some(function (oc) { return oc.status !== 'resolvido' && chave(oc.gaiolaEncontrada) === codigo; });
      return divergencia ? 'Concluído com divergência' : 'Concluído';
    }
    return 'Não auditado';
  }
  function validarQuantidadesAuditoria(q) {
    q = q || {};
    return ['g', 'v', 'p'].every(function (k) {
      var r = inteiroOuNulo(q[k]);
      return r.ok && r.valor !== null;
    });
  }
  /** VUC permanece pendente e é excluído de todos os totais e percentuais da auditoria. */
  function resumoAuditoria(gaiolas) {
    var r = { total: 0, vuc: 0, concluidas: 0, concluidasSem: 0, concluidasCom: 0, pendentes: 0, naoIniciadas: 0 };
    gaiolas.forEach(function (g) {
      if (g.vuc) { r.vuc++; return; }
      r.total++;
      var e = g.auditoria.estado;
      if (e === 'concluida' || e.indexOf('concluida_') === 0) r.concluidas++;
      else if (e === 'pendente') r.pendentes++; else r.naoIniciadas++;
    });
    r.percentual = r.total ? Math.round(r.concluidas / r.total * 1000) / 10 : null;
    return r;
  }
  function ocorrenciasDaGaiola(op, gaiola) {
    var codigo = typeof gaiola === 'string' ? gaiola : gaiola && gaiola.codigo;
    return (op.ocorrencias || []).filter(function (oc) { return chave(oc.gaiolaEncontrada) === chave(codigo); });
  }
  function rotuloAuditoria(op, gaiola) {
    var estado = gaiola && gaiola.auditoria ? gaiola.auditoria.estado : '';
    if (estado === 'auditando') return 'Auditando';
    if (estado === 'concluida' || estado === 'concluida_sem_divergencia' || estado === 'concluida_com_divergencia') {
      return ocorrenciasDaGaiola(op, gaiola).some(function (oc) { return oc.status !== 'resolvido'; }) ? 'Concluído com divergência' : 'Concluído';
    }
    if (estado === 'pendente') return 'Não auditado';
    return 'Não auditado';
  }  // ---------------------------------------------------------------- quantidades
  function n(v) { return v == null || v === '' ? 0 : Number(v); }
  function redesDoVeiculo(op, veiculo) {
    // Cada rota corresponde à gaiola cadastrada pelo código. Só contar uma vez por ID;
    // G e V vêm da auditoria da rota. Paletes (P) nunca entram no cálculo.
    var ids = {}, total = 0, informadas = 0;
    (veiculo.gaiolaIds || []).forEach(function (id) {
      if (ids[id]) return; ids[id] = true;
      var g = op.gaiolas.filter(function (x) { return x.id === id; })[0];
      if (!g || !g.auditoria || !g.auditoria.quantidades) return;
      var q = g.auditoria.quantidades;
      if (q.g == null || q.v == null) return;
      total += n(q.g) + n(q.v); informadas++;
    });
    return { valor: total, rotasInformadas: informadas, rotasAssociadas: Object.keys(ids).length };
  }
  function resumoVeiculo(op, veiculo) {
    var ids = {}, rotas = 0, gaiolas = 0, paletes = 0, rotasSemQuantidades = 0;
    (veiculo.gaiolaIds || []).forEach(function (id) {
      if (ids[id]) return;
      ids[id] = true; rotas++;
      var g = op.gaiolas.filter(function (x) { return x.id === id; })[0];
      var q = g && g.auditoria && g.auditoria.quantidades;
      if (!q || q.g == null || q.v == null || q.p == null) { rotasSemQuantidades++; return; }
      gaiolas += n(q.g) + n(q.v);
      paletes += n(q.p);
    });
    return { rotas: rotas, gaiolas: gaiolas, paletes: paletes, rotasSemQuantidades: rotasSemQuantidades };
  }
  function totais(op) {
    var q = op.quantidades, vs = op.veiculos;
    var somaPaletes = vs.reduce(function (s, v) { return s + n(v.paletes); }, 0);
    var somaRedes = vs.reduce(function (s, v) { return s + redesDoVeiculo(op, v).valor; }, 0);
    var quantidadesRotas = op.gaiolas.reduce(function (s, g) {
      var z = g.auditoria && g.auditoria.quantidades;
      if (!z || z.g == null || z.v == null || z.p == null) { s.rotasSemQuantidades++; return s; }
      s.gaiolas += n(z.g) + n(z.v); s.paletes += n(z.p); return s;
    }, { gaiolas: 0, paletes: 0, rotasSemQuantidades: 0 });
    var r = {
      totalProdutos: n(q.pacotes) + n(q.volumosos) + n(q.extraVolumosos),    // BK não entra na soma (significado não confirmado)
      gaiolas: op.gaiolas.length, gaiolasAuditadas: quantidadesRotas.gaiolas, paletesAuditados: quantidadesRotas.paletes, rotasSemQuantidades: quantidadesRotas.rotasSemQuantidades,
      paletesVeiculos: somaPaletes, redesVeiculos: somaRedes, avisos: []
    };
    if (q.paletes != null && vs.length && q.paletes !== somaPaletes) r.avisos.push('Paletes legados: total informado (' + q.paletes + ') difere da soma dos veículos (' + somaPaletes + ').');
    return r;
  }
  function inteiroOuNulo(v) {
    if (v === '' || v == null) return { ok: true, valor: null };
    var x = Number(v); return Number.isInteger(x) && x >= 0 ? { ok: true, valor: x } : { ok: false };
  }

  // ---------------------------------------------------------------- veículos e gaiolas carregadas
  function normalizarPlaca(p) { return limpar(p).toUpperCase().replace(/[\s-]/g, ''); }
  function placaPadraoConhecido(p) { return /^[A-Z]{3}\d{4}$/.test(p) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p); }
  function listaTexto(t) { return String(t || '').split(/[\n,;]+/).map(limpar).filter(Boolean); }

  function novoVeiculo(o, agoraMs) {
    var placa = normalizarPlaca(o.placa);
    if (!placa) return { ok: false, erro: 'Informe a placa.' };
    var pal = inteiroOuNulo(o.paletes), red = inteiroOuNulo(o.redes);
    if (!pal.ok || !red.ok) return { ok: false, erro: 'Paletes e redes devem ser números inteiros não negativos.' };
    return { ok: true, veiculo: { id: novoId('xvc'), placa: placa, motorista: limpar(o.motorista), rotas: listaTexto(o.rotas), gaiolaIds: [],
      fimCarregamentoAt: null, paletes: pal.valor, redes: red.valor, saidaAt: o.saidaMs ? iso(o.saidaMs) : null, fotoId: null, fotosAnteriores: [], criadoEm: iso(agoraMs), historico: [] } };
  }
  function veiculoDaGaiola(op, gaiolaId) {
    for (var i = 0; i < op.veiculos.length; i++) if (op.veiculos[i].gaiolaIds.indexOf(gaiolaId) >= 0) return op.veiculos[i];
    return null;
  }
  /** Uma gaiola só pode estar em um veículo por vez; sem transferência implícita (não confirmada no processo). */
  function carregarGaiola(op, veiculoId, gaiolaId, agoraMs) {
    var v = op.veiculos.filter(function (x) { return x.id === veiculoId; })[0];
    var g = op.gaiolas.filter(function (x) { return x.id === gaiolaId; })[0];
    if (!v || !g) return { ok: false, erro: 'Veículo ou gaiola não encontrado.' };
    var atual = veiculoDaGaiola(op, gaiolaId);
    if (atual) return { ok: false, erro: 'A gaiola ' + g.codigo + ' já está carregada no veículo ' + atual.placa + (atual.id === v.id ? '' : '. Remova-a de lá antes.') };
    v.gaiolaIds.push(gaiolaId); v.historico.push({ em: iso(agoraMs), acao: 'gaiola_carregada', gaiolaCodigo: g.codigo });
    return { ok: true };
  }
  function descarregarGaiola(op, veiculoId, gaiolaId, agoraMs) {
    var v = op.veiculos.filter(function (x) { return x.id === veiculoId; })[0]; if (!v) return { ok: false, erro: 'Veículo não encontrado.' };
    var k = v.gaiolaIds.indexOf(gaiolaId); if (k < 0) return { ok: false, erro: 'A gaiola não está neste veículo.' };
    var g = op.gaiolas.filter(function (x) { return x.id === gaiolaId; })[0];
    v.gaiolaIds.splice(k, 1); v.historico.push({ em: iso(agoraMs), acao: 'gaiola_removida', gaiolaCodigo: g ? g.codigo : gaiolaId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- ocorrências
  function novaOcorrencia(o, agoraMs) {
    if (!CATEGORIAS.some(function (c) { return c.id === o.categoria; })) return { ok: false, erro: 'Selecione a categoria.' };
    if (o.categoria === 'outra' && !limpar(o.outraDescricao)) return { ok: false, erro: 'Descreva a categoria “Outra”.' };
    var prod = limpar(o.produtoId);
    if (!prod) return { ok: false, erro: 'Informe ou leia o identificador do produto.' };
    var v = validarCodigo(prod); if (!v.ok) return { ok: false, erro: 'Identificador do produto n\u00e3o reconhecido: ' + v.motivo }; prod = v.id;
    if (!limpar(o.gaiolaEncontrada)) return { ok: false, erro: 'Informe a gaiola onde o produto foi encontrado.' };
    if (!limpar(o.identificadoPor)) return { ok: false, erro: 'Informe quem encontrou o produto.' };
    return { ok: true, ocorrencia: {
      id: novoId('xoc'), categoria: o.categoria, outraDescricao: limpar(o.outraDescricao), produtoId: prod, tipoProduto: limpar(o.tipoProduto),
      gaiolaEncontrada: limpar(o.gaiolaEncontrada), gaiolaCorreta: limpar(o.gaiolaCorreta), identificadoPor: limpar(o.identificadoPor),
      registradaEm: iso(o.quandoMs || agoraMs), observacao: limpar(o.observacao), status: 'pendente', historico: [] } };
  }
  function produtoJaRegistrado(op, produtoId) {
    var k = chave(produtoId); if (!k) return [];
    return op.ocorrencias.filter(function (x) { return chave(x.produtoId) === k; });
  }
  function mudarStatus(oc, novo, nota, agoraMs) {
    if (novo !== 'pendente' && novo !== 'resolvido') return { ok: false, erro: 'Status inválido.' };
    if (oc.status === novo) return { ok: false, erro: 'A ocorrência já está ' + novo + '.' };
    oc.historico.push({ em: iso(agoraMs), de: oc.status, para: novo, nota: limpar(nota) }); oc.status = novo;
    return { ok: true };
  }
  function rotuloCategoria(oc) { var c = CATEGORIAS.filter(function (x) { return x.id === oc.categoria; })[0]; return c ? (oc.categoria === 'outra' && oc.outraDescricao ? 'Outra: ' + oc.outraDescricao : c.rotulo) : oc.categoria; }

  // ---------------------------------------------------------------- dados
  function padrao() { return { versao: 1, rev: 0, operacoes: [] }; }
  function validarDados(d) {
    var e = [];
    if (!d || typeof d !== 'object' || !Array.isArray(d.operacoes)) return ['operacoes não é lista'];
    var ids = {};
    d.operacoes.forEach(function (o, k) {
      var p = 'operacoes[' + k + ']';
      if (!o || typeof o.id !== 'string') { e.push(p + '.id inválido'); return; }
      if (ids[o.id]) e.push('id repetido: ' + o.id); ids[o.id] = 1;
      if (isNaN(Date.parse(o.inicioAt))) e.push(p + '.inicioAt inválido');
      ['gaiolas', 'ocorrencias', 'veiculos'].forEach(function (c) { if (!Array.isArray(o[c])) e.push(p + '.' + c + ' não é lista'); });
      if (!o.quantidades || typeof o.quantidades !== 'object') e.push(p + '.quantidades inválido');
      if (Array.isArray(o.gaiolas)) o.gaiolas.forEach(function (g) {
        if (!g || typeof g.id !== 'string' || !g.codigo) e.push(p + ' gaiola inválida');
        else if (!ESTADOS_AUDITORIA[g.auditoria && g.auditoria.estado]) e.push(p + ' auditoria inválida em ' + g.codigo);
      });
      if (Array.isArray(o.veiculos) && Array.isArray(o.gaiolas)) {
        var usadas = {};
        o.veiculos.forEach(function (v) {
          (v.gaiolaIds || []).forEach(function (gid) { if (usadas[gid]) e.push(p + ': gaiola em mais de um veículo'); usadas[gid] = 1; });
        });
      }
    });
    return e;
  }


  // ---------------------------------------------------------------- relatórios (dados e texto)
  function rotasDaOperacao(op) {
    var vistos = {}, out = [];
    op.veiculos.forEach(function (v) {
      (v.gaiolaIds || []).forEach(function (id) {
        var g = op.gaiolas.filter(function (x) { return x.id === id; })[0];
        if (g && !vistos[chave(g.codigo)]) { vistos[chave(g.codigo)] = 1; out.push(g.codigo); }
      });
      (v.rotas || []).forEach(function (r) { if (!vistos[chave(r)]) { vistos[chave(r)] = 1; out.push(r); } });
    });
    return out;
  }
  function pendentesAbertas(op) { return op.ocorrencias.filter(function (o) { return o.status === 'pendente'; }); }

  /** Relatório básico de expedição, em texto (copiar/colar). Só o que está registrado. */
  function relatorioBasico(op) {
    var U = NS.Utils, t = totais(op), a = resumoAuditoria(op.gaiolas), q = op.quantidades, L = [];
    var hm = function (isoStr) { return U.formatarHora(new Date(isoStr)); };
    L.push('📦 *MeliNotepad* — Expedição XPT');
    L.push('━━━━━━━━━━━━━━━━'); L.push('');
    L.push('📅 *Operação de ' + U.formatarData(new Date(op.inicioAt)) + '*');
    if (op.encerradaAt) L.push('🕗 Encerrada: ' + hm(op.encerradaAt));
    L.push('');
    L.push('📊 *Quantidades*');
    var qs = [['Pacotes', q.pacotes], ['Volumosos', q.volumosos], ['Extra volumosos', q.extraVolumosos]].filter(function (x) { return x[1] != null; });
    if (qs.length) L.push(qs.map(function (x) { return x[0] + ': ' + U.formatarNumeroBR(x[1]); }).join(' · '));
    if (qs.length) L.push('Total de produtos: *' + U.formatarNumeroBR(t.totalProdutos) + '*');
    var o = ['Rotas cadastradas: ' + t.gaiolas, 'Gaiolas informadas (G+V): ' + t.gaiolasAuditadas, 'Paletes informados (P): ' + t.paletesAuditados];
    if (t.rotasSemQuantidades) o.push('Rotas sem quantidades G/V/P completas: ' + t.rotasSemQuantidades);
    if (q.totalBK != null) o.push('Total BK: ' + q.totalBK);
    L.push(o.join(' · '));
    var rotas = rotasDaOperacao(op); if (rotas.length) { L.push(''); L.push('🗺️ *Rotas:* ' + rotas.join(', ')); }
    if (op.veiculos.length) {
      L.push(''); L.push('🚚 *Veículos* — ' + op.veiculos.length);
      op.veiculos.forEach(function (v) {
        var resumo = resumoVeiculo(op, v), fim = v.fimCarregamentoAt || (op.fimCarregamentoAt ? op.fimCarregamentoAt : null);
        var p = [v.placa]; if (v.motorista) p.push(v.motorista);
        p.push('Rotas carregadas: ' + resumo.rotas);
        p.push('Gaiolas informadas: ' + resumo.gaiolas);
        p.push('Paletes informados: ' + resumo.paletes);
        p.push(fim ? 'Fim do carregamento: ' + hm(fim) : 'Carregamento não finalizado');
        p.push('Redes calculadas: ' + redesDoVeiculo(op, v).valor);
        L.push('└ ' + p.join(' · '));
      });
    }
    L.push(''); L.push('🔎 *Auditoria* (rotas convencionais)');
    if (!a.total) L.push('Sem rotas convencionais para auditoria.');
    else {
      var comDivergencia = op.gaiolas.filter(function (g) { return !g.vuc && rotuloAuditoria(op, g) === 'Concluída com divergência'; }).length;
      var semDivergencia = op.gaiolas.filter(function (g) { return !g.vuc && rotuloAuditoria(op, g) === 'Concluído'; }).length;
      L.push('Concluídas: ' + a.concluidas + ' de ' + a.total + ' (' + String(a.percentual).replace('.', ',') + '%) · sem divergência ' + semDivergencia + ' · com divergência ' + comDivergencia);
      L.push('Não realizadas: ' + (a.pendentes + a.naoIniciadas));
    }
    if (a.vuc) L.push('VUC fora do cálculo de auditoria: ' + a.vuc);
    L.push(''); L.push('*Rotas, auditoria e ocorrências*');
    if (!op.gaiolas.length) L.push('Nenhuma gaiola cadastrada.');
    op.gaiolas.forEach(function (g) {
      L.push('- Rota ' + g.codigo + ': ' + rotuloAuditoria(op, g) + ' | Auditor: ' + (g.auditoria.auditor || 'não informado'));
      ocorrenciasDaGaiola(op, g).forEach(function (oc) {
        L.push('  Ocorrência: produto ' + (oc.produtoId || '-') + ' | categoria: ' + rotuloCategoria(oc) +
          ' | encontrado por: ' + (oc.identificadoPor || '-') + ' | gaiola correta: ' + (oc.gaiolaCorreta || '-') +
          ' | ' + oc.status + (oc.observacao ? ' | observações: ' + oc.observacao : ''));
      });
    });
    L.push(''); L.push('🏁 *XPT — ' + ROTULO_SITUACAO[situacaoOperacao(op)] + '*');
    return L.join('\n');
  }

  NS.XptRegras = {
    CATEGORIAS: CATEGORIAS, ESTADOS_AUDITORIA: ESTADOS_AUDITORIA, ROTULO_SITUACAO: ROTULO_SITUACAO, MAX_INTERVALO: MAX_INTERVALO,
    limpar: limpar, chave: chave, diaRef: diaRef, interpretarCodigos: interpretarCodigos, novaOperacao: novaOperacao, situacaoOperacao: situacaoOperacao,
    diasAberta: diasAberta, adicionarGaiolas: adicionarGaiolas, definirAuditoria: definirAuditoria, iniciarAuditoria: iniciarAuditoria, statusAuditoria: statusAuditoria, validarQuantidadesAuditoria: validarQuantidadesAuditoria, resumoAuditoria: resumoAuditoria,
    ocorrenciasDaGaiola: ocorrenciasDaGaiola, rotuloAuditoria: rotuloAuditoria,
    totais: totais, redesDoVeiculo: redesDoVeiculo, resumoVeiculo: resumoVeiculo, inteiroOuNulo: inteiroOuNulo, normalizarPlaca: normalizarPlaca, placaPadraoConhecido: placaPadraoConhecido, listaTexto: listaTexto,
    novoVeiculo: novoVeiculo, veiculoDaGaiola: veiculoDaGaiola, carregarGaiola: carregarGaiola, descarregarGaiola: descarregarGaiola,
    novaOcorrencia: novaOcorrencia, produtoJaRegistrado: produtoJaRegistrado, mudarStatus: mudarStatus, rotuloCategoria: rotuloCategoria,
    rotasDaOperacao: rotasDaOperacao, pendentesAbertas: pendentesAbertas, relatorioBasico: relatorioBasico,
    padrao: padrao, validarDados: validarDados
  };
})(window);
