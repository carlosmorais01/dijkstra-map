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

const zoomGroup = svg.append("g");

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
    document.querySelectorAll(".tool-button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoAtual = btn.dataset.modo;
            resetarSelecaoVisual();
        });
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
 * UTILIZADO PARA SELEÇÃO DE ORIGEM E DESTINO NO MODO 'ORIGEM-DESTINO'.
 */
svg.on("click", (event) => {
    if (modoAtual !== "origem-destino") return;

    const [mouseX, mouseY] = d3.pointer(event);
    const transform = d3.zoomTransform(svg.node());
    // CONVERTE AS COORDENADAS DO MOUSE PARA O SISTEMA DE COORDENADAS DO GRUPO (APÓS ZOOM/PAN)
    const x = (mouseX - transform.x) / transform.k;
    const y = (mouseY - transform.y) / transform.k;

    const maisProximo = encontrarVerticeMaisProximo(x, y);
    if (!maisProximo) return;

    const { id, x: vx, y: vy } = maisProximo;

    if (!origemClicada) {
        origemClicada = id;
    } else if (!destinoClicada) {
        destinoClicada = id;
    }

    const circulo = zoomGroup.append("circle")
        .attr("cx", xScale(vx)) // USA ESCALA PARA POSICIONAR VISUALMENTE
        .attr("cy", yScale(vy)) // USA ESCALA PARA POSICIONAR VISUALMENTE
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
            event.stopPropagation(); // IMPEDE QUE O CLIQUE NO NÓ PROPAGUE PARA O SVG

            resetarSelecaoVisual();
            d3.select(this)
                .attr("fill", "#EB3A3B")
                .classed("selecionado", true);

            itemSelecionado = d;
        })
        .call(
            d3.drag()
                .on("start", function () {
                    if (modoAtual !== "selecionar") return;
                    d3.select(this).raise().attr("stroke", "black");
                })
                .on("drag", function (event, d) {
                    if (modoAtual !== "selecionar") return;

                    const novosPontos = calcularNovasPosicoes(event, d);
                    atualizarPosicaoNo(this, d, novosPontos);
                    atualizarPosicaoArestas();
                })
                .on("end", function () {
                    if (modoAtual !== "selecionar") return;
                    d3.select(this).attr("stroke", null);
                })
        );

    zoomGroup.selectAll(".link")
        .on("click", function(event, d) {
            if (modoAtual !== "selecionar") return;
            event.stopPropagation(); // IMPEDE QUE O CLIQUE NA ARESTA PROPAGUE PARA O SVG

            resetarSelecaoVisual();
            d3.select(this)
                .attr("stroke", "#EB3A3B")
                .classed("selecionado", true);
            itemSelecionado = d;
        });
}

