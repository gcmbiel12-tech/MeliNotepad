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
  var ESTADOS_AUDITORIA = {
    nao_iniciada: 'Não iniciada', pendente: 'Pendente',
    concluida_sem_divergencia: 'Concluída sem divergências', concluida_com_divergencia: 'Concluída com divergências'
  };
  var MODOS = { manual: 'Manual', automatica: 'Automática' };

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
    return { id: novoId('gai'), codigo: codigo, vuc: false, criadaEm: iso(agoraMs),
             auditoria: { estado: 'nao_iniciada', modo: null, em: null, historico: [] } };
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
  function definirAuditoria(g, estado, modo, agoraMs) {
    if (!ESTADOS_AUDITORIA[estado]) return { ok: false, erro: 'Estado de auditoria inválido.' };
    var concluida = estado.indexOf('concluida') === 0;
    if (concluida && !MODOS[modo]) return { ok: false, erro: 'Informe se a auditoria foi manual ou automática.' };
    g.auditoria.historico.push({ em: iso(agoraMs), de: g.auditoria.estado, para: estado, modo: concluida ? modo : null });
    g.auditoria.estado = estado; g.auditoria.modo = concluida ? modo : null; g.auditoria.em = concluida ? iso(agoraMs) : null;
    return { ok: true };
  }
  /** % de auditoria = concluídas ÷ gaiolas convencionais (VUC fora do denominador, mas dentro da expedição). */
  function resumoAuditoria(gaiolas) {
    var r = { total: gaiolas.length, vuc: 0, convencionais: 0, concluidasSem: 0, concluidasCom: 0, pendentes: 0, naoIniciadas: 0, manuais: 0, automaticas: 0 };
    gaiolas.forEach(function (g) {
      if (g.vuc) { r.vuc++; return; }
      r.convencionais++;
      var e = g.auditoria.estado;
      if (e === 'concluida_sem_divergencia') r.concluidasSem++;
      else if (e === 'concluida_com_divergencia') r.concluidasCom++;
      else if (e === 'pendente') r.pendentes++; else r.naoIniciadas++;
      if (e.indexOf('concluida') === 0) { if (g.auditoria.modo === 'automatica') r.automaticas++; else r.manuais++; }
    });
    r.concluidas = r.concluidasSem + r.concluidasCom;
    r.percentual = r.convencionais ? Math.round(r.concluidas / r.convencionais * 1000) / 10 : null;
    return r;
  }

  // ---------------------------------------------------------------- quantidades
  function n(v) { return v == null || v === '' ? 0 : Number(v); }
  function totais(op) {
    var q = op.quantidades, vs = op.veiculos;
    var somaPaletes = vs.reduce(function (s, v) { return s + n(v.paletes); }, 0);
    var somaRedes = vs.reduce(function (s, v) { return s + n(v.redes); }, 0);
    var r = {
      totalProdutos: n(q.pacotes) + n(q.volumosos) + n(q.extraVolumosos),    // BK não entra na soma (significado não confirmado)
      gaiolas: op.gaiolas.length, gaiolasVuc: op.gaiolas.filter(function (g) { return g.vuc; }).length,
      paletesVeiculos: somaPaletes, redesVeiculos: somaRedes, avisos: []
    };
    if (q.paletes != null && vs.length && q.paletes !== somaPaletes) r.avisos.push('Paletes: total informado (' + q.paletes + ') difere da soma dos veículos (' + somaPaletes + ').');
    if (q.redes != null && vs.length && q.redes !== somaRedes) r.avisos.push('Redes: total informado (' + q.redes + ') difere da soma dos veículos (' + somaRedes + ').');
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
      paletes: pal.valor, redes: red.valor, saidaAt: o.saidaMs ? iso(o.saidaMs) : null, fotoId: null, fotosAnteriores: [], criadoEm: iso(agoraMs), historico: [] } };
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
    if (prod) { var v = validarCodigo(prod); if (!v.ok) return { ok: false, erro: 'Identificador do produto não reconhecido: ' + v.motivo }; prod = v.id; }
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
    op.veiculos.forEach(function (v) { (v.rotas || []).forEach(function (r) { if (!vistos[chave(r)]) { vistos[chave(r)] = 1; out.push(r); } }); });
    return out;
  }
  function pendentesAbertas(op) { return op.ocorrencias.filter(function (o) { return o.status === 'pendente'; }); }

  /** Relatório básico de expedição, em texto (copiar/colar). Só o que está registrado. */
  function relatorioBasico(op) {
    var U = NS.Utils, t = totais(op), a = resumoAuditoria(op.gaiolas), q = op.quantidades, L = [];
    var hm = function (isoStr) { return U.formatarHora(new Date(isoStr)); };
    L.push('📦 *MeliOps* — Expedição XPT');
    L.push('━━━━━━━━━━━━━━━━'); L.push('');
    L.push('📅 *Operação de ' + U.formatarData(new Date(op.inicioAt)) + '*');
    var h = ['Início: ' + hm(op.inicioAt)];
    h.push(op.fimCarregamentoAt ? 'Fim do carregamento: ' + hm(op.fimCarregamentoAt) : 'Carregamento em andamento');
    h.push(op.encerradaAt ? 'Encerrada: ' + hm(op.encerradaAt) : 'Operação aberta');
    L.push('🕗 ' + h.join(' · ')); L.push('');
    L.push('📊 *Quantidades*');
    var qs = [['Pacotes', q.pacotes], ['Volumosos', q.volumosos], ['Extra volumosos', q.extraVolumosos]].filter(function (x) { return x[1] != null; });
    if (qs.length) L.push(qs.map(function (x) { return x[0] + ': ' + U.formatarNumeroBR(x[1]); }).join(' · '));
    if (qs.length) L.push('Total de produtos: *' + U.formatarNumeroBR(t.totalProdutos) + '*');
    var o = ['Gaiolas: ' + t.gaiolas + (t.gaiolasVuc ? ' (' + t.gaiolasVuc + ' VUC)' : '')];
    if (q.paletes != null) o.push('Paletes: ' + q.paletes); if (q.redes != null) o.push('Redes: ' + q.redes); if (q.totalBK != null) o.push('Total BK: ' + q.totalBK);
    L.push(o.join(' · '));
    var rotas = rotasDaOperacao(op); if (rotas.length) { L.push(''); L.push('🗺️ *Rotas:* ' + rotas.join(', ')); }
    if (op.veiculos.length) {
      L.push(''); L.push('🚚 *Veículos* — ' + op.veiculos.length);
      op.veiculos.forEach(function (v) {
        var p = [v.placa]; if (v.motorista) p.push(v.motorista);
        p.push(v.gaiolaIds.length + ' gaiola(s)'); if (v.paletes != null) p.push(v.paletes + ' palete(s)'); if (v.redes != null) p.push(v.redes + ' rede(s)');
        p.push(v.saidaAt ? 'saída ' + hm(v.saidaAt) : 'sem horário de saída');
        L.push('└ ' + p.join(' · '));
      });
    }
    L.push(''); L.push('🔎 *Auditoria* (gaiolas convencionais)');
    if (!a.convencionais) L.push('Sem gaiolas convencionais registradas.');
    else {
      L.push('Concluídas: ' + a.concluidas + ' de ' + a.convencionais + ' (' + String(a.percentual).replace('.', ',') + '%) · sem divergência ' + a.concluidasSem + ' · com divergência ' + a.concluidasCom);
      L.push('Pendentes: ' + a.pendentes + ' · não iniciadas: ' + a.naoIniciadas);
    }
    if (a.vuc) L.push('VUC fora do cálculo de auditoria: ' + a.vuc);
    L.push(''); L.push('🏁 *XPT — ' + ROTULO_SITUACAO[situacaoOperacao(op)] + '*');
    return L.join('\n');
  }

  NS.XptRegras = {
    CATEGORIAS: CATEGORIAS, ESTADOS_AUDITORIA: ESTADOS_AUDITORIA, MODOS: MODOS, ROTULO_SITUACAO: ROTULO_SITUACAO, MAX_INTERVALO: MAX_INTERVALO,
    limpar: limpar, chave: chave, diaRef: diaRef, interpretarCodigos: interpretarCodigos, novaOperacao: novaOperacao, situacaoOperacao: situacaoOperacao,
    diasAberta: diasAberta, adicionarGaiolas: adicionarGaiolas, definirAuditoria: definirAuditoria, resumoAuditoria: resumoAuditoria,
    totais: totais, inteiroOuNulo: inteiroOuNulo, normalizarPlaca: normalizarPlaca, placaPadraoConhecido: placaPadraoConhecido, listaTexto: listaTexto,
    novoVeiculo: novoVeiculo, veiculoDaGaiola: veiculoDaGaiola, carregarGaiola: carregarGaiola, descarregarGaiola: descarregarGaiola,
    novaOcorrencia: novaOcorrencia, produtoJaRegistrado: produtoJaRegistrado, mudarStatus: mudarStatus, rotuloCategoria: rotuloCategoria,
    rotasDaOperacao: rotasDaOperacao, pendentesAbertas: pendentesAbertas, relatorioBasico: relatorioBasico,
    padrao: padrao, validarDados: validarDados
  };
})(window);
