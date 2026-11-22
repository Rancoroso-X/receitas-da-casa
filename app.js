const NOMES_CURTOS = {
  "Molhos e acompanhamentos": "Acompanhamentos",
  "Peixes e frutos do mar": "Peixes",
  "Doces e sobremesas": "Doces",
  "Sopas e caldos": "Sopas",
  "Dicas de cozinha": "Dicas",
};
// equipamento como a pessoa procura: [rótulo, pedaços de texto que contam]
const EQUIPAMENTOS = [
  ["Airfryer", ["airfryer", "air fryer"]],
  ["Forno", ["forno"]],
  ["Panela de pressão", ["pressão"]],
  ["Micro-ondas", ["micro-ondas"]],
  ["Liquidificador ou mixer", ["liquidificador", "mixer", "processador"]],
  ["Churrasqueira", ["churrasqueira", "grelha"]],
];

const estado = { receitas: [], aba: "Tudo", busca: "", tempo: "", dificuldade: "", equipamentos: new Set(), vegetariano: false, tenho: [], rolagemDaGaleria: 0 };
const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const icone = (caminho) => `<svg aria-hidden="true" viewBox="0 0 24 24">${caminho}</svg>`;
const ICONES = {
  voltar: '<path d="M15 18l-6-6 6-6"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  panela: '<path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 11h20M9 7c0-1 1-1 1-2M14 7c0-1 1-1 1-2"/>',
  seta: '<path d="M9 6l6 6-6 6"/>',
  externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function semAcento(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function formatarTempo(minutos) {
  if (!minutos) return "";
  if (minutos < 60) return `${minutos} min`;
  if (minutos >= 1440) { const dias = Math.round(minutos / 1440); return `${dias} ${dias === 1 ? "dia" : "dias"}`; }
  const horas = Math.floor(minutos / 60), resto = minutos % 60;
  return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
}
function separarTitulo(titulo) {
  const achado = titulo.match(/^(.*?)\s*\((.+)\)\s*$/);
  return achado ? [achado[1], achado[2]] : [titulo, ""];
}
function equipamentosDa(receita) {
  const texto = semAcento(receita.equipamentos.join(" "));
  return EQUIPAMENTOS.filter(([, pedacos]) => pedacos.some((p) => texto.includes(semAcento(p)))).map(([rotulo]) => rotulo);
}
function equipamentoDeDestaque(receita) {
  const achado = equipamentosDa(receita)[0];
  if (achado) return achado.split(" ou ")[0].toLowerCase();
  const primeiro = (receita.equipamentos[0] || "").split(/\s+/)[0];
  return primeiro.toLowerCase() === "garrafa" ? "garrafa PET" : primeiro;
}
function textoDeBusca(receita) {
  if (!receita._busca) {
    const ingredientes = receita.ingredientes.flatMap((g) => g.itens.map((i) => i.texto));
    receita._busca = semAcento([receita.titulo, receita.categoria, receita.proteina, ...receita.ingredientes_principais, ...ingredientes].join(" "));
  }
  return receita._busca;
}
function quantosEuTenho(receita) {
  const texto = textoDeBusca(receita);
  return estado.tenho.filter((item) => texto.includes(semAcento(item))).length;
}
function guardar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {} }
function lerGuardado(chave, padrao) { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } }

/* ---------- galeria ---------- */
function receitasFiltradas() {
  const termos = semAcento(estado.busca).split(/\s+/).filter(Boolean);
  let lista = estado.receitas.filter((r) => {
    if (estado.aba !== "Tudo" && r.categoria !== estado.aba) return false;
    if (termos.some((t) => !textoDeBusca(r).includes(t))) return false;
    if (estado.tempo === "30" && !(r.tempo_minutos && r.tempo_minutos <= 30)) return false;
    if (estado.tempo === "60" && !(r.tempo_minutos && r.tempo_minutos <= 60)) return false;
    if (estado.tempo === "mais" && !(r.tempo_minutos > 60)) return false;
    if (estado.dificuldade && r.dificuldade !== estado.dificuldade) return false;
    if (estado.vegetariano && !r.vegetariano) return false;
    const minhas = equipamentosDa(r);
    if ([...estado.equipamentos].some((e) => !minhas.includes(e))) return false;
    if (estado.tenho.length && quantosEuTenho(r) === 0) return false;
    return true;
  });
  lista = lista.sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0));
  if (estado.tenho.length) lista.sort((a, b) => quantosEuTenho(b) - quantosEuTenho(a));
  return lista;
}

