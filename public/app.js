window.addEventListener('load', function() {
  const firebaseConfig = {
    apiKey: "AIzaSyDuuiJ4YrAOTmlr7-zI1vOogdjfIPZwqtw",
    authDomain: "tetoeobra-casa-borogodo.firebaseapp.com",
    projectId: "tetoeobra-casa-borogodo",
    storageBucket: "tetoeobra-casa-borogodo.firebasestorage.app",
    messagingSenderId: "916640072730",
    appId: "1:916640072730:web:7e2a9c38281216c1513da3"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const col = db.collection("lancamentos");
  const cfgDoc = db.collection("config").doc("caixa");

  let lancamentos = [];
  let imgBase64 = null;
  let unsubscribe = null;

  // ── TELAS ──
  function mostrar(id) {
    ['authLoading','loginScreen','appScreen'].forEach(i => {
      document.getElementById(i).classList.remove('visivel');
    });
    document.getElementById(id).classList.add('visivel');
  }

  mostrar('authLoading');

  auth.onAuthStateChanged(user => {
    if (user) {
      mostrar('appScreen');
      document.getElementById('userInfo').textContent = user.email;
      iniciarApp();
    } else {
      mostrar('loginScreen');
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    }
  });

  window.fazerLogin = async function() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');
    errEl.style.display = 'none';
    if (!email || !senha) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.style.display = ''; return; }
    btn.disabled = true; btn.textContent = 'Entrando...';
    try {
      await auth.signInWithEmailAndPassword(email, senha);
    } catch(e) {
      const msgs = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.'
      };
      errEl.textContent = msgs[e.code] || 'Erro ao entrar: ' + e.code;
      errEl.style.display = '';
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  };

  document.getElementById('loginSenha').addEventListener('keydown', e => { if (e.key === 'Enter') window.fazerLogin(); });
  document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginSenha').focus(); });

  window.fazerLogout = async function() { await auth.signOut(); };

  function iniciarApp() {
    const overlay = document.getElementById('loadingOverlay');
    const overlayMsg = overlay.querySelector('p');
    overlayMsg.textContent = 'Carregando dados...';
    overlay.style.display = 'flex';

    cfgDoc.get().then(d => {
      if (d.exists) document.getElementById('valorInicial').value = d.data().valorInicial || '';
    }).catch(err => console.error('Erro config:', err));

    const timeoutId = setTimeout(() => {
      overlay.style.display = 'flex';
      overlay.style.padding = '2rem';
      overlay.style.textAlign = 'center';
      overlay.innerHTML = `
        <i class="ti ti-wifi-off" style="font-size:40px;color:var(--text-warning)"></i>
        <p style="font-size:15px;font-weight:500;color:var(--text-primary)">Tempo esgotado</p>
        <p style="font-size:13px;color:var(--text-secondary);max-width:320px">O banco de dados não respondeu. Verifique as regras do Firestore.</p>
        <button onclick="window.location.reload()" style="margin-top:8px;padding:8px 20px;background:var(--fill-accent);color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Tentar novamente</button>
      `;
    }, 10000);

    unsubscribe = col.orderBy("criadoEm", "asc").onSnapshot(snap => {
      clearTimeout(timeoutId);
      lancamentos = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      renderTabela();
      setSync(true);
      overlay.style.display = 'none';
    }, err => {
      clearTimeout(timeoutId);
      console.error('Erro Firestore:', err);
      setSync(false);
      overlay.style.display = 'flex';
      overlay.style.padding = '2rem';
      overlay.style.textAlign = 'center';
      overlay.innerHTML = `
        <i class="ti ti-alert-circle" style="font-size:40px;color:var(--text-danger)"></i>
        <p style="font-size:15px;font-weight:500;color:var(--text-primary)">Erro ao carregar dados</p>
        <p style="font-size:13px;color:var(--text-secondary);max-width:320px">Código: <strong>${err.code || err.message}</strong></p>
        <button onclick="window.location.reload()" style="margin-top:8px;padding:8px 20px;background:var(--fill-accent);color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">Tentar novamente</button>
      `;
    });
  }

  // ── HELPERS ──
  function fmt(v) {
    return 'R$ ' + parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtData(d) {
    if (!d) return '';
    if (d.includes('-')) { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }
    return d;
  }
  function badgePag(p) {
    const cls = { 'PIX': 'badge-pix', 'Crédito': 'badge-credito', 'Débito': 'badge-debito', 'Dinheiro': 'badge-dinheiro' }[p] || 'badge-outro';
    return `<span class="badge ${cls}">${p}</span>`;
  }
  function origemCaixa(o) { return o && o.toLowerCase().includes('caixa'); }
  function setSync(ok) {
    document.getElementById('syncStatus').innerHTML = ok
      ? '<i class="ti ti-cloud-check"></i> Sincronizado'
      : '<i class="ti ti-cloud-off"></i> Sem conexão';
  }

  function calcTotais() {
    const ini = parseFloat(document.getElementById('valorInicial')?.value || 0);
    let tc = 0, tf = 0;
    lancamentos.forEach(l => { const v = parseFloat(l.valor || 0); origemCaixa(l.origem) ? tc += v : tf += v; });
    return { ini, totalCaixa: tc, totalFora: tf, total: tc + tf, saldo: ini - tc };
  }

  function renderTabela() {
    const tbody = document.getElementById('tbody');
    const tabela = document.getElementById('tabela');
    const emptyMsg = document.getElementById('emptyMsg');
    if (lancamentos.length === 0) { tabela.style.display = 'none'; emptyMsg.style.display = ''; }
    else {
      tabela.style.display = ''; emptyMsg.style.display = 'none';
      tbody.innerHTML = lancamentos.map(l => `
        <tr>
          <td>${fmtData(l.data)}</td>
          <td>${l.descricao}</td>
          <td>${badgePag(l.pagamento)}</td>
          <td style="color:var(--text-secondary);font-size:12px">${l.origem || '—'}</td>
          <td style="font-weight:500">${fmt(l.valor)}</td>
          <td style="font-size:12px;color:var(--text-secondary)">${l.cupom || '—'}</td>
          <td><button class="btn btn-danger btn-sm" onclick="window._remover('${l._id}')"><i class="ti ti-trash"></i></button></td>
        </tr>`).join('');
    }
    atualizarCards();
  }

  function atualizarCards() {
    const t = calcTotais();
    document.getElementById('cardInicial').textContent = fmt(t.ini);
    document.getElementById('cardTotal').textContent = fmt(t.total);
    document.getElementById('cardCaixa').textContent = fmt(t.totalCaixa);
    document.getElementById('cardFora').textContent = fmt(t.totalFora);
    document.getElementById('cardSaldo').textContent = fmt(t.saldo);
    document.getElementById('cardQtd').textContent = lancamentos.length;
  }

  function atualizarResumo() {
    const t = calcTotais();
    document.getElementById('rInicial').textContent = fmt(t.ini);
    document.getElementById('rUtilizado').textContent = fmt(t.totalCaixa);
    document.getElementById('rSaldo').textContent = fmt(t.saldo);
    document.getElementById('rFora').textContent = fmt(t.totalFora);
    document.getElementById('rTotal').textContent = fmt(t.total);
    const pag = {};
    lancamentos.forEach(l => { pag[l.pagamento] = (pag[l.pagamento] || 0) + parseFloat(l.valor || 0); });
    const el = document.getElementById('porPagamento');
    if (!Object.keys(pag).length) {
      el.innerHTML = '<div class="empty" style="padding:1rem"><i class="ti ti-info-circle"></i> Nenhum dado ainda.</div>';
    } else {
      el.innerHTML = Object.entries(pag).map(([k, v]) => `<div class="resumo-row"><span>${badgePag(k)}</span><span>${fmt(v)}</span></div>`).join('');
    }
    atualizarCards();
  }

  window.showTab = function(name) {
    ['lancamentos', 'novo', 'resumo'].forEach(t => { document.getElementById('tab-' + t).style.display = t === name ? '' : 'none'; });
    document.querySelectorAll('.tab').forEach((btn, i) => { btn.classList.toggle('active', ['lancamentos', 'novo', 'resumo'][i] === name); });
    if (name === 'resumo') atualizarResumo();
  };

  window.salvarInicial = async function() {
    const v = parseFloat(document.getElementById('valorInicial').value || 0);
    await cfgDoc.set({ valorInicial: v });
    atualizarCards();
  };

  window._remover = async function(id) {
    if (!confirm('Remover este lançamento?')) return;
    await col.doc(id).delete();
  };

  window.limparTudo = async function() {
    if (!confirm('Tem certeza? Isso vai apagar TODOS os lançamentos.')) return;
    const snap = await col.get();
    for (const d of snap.docs) await d.ref.delete();
  };

  window.cancelar = function() {
    document.getElementById('previewBox').style.display = 'none';
    document.getElementById('fileInput').value = '';
    document.getElementById('statusBox').style.display = 'none';
    imgBase64 = null;
  };

  function setStatus(msg, tipo) {
    const el = document.getElementById('statusBox');
    el.textContent = msg; el.className = 'status ' + (tipo || ''); el.style.display = msg ? '' : 'none';
  }

  window.onFileSelected = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const dataUrl = ev.target.result;
      imgBase64 = dataUrl.split(',')[1];
      const mtype = file.type;
      document.getElementById('previewImg').src = dataUrl;
      document.getElementById('previewImg').style.display = '';
      document.getElementById('previewBox').style.display = '';
      setStatus('Analisando imagem com IA...', 'loading');
      analisarComIA(imgBase64, mtype);
    };
    reader.readAsDataURL(file);
  };

  async function analisarComIA(b64, mtype) {
    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mediaType: mtype })
      });
      if (!resp.ok) throw new Error('Erro ' + resp.status);
      const parsed = await resp.json();
      if (parsed.data) document.getElementById('fData').value = parsed.data;
      if (parsed.descricao) document.getElementById('fDesc').value = parsed.descricao;
      if (parsed.pagamento) document.getElementById('fPag').value = parsed.pagamento;
      if (parsed.origem) document.getElementById('fOrigem').value = parsed.origem;
      if (parsed.valor) document.getElementById('fValor').value = parsed.valor;
      if (parsed.cupom) document.getElementById('fCupom').value = parsed.cupom;
      setStatus('✓ Dados extraídos — revise e confirme.', 'success');
    } catch (err) {
      setStatus('Não foi possível extrair automaticamente. Preencha manualmente.', 'error');
      console.error(err);
    }
  }

  window.adicionarLancamento = async function() {
    const desc = document.getElementById('fDesc').value.trim();
    const valor = document.getElementById('fValor').value;
    if (!desc || !valor) { alert('Preencha ao menos a descrição e o valor.'); return; }
    setStatus('Salvando...', 'loading');
    try {
      await col.add({
        data: document.getElementById('fData').value,
        descricao: desc,
        pagamento: document.getElementById('fPag').value,
        origem: document.getElementById('fOrigem').value.trim(),
        valor: parseFloat(valor),
        cupom: document.getElementById('fCupom').value.trim(),
        criadoEm: Date.now()
      });
      window.cancelar(); window.showTab('lancamentos');
    } catch (e) { setStatus('Erro ao salvar. Verifique a conexão.', 'error'); }
  };

  window.adicionarManual = async function() {
    const desc = document.getElementById('mDesc').value.trim();
    const valor = document.getElementById('mValor').value;
    if (!desc || !valor) { alert('Preencha ao menos a descrição e o valor.'); return; }
    try {
      await col.add({
        data: document.getElementById('mData').value,
        descricao: desc,
        pagamento: document.getElementById('mPag').value,
        origem: document.getElementById('mOrigem').value.trim(),
        valor: parseFloat(valor),
        cupom: document.getElementById('mCupom').value.trim(),
        criadoEm: Date.now()
      });
      ['mData', 'mDesc', 'mValor', 'mOrigem', 'mCupom'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('mPag').value = 'PIX';
      window.showTab('lancamentos');
    } catch (e) { alert('Erro ao salvar. Verifique a conexão.'); }
  };

  window.exportarCSV = function() {
    const cols = ['Data', 'Descrição', 'Pagamento', 'Origem', 'Valor', 'Cupom / Venda'];
    const rows = lancamentos.map(l => [
      fmtData(l.data), l.descricao, l.pagamento, l.origem,
      String(l.valor).replace('.', ','), l.cupom
    ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(';'));
    const csv = [cols.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'detalhamento_caixa.csv'; a.click();
  };
}); // fim window.onload
