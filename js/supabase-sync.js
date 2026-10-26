(function (global) {
  'use strict';
  var NS = global.MeliNotepad = global.MeliNotepad || {};
  var A = NS.SupabaseAuth;
  var MODULOS = {
    nex: { nome: 'NEX', chave: (NS.Constants && NS.Constants.STORAGE_KEY) || 'melinotepad_data_v1' },
    xpt: { nome: 'XPT', chave: 'melinotepad_xpt_v1' },
    intervalos: { nome: 'Intervalos', chave: 'melinotepad_intervalos_v1' }
  };
  var projeto = String((global.MeliNotepadConfig || {}).supabaseUrl || 'local').replace(/[^a-z0-9]/gi, '_').slice(-50);
  var CHAVE_ATIVADOS = 'melinotepad_sync_enabled_v1_' + projeto;
  var CHAVE_META = 'melinotepad_sync_meta_v1_' + projeto;
  var ativados = lerObjeto(CHAVE_ATIVADOS, {});
  var meta = lerObjeto(CHAVE_META, {});
  var versoesRemotas = {};
  var analiseAtual = {};
  var timers = {};
  var resolvendo = {};
  var iniciado = false;
  var analisando = false;
  var reconciliando = false;
  var panel, list, message, status;

  function lerObjeto(chave, padrao) {
    try { var v = JSON.parse(global.localStorage.getItem(chave) || 'null'); return v && typeof v === 'object' ? v : padrao; }
    catch (e) { return padrao; }
  }
  function gravarObjeto(chave, valor) {
    global.localStorage.setItem(chave, JSON.stringify(valor));
  }
  function estadoLocal(modulo) {
    var raw;
    try { raw = global.localStorage.getItem(MODULOS[modulo].chave); }
    catch (e) { return { erro: 'O armazenamento local não está disponível.' }; }
    if (raw === null) return { existe: false, dados: null, hash: hash('null') };
    try {
      var dados = JSON.parse(raw);
      return { existe: true, dados: dados, hash: hash(estavel(dados)) };
    } catch (e) {
      return { erro: 'O JSON local está corrompido. Exporte/recupere um backup antes de sincronizar.' };
    }
  }
  function estavel(v) {
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + estavel(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function hash(texto) {
    var h = 2166136261;
    for (var i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  function vazio(modulo, dados, existe) {
    if (!existe || !dados) return true;
    if (modulo === 'nex') return !dados.currentSession && Array.isArray(dados.history) && dados.history.length === 0;
    if (modulo === 'xpt') return Array.isArray(dados.operacoes) && dados.operacoes.length === 0;
    return Array.isArray(dados.funcionarios) && dados.funcionarios.length === 0
      && Array.isArray(dados.intervalos) && dados.intervalos.length === 0;
  }
  function validarPayload(modulo, dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return false;
    if (modulo === 'nex') return !!(NS.Storage && NS.Storage.validarDados(dados).valido);
    if (modulo === 'xpt') return !!(NS.XptRegras && NS.XptRegras.validarDados(dados).length === 0);
    if (modulo === 'intervalos') return !!(NS.IntervalosRegras && NS.IntervalosRegras.validarDados(dados).length === 0);
    return false;
  }
  function temFotos(valor, chave) {
    if (valor === null || valor === undefined || valor === '') return false;
    if (/foto/i.test(chave || '')) {
      if (Array.isArray(valor)) return valor.length > 0;
      if (typeof valor === 'object') return true;
      if (typeof valor === 'string') return true;
    }
    if (Array.isArray(valor)) return valor.some(function (x) { return temFotos(x, chave); });
    if (valor && typeof valor === 'object') return Object.keys(valor).some(function (k) { return temFotos(valor[k], k); });
    return false;
  }
  function idsFotos(dados) {
    var ids = {};
    function percorrer(valor, chave) {
      if (chave === 'fotoId' && typeof valor === 'string' && valor) ids[valor] = true;
      if (Array.isArray(valor)) valor.forEach(function (v) { percorrer(v, chave); });
      else if (valor && typeof valor === 'object') Object.keys(valor).forEach(function (k) { percorrer(valor[k], k); });
    }
    percorrer(dados, '');
    return Object.keys(ids);
  }
  function sincronizarFotosXpt(dados) {
    var fotos = idsFotos(dados);
    if (!fotos.length) return Promise.resolve();
    if (!NS.Fotos || !NS.Fotos.obter || !NS.Fotos.salvar || !A.storageUpload || !A.storageDownload) {
      return Promise.reject(new Error('O armazenamento central de fotos não está disponível.'));
    }
    return Promise.all(fotos.map(function (id) {
      return NS.Fotos.obter(id).then(function (registro) {
        if (registro && registro.blob) {
          if (registro.sincronizada === true) return;
          var mime = registro.mime || registro.blob.type || 'image/jpeg';
          if (mime !== 'image/jpeg' || (registro.blob.size || 0) > 10 * 1024 * 1024) {
            throw new Error('A foto ' + id + ' precisa ser JPEG de até 10 MiB. Nenhum snapshot XPT foi enviado.');
          }
          return A.storageUpload('xpt-fotos', id + '.jpg', registro.blob, mime).then(function () {
            registro.sincronizada = true;
            registro.sincronizadaEm = new Date().toISOString();
            return NS.Fotos.salvar(registro);
          });
        }
        return A.storageDownload('xpt-fotos', id + '.jpg').then(function (blob) {
          if (!blob || (blob.type && blob.type !== 'image/jpeg') || (blob.size || 0) > 10 * 1024 * 1024) {
            throw new Error('A foto remota não corresponde ao formato JPEG de até 10 MiB.');
          }
          return NS.Fotos.salvar({ id: id, blob: blob, mime: 'image/jpeg', criadoEm: new Date().toISOString(), sincronizada: true, sincronizadaEm: new Date().toISOString() });
        }).catch(function (e) {
          throw new Error('A foto ' + id + ' não está neste aparelho nem foi encontrada na nuvem. Nenhum snapshot XPT foi aplicado: ' + e.message);
        });
      });
    }));
  }
  function setStatus(texto, tipo) {
    if (status) {
      status.textContent = texto;
      status.className = 'auth-sync-status' + (tipo ? ' auth-sync-status--' + tipo : '');
      status.title = texto;
    }
    atualizarAviso();
  }
  function atualizarAviso() {
    var aviso = document.getElementById('auth-local-data-warning');
    if (!aviso) return;
    var ativos = Object.keys(ativados).filter(function (m) { return ativados[m] === true; });
    var nomes = ativos.map(function (m) { return MODULOS[m] && MODULOS[m].nome; }).filter(Boolean);
    var xptFotoLocal = false;
    if (MODULOS.xpt) {
      var x = estadoLocal('xpt');
      xptFotoLocal = !x.erro && temFotos(x.dados, '');
    }
    if (!nomes.length) {
      aviso.textContent = 'Autenticação ativa. Os dados operacionais continuam locais; a sincronização está desligada.';
      return;
    }
    aviso.textContent = 'Sincronização ativa: ' + nomes.join(', ') + '.'
      + (xptFotoLocal && ativos.indexOf('xpt') === -1 ? ' XPT contém fotos locais; ative a sincronização do módulo XPT para transferi-las.' : '')
      + ' Se houver conflito entre dispositivos, o salvamento é bloqueado para evitar sobrescrita silenciosa.';
  }
  function carregarRemoto(modulo) {
    return A.rpc('get_module_snapshot', { p_module_name: modulo });
  }
  function salvarRemoto(modulo, versao, dados) {
    return A.rpc('save_module_snapshot', {
      p_module_name: modulo,
      p_expected_version: versao,
      p_payload: dados
    });
  }
  function guardarMeta(modulo, versao, localHash) {
    meta[modulo] = { version: versao, localHash: localHash };
    versoesRemotas[modulo] = versao;
    gravarObjeto(CHAVE_META, meta);
  }
  function marcarAtivo(modulo, versao, localHash) {
    ativados[modulo] = true;
    gravarObjeto(CHAVE_ATIVADOS, ativados);
    guardarMeta(modulo, versao, localHash);
    setStatus('Sincronização ativa: ' + MODULOS[modulo].nome, 'ok');
  }
  function desativar(modulo) {
    ativados[modulo] = false;
    gravarObjeto(CHAVE_ATIVADOS, ativados);
  }
  function criar(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }
  function definirMensagem(texto, erro) {
    if (!message) return;
    message.textContent = texto || '';
    message.classList.toggle('is-erro', !!erro);
  }
  function botao(acoes, rotulo, acao, modulo) {
    var b = criar('button', 'botao ' + (acao === 'local' || acao === 'cloud' ? 'botao--primario' : 'botao--secundario'), rotulo);
    b.type = 'button';
    b.addEventListener('click', function () { resolver(modulo, acao); });
    acoes.appendChild(b);
  }
  function desenharItem(item) {
    var li = criar('li', 'auth-sync-item');
    var info = criar('div', 'auth-sync-item__info');
    info.appendChild(criar('strong', '', MODULOS[item.modulo].nome));
    info.appendChild(criar('p', '', item.descricao));
    if (item.modulo === 'xpt' && (temFotos(item.local && item.local.dados, '') || temFotos(item.remoto && item.remoto.payload, ''))) {
      info.appendChild(criar('p', '', 'As fotos vinculadas também serão enviadas/baixadas pelo bucket privado. Se uma foto não existir nem localmente nem na nuvem, a operação será interrompida sem substituir o snapshot.'));
    }
    var acoes = criar('div', 'auth-sync-item__acoes');
    if (item.state === 'empty' || item.state === 'equal') {
      botao(acoes, 'Ativar sincronização', 'ativar', item.modulo);
    } else if (item.state === 'remote-only') {
      botao(acoes, 'Baixar da nuvem', 'cloud', item.modulo);
      botao(acoes, 'Manter só local', 'local-only', item.modulo);
    } else if (item.state === 'local-only') {
      botao(acoes, 'Enviar dados locais', 'local', item.modulo);
      botao(acoes, 'Manter só local', 'local-only', item.modulo);
    } else if (item.state === 'conflict') {
      botao(acoes, 'Enviar local (substituir nuvem)', 'local', item.modulo);
      botao(acoes, 'Baixar nuvem (backup local)', 'cloud', item.modulo);
      botao(acoes, 'Manter só local', 'local-only', item.modulo);
    } else if (item.state === 'photos') {
      botao(acoes, 'Manter só local', 'local-only', item.modulo);
    } else if (item.state === 'corrupt' || item.state === 'remote-invalid') {
      info.appendChild(criar('p', 'is-erro', 'Nenhuma alteração foi feita.'));
    }
    li.appendChild(info);
    li.appendChild(acoes);
    return li;
  }
  function desenhar(lista) {
    if (!list) return;
    list.textContent = '';
    lista.forEach(function (item) { list.appendChild(desenharItem(item)); });
  }
  function analisar() {
    if (!A || !A.configurado()) return Promise.reject(new Error('Supabase não está configurado.'));
    if (analisando) return Promise.resolve([]);
    analisando = true;
    definirMensagem('Lendo os estados locais e os snapshots da nuvem. Nenhum dado será substituído automaticamente.');
    return Promise.all(Object.keys(MODULOS).map(function (modulo) {
      return Promise.all([Promise.resolve(estadoLocal(modulo)), carregarRemoto(modulo)]).then(function (partes) {
        var local = partes[0], remoto = partes[1];
        if (local.erro) return { modulo: modulo, state: 'corrupt', local: local, remoto: remoto, descricao: local.erro };
        if (local.existe && !validarPayload(modulo, local.dados)) return { modulo: modulo, state: 'corrupt', local: local, remoto: remoto, descricao: 'Os dados locais não passam pela validação do módulo.' };
        var localVazio = vazio(modulo, local.dados, local.existe);
        var remotoExiste = Number(remoto.version) > 0 && remoto.payload !== null;
        if (remotoExiste && !validarPayload(modulo, remoto.payload)) return { modulo: modulo, state: 'remote-invalid', local: local, remoto: remoto, descricao: 'O snapshot remoto não passa pela validação do módulo. Não será aplicado nem substituído.' };
        var remotoVazio = !remotoExiste || vazio(modulo, remoto.payload, true);
        if (localVazio && remotoVazio) return { modulo: modulo, state: 'empty', local: local, remoto: remoto, descricao: 'Sem dados neste aparelho nem na nuvem. A primeira alteração criará o snapshot.' };
        if (localVazio && remotoExiste) return { modulo: modulo, state: 'remote-only', local: local, remoto: remoto, descricao: 'Há dados na nuvem e este aparelho não tem registros. Baixar não substituirá dados locais existentes.' };
        if (!localVazio && !remotoExiste) return { modulo: modulo, state: 'local-only', local: local, remoto: remoto, descricao: 'Há dados locais, mas ainda não existe snapshot na nuvem.' };
        if (estavel(local.dados) === estavel(remoto.payload)) return { modulo: modulo, state: 'equal', local: local, remoto: remoto, descricao: 'Os dados locais e da nuvem são iguais.' };
        return { modulo: modulo, state: 'conflict', local: local, remoto: remoto, descricao: 'Os dados locais e da nuvem são diferentes. Escolha qual versão manter.' };
      });
    })).then(function (lista) {
      lista.forEach(function (item) {
        analiseAtual[item.modulo] = {
          remoteVersion: Number(item.remoto && item.remoto.version) || 0,
          localHash: item.local && item.local.hash
        };
      });
      desenhar(lista);
      definirMensagem('Escolha por módulo. Enviar local preserva uma cópia da versão remota antes de substituí-la; baixar nuvem preserva primeiro uma cópia local. Nenhuma escolha é aplicada automaticamente.');
      return lista;
    }).catch(function (e) {
      definirMensagem('Não foi possível comparar os dados: ' + e.message, true);
      throw e;
    }).finally(function () { analisando = false; });
  }
  function guardarBackupLocal(modulo, dados) {
    if (dados === null || dados === undefined) return;
    var chave = 'melinotepad_sync_backup_' + modulo + '_' + Date.now();
    var backup = { criadoEm: new Date().toISOString(), modulo: modulo, dados: dados };
    try {
      global.localStorage.setItem(chave, JSON.stringify(backup));
      try {
        var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        var url = global.URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'melinotepad-backup-antes-da-sincronizacao-' + modulo + '-' + Date.now() + '.json';
        document.body.appendChild(link); link.click(); link.remove();
        global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
      } catch (downloadError) { /* a cópia no armazenamento local já foi preservada */ }
    } catch (e) {
      throw new Error('Não foi possível preservar o backup local neste navegador. Exporte o backup do módulo antes de substituir os dados.');
    }
  }
  function guardarBackupRemoto(modulo, dados, versao) {
    if (!dados || Number(versao) < 1) return;
    var chave = 'melinotepad_sync_backup_nuvem_' + modulo + '_' + Date.now();
    var backup = { criadoEm: new Date().toISOString(), origem: 'nuvem', modulo: modulo, versao: Number(versao), dados: dados };
    try {
      global.localStorage.setItem(chave, JSON.stringify(backup));
      try {
        var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        var url = global.URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'melinotepad-backup-nuvem-antes-da-sobrescrita-' + modulo + '-v' + versao + '.json';
        document.body.appendChild(link); link.click(); link.remove();
        global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
      } catch (downloadError) { /* a cópia no armazenamento local já foi preservada */ }
    } catch (e) {
      throw new Error('Não foi possível preservar a versão remota antes de substituí-la. Nenhuma gravação foi feita.');
    }
  }
  function escreverLocal(modulo, dados) {
    global.localStorage.setItem(MODULOS[modulo].chave, JSON.stringify(dados));
  }
  function resolver(modulo, acao) {
    if (!MODULOS[modulo] || resolvendo[modulo]) return;
    resolvendo[modulo] = true;
    definirMensagem('Processando ' + MODULOS[modulo].nome + '…');
    carregarRemoto(modulo).then(function (remoto) {
      if (!iniciado) return;
      var local = estadoLocal(modulo);
      if (local.erro) throw new Error(local.erro);
      var baseAnalise = analiseAtual[modulo];
      if (acao !== 'local-only' && baseAnalise && (
        Number(remoto.version) !== baseAnalise.remoteVersion || local.hash !== baseAnalise.localHash
      )) {
        throw new Error('Os dados locais ou da nuvem mudaram depois da comparação. Atualize a análise antes de escolher uma versão.');
      }
      if (acao === 'local-only') {
        desativar(modulo);
        setStatus('Somente local: ' + MODULOS[modulo].nome, 'pendente');
        definirMensagem(MODULOS[modulo].nome + ' permanecerá somente neste aparelho. Os outros módulos não são afetados.');
        return;
      }
      if (acao === 'ativar') {
        var v = Number(remoto.version) || 0;
        return (modulo === 'xpt' ? sincronizarFotosXpt(local.dados || remoto.payload) : Promise.resolve()).then(function () {
          marcarAtivo(modulo, v, local.hash);
          definirMensagem('Sincronização ativada para ' + MODULOS[modulo].nome + '.');
          return analisar();
        });
      }
      if (acao === 'local') {
        if (vazio(modulo, local.dados, local.existe)) throw new Error('Não há dados locais para enviar.');
        if (!validarPayload(modulo, local.dados)) throw new Error('Os dados locais não passam pela validação do módulo.');
        return (modulo === 'xpt' ? sincronizarFotosXpt(local.dados) : Promise.resolve()).then(function () {
          guardarBackupRemoto(modulo, remoto.payload, remoto.version);
          return salvarRemoto(modulo, Number(remoto.version) || 0, local.dados);
        }).then(function (resultado) {
          marcarAtivo(modulo, Number(resultado.version), local.hash);
          definirMensagem('Dados locais enviados para ' + MODULOS[modulo].nome + '.');
          return analisar();
        });
      }
      if (acao === 'cloud') {
        if (!remoto.payload || Number(remoto.version) < 1) throw new Error('Não há snapshot remoto para baixar.');
        if (!validarPayload(modulo, remoto.payload)) throw new Error('O snapshot remoto não passa pela validação do módulo.');
        if (!vazio(modulo, local.dados, local.existe)) guardarBackupLocal(modulo, local.dados);
        return (modulo === 'xpt' ? sincronizarFotosXpt(remoto.payload) : Promise.resolve()).then(function () {
          escreverLocal(modulo, remoto.payload);
          marcarAtivo(modulo, Number(remoto.version), hash(estavel(remoto.payload)));
          definirMensagem('Dados de ' + MODULOS[modulo].nome + ' baixados. Recarregando para que a interface leia o estado sincronizado.');
          global.setTimeout(function () { global.location.reload(); }, 250);
        });
      }
    }).catch(function (e) {
      setStatus('Sincronização pendente: ' + MODULOS[modulo].nome, 'erro');
      definirMensagem('Não foi concluído: ' + e.message, true);
      analisar().catch(function () {});
    }).finally(function () { resolvendo[modulo] = false; });
  }
  function sincronizarAlteracao(modulo) {
    if (!iniciado || !ativados[modulo] || timers[modulo]) return;
    timers[modulo] = global.setTimeout(function () {
      timers[modulo] = null;
      if (!iniciado || !ativados[modulo]) return;
      var local = estadoLocal(modulo);
      if (local.erro) { setStatus('Erro local: ' + MODULOS[modulo].nome, 'erro'); return; }
      var versao = meta[modulo] ? Number(meta[modulo].version) : Number(versoesRemotas[modulo] || 0);
      setStatus('Salvando na nuvem: ' + MODULOS[modulo].nome + '…', 'pendente');
      (modulo === 'xpt' ? sincronizarFotosXpt(local.dados) : Promise.resolve())
        .then(function () { return salvarRemoto(modulo, versao, local.dados); })
        .then(function (resultado) {
        marcarAtivo(modulo, Number(resultado.version), local.hash);
        definirMensagem('');
      }).catch(function (e) {
        if (/CONFLICT|conflito|40001/i.test(e.message)) {
          carregarRemoto(modulo).then(function (remoto) {
            var atual = estadoLocal(modulo);
            if (iniciado && !atual.erro && remoto.payload && estavel(remoto.payload) === estavel(atual.dados)) {
              marcarAtivo(modulo, Number(remoto.version), atual.hash);
              definirMensagem('A alteração já foi sincronizada por outra aba ou dispositivo.');
              return;
            }
            desativar(modulo);
            setStatus('Conflito: ' + MODULOS[modulo].nome, 'erro');
            definirMensagem('Outra pessoa alterou ' + MODULOS[modulo].nome + '. Seus dados locais foram preservados; abra “Sincronizar dados” e escolha como resolver.', true);
            if (panel) panel.hidden = false;
            analisar().catch(function () {});
          }).catch(function () {
            desativar(modulo);
            setStatus('Conflito: ' + MODULOS[modulo].nome, 'erro');
            definirMensagem('Não foi possível verificar a versão remota. Seus dados locais foram preservados.', true);
          });
        } else {
          setStatus('Falha de rede: ' + MODULOS[modulo].nome, 'erro');
          definirMensagem('A alteração permanece neste aparelho, mas não foi enviada. Verifique a conexão e tente novamente.', true);
        }
      });
    }, 500);
  }
  function reconciliarAtivos() {
    if (reconciliando) return Promise.resolve();
    var lista = Object.keys(MODULOS).filter(function (m) { return ativados[m] === true; });
    if (!lista.length) { setStatus('Sincronização desligada', ''); atualizarAviso(); return Promise.resolve(); }
    reconciliando = true;
    return Promise.all(lista.map(function (modulo) {
      return Promise.all([Promise.resolve(estadoLocal(modulo)), carregarRemoto(modulo)]).then(function (partes) {
        if (!iniciado) return;
        var local = partes[0], remoto = partes[1], anterior = meta[modulo];
        if (local.erro || (local.existe && !validarPayload(modulo, local.dados))) { desativar(modulo); setStatus('Erro local: ' + MODULOS[modulo].nome, 'erro'); return; }
        if (Number(remoto.version) > 0 && !validarPayload(modulo, remoto.payload)) { desativar(modulo); setStatus('Snapshot inválido: ' + MODULOS[modulo].nome, 'erro'); return; }
        var vRemoto = Number(remoto.version) || 0;
        if (!anterior) {
          if (vRemoto > 0 && vazio(modulo, local.dados, local.existe)) {
            return (modulo === 'xpt' ? sincronizarFotosXpt(remoto.payload) : Promise.resolve()).then(function () {
              escreverLocal(modulo, remoto.payload);
              guardarMeta(modulo, vRemoto, hash(estavel(remoto.payload)));
              return 'reload';
            });
          }
          if (vRemoto > 0 && estavel(local.dados) !== estavel(remoto.payload)) {
            desativar(modulo);
            setStatus('Conflito: ' + MODULOS[modulo].nome, 'erro');
            definirMensagem('Há dados locais e remotos sem histórico de sincronização. Abra “Sincronizar dados” e escolha a versão por módulo.', true);
            if (panel) panel.hidden = false;
            return;
          }
          if (vRemoto === 0 && !vazio(modulo, local.dados, local.existe)) {
            desativar(modulo);
            setStatus('Dados locais pendentes: ' + MODULOS[modulo].nome, 'pendente');
            definirMensagem('Há dados locais ainda não enviados. Abra “Sincronizar dados” para decidir se deseja enviá-los.', true);
            if (panel) panel.hidden = false;
            return;
          }
          return (modulo === 'xpt' && vRemoto > 0 ? sincronizarFotosXpt(local.dados) : Promise.resolve()).then(function () {
            guardarMeta(modulo, vRemoto, local.hash);
          });
        }
        var hashLocalAnterior = anterior.localHash;
        if (vRemoto === Number(anterior.version) && local.hash === hashLocalAnterior) {
          versoesRemotas[modulo] = vRemoto;
          return modulo === 'xpt' ? sincronizarFotosXpt(local.dados) : undefined;
        }
        if (vRemoto > Number(anterior.version) && local.hash === hashLocalAnterior && remoto.payload) {
          return (modulo === 'xpt' ? sincronizarFotosXpt(remoto.payload) : Promise.resolve()).then(function () {
            if (!vazio(modulo, local.dados, local.existe)) guardarBackupLocal(modulo, local.dados);
            escreverLocal(modulo, remoto.payload);
            guardarMeta(modulo, vRemoto, hash(estavel(remoto.payload)));
            return 'reload';
          });
        }
        if (vRemoto === Number(anterior.version) && local.hash !== hashLocalAnterior) {
          return (modulo === 'xpt' ? sincronizarFotosXpt(local.dados) : Promise.resolve())
            .then(function () { return salvarRemoto(modulo, vRemoto, local.dados); })
            .then(function (r) {
            marcarAtivo(modulo, Number(r.version), local.hash);
          }).catch(function () {
            desativar(modulo);
            setStatus('Conflito: ' + MODULOS[modulo].nome, 'erro');
            definirMensagem('Não foi possível reconciliar ' + MODULOS[modulo].nome + '. Os dados locais foram preservados; abra o painel de sincronização.', true);
            if (panel) panel.hidden = false;
          });
        }
        desativar(modulo);
        setStatus('Conflito: ' + MODULOS[modulo].nome, 'erro');
        definirMensagem('Conflito detectado em ' + MODULOS[modulo].nome + '. Nenhum dado foi sobrescrito; abra “Sincronizar dados”.', true);
        if (panel) panel.hidden = false;
      });
    })).then(function (resultados) {
      if (resultados.indexOf('reload') !== -1) global.location.reload();
      atualizarAviso();
    }).catch(function (e) {
      setStatus('Nuvem indisponível', 'erro');
      definirMensagem('Não foi possível verificar os módulos sincronizados: ' + e.message, true);
    }).finally(function () { reconciliando = false; });
  }
  function abrirPainel() {
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) analisar().catch(function () {});
  }
  function iniciar() {
    iniciado = true;
    setStatus('Verificando sincronização…', 'pendente');
    reconciliarAtivos();
  }
  function parar() {
    iniciado = false;
    Object.keys(timers).forEach(function (m) { if (timers[m]) global.clearTimeout(timers[m]); timers[m] = null; });
    if (panel) panel.hidden = true;
    setStatus('Sincronização pausada', '');
  }
  function initUI() {
    panel = document.getElementById('auth-sync-panel');
    list = document.getElementById('auth-sync-list');
    message = document.getElementById('auth-sync-message');
    status = document.getElementById('auth-sync-status');
    var toggle = document.getElementById('auth-sync-toggle');
    var refresh = document.getElementById('auth-sync-refresh');
    if (toggle) toggle.addEventListener('click', abrirPainel);
    if (refresh) refresh.addEventListener('click', function () { analisar().catch(function () {}); });
    global.document.addEventListener('melios:local-change', function (event) {
      var modulo = event.detail && event.detail.module;
      if (MODULOS[modulo]) sincronizarAlteracao(modulo);
    });
    global.addEventListener('storage', function (event) {
      if (event.key === CHAVE_META) {
        meta = lerObjeto(CHAVE_META, {});
        versoesRemotas = {};
        Object.keys(meta).forEach(function (m) { versoesRemotas[m] = Number(meta[m].version) || 0; });
        atualizarAviso();
        return;
      }
      if (event.key === CHAVE_ATIVADOS) {
        ativados = lerObjeto(CHAVE_ATIVADOS, {});
        atualizarAviso();
      }
      // Mudança de outro separador não é reenviada imediatamente: quem gravou
      // já dispara o evento local. Evita duas abas competirem pela mesma versão.
    });
    global.addEventListener('focus', function () { if (iniciado) reconciliarAtivos(); });
    global.document.addEventListener('visibilitychange', function () {
      if (iniciado && !global.document.hidden) reconciliarAtivos();
    });
  }

  NS.SupabaseSync = {
    iniciar: iniciar,
    parar: parar,
    abrir: abrirPainel,
    analisar: analisar,
    ativados: function () { return Object.keys(ativados).filter(function (m) { return ativados[m] === true; }); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
  else initUI();
})(window);
