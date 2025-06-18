import {Grafo} from './grafo.js';

// --- VARIÁVEIS GLOBAIS E INICIALIZAÇÃO DO D3.JS ---
let origemClicada = null;
let destinoClicada = null;
let circulosSelecionados = [];
let xScale, yScale; // SCALES SERÃO INICIALIZADAS EM desenharGrafo()

const svg = d3.select("svg");
const tabela = document.querySelector("#tabela-caminho tbody");
let grafo = new Grafo();
let nodes = [], links = [];
let contadorId = 1;

const zoomGroup = svg.append("g");
const nodeTooltip = d3.select("#node-tooltip"); // NOVO: SELECIONA O ELEMENTO DO TOOLTIP

// --- VARIÁVEIS DE ESTADO PARA ADIÇÃO DE ARESTAS (PREPARAÇÃO PARA O PONTO 3) ---
let isDrawingEdge = false;
let startNode = null;
let currentLine = null; // LINHA TEMPORÁRIA PARA A ARESTA ENQUANTO É DESENHADA
let edgeType = 'undirected'; // TIPO DE ARESTA PADRÃO: 'undirected' OU 'directed'

// --- CONFIGURAÇÕES DE ESTILO (SLIDERS) ---
let tamanhoVertice = 3;
let larguraAresta = 1.5;
let tamanhoSeta = 6;
let distanciaSeta = 1;

document.getElementById("slider-node-size").addEventListener("input", e => {
    tamanhoVertice = +e.target.value;
    atualizarVertices();
});

document.getElementById("slider-link-width").addEventListener("input", e => {
    larguraAresta = +e.target.value;
    atualizarArestas();
});

document.getElementById("slider-arrow-size").addEventListener("input", e => {
    tamanhoSeta = +e.target.value;
    atualizarSetas();
});

document.getElementById("slider-arrow-gap").addEventListener("input", e => {
    distanciaSeta = +e.target.value;
    atualizarDistanciaSetas();
});

// --- DEFINIÇÕES DE MARCADORES (SETA) ---
svg.append("defs").append("marker")
    .attr("id", "arrowhead-green")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 0)
    .attr("refY", 0)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "limegreen");

svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 0)
    .attr("refY", 0)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#868baf");

// --- ESTADO DA APLICAÇÃO ---
let modoAtual = "selecionar"; // MODO PADRÃO
let itemSelecionado = null;

// --- FUNÇÕES DE INTERFACE DO USUÁRIO (UI) ---

/**
 * CONFIGURA OS BOTÕES DA BARRA DE FERRAMENTAS PARA ALTERNAR O MODO ATUAL.
 */