// Funções auxiliares
function calcularNovasPosicoes(event, no) {
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

function atualizarPosicaoArestas() {
    atualizarDistanciaSetas();
    zoomGroup.selectAll(".link")
    zoomGroup.selectAll(".link")
    zoomGroup.selectAll(".link")
        .attr("x1", l => xScale(grafo.vertices.get(l.source).x))
        .attr("y1", l => yScale(grafo.vertices.get(l.source).y))
        .attr("x2", l => calcularPontoFinalX(l))
        .attr("y2", l => calcularPontoFinalY(l));
}

function calcularPontoFinalX(aresta) {
    const {dx, dy, len} = calcularDiferencasEComprimento(aresta);
    const to = grafo.vertices.get(aresta.target);
    return aresta.bidirectional
        ? xScale(to.x)
        : xScale(to.x) - (dx / len) * distanciaSeta;
}

function calcularPontoFinalY(aresta) {
    const {dx, dy, len} = calcularDiferencasEComprimento(aresta);
    const to = grafo.vertices.get(aresta.target);
    return aresta.bidirectional
        ? yScale(to.y)
        : yScale(to.y) - (dy / len) * distanciaSeta;
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
 * @param {number} x - COORDENADA X NO SISTEMA DO ZOOMGROUP.
 * @param {number} y - COORDENADA Y NO SISTEMA DO ZOOMGROUP.
 * @returns {object|null} O OBJETO DO NÓ OU NULL SE NENHUM FOR ENCONTRADO.
 */
function encontrarVerticeMaisProximo(x, y) {
    return nodes.find(n => {
        // CONVERTE AS COORDENADAS DO NÓ DO DOMÍNIO PARA PIXELS NO SISTEMA DO ZOOMGROUP
        const px = xScale(n.x);
        const py = yScale(n.y);
        // VERIFICA SE O CLIQUE ESTÁ DENTRO DO RAIO DO VÉRTICE
        return Math.hypot(px - x, py - y) <= tamanhoVertice;
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
            return xTo - (dx / len) * distanciaSeta;
        })
        .attr("y2", d => {
            const from = grafo.vertices.get(d.source);
            const to = grafo.vertices.get(d.target);
            const yTo = yScale(to.y);
            const yFrom = yScale(from.y);
            const dx = xScale(to.x) - xScale(from.x);
            const dy = yTo - yFrom;
            const len = Math.sqrt(dx * dx + dy * dy);
            return yTo - (dy / len) * distanciaSeta;
        });
}

/**
 * DESENHA O GRAFO NO SVG, INCLUINDO NÓS E ARESTAS.
 * RECALCULA AS ESCALAS (XSCALE, YSCALE) BASEADAS NA EXTENSÃO DOS NÓS.
 */
function desenharGrafo() {
    zoomGroup.selectAll("*").remove(); // REMOVE TODOS OS ELEMENTOS EXISTENTES NO GRUPO DE ZOOM

    const padding = 100;
    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);
    const width = 1500;

    // GARANTE QUE AS EXTENSÕES SÃO VÁLIDAS PARA EVITAR DIVISÃO POR ZERO OU ERROS DE ESCALA
    const safeXExtent = [xExtent[0] === undefined ? 0 : xExtent[0], xExtent[1] === undefined ? width : xExtent[1]];
    const safeYExtent = [yExtent[0] === undefined ? 0 : yExtent[0], yExtent[1] === undefined ? width : yExtent[1]];

    const aspect = (safeYExtent[1] - safeYExtent[0]) / (safeXExtent[1] - safeXExtent[0]);
    const height = isFinite(aspect) ? width * aspect : width; // GARANTE QUE A ALTURA É FINITA

    xScale = d3.scaleLinear()
        .domain([safeXExtent[0] - padding, safeXExtent[1] + padding])
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain([safeYExtent[0] - padding, safeYExtent[1] + padding])
        .range([height, 0]); // AQUI INVERTE O Y (0 NO TOPO, HEIGHT NA BASE)

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

            return xTo - (dx / len) * distanciaSeta;
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

            return yTo - (dy / len) * distanciaSeta;
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

    document.getElementById("velocidade").textContent = `VELOCIDADE = ${tempoDecorrido}S`;
    document.getElementById("explorados").textContent = `NÓS EXPLORADOS = ${resultado.visitados}`;
    document.getElementById("custo").textContent = `CUSTO = ${resultado.custo.toFixed(2)}`;

    if (!resultado.caminho || resultado.caminho.length === 0 || resultado.custo === Infinity) {
        document.getElementById("status").textContent = "STATUS = CAMINHO NÃO ENCONTRADO ❌";
    } else {
        document.getElementById("status").textContent = "STATUS = CAMINHO CALCULADO ✅";
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
window.resetarSelecao = function () {
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

    document.getElementById("velocidade").textContent = "VELOCIDADE = 0S";
    document.getElementById("status").textContent = "STATUS = AGUARDANDO";
    document.getElementById("explorados").textContent = "NÓS EXPLORADOS = 0";
    document.getElementById("custo").textContent = "CUSTO = 0";
};

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
configurarToolbar();