function desenharAbas() {
  const contagem = new Map();
  estado.receitas.forEach((r) => contagem.set(r.categoria, (contagem.get(r.categoria) || 0) + 1));
  const DICAS = "Dicas de cozinha";
  const tipos = [...contagem.entries()].filter(([c]) => c !== DICAS).sort((a, b) => a[0].localeCompare(b[0], "pt"));
  const botao = ([categoria, total]) => {
    const curto = categoria === "Tudo" ? "Tudo" : NOMES_CURTOS[categoria] || categoria;
    const longo = categoria === "Tudo" ? "Todas as receitas" : categoria;
    return `<button type="button" class="aba" data-aba="${escapar(categoria)}" aria-pressed="${estado.aba === categoria}">
      <span><span class="nome-curto">${escapar(curto)}</span><span class="nome-longo">${escapar(longo)}</span></span><span class="anotacao-contagem">${total}</span></button>`;
  };
  const partes = [botao(["Tudo", estado.receitas.length]), '<span class="separador-de-abas" aria-hidden="true"></span>', ...tipos.map(botao)];
  if (contagem.has(DICAS)) partes.push('<span class="separador-de-abas" aria-hidden="true"></span>', botao([DICAS, contagem.get(DICAS)]));
  $("#abas").innerHTML = partes.join("");
}

function cartao(receita) {
  const [titulo] = separarTitulo(receita.titulo);
  const foto = receita.capa
    ? `<img src="${receita.capa}" alt="" loading="lazy" decoding="async">`
    : `<div class="sem-capa">${escapar(titulo)}</div>`;
  const meta = [formatarTempo(receita.tempo_minutos), receita.dificuldade, equipamentoDeDestaque(receita)].filter(Boolean).join(" · ");
  let nota = "";
  if (estado.tenho.length) {
    const n = quantosEuTenho(receita);
    nota = `<p class="nota-caneta nota-azul">usa ${n} ${n === 1 ? "coisa" : "coisas"} que você tem</p>`;
  } else if (receita.formato === "dica") nota = `<p class="nota-caneta">dica de cozinha</p>`;
  return `<li class="cartao"><a href="#/r/${receita.id}">
    <div class="foto">${foto}</div>
    ${receita.numero ? `<span class="numero-circulado" aria-label="Receita ${receita.numero}">${receita.numero}</span>` : ""}
    <h2>${escapar(titulo)}</h2>
    ${meta ? `<p class="meta">${escapar(meta)}</p>` : ""}${nota}
  </a></li>`;
}

function desenharGaleria() {
  const lista = receitasFiltradas();
  $("#grade").innerHTML = lista.map(cartao).join("");
  $("#vazio").hidden = lista.length > 0;
  $(".vazio-titulo").textContent = estado.busca.trim() ? `Nada com "${estado.busca.trim()}".` : "Nada por aqui com esse filtro.";
  const receitas = lista.filter((r) => r.formato !== "dica").length, dicas = lista.length - receitas;
  const partes = [`<strong>${receitas} ${receitas === 1 ? "receita" : "receitas"}</strong>`];
  if (dicas) partes.push(`${dicas} ${dicas === 1 ? "dica" : "dicas"}`);
  $("#contagem").innerHTML = partes.join(" · ");
  desenharFiltrosEmUso();
}

function desenharFiltrosEmUso() {
  const ativos = [];
  if (estado.tempo) ativos.push(["tempo", { 30: "Até 30 min", 60: "Até 1 hora", mais: "Mais de 1 hora" }[estado.tempo]]);
  if (estado.dificuldade) ativos.push(["dificuldade", estado.dificuldade[0].toUpperCase() + estado.dificuldade.slice(1)]);
  estado.equipamentos.forEach((e) => ativos.push([`equipamento:${e}`, e]));
  if (estado.vegetariano) ativos.push(["vegetariano", "Vegetarianas"]);
  estado.tenho.forEach((t) => ativos.push([`tenho:${t}`, `Tenho ${t}`]));
  $("#filtros-ativos").textContent = ativos.length ? ativos.length : "";
  $("#filtros-em-uso").innerHTML = ativos.map(([chave, rotulo]) =>
    `<button type="button" class="etiqueta-filtro" data-tirar="${escapar(chave)}" aria-label="Tirar filtro ${escapar(rotulo)}">${escapar(rotulo)}${icone(ICONES.fechar)}</button>`).join("");
}