function configurarToolbar() {
    // SELECIONA TODOS OS BOTÕES DE FERRAMENTA, EXCETO AS OPÇÕES DO DROPDOWN DE ARESTAS E O BOTÃO PRINCIPAL DE ARESTA
    document.querySelectorAll(".tool-button:not(.edge-option):not(#tool-edge-main)").forEach(btn => {
        btn.addEventListener("click", () => {
            // CANCELA QUALQUER DESENHO DE ARESTA SE O MODO FOR ALTERADO
            cancelarDesenhoAresta();
            // NOVO: RESETA A SELEÇÃO DE ORIGEM/DESTINO E O CAMINHO VISUAL AO MUDAR DE FERRAMENTA
            if (modoAtual === "origem-destino") { // SÓ RESETA SE ESTAVA NO MODO DE SELEÇÃO DE ORIGEM/DESTINO
                window.resetarSelecao();
            }

            document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoAtual = btn.dataset.mode; // AGORA OS BOTÕES TÊM data-mode
            resetarSelecaoVisual(); // RESETA SELEÇÃO VISUAL GENÉRICA (NÓS/ARESTAS)

            // ESCONDE O DROPDOWN SE O BOTÃO CLICADO NÃO FOR O PRINCIPAL DE ARESTA
            document.querySelector(".edge-dropdown-content").classList.remove("show");
        });
    });

    // LÓGICA DO DROPDOWN DE ARESTAS (CÓDIGO JÁ IMPLEMENTADO DO PONTO 3)
    const edgeMainButton = document.getElementById("tool-edge-main");
    const edgeDropdown = document.querySelector(".edge-dropdown-content");
    const edgeMainIcon = document.getElementById("edge-main-icon");
    const dropdownArrow = document.querySelector(".dropdown-arrow");

    // O BOTÃO PRINCIPAL (ÍCONE) APENAS ATIVA O MODO DE ARESTA, NÃO ABRE O DROPDOWN
    edgeMainButton.addEventListener("click", () => {
        // NOVO: RESETA A SELEÇÃO DE ORIGEM/DESTINO E O CAMINHO VISUAL AO MUDAR DE FERRAMENTA
        if (modoAtual === "origem-destino") {
            window.resetarSelecao();
        }

        document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
        edgeMainButton.classList.add("active");
        modoAtual = edgeMainButton.dataset.mode;
        resetarSelecaoVisual();
    });

    // EVENT LISTENER APENAS PARA A SETA (para abrir/fechar o dropdown)
    dropdownArrow.addEventListener("click", (event) => {
        event.stopPropagation();
        edgeDropdown.classList.toggle("show");
    });

    // LÓGICA PARA AS OPÇÕES DENTRO DO DROPDOWN
    document.querySelectorAll(".edge-option").forEach(optionBtn => {
        optionBtn.addEventListener("click", () => {
            // NOVO: RESETA A SELEÇÃO DE ORIGEM/DESTINO E O CAMINHO VISUAL AO MUDAR DE FERRAMENTA
            if (modoAtual === "origem-destino") {
                window.resetarSelecao();
            }

            edgeType = optionBtn.dataset.edgeType;
            edgeMainButton.dataset.mode = `add-edge-${edgeType}`;
            modoAtual = `add-edge-${edgeType}`;
            edgeMainIcon.src = optionBtn.querySelector("img").src;
            edgeDropdown.classList.remove("show");
            resetarSelecaoVisual();

            // ATIVA O BOTÃO PRINCIPAL AO SELECIONAR UMA OPÇÃO NO DROPDOWN
            document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
            edgeMainButton.classList.add("active");
        });
    });

    // FECHA O DROPDOWN SE CLICAR FORA DELE
    document.addEventListener("click", (event) => {
        if (!edgeMainButton.contains(event.target) && !edgeDropdown.contains(event.target)) {
            edgeDropdown.classList.remove("show");
        }
    });
}

/**
 * REMOVE A MARCAÇÃO VISUAL DO ELEMENTO SELECIONADO.
 */
function resetarSelecaoVisual() {
    zoomGroup.selectAll(".node").attr("fill", "#4960dd").classed("selecionado", false);
    zoomGroup.selectAll(".link").attr("stroke", "#868baf").classed("selecionado", false);
    itemSelecionado = null;
}

/**
 * MANIPULADOR DE EVENTO DE CLIQUE NO SVG.
 * UTILIZADO PARA ADICIONAR NÓS E SELEÇÃO DE ORIGEM E DESTINO.
 */
