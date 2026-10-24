/**
 * modulo-store.js
 * Armazenamento local seguro e genérico para os módulos XPT e Intervalos.
 * O NEX continua usando storage.js (chave própria, intocada): os registros dos
 * módulos ficam em chaves separadas e nunca se misturam.
 *
 * Importante: isto é armazenamento LOCAL (LocalStorage). Não há sincronização
 * entre aparelhos — nenhuma mensagem do app deve sugerir o contrário.
 */
(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};

  function criar(cfg) {
    var chave = cfg.chave;
    var pendente = null;

    function lerBruto() {
      try { return global.localStorage.getItem(chave); } catch (e) { return undefined; }
    }

    // Preserva (até 3 cópias distintas) o conteúdo ilegível, sem acumular a cada recarga.
    function preservar(bruto) {
      try {
        for (var i = 0; i < 3; i++) {
          var k = chave + '_corrompido_' + i;
          var existente = global.localStorage.getItem(k);
          if (existente === bruto) return;
          if (existente === null) { global.localStorage.setItem(k, bruto); return; }
        }
      } catch (e) { /* sem espaço: nada a fazer */ }
    }

    function carregar() {
      var bruto = lerBruto();
      if (bruto === undefined) return { dados: cfg.padrao(), aviso: 'Armazenamento local indisponível: nada será salvo.', indisponivel: true };
      if (bruto === null) return { dados: cfg.padrao(), aviso: null };
      var p;
      try { p = JSON.parse(bruto); } catch (e) {
        preservar(bruto);
        return { dados: cfg.padrao(), aviso: 'Os dados de ' + cfg.rotulo + ' estavam ilegíveis. Uma cópia foi preservada; iniciando vazio.', corrompido: true };
      }
      var erros = cfg.validar(p);
      if (erros.length) {
        preservar(bruto);
        return { dados: cfg.padrao(), aviso: 'Os dados de ' + cfg.rotulo + ' estão fora do formato esperado (' + erros.slice(0, 2).join('; ') + '). Uma cópia foi preservada; iniciando vazio.', corrompido: true };
      }
      return { dados: p, aviso: null };
    }

    function gravar(dados) {
      var erros = cfg.validar(dados);
      if (erros.length) return { sucesso: false, erro: 'Dados inválidos, nada foi salvo: ' + erros[0] };
      try { global.localStorage.setItem(chave, JSON.stringify(dados)); pendente = null; return { sucesso: true }; }
      catch (e) {
        return { sucesso: false, erro: e && e.name === 'QuotaExceededError'
          ? 'O armazenamento local está cheio. Exporte um backup antes de continuar.'
          : 'Falha ao salvar neste aparelho.' };
      }
    }

    // Lê o estado MAIS RECENTE do armazenamento, aplica a mudança e grava.
    // Assim, uma segunda aba aberta nunca é sobrescrita por um estado antigo em memória.
    function mutar(fn) {
      var c = carregar();
      if (c.indisponivel) return { sucesso: false, erro: c.aviso };
      var d = pendente || c.dados, retorno;
      try { retorno = fn(d); } catch (e) { return { sucesso: false, erro: (e && e.message) || String(e) }; }
      d.rev = (d.rev || 0) + 1;
      var g = gravar(d);
      if (!g.sucesso) { pendente = d; return g; }
      return { sucesso: true, dados: d, retorno: retorno };
    }

    function tentarNovamente() {
      if (!pendente) return { sucesso: true, dados: carregar().dados, semAlteracoes: true };
      var dadosPendentes = pendente;
      var g = gravar(dadosPendentes);
      if (!g.sucesso) return g;
      return { sucesso: true, dados: dadosPendentes };
    }

    function ouvirOutrasAbas(cb) {
      global.addEventListener('storage', function (ev) { if (ev.key === chave) cb(); });
    }

    return { chave: chave, carregar: carregar, gravar: gravar, mutar: mutar, tentarNovamente: tentarNovamente, ouvirOutrasAbas: ouvirOutrasAbas };
  }

  // Comparação estável (ignora a ordem das chaves) para detectar registros idênticos.
  function estavel(v) {
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + estavel(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }

  /**
   * Mescla um backup importado nos dados atuais SEM apagar nada:
   * id novo -> inserir; id igual e conteúdo idêntico -> ignorar;
   * id igual e conteúdo diferente -> conflito (mantém o atual, relata).
   * Importar o mesmo arquivo duas vezes não cria duplicatas.
   */
  function mesclar(atual, importado, colecoes) {
    var resumo = { inseridos: 0, ignorados: 0, conflitos: [], rejeitados: [] };
    colecoes.forEach(function (col) {
      if (!Array.isArray(atual[col])) atual[col] = [];
      var porId = {};
      atual[col].forEach(function (x) { porId[x.id] = x; });
      (Array.isArray(importado[col]) ? importado[col] : []).forEach(function (item, i) {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) {
          resumo.rejeitados.push({ colecao: col, posicao: i, motivo: 'registro sem id válido' });
          return;
        }
        var ex = porId[item.id];
        if (!ex) { atual[col].push(item); porId[item.id] = item; resumo.inseridos++; }
        else if (estavel(ex) === estavel(item)) resumo.ignorados++;
        else resumo.conflitos.push({ colecao: col, id: item.id });
      });
    });
    return resumo;
  }

  function exportarJson(modulo, dados) {
    return JSON.stringify({ melinotepadBackup: true, modulo: modulo, formato: 1, exportadoEm: new Date().toISOString(), dados: dados }, null, 2);
  }

  function lerBackup(texto, modulo) {
    var p;
    try { p = JSON.parse(texto); } catch (e) { return { valido: false, erro: 'O arquivo não é um JSON válido.' }; }
    if (!p || p.melinotepadBackup !== true || p.modulo !== modulo || !p.dados || typeof p.dados !== 'object') {
      return { valido: false, erro: 'Este arquivo não é um backup de ' + modulo + '.' };
    }
    return { valido: true, dados: p.dados };
  }

  NS.ModStore = { criar: criar, mesclar: mesclar, exportarJson: exportarJson, lerBackup: lerBackup, estavel: estavel };
})(window);