function tirarFiltro(chave) {
  if (chave === "tempo") estado.tempo = "";
  else if (chave === "dificuldade") estado.dificuldade = "";
  else if (chave === "vegetariano") estado.vegetariano = false;
  else if (chave.startsWith("equipamento:")) estado.equipamentos.delete(chave.slice(12));
  else if (chave.startsWith("tenho:")) estado.tenho = estado.tenho.filter((t) => t !== chave.slice(6));
  desenharGaleria();
}

/* ---------- painel de filtros ---------- */
function prepararPainel() {
  const painel = $("#painel-filtros"), form = $("#form-filtros");
  $("#opcoes-equipamento").innerHTML = EQUIPAMENTOS.map(([rotulo]) =>
    `<label><input type="checkbox" name="equipamento" value="${rotulo}"><span>${rotulo}</span></label>`).join("");

  const desenharTenho = () => {
    $("#tenho-lista").innerHTML = estado.tenho.map((t) =>
      `<button type="button" class="etiqueta-filtro" data-tenho="${escapar(t)}" aria-label="Tirar ${escapar(t)}">${escapar(t)}${icone(ICONES.fechar)}</button>`).join("");
  };
  const lerFormulario = () => {
    const dados = new FormData(form);
    estado.tempo = dados.get("tempo") || "";
    estado.dificuldade = dados.get("dificuldade") || "";
    estado.equipamentos = new Set(dados.getAll("equipamento"));
    estado.vegetariano = dados.get("vegetariano") === "on";
    const quantas = receitasFiltradas().length;
    $("#ver-resultados").textContent = quantas ? `Ver ${quantas} ${quantas === 1 ? "resultado" : "resultados"}` : "Nada com esses filtros";
  };
  const adicionarTenho = () => {
    const campo = $("#tenho-campo");
    campo.value.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => { if (!estado.tenho.includes(t)) estado.tenho.push(t); });
    campo.value = "";
    desenharTenho(); lerFormulario();
  };

  let antesDeAbrir = null;
  $("#abrir-filtros").addEventListener("click", () => {
    antesDeAbrir = { tempo: estado.tempo, dificuldade: estado.dificuldade, equipamentos: new Set(estado.equipamentos), vegetariano: estado.vegetariano, tenho: [...estado.tenho] };
    form.elements.tempo.value = estado.tempo;
    form.elements.dificuldade.value = estado.dificuldade;
    form.querySelectorAll('[name="equipamento"]').forEach((c) => { c.checked = estado.equipamentos.has(c.value); });
    form.elements.vegetariano.checked = estado.vegetariano;
    desenharTenho(); lerFormulario();
    painel.showModal();
  });
  form.addEventListener("change", lerFormulario);
  $("#tenho-campo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); adicionarTenho(); } });
  $("#tenho-campo").addEventListener("blur", adicionarTenho);
  $("#tenho-lista").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-tenho]");
    if (!botao) return;
    estado.tenho = estado.tenho.filter((t) => t !== botao.dataset.tenho);
    desenharTenho(); lerFormulario();
  });
  $("#limpar-filtros").addEventListener("click", () => {
    form.reset(); estado.tenho = []; desenharTenho(); lerFormulario();
  });
  painel.addEventListener("close", () => {
    if (painel.returnValue !== "aplicar" && antesDeAbrir) Object.assign(estado, antesDeAbrir);
    painel.returnValue = "";
    desenharGaleria();
  });
  painel.addEventListener("click", (e) => { if (e.target === painel) painel.close(); });
}