svg.on("click", (event) => {
    const [mouseX, mouseY] = d3.pointer(event);
    const transform = d3.zoomTransform(svg.node());
    // CONVERTE AS COORDENADAS DO MOUSE DA TELA PARA O SISTEMA DE COORDENADAS DO ZOOMGROUP
    const xCoordInZoomGroup = (mouseX - transform.x) / transform.k;
    const yCoordInZoomGroup = (mouseY - transform.y) / transform.k;

    // LÓGICA PARA ADICIONAR NÓS QUANDO O MODO É 'add-node'
    if (modoAtual === "add-node") {
        const id = gerarIdSequencial();
        const xLogico = xScale.invert(xCoordInZoomGroup);
        const yLogico = yScale.invert(yCoordInZoomGroup);
        grafo.adicionarVertice(id, xLogico, yLogico);
        nodes.push({ id, x: xLogico, y: yLogico });
        desenharGrafo();
        return;
    }

    // LÓGICA EXISTENTE PARA 'origem-destino'
    if (modoAtual !== "origem-destino") return;

    // CHAMA encontrarVerticeMaisProximo COM AS COORDENADAS JÁ NO ESPAÇO DO ZOOMGROUP
    const maisProximo = encontrarVerticeMaisProximo(xCoordInZoomGroup, yCoordInZoomGroup); // ALTERADO AQUI
    if (!maisProximo) return;

    const { id, x: vx, y: vy } = maisProximo;

    if (!origemClicada) {
        origemClicada = id;
    } else if (!destinoClicada) {
        destinoClicada = id;
    }

    const circulo = zoomGroup.append("circle")
        .attr("cx", xScale(vx))
        .attr("cy", yScale(vy))
        .attr("r", tamanhoVertice)
        .attr("fill", origemClicada && !destinoClicada ? "orange" : "red")
        .attr("class", "selected-node");

    circulosSelecionados.push(circulo);
});

/**
 * REGISTRA OS MANIPULADORES DE EVENTO (CLIQUE E ARRASTAR) PARA NÓS E ARESTAS.
 */
function registrarSeletores() {
    zoomGroup.selectAll(".node")
        .on("click", function (event, d) {
            if (modoAtual !== "selecionar") return;
            event.stopPropagation();

            resetarSelecaoVisual();
            d3.select(this)
                .attr("fill", "#EB3A3B")
                .classed("selecionado", true);

            itemSelecionado = d;
        })
        .on("mouseover", function(event, d) {
            if (modoAtual !== "selecionar" && modoAtual !== "origem-destino" && !isDrawingEdge) return;

            nodeTooltip
                .style("display", "block")
                .html(`ID: ${d.id}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function() {
            nodeTooltip.style("display", "none");
        })
        .on("mousemove", function(event) {
            nodeTooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .call(
            d3.drag()
                .on("start", function (event, d) {
                    nodeTooltip.style("display", "none"); // ESCONDE O TOOLTIP DO NÓ AO INICIAR O ARRASTO
                    // ... CÓDIGO EXISTENTE PARA DRAG START ...
                    if (modoAtual === "add-edge-undirected" || modoAtual === "add-edge-directed") {
                        isDrawingEdge = true;
                        startNode = d.id;

                        currentLine = zoomGroup.append("line")
                            .attr("x1", xScale(d.x))
                            .attr("y1", yScale(d.y))
                            .attr("x2", xScale(d.x))
                            .attr("y2", yScale(d.y))
                            .attr("stroke", "gray")
                            .attr("stroke-width", larguraAresta)
                            .attr("stroke-dasharray", "5,5");
                    }
                    else if (modoAtual === "selecionar") {
                        d3.select(this).raise().attr("stroke", "black");
                    }
                })
                .on("drag", function (event, d) {
                    nodeTooltip.style("display", "none"); // ESCONDE O TOOLTIP DO NÓ DURANTE O ARRASTO
                    if (modoAtual === "selecionar") {
                        const novosPontos = calcularNovasPosicoes(event, d);
                        atualizarPosicaoNo(this, d, novosPontos);
                        atualizarPosicaoArestas();
                    }
                    else if (isDrawingEdge && currentLine) {
                        const [mouseX, mouseY] = d3.pointer(event, svg.node());
                        const transform = d3.zoomTransform(zoomGroup.node());
                        const [xCoordInZoomGroup, yCoordInZoomGroup] = transform.invert([mouseX, mouseY]);

                        currentLine
                            .attr("x2", xCoordInZoomGroup)
                            .attr("y2", yCoordInZoomGroup);
                    }
                })
                .on("end", function (event) {
                    nodeTooltip.style("display", "none"); // ESCONDE O TOOLTIP DO NÓ AO FINALIZAR O ARRASTO
                    // ... CÓDIGO EXISTENTE PARA DRAG END ...
                    if (modoAtual === "selecionar") {
                        d3.select(this).attr("stroke", null);
                    }
                    else if (isDrawingEdge) {
                        if (currentLine) {
                            currentLine.remove();
                            currentLine = null;
                        }

                        isDrawingEdge = false;
                        const [mouseX, mouseY] = d3.pointer(event, svg.node());
                        const transform = d3.zoomTransform(svg.node());
                        const xCoordInZoomGroup = (mouseX - transform.x) / transform.k;
                        const yCoordInZoomGroup = (mouseY - transform.y) / transform.k;

                        const endNode = encontrarVerticeMaisProximo(xCoordInZoomGroup, yCoordInZoomGroup);

                        if (startNode && endNode && startNode !== endNode.id) {
                            const bidirectional = (edgeType === 'undirected');
                            const existingLink = links.find(
                                l => (l.source === startNode && l.target === endNode.id && l.bidirectional === bidirectional) ||
                                    (l.source === endNode.id && l.target === startNode && l.bidirectional === bidirectional && bidirectional)
                            );

                            if (!existingLink) {
                                grafo.adicionarAresta(startNode, endNode.id, bidirectional);
                                links.push({ source: startNode, target: endNode.id, bidirectional: bidirectional });
                                desenharGrafo();
                            }
                        }
                        startNode = null;
                    }
                })
        );

    // NOVO: EVENTOS DE MOUSE PARA ARESTAS (LINK)
    zoomGroup.selectAll(".link")
        .on("click", function(event, d) {
            if (modoAtual !== "selecionar") return;
            event.stopPropagation();

            resetarSelecaoVisual();
            d3.select(this)
                .attr("stroke", "#EB3A3B")
                .classed("selecionado", true);
            itemSelecionado = d;
        })
        .on("mouseover", function(event, d) {
            if (modoAtual !== "selecionar") return;

            // ALTERADO: OBTÉM A DISTÂNCIA/PESO DINAMICAMENTE USANDO grafo.distanciaEntre
            const distance = grafo.distanciaEntre(d.source, d.target);
            nodeTooltip
                .style("display", "block")
                .html(`Distância: ${distance !== null && isFinite(distance) ? distance.toFixed(2) : 'N/A'}`) // MELHOR TRATAMENTO DE NULL/INFINITY
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function() {
            nodeTooltip.style("display", "none");
        })
        .on("mousemove", function(event) {
            nodeTooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        });
}


// Funções auxiliares
function calcularNovasPosicoes(event) {
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transform = d3.zoomTransform(zoomGroup.node());
    const [xZoom, yZoom] = transform.invert([mouseX, mouseY]);

    return {
        x: xScale.invert(xZoom),
        y: yScale.invert(yZoom)
    };
}

function atualizarPosicaoNo(elemento, no, posicoes) {
    no.x = posicoes.x;
    no.y = posicoes.y;
    grafo.vertices.set(no.id, { x: no.x, y: no.y });

    const strokeWidth = calcularTamanhoStroke(tamanhoVertice);

    d3.select(elemento)
        .attr("cx", xScale(no.x))
        .attr("cy", yScale(no.y))
        .attr("stroke-width", strokeWidth);
}

function calcularTamanhoStroke(tamanhoVertice) {
    // O stroke será 20% do tamanho do vértice
    return tamanhoVertice * 0.2;
}

function gerarIdSequencial() {
    return `${contadorId++}`;
}

function atualizarPosicaoArestas() {
    atualizarDistanciaSetas();
    zoomGroup.selectAll(".link")
        .attr("x1", l => xScale(grafo.vertices.get(l.source).x))
        .attr("y1", l => yScale(grafo.vertices.get(l.source).y))
        .attr("x2", l => calcularPontoFinalX(l))
        .attr("y2", l => calcularPontoFinalY(l));
}

function calcularPontoFinalX(aresta) {
    const {dx,len} = calcularDiferencasEComprimento(aresta);
    const to = grafo.vertices.get(aresta.target);
    // GARANTE QUE LEN NÃO É ZERO PARA EVITAR DIVISÃO POR ZERO
    return aresta.bidirectional
        ? xScale(to.x)
        : (len > 0 ? xScale(to.x) - (dx / len) * distanciaSeta : xScale(to.x));
}

function calcularPontoFinalY(aresta) {
    const {dy, len} = calcularDiferencasEComprimento(aresta);
    const to = grafo.vertices.get(aresta.target);
    // GARANTE QUE LEN NÃO É ZERO PARA EVITAR DIVISÃO POR ZERO
    return aresta.bidirectional
        ? yScale(to.y)
        : (len > 0 ? yScale(to.y) - (dy / len) * distanciaSeta : yScale(to.y));
}

function calcularDiferencasEComprimento(aresta) {
    const from = grafo.vertices.get(aresta.source);
    const to = grafo.vertices.get(aresta.target);
    const dx = xScale(to.x) - xScale(from.x);
    const dy = yScale(to.y) - yScale(from.y);
    const len = Math.sqrt(dx * dx + dy * dy);
    return {dx, dy, len};
}

/**
 * FUNÇÃO PARA CANCELAR UM DESENHO DE ARESTA EM ANDAMENTO.
 */
function cancelarDesenhoAresta() {
    if (currentLine) {
        currentLine.remove();
        currentLine = null;
    }
    isDrawingEdge = false;
    startNode = null;
}

/**
 * MANIPULA A DELEÇÃO DE ELEMENTOS (NÓS OU ARESTAS) PELA TECLA DELETE.
 */
document.addEventListener("keydown", (e) => {
    if (modoAtual !== "selecionar" || !itemSelecionado) return;
    if (e.key === "Delete") {
        if (itemSelecionado.id) {
            // É UM VÉRTICE
            const id = itemSelecionado.id;
            grafo.removerVertice(id);
            nodes = nodes.filter(n => n.id !== id);
            links = links.filter(l => l.source !== id && l.target !== id);
        } else if (itemSelecionado.source && itemSelecionado.target) {
            // É UMA ARESTA
            grafo.removerAresta(itemSelecionado.source, itemSelecionado.target);
            links = links.filter(l =>
                !(l.source === itemSelecionado.source && l.target === itemSelecionado.target) &&
                !(l.bidirectional && l.source === itemSelecionado.target && l.target === itemSelecionado.source)
            );
        }
        itemSelecionado = null;
        desenharGrafo();
    }
});

/**
 * ENCONTRA O VÉRTICE MAIS PRÓXIMO DE UMA DADA COORDENADA (NO SISTEMA DO ZOOMGROUP).
 * @param {number} xCoordInZoomGroup - COORDENADA X NO SISTEMA DO ZOOMGROUP (PIXELS).
 * @param {number} yCoordInZoomGroup - COORDENADA Y NO SISTEMA DO ZOOMGROUP (PIXELS).
 * @returns {object|null} O OBJETO DO NÓ OU NULL SE NENHUM FOR ENCONTRADO.
 */
function encontrarVerticeMaisProximo(xCoordInZoomGroup, yCoordInZoomGroup) {
    const tolerance = 10; // UMA TOLERÂNCIA MAIOR PARA FACILITAR A SELEÇÃO
    return nodes.find(n => {
        // CONVERTE AS COORDENADAS DO NÓ DO DOMÍNIO PARA PIXELS NO SISTEMA DO ZOOMGROUP
        const px = xScale(n.x);
        const py = yScale(n.y);
        // VERIFICA SE O CLIQUE ESTÁ DENTRO DO RAIO DO VÉRTICE (AGORA COM TOLERÂNCIA)
        return Math.hypot(px - xCoordInZoomGroup, py - yCoordInZoomGroup) <= (tamanhoVertice + tolerance);
    }) || null;
}

/**
 * CONFIGURA O COMPORTAMENTO DE ZOOM E PAN DO SVG.
 */
svg.call(
    d3.zoom()
        .scaleExtent([0.2, 2000]) // DEFINE OS LIMITES DE ESCALA DO ZOOM
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        })
);

// --- CARREGAMENTO INICIAL DO GRAFO ---
const grafoSalvo = localStorage.getItem("grafo-importado");

if (grafoSalvo) {
    const data = JSON.parse(grafoSalvo);
    grafo = new Grafo();
    grafo.carregarDoJSON(data);
    nodes = data.nodes;
    links = data.edges.map(e => ({
        source: e.from,
        target: e.to,
        bidirectional: e.bidirectional !== false
    }));
    desenharGrafo();
} else {
    // SE NÃO HOUVER GRAFO SALVO, DESENHA UM GRAFO VAZIO PARA INICIAR AS ESCALAS
    desenharGrafo();
}

if (nodes.length > 0) {
    const max = Math.max(
        ...nodes
            .map(n => parseInt(String(n.id).replace(/\D+/g, '')))
            .filter(n => !isNaN(n))
    );
    contadorId = max + 1;
}

// --- FUNÇÕES DE UTILIDADE E ATUALIZAÇÃO VISUAL ---

/**
 * VERIFICA SE UMA ARESTA FAZ PARTE DE UM CAMINHO.
 * @param {object} d - OBJETO DA ARESTA.
 * @param {Array<string>} caminho - ARRAY DE IDS DOS NÓS NO CAMINHO.
 * @returns {boolean} TRUE SE A ARESTA FAZ PARTE DO CAMINHO, FALSE CASO CONTRÁRIO.
 */
function fazParteDoCaminho(d, caminho) {
    for (let i = 0; i < caminho.length - 1; i++) {
        const a = caminho[i];
        const b = caminho[i + 1];

        if (d.source === a && d.target === b) return true;
        if (d.bidirectional && d.source === b && d.target === a) return true;
    }
    return false;
}

/**
 * ATUALIZA O TAMANHO VISUAL DOS VÉRTICES.
 */
function atualizarVertices() {
    const strokeWidth = calcularTamanhoStroke(tamanhoVertice);
    zoomGroup.selectAll(".node")
        .attr("r", tamanhoVertice)
        .attr("stroke-width", strokeWidth);
    zoomGroup.selectAll(".selected-node")
        .attr("r", tamanhoVertice)
        .attr("stroke-width", strokeWidth);
}

/**
 * ATUALIZA A LARGURA VISUAL DAS ARESTAS.
 */
function atualizarArestas() {
    zoomGroup.selectAll(".link").attr("stroke-width", larguraAresta);
}

/**
 * ATUALIZA O TAMANHO VISUAL DAS SETAS (MARCADORES).
 */
function atualizarSetas() {
    svg.select("#arrowhead")
        .attr("markerWidth", tamanhoSeta)
        .attr("markerHeight", tamanhoSeta);

    svg.select("#arrowhead-green")
        .attr("markerWidth", tamanhoSeta)
        .attr("markerHeight", tamanhoSeta);
}

/**
 * ATUALIZA A DISTÂNCIA DA PONTA DA SETA AO NÓ DE DESTINO PARA ARESTAS DIRECIONAIS.
 */
function atualizarDistanciaSetas() {
    zoomGroup.selectAll(".link.directional")
        .attr("x2", d => {
            const from = grafo.vertices.get(d.source);
            const to = grafo.vertices.get(d.target);
            const xTo = xScale(to.x);
            const xFrom = xScale(from.x);
            const dx = xTo - xFrom;
            const dy = yScale(to.y) - yScale(from.y);
            const len = Math.sqrt(dx * dx + dy * dy);
            // GARANTE QUE LEN NÃO É ZERO PARA EVITAR DIVISÃO POR ZERO
            return len > 0 ? xTo - (dx / len) * distanciaSeta : xTo;
        })
        .attr("y2", d => {
            const from = grafo.vertices.get(d.source);
            const to = grafo.vertices.get(d.target);
            const yTo = yScale(to.y);
            const yFrom = yScale(from.y);
            const dx = xScale(to.x) - xScale(from.x);
            const dy = yTo - yFrom;
            const len = Math.sqrt(dx * dx + dy * dy);
            // GARANTE QUE LEN NÃO É ZERO PARA EVITAR DIVISÃO POR ZERO
            return len > 0 ? yTo - (dy / len) * distanciaSeta : yTo;
        });
}

/**
 * DESENHA O GRAFO NO SVG, INCLUINDO NÓS E ARESTAS.
 * RECALCULA AS ESCALAS (XSCALE, YSCALE) BASEADAS NA EXTENSÃO DOS NÓS.
 */
function desenharGrafo() {
    zoomGroup.selectAll("*").remove(); // REMOVE TODOS OS ELEMENTOS EXISTENTES NO GRUPO DE ZOOM

    const padding = 100;
    // SE NÃO HOUVER NÓS, DEFINA UM DOMÍNIO PADRÃO PARA AS ESCALAS
    const minX = nodes.length > 0 ? d3.min(nodes, d => d.x) : 0;
    const maxX = nodes.length > 0 ? d3.max(nodes, d => d.x) : 1;
    const minY = nodes.length > 0 ? d3.min(nodes, d => d.y) : 0;
    const maxY = nodes.length > 0 ? d3.max(nodes, d => d.y) : 1;

    // USA EXTENSÕES SEGURAS PARA EVITAR PROBLEMAS COM GRAFOS VAZIOS OU COM UM ÚNICO NÓ
    const xExtent = [minX, maxX];
    const yExtent = [minY, maxY];

    // OBTÉM AS DIMENSÕES REAIS DO SVG, MAIS ROBUSTO QUE VALORES FIXOS
    const width = svg.node().getBoundingClientRect().width;

    // PARA EVITAR PROBLEMAS DE DIVISÃO POR ZERO SE MIN/MAX SÃO IGUAIS (e.g., um único nó)
    const domainWidth = xExtent[1] - xExtent[0] || 1; // Garante que não é 0
    const domainHeight = yExtent[1] - yExtent[0] || 1; // Garante que não é 0

    const aspect = domainHeight / domainWidth;
    const calculatedHeight = isFinite(aspect) ? width * aspect : width;


    xScale = d3.scaleLinear()
        .domain([xExtent[0] - padding, xExtent[1] + padding])
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain([yExtent[0] - padding, yExtent[1] + padding])
        .range([calculatedHeight, 0]); // AQUI INVERTE O Y (0 NO TOPO, HEIGHT NA BASE)

    zoomGroup.selectAll(".link")
        .data(links)
        .enter()
        .append("line")
        .attr("class", d => d.bidirectional ? "link" : "link directional")
        .attr("stroke-width", larguraAresta)
        .attr("stroke", "#868baf")
        .attr("marker-end", d => {
            return d.bidirectional ? null : "url(#arrowhead)";
        })
        .attr("x1", d => {
            const from = grafo.vertices.get(d.source);
            return xScale(from.x);
        })
        .attr("y1", d => {
            const from = grafo.vertices.get(d.source);
            return yScale(from.y);
        })
        .attr("x2", d => {
            const from = grafo.vertices.get(d.source);
            const to = grafo.vertices.get(d.target);
            const xTo = xScale(to.x);
            const xFrom = xScale(from.x);

            if (d.bidirectional) return xTo;

            const dx = xTo - xFrom;
            const dy = yScale(to.y) - yScale(from.y);
            const len = Math.sqrt(dx * dx + dy * dy);

            return len > 0 ? xTo - (dx / len) * distanciaSeta : xTo;
        })
        .attr("y2", d => {
            const from = grafo.vertices.get(d.source);
            const to = grafo.vertices.get(d.target);
            const yTo = yScale(to.y);
            const yFrom = yScale(from.y);

            if (d.bidirectional) return yTo;

            const dx = xScale(to.x) - xScale(from.x);
            const dy = yTo - yFrom;
            const len = Math.sqrt(dx * dx + dy * dy);

            return len > 0 ? yTo - (dy / len) * distanciaSeta : yTo;
        });

    zoomGroup.selectAll(".node")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", tamanhoVertice)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("fill", "#4960dd");

    // ATUALIZA OS TAMANHOS DE MARCADOR PARA AS SETAS EXISTENTES
    atualizarSetas();

    // ATUALIZA AS PROPRIEDADES VISUAIS BASEADAS NOS VALORES ATUAIS DOS SLIDERS
    atualizarVertices();
    atualizarArestas();
    atualizarDistanciaSetas();
    registrarSeletores();
}

// --- FUNÇÕES DE LÓGICA DO GRAFO (DIJKSTRA) ---

/**
 * EXECUTA O ALGORITMO DE DIJKSTRA E ATUALIZA A UI COM OS RESULTADOS.
 */
window.executarDijkstra = function () {
    if (origemClicada === null || destinoClicada === null) {
        document.getElementById("status").textContent = "STATUS = SELECIONE DOIS VÉRTICES ⚠️";
        return;
    }

    document.getElementById("status").textContent = "STATUS = CALCULANDO...";

    const inicio = performance.now();
    const resultado = grafo.dijkstra(origemClicada, destinoClicada);
    const fim = performance.now();

    const tempoDecorrido = ((fim - inicio) / 1000).toFixed(3);

    document.getElementById("velocidade").textContent = `Velocidade = ${tempoDecorrido}S`;
    document.getElementById("explorados").textContent = `Nós explorados = ${resultado.visitados}`;
    document.getElementById("custo").textContent = `Custo = ${resultado.custo.toFixed(2)}`;

    if (!resultado.caminho || resultado.caminho.length === 0 || resultado.custo === Infinity) {
        document.getElementById("status").textContent = "Status = Caminho não encontrado";
    } else {
        document.getElementById("status").textContent = "Status = Caminho Calculado";
    }

    zoomGroup.selectAll(".link")
        .classed("path", d => fazParteDoCaminho(d, resultado.caminho))
        .attr("marker-end", d => {
            return d.bidirectional
                ? null
                : (fazParteDoCaminho(d, resultado.caminho)
                    ? "url(#arrowhead-green)"
                    : "url(#arrowhead)");
        });

    zoomGroup.selectAll(".node")
        .classed("path", d => resultado.caminho.includes(d.id));

    tabela.innerHTML = "";

    const caminho = resultado.caminho;

    for (let i = 0; i < caminho.length; i++) {
        const atual = caminho[i];
        const proximo = caminho[i + 1] || "-";

        let distancia = "-";
        if (proximo !== "-") {
            distancia = grafo.distanciaEntre(atual, proximo)?.toFixed(2) ?? "-";
        }

        const linha = document.createElement("tr");
        linha.innerHTML = `
            <td>${atual}</td>
            <td>${distancia}</td>
            <td>${proximo}</td>
        `;
        tabela.appendChild(linha);
    }
};

/**
 * REINICIA A SELEÇÃO DE ORIGEM/DESTINO E LIMPA A VISUALIZAÇÃO DO CAMINHO.
 */
window.resetarSelecao = function () { // MANTENHA COMO `window.resetarSelecao`
    tabela.innerHTML = "";
    origemClicada = null;
    destinoClicada = null;
    circulosSelecionados.forEach(c => c.remove());
    circulosSelecionados = [];
    svg.selectAll(".link").classed("path", false);
    zoomGroup.selectAll(".link")
        .classed("path", false)
        .attr("marker-end", d => d.bidirectional ? null : "url(#arrowhead)");

    zoomGroup.selectAll(".node")
        .classed("path", false);

    document.getElementById("velocidade").textContent = "Velocidade = 0S";
    document.getElementById("status").textContent = "Status = Aguardando";
    document.getElementById("explorados").textContent = "Nós explorados = 0";
    document.getElementById("custo").textContent = "Custo = 0";
};

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
configurarToolbar();

// ASSEGURA QUE O GRAFO É DESENHADO NO INÍCIO PARA INICIALIZAR AS ESCALAS
// MESMO QUE NÃO HAJA DADOS SALVOS.
if (!grafoSalvo) {
    desenharGrafo();
}