/* ---------- receita ---------- */
function fotoDeCadaPasso(receita) {
  const n = receita.preparo.length, fotos = receita.fotos_dos_passos, mapa = new Map();
  fotos.forEach((foto, j) => {
    const indice = Math.min(n - 1, Math.round(((j + 0.5) * n) / fotos.length - 0.5));
    if (!mapa.has(indice)) mapa.set(indice, foto);
  });
  return mapa;
}

function desenharReceita(receita) {
  const [titulo, subtitulo] = separarTitulo(receita.titulo);
  const feitos = lerGuardado(`feitos:${receita.id}`, { ingredientes: [], passos: [] });
  const fotos = fotoDeCadaPasso(receita);
  const ficha = [
    ["Tempo", formatarTempo(receita.tempo_minutos)],
    ["Nível", receita.dificuldade],
    ["Rende", receita.rendimento],
    ["Tipo", NOMES_CURTOS[receita.categoria] || receita.categoria],
  ].filter(([, valor]) => valor);
  const itensDosIngredientes = receita.ingredientes.flatMap((g) => g.itens);
  const todosAConfirmar = itensDosIngredientes.length > 0 && itensDosIngredientes.every((i) => i.a_confirmar);
  const precisaDe = receita.equipamentos.join(", ");
  let contador = 0;
  const ingredientes = receita.ingredientes.map((grupo) => `
    ${grupo.nome ? `<h3>${escapar(grupo.nome)}</h3>` : ""}
    <ul class="ingredientes">${grupo.itens.map((item) => {
      const id = contador++;
      return `<li class="ingrediente"><label>
        <input type="checkbox" data-ingrediente="${id}" ${feitos.ingredientes.includes(id) ? "checked" : ""}>
        <span class="texto-ingrediente">${escapar(item.texto)}${item.a_confirmar && !todosAConfirmar ? '<span class="a-confirmar">quantidade a confirmar</span>' : ""}</span>
      </label></li>`;
    }).join("")}</ul>`).join("");
  const passos = receita.preparo.map((texto, i) => `
    <li class="passo ${feitos.passos.includes(i) ? "feito" : ""}" data-passo="${i}">
      <button type="button" class="marcar-botao" aria-pressed="${feitos.passos.includes(i)}" title="Marcar passo como feito">
        <span class="passo-numero" aria-hidden="true">${i + 1}</span>
        <span class="passo-texto"><span class="sr">Passo ${i + 1}: </span>${escapar(texto)}</span>
      </button>
      ${fotos.has(i) ? `<div class="passo-foto"><img src="${fotos.get(i)}" alt="Foto do vídeo neste passo" loading="lazy"></div>` : ""}
    </li>`).join("");
  const nomeDoBotao = receita.formato === "dica" ? "Seguir passo a passo" : "Começar a cozinhar";
  const credito = receita.link
    ? `Do vídeo de ${escapar(receita.autor_do_video || "autor desconhecido")}. <a href="${escapar(receita.link)}" target="_blank" rel="noopener">Ver o vídeo original ${icone(ICONES.externo)}</a>`
    : escapar(receita.autor_do_video ? `Receita de ${receita.autor_do_video}.` : "");

  $("#tela-receita").innerHTML = `
    <div class="receita-topo">
      <a class="voltar" href="#/">${icone(ICONES.voltar)}Todas as receitas</a>
    </div>
    <div class="receita-lado">
      <div class="receita-capa ${receita.capa ? "" : "sem-foto"}">
        <div class="foto">${receita.capa ? `<img src="${receita.capa}" alt="${escapar(titulo)} pronto">` : `<div class="sem-capa">${escapar(titulo)}</div>`}</div>
        ${receita.numero ? `<span class="numero-circulado" aria-label="Receita ${receita.numero}">${receita.numero}</span>` : ""}
      </div>
      <dl class="ficha">
        ${ficha.map(([rotulo, valor], i) => `<div class="${ficha.length % 2 && i === ficha.length - 1 ? "sozinho" : ""}"><dt>${rotulo}</dt><dd>${escapar(valor)}</dd></div>`).join("")}
        ${precisaDe ? `<div class="longo"><dt>Precisa de</dt><dd>${escapar(precisaDe)}</dd></div>` : ""}
      </dl>
      ${receita.preparo.length ? `<div class="acao-cozinhar" id="acao-cozinhar"><a class="botao-principal" href="#/r/${receita.id}/cozinhar">${icone(ICONES.panela)}${nomeDoBotao}</a></div>` : ""}
    </div>
    <div class="receita-texto">
      <header class="receita-cabeca">
        ${!receita.capa && receita.numero ? `<span class="numero-circulado numero-inline" aria-label="Receita ${receita.numero}">${receita.numero}</span>` : ""}
        <h1>${escapar(titulo)}</h1>
        ${subtitulo ? `<p class="subtitulo">${escapar(subtitulo)}</p>` : ""}
        ${receita.formato === "dica" ? '<p class="tipo-da-receita">dica de cozinha</p>' : ""}
        ${receita.resumo ? `<p class="resumo">${escapar(receita.resumo)}</p>` : ""}
        ${credito ? `<p class="credito">${credito}</p>` : ""}
      </header>
      ${ingredientes ? `<section class="bloco"><h2>${receita.formato === "dica" ? "O que vai usar" : "Ingredientes"}</h2>${todosAConfirmar ? '<p class="aviso-quantidades">o vídeo não diz as quantidades: vá no olho e prove</p>' : ""}${ingredientes}</section>` : ""}
      ${passos ? `<section class="bloco"><h2>${receita.formato === "dica" ? "Como fazer" : "Modo de preparo"}</h2><ol class="passos">${passos}</ol></section>` : ""}
      ${receita.dicas.length ? `<section class="bloco"><h2>Dicas do Chef</h2><ul class="dicas">${receita.dicas.map((d) => `<li>${escapar(d)}</li>`).join("")}</ul></section>` : ""}
      <div class="bloco">
        ${receita.diferencas.length ? `<details class="notas-da-fonte"><summary>${icone(ICONES.seta)}Notas sobre o vídeo</summary><ul>${receita.diferencas.map((d) => `<li>${escapar(d)}</li>`).join("")}</ul></details>` : ""}
      </div>
      ${receita.link ? '<p class="rodape-receita">Receita escrita a partir do vídeo, com os passos que ele pulou explicados. Confira as quantidades marcadas como a confirmar.</p>' : '<p class="rodape-receita"></p>'}
    </div>
    ${receita.preparo.length ? `<div class="barra-cozinhar" id="barra-cozinhar"><a class="botao-principal" href="#/r/${receita.id}/cozinhar">${icone(ICONES.panela)}${nomeDoBotao}</a></div>` : ""}`;

  estado.receitaAberta = receita;
  atualizarBarraCozinhar();
}

function atualizarBarraCozinhar() {
  const acao = $("#acao-cozinhar"), barra = $("#barra-cozinhar");
  if (!acao || !barra) return;
  const caixa = acao.getBoundingClientRect();
  barra.classList.toggle("visivel", caixa.bottom < 0 || caixa.top > innerHeight - 70);
}
function marcarNaReceita(evento) {
  const receita = estado.receitaAberta;
  if (!receita) return;
  const atual = lerGuardado(`feitos:${receita.id}`, { ingredientes: [], passos: [] });
  const caixa = evento.target.closest("[data-ingrediente]");
  if (evento.type === "change" && caixa) {
    const id = Number(caixa.dataset.ingrediente);
    atual.ingredientes = caixa.checked ? [...new Set([...atual.ingredientes, id])] : atual.ingredientes.filter((x) => x !== id);
  }
  const passo = evento.target.closest("[data-passo]");
  if (evento.type === "click" && passo && evento.target.closest(".marcar-botao")) {
    passo.classList.toggle("feito");
    passo.querySelector(".marcar-botao").setAttribute("aria-pressed", passo.classList.contains("feito"));
    const i = Number(passo.dataset.passo);
    atual.passos = passo.classList.contains("feito") ? [...new Set([...atual.passos, i])] : atual.passos.filter((x) => x !== i);
  }
  guardar(`feitos:${receita.id}`, atual);
}

/* ---------- modo cozinhar ---------- */
let travaDaTela = null;
async function manterTelaAcesa(ligar) {
  try {
    if (ligar && "wakeLock" in navigator) travaDaTela = await navigator.wakeLock.request("screen");
    else if (!ligar && travaDaTela) { await travaDaTela.release(); travaDaTela = null; }
  } catch { travaDaTela = null; }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#cozinhar").hidden) manterTelaAcesa(true); });

function abrirCozinhar(receita, passoInicial = 0) {
  const caixa = $("#cozinhar"), fotos = fotoDeCadaPasso(receita), total = receita.preparo.length;
  const [titulo] = separarTitulo(receita.titulo);
  let atual = Math.min(passoInicial, total);
  const listaIngredientes = receita.ingredientes.flatMap((g) => g.itens).map((i) => `<li>${escapar(i.texto)}</li>`).join("");

  const desenhar = () => {
    const fim = atual >= total;
    const foto = fim ? receita.capa : fotos.get(atual);
    caixa.innerHTML = `
      <div class="cozinhar-topo">
        <h2 id="cozinhar-titulo">${escapar(titulo)}</h2>
        <button type="button" class="botao-icone" data-acao="sair" aria-label="Sair do modo cozinhar">${icone(ICONES.fechar)}</button>
      </div>
      <div class="cozinhar-progresso" aria-hidden="true"><span style="width:${(Math.min(atual + 1, total) / total) * 100}%"></span></div>
      <div class="cozinhar-palco" aria-live="polite">
        ${foto ? `<div class="cozinhar-foto"><img src="${foto}" alt=""></div>` : ""}
        <div class="cozinhar-coluna">
        ${fim ? `
          <div class="cozinhar-fim">
            <p class="titulo-fim">Pronto. Bom apetite!</p>
            <p>Você passou pelos ${total} passos.</p>
          </div>` : `
          <p class="cozinhar-contador"><span>passo</span> <b>${atual + 1}</b> <span>de <i class="cozinhar-total">${total}</i></span></p>
          <p class="cozinhar-passo ${receita.preparo[atual].length <= 90 ? "passo-curto" : receita.preparo[atual].length > 170 ? "passo-longo" : ""}">${escapar(receita.preparo[atual])}</p>
          ${atual + 1 < total ? `<p class="cozinhar-proximo"><b>depois</b>${escapar(receita.preparo[atual + 1])}</p>` : `<p class="cozinhar-proximo"><b>depois</b>servir</p>`}`}
        </div>
      </div>
      ${listaIngredientes ? `<details class="cozinhar-ingredientes"><summary>${icone(ICONES.seta)}<span class="quando-fechado">Ver ingredientes</span><span class="quando-aberto">Esconder ingredientes</span></summary><ul>${listaIngredientes}</ul></details>` : ""}
      <div class="cozinhar-rodape">
        <button type="button" class="botao-secundario" data-acao="voltar" ${atual === 0 ? "disabled" : ""}>${icone(ICONES.voltar)}Voltar</button>
        ${fim ? `<button type="button" class="botao-principal" data-acao="sair">Fechar</button>`
              : `<button type="button" class="botao-principal" data-acao="avancar">${atual + 1 === total ? "Terminei" : "Próximo passo"}${icone(ICONES.seta)}</button>`}
      </div>`;
    caixa.querySelector('.cozinhar-rodape .botao-principal')?.focus({ preventScroll: true, focusVisible: false });
  };
  const ir = (delta) => { atual = Math.max(0, Math.min(total, atual + delta)); desenhar(); };
  caixa.onclick = (e) => {
    const acao = e.target.closest("[data-acao]")?.dataset.acao;
    if (acao === "avancar") ir(1);
    if (acao === "voltar") ir(-1);
    if (acao === "sair") location.hash = `#/r/${receita.id}`;
  };
  caixa.onkeydown = (e) => {
    if (e.key === "ArrowRight") ir(1);
    if (e.key === "ArrowLeft") ir(-1);
    if (e.key === "Escape") location.hash = `#/r/${receita.id}`;
  };
  let inicioX = null;
  caixa.ontouchstart = (e) => { inicioX = e.touches[0].clientX; };
  caixa.ontouchend = (e) => {
    if (inicioX === null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    if (Math.abs(dx) > 70) ir(dx < 0 ? 1 : -1);
    inicioX = null;
  };
  caixa.hidden = false;
  document.body.style.overflow = "hidden";
  desenhar();
  manterTelaAcesa(true);
}
function fecharCozinhar() {
  const caixa = $("#cozinhar");
  if (caixa.hidden) return;
  caixa.hidden = true;
  caixa.innerHTML = "";
  document.body.style.overflow = "";
  manterTelaAcesa(false);
}

/* ---------- rotas ---------- */
function rota() {
  const [, tipo, id, extra] = location.hash.split("/");
  const receita = tipo === "r" && estado.receitas.find((r) => r.id === id);
  const capa = $("#capa"), galeria = $("#tela-galeria"), telaReceita = $("#tela-receita");
  if (receita) {
    if (!galeria.hidden) estado.rolagemDaGaleria = scrollY;
    if (extra === "cozinhar") {
      if (telaReceita.dataset.id !== receita.id) { desenharReceita(receita); telaReceita.dataset.id = receita.id; }
      abrirCozinhar(receita);
    } else {
      fecharCozinhar();
      if (telaReceita.dataset.id !== receita.id || telaReceita.hidden) {
        desenharReceita(receita); telaReceita.dataset.id = receita.id; scrollTo(0, 0);
      }
    }
    galeria.hidden = true; telaReceita.hidden = false; capa.classList.add("compacta");
    document.title = `${separarTitulo(receita.titulo)[0]} · Receitas da Casa`;
    atualizarBarraCozinhar();
  } else {
    fecharCozinhar();
    const vinhaDaReceita = galeria.hidden;
    galeria.hidden = false; telaReceita.hidden = true; telaReceita.dataset.id = ""; capa.classList.remove("compacta");
    document.title = "Receitas da Casa";
    if (vinhaDaReceita) requestAnimationFrame(() => scrollTo(0, estado.rolagemDaGaleria));
  }
}

/* ---------- início ---------- */
async function iniciar() {
  try {
    const resposta = await fetch("dados/receitas.json", { cache: "no-cache" });
    estado.receitas = (await resposta.json()).receitas;
  } catch {
    $("#grade").innerHTML = "";
    $("#vazio").hidden = false;
    $(".vazio-titulo").textContent = "Não consegui carregar as receitas.";
    $("#vazio p:nth-child(2)").textContent = "Confira a internet e recarregue a página.";
    $("#limpar-tudo").hidden = true;
    return;
  }
  const receitas = estado.receitas.filter((r) => r.formato !== "dica").length;
  $("#subtitulo").innerHTML = `<b>${receitas}</b> receitas tiradas de vídeos que a gente salvou`;
  desenharAbas();
  desenharGaleria();
  prepararPainel();

  $("#abas").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-aba]");
    if (!botao) return;
    estado.aba = botao.dataset.aba;
    desenharAbas(); desenharGaleria();
    if (location.hash.startsWith("#/r/")) location.hash = "#/";
  });
  let espera;
  $("#campo-busca").addEventListener("input", (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      estado.busca = e.target.value;
      if (location.hash.startsWith("#/r/")) location.hash = "#/";
      desenharGaleria();
    }, 120);
  });
  $("#filtros-em-uso").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-tirar]");
    if (botao) tirarFiltro(botao.dataset.tirar);
  });
  $("#limpar-tudo").addEventListener("click", () => {
    Object.assign(estado, { aba: "Tudo", busca: "", tempo: "", dificuldade: "", equipamentos: new Set(), vegetariano: false, tenho: [] });
    $("#campo-busca").value = "";
    desenharAbas(); desenharGaleria();
  });
  const telaLarga = matchMedia("(min-width: 900px)");
  const posicionarAbas = () => (telaLarga.matches ? $("#capa").append($("#abas")) : $("#tela-galeria").prepend($("#abas")));
  posicionarAbas();
  telaLarga.addEventListener("change", posicionarAbas);
  $("#tela-receita").addEventListener("change", marcarNaReceita);
  $("#tela-receita").addEventListener("click", marcarNaReceita);
  addEventListener("scroll", atualizarBarraCozinhar, { passive: true });
  addEventListener("resize", atualizarBarraCozinhar);
  addEventListener("hashchange", rota);
  rota();
}
iniciar();
