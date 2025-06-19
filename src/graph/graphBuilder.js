import {Grafo} from './grafo.js';
import { parseOSM } from './mapConverter.js';

// --- VARIÁVEIS GLOBAIS E INICIALIZAÇÃO DO D3.JS ---
let origemClicada = null;
let destinoClicada = null;
let circulosSelecionados = [];

const svg = d3.select("svg");
const tabela = document.querySelector("#tabela-caminho tbody");
let grafo = new Grafo();
let nodes = [], links = [];
let contadorId = 1;

const zoomGroup = svg.append("g");
const nodeTooltip = d3.select("#node-tooltip");

// --- VARIÁVEIS DE ESTADO PARA ADIÇÃO DE ARESTAS (PREPARAÇÃO PARA O PONTO 3) ---
let isDrawingEdge = false;
let startNode = null;
let currentLine = null;
let edgeType = 'undirected';

// --- CONFIGURAÇÕES DE ESTILO (SLIDERS) ---
let tamanhoVertice = 3;
let larguraAresta = 1.5;
let tamanhoSeta = 6;
let distanciaSeta = 1;

// --- VARIÁVEIS DE ESTADO DO MENU VISUALIZAR ---
let enumerarVertices = false; // Estado para enumerar vértices
let mostrarPesosArestas = false; // Estado para mostrar pesos

document.getElementById("slider-node-size").addEventListener("input", e => {
    tamanhoVertice = +e.target.value;
    atualizarVertices();
    atualizarEnumeracaoVertices();
});

document.getElementById("slider-link-width").addEventListener("input", e => {
    larguraAresta = +e.target.value;
    atualizarArestas();
    atualizarPesosArestas();
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
let modoAtual = "selecionar";
let itemSelecionado = null;

// --- FUNÇÕES DE INTERFACE DO USUÁRIO (UI) ---

function configurarToolbar() {
    document.querySelectorAll(".tool-button:not(.edge-option):not(#tool-edge-main)").forEach(btn => {
        btn.addEventListener("click", () => {
            cancelarDesenhoAresta();
            if (modoAtual === "origem-destino") {
                window.resetarSelecao();
            }
            document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoAtual = btn.dataset.mode;
            resetarSelecaoVisual();
            document.querySelector(".edge-dropdown-content").classList.remove("show");
        });
    });

    const edgeMainButton = document.getElementById("tool-edge-main");
    const edgeDropdown = document.querySelector(".edge-dropdown-content");
    const edgeMainIcon = document.getElementById("edge-main-icon");
    const dropdownArrow = document.querySelector(".dropdown-arrow");

    edgeMainButton.addEventListener("click", () => {
        if (modoAtual === "origem-destino") {
            window.resetarSelecao();
        }
        document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
        edgeMainButton.classList.add("active");
        modoAtual = edgeMainButton.dataset.mode;
        resetarSelecaoVisual();
    });

    dropdownArrow.addEventListener("click", (event) => {
        event.stopPropagation();
        edgeDropdown.classList.toggle("show");
    });

    document.querySelectorAll(".edge-option").forEach(optionBtn => {
        optionBtn.addEventListener("click", () => {
            if (modoAtual === "origem-destino") {
                window.resetarSelecao();
            }
            edgeType = optionBtn.dataset.edgeType;
            edgeMainButton.dataset.mode = `add-edge-${edgeType}`;
            modoAtual = `add-edge-${edgeType}`;
            edgeMainIcon.src = optionBtn.querySelector("img").src;
            edgeDropdown.classList.remove("show");
            resetarSelecaoVisual();
            document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
            edgeMainButton.classList.add("active");
        });
    });

    // Fecha os dropdowns se clicar fora deles
    document.addEventListener("click", (event) => {
        if (!edgeMainButton.contains(event.target) && !edgeDropdown.contains(event.target)) {
            edgeDropdown.classList.remove("show");
        }
        const mainMenuToggle = document.getElementById("menu-toggle-arrow"); // Alterado para o ID da nova seta
        const mainMenuContent = document.getElementById("app-main-menu");
        if (mainMenuToggle && mainMenuContent && !mainMenuToggle.contains(event.target) && !mainMenuContent.contains(event.target)) {
            mainMenuContent.classList.remove("show");
        }
    });

    document.getElementById("tool-delete").addEventListener("click", () => {
        cancelarDesenhoAresta();
        if (modoAtual === "origem-destino") {
            window.resetarSelecao();
        }

        document.querySelectorAll(".tool-button").forEach(b => b.classList.remove("active"));
        document.getElementById("tool-delete").classList.add("active");
        modoAtual = "apagar";
        resetarSelecaoVisual();
    });

}

// --- NOVO: Configurações do Menu Principal (Arquivo/Visualizar) ---
function configurarMenuPrincipal() {
    const mainMenuToggle = document.getElementById("menu-toggle-arrow"); // ID da seta para abrir o menu
    const mainMenuContent = document.getElementById("app-main-menu");
    const fileInput = document.getElementById("file-input");

    if (mainMenuToggle) {
        mainMenuToggle.addEventListener("click", (event) => {
            event.stopPropagation(); // Impede o fechamento imediato pelo document.click
            mainMenuContent.classList.toggle("show");
        });
    }

    // Evento para abrir/fechar submenus ao passar o mouse
    document.querySelectorAll(".dropdown-item.has-submenu").forEach(item => {
        item.addEventListener("mouseenter", () => {
            item.querySelector(".submenu-content").style.display = "block";
        });
        item.addEventListener("mouseleave", () => {
            item.querySelector(".submenu-content").style.display = "none";
        });
    });


    // Opções do menu "Arquivo"
    document.getElementById("new-graph-btn").addEventListener("click", () => {
        window.limparGrafo(); // Reutiliza a função existente
        mainMenuContent.classList.remove("show"); // Fecha o menu
    });

    document.getElementById("import-graph-btn").addEventListener("click", () => {
        fileInput.click(); // Simula o clique no input de arquivo
        mainMenuContent.classList.remove("show"); // Fecha o menu
    });

    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;

                try {
                    if (file.name.endsWith(".osm")) {
                        const parsed = parseOSM(content);
                        importarGrafo(parsed); // função que trata o carregamento no sistema
                    } else {
                        const data = JSON.parse(content);
                        importarGrafo(data); // mesma função
                    }
                } catch (err) {
                    alert("Erro ao importar o arquivo. Verifique se é válido.");
                    console.error(err);
                }
                fileInput.value = '';
            };
            reader.readAsText(file);
        }
    });

    function importarGrafo(data) {
        grafo = new Grafo();

        const minX = Math.min(...data.nodes.map(n => n.x));
        const minY = Math.min(...data.nodes.map(n => n.y));

        nodes = data.nodes.map(n => ({
            id: n.id,
            x: n.x - minX,
            y: (n.y - minY) * -1
        }));

        grafo.carregarDoJSON({ nodes, edges: data.edges });

        links = data.edges.map(e => ({
            source: e.from,
            target: e.to,
            bidirectional: e.bidirectional !== false
        }));

        desenharGrafoCompleto();
        centralizarGrafo();
        window.resetarSelecao();

        if (nodes.length > 0) {
            const max = Math.max(...nodes.map(n => parseInt(String(n.id).replace(/\D+/g, ''))).filter(n => !isNaN(n)));
            contadorId = max + 1;
        }
    }

    document.getElementById("copy-to-clipboard-btn").addEventListener("click", () => {
        window.copiarImagemGrafo(); // Reutiliza a função existente
        mainMenuContent.classList.remove("show"); // Fecha o menu
    });

    document.getElementById("save-graph-btn").addEventListener("click", () => {
        salvarGrafoLocal();
        mainMenuContent.classList.remove("show"); // Fecha o menu
    });

    // Opções do menu "Visualizar" (checkboxes)
    const enumerateNodesSwitch = document.getElementById("enumerate-nodes-switch");
    const showEdgeWeightsSwitch = document.getElementById("show-edge-weights-switch");

    enumerarVertices = localStorage.getItem("enumerarVertices") === "true";
    mostrarPesosArestas = localStorage.getItem("mostrarPesosArestas") === "true";

    enumerateNodesSwitch.checked = enumerarVertices;
    showEdgeWeightsSwitch.checked = mostrarPesosArestas;

    enumerateNodesSwitch.addEventListener("change", (event) => {
        enumerarVertices = event.target.checked;
        localStorage.setItem("enumerarVertices", enumerarVertices); // ← ADICIONADO
        atualizarEnumeracaoVertices();
    });

    showEdgeWeightsSwitch.addEventListener("change", (event) => {
        mostrarPesosArestas = event.target.checked;
        localStorage.setItem("mostrarPesosArestas", mostrarPesosArestas); // ← ADICIONADO
        atualizarPesosArestas();
    });
}

function salvarGrafoLocal() {
    const dataToSave = {
        nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y * -1 })), // Inverte Y de volta para o formato original para salvar
        edges: links.map(l => ({ from: l.source, to: l.target, bidirectional: l.bidirectional }))
    };
    const dataStr = JSON.stringify(dataToSave, null, 2); // Formata com indentação

    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grafo.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function atualizarEnumeracaoVertices() {
    if (enumerarVertices) {
        const labels = zoomGroup.selectAll(".node-label")
            .data(nodes, d => d.id);

        labels.join(
            enter => enter.append("text")
                .attr("class", "node-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("pointer-events", "none")
                .attr("fill", "#f3efe7")
                .attr("font-size", Math.max(0.001, tamanhoVertice) + "px")
                .attr("x", d => d.x)
                .attr("y", d => d.y + 0.25)
                .text(d => d.id),
            update => update
                .attr("x", d => d.x)
                .attr("y", d => d.y + 0.25)
                .attr("font-size", Math.max(0.001, tamanhoVertice) + "px")
                .text(d => d.id),
            exit => exit.remove()
        );

        zoomGroup.selectAll(".node-label").raise();
    } else {
        zoomGroup.selectAll(".node-label").remove();
    }
}

function atualizarPesosArestas() {
    if (mostrarPesosArestas) {
        const weightLabels = zoomGroup.selectAll(".link-weight-label")
            .data(links, d => `${d.source}-${d.target}-${d.bidirectional}`); // Key-binding para arestas

        weightLabels.enter()
            .append("text")
            .attr("class", "link-weight-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .merge(weightLabels)
            .attr("x", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                // Calcula o ponto médio da aresta
                let midX = (from.x + to.x) / 2;
                let midY = (from.y + to.y) / 2;

                // Pequeno offset para o texto não ficar exatamente sobre a linha,
                // pode precisar de ajuste fino.
                const offset = 5;
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                midX += Math.sin(angle) * offset;
                return midX;
            })
            .attr("y", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                let midX = (from.x + to.x) / 2;
                let midY = (from.y + to.y) / 2;

                const offset = 5;
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                midY -= Math.cos(angle) * offset;
                return midY;
            })
            .attr("font-size", Math.max(2, larguraAresta * 5) + "px")
            .attr("fill", "#393939")
            .attr("pointer-events", "none")
            .text(d => {
                const distance = grafo.distanciaEntre(d.source, d.target);
                return distance !== null && isFinite(distance) ? distance.toFixed(2) : '';
            });

        weightLabels.exit().remove();
    } else {
        zoomGroup.selectAll(".link-weight-label").remove();
    }
}


function resetarSelecaoVisual() {
    zoomGroup.selectAll(".node").attr("fill", "#4960dd").classed("selecionado", false);
    zoomGroup.selectAll(".link").attr("stroke", "#868baf").classed("selecionado", false);
    itemSelecionado = null;
}

let currentTransform = d3.zoomIdentity;

const zoom = d3.zoom()
    .scaleExtent([0.02, 1000])
    .on("zoom", (event) => {
        currentTransform = event.transform;
        zoomGroup.attr("transform", currentTransform);
        // Chamar atualização de labels/pesos aqui para que se movam com o zoom
        atualizarEnumeracaoVertices();
        atualizarPesosArestas();
    });

svg.call(zoom);

svg.on("click", (event) => {
    if (modoAtual === "add-node") {
        const [mouseX, mouseY] = d3.pointer(event);
        const [xLogico, yLogico] = currentTransform.invert([mouseX, mouseY]);

        const id = gerarIdSequencial();
        grafo.adicionarVertice(id, xLogico, yLogico);
        nodes.push({ id, x: xLogico, y: yLogico });

        desenharNovoNo(id, xLogico, yLogico);
    }
});


// --- FUNÇÃO CENTRALIZADA PARA CONFIGURAR EVENTOS DE NÓS ---
function configurarEventosNo(selection) {
    selection
        .on("click", function (event, d) {
            event.stopPropagation();

            if (modoAtual === "origem-destino") {
                if (origemClicada && destinoClicada) {
                    return;
                }

                if (d.id === origemClicada || d.id === destinoClicada) {
                    return;
                }

                if (!origemClicada) {
                    origemClicada = d.id;
                    d3.select(this).attr("fill", "orange").attr("r", tamanhoVertice * 1.2);
                    circulosSelecionados.push(d3.select(this));
                } else if (!destinoClicada) {
                    destinoClicada = d.id;
                    d3.select(this).attr("fill", "red").attr("r", tamanhoVertice * 1.2);
                    circulosSelecionados.push(d3.select(this));
                }
            } else if (modoAtual === "apagar") {
                grafo.removerVertice(d.id);
                nodes = nodes.filter(n => n.id !== d.id);
                links = links.filter(l => l.source !== d.id && l.target !== d.id);
                desenharGrafoCompleto();
            }
        })
        .on("mouseover", function (event, d) {
            if (modoAtual !== "selecionar" && modoAtual !== "origem-destino" && !isDrawingEdge) return;
            nodeTooltip
                .style("display", "block")
                .html(`ID: ${d.id}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            nodeTooltip.style("display", "none");
        })
        .on("mousemove", function (event) {
            nodeTooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .call(
            d3.drag()
                .filter(modoAtual === "selecionar" || modoAtual.startsWith("add-edge-"))
                .on("start", function (event, d) {
                    nodeTooltip.style("display", "none");
                    d._dragStart = { x: event.x, y: event.y };

                    if (modoAtual.startsWith("add-edge-")) {
                        isDrawingEdge = true;
                        startNode = d.id;
                        currentLine = zoomGroup.append("line")
                            .attr("x1", d.x)
                            .attr("y1", d.y)
                            .attr("x2", d.x)
                            .attr("y2", d.y)
                            .attr("stroke", "gray")
                            .attr("stroke-width", larguraAresta)
                            .attr("stroke-dasharray", "5,5");
                    } else if (modoAtual === "selecionar") {
                        d3.select(this).raise().attr("stroke", "black");
                        zoomGroup.selectAll(".node-label")
                            .filter(lbl => lbl.id === d.id)
                            .raise();
                    }
                })
                .on("drag", function (event, d) {
                    nodeTooltip.style("display", "none");
                    if (modoAtual === "selecionar") {
                        d.x = event.x;
                        d.y = event.y;
                        grafo.vertices.set(d.id, { x: d.x, y: d.y });

                        const index = nodes.findIndex(n => n.id === d.id);
                        if (index !== -1) {
                            nodes[index].x = d.x;
                            nodes[index].y = d.y;
                        }

                        d3.select(this)
                            .attr("cx", d.x)
                            .attr("cy", d.y);
                        atualizarPosicaoArestas();
                        atualizarEnumeracaoVertices();
                        zoomGroup.selectAll(".node-label").raise();
                    } else if (isDrawingEdge && currentLine) {
                        currentLine
                            .attr("x2", event.x)
                            .attr("y2", event.y);
                    }
                })
                .on("end", function (event, d) {
                    nodeTooltip.style("display", "none");

                    const dx = event.x - d._dragStart.x;
                    const dy = event.y - d._dragStart.y;

                    if (modoAtual === "selecionar") {
                        d3.select(this).attr("stroke", null);
                    } else if (modoAtual.startsWith("add-edge-")) {
                        // O arrasto de aresta sempre tem a lógica aqui
                        if (currentLine) {
                            currentLine.remove();
                            currentLine = null;
                        }

                        isDrawingEdge = false;
                        const [mouseX, mouseY] = d3.pointer(event, svg.node());
                        const [xCoordInZoomGroup, yCoordInZoomGroup] = currentTransform.invert([mouseX, mouseY]);

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
                                desenharNovaAresta(startNode, endNode.id, bidirectional);
                            }
                        }
                        startNode = null;
                    }
                })
        );
}

// --- FUNÇÃO PARA DESENHAR UM NOVO NÓ (Usa a função de configuração de eventos) ---
function desenharNovoNo(id, x, y) {
    const strokeWidth = calcularTamanhoStroke(tamanhoVertice);

    const newNode = zoomGroup.append("circle")
        .data([{ id, x, y }])
        .attr("class", "node")
        .attr("r", tamanhoVertice)
        .attr("cx", x)
        .attr("cy", y)
        .attr("fill", "#4960dd")
        .attr("stroke", null)
        .attr("stroke-width", strokeWidth);

    configurarEventosNo(newNode);
    atualizarEnumeracaoVertices();
}

// --- FUNÇÃO PARA DESENHAR UMA NOVA ARESTA (Usa a função de configuração de eventos) ---
function desenharNovaAresta(sourceId, targetId, bidirectional) {
    const newLink = { source: sourceId, target: targetId, bidirectional: bidirectional };
    const from = grafo.vertices.get(newLink.source);
    const to = grafo.vertices.get(newLink.target);

    const x1 = from.x;
    const y1 = from.y;
    const x2 = bidirectional ? to.x : calcularPontoFinalX(newLink, true);
    const y2 = bidirectional ? to.y : calcularPontoFinalY(newLink, true);

    const novaLinha = zoomGroup.append("line")
        .data([newLink])
        .attr("class", newLink.bidirectional ? "link" : "link directional")
        .attr("stroke-width", larguraAresta)
        .attr("stroke", "#868baf")
        .attr("marker-end", newLink.bidirectional ? null : "url(#arrowhead)")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2);

    configurarEventosAresta(novaLinha);

    zoomGroup.selectAll(".node").raise();
    zoomGroup.selectAll(".selected-node.temp-selection").raise();
    zoomGroup.selectAll(".node-label").raise();
    atualizarPesosArestas();
}

// --- FUNÇÃO CENTRALIZADA PARA CONFIGURAR EVENTOS DE ARESTAS ---
function
configurarEventosAresta(selection) {
    selection
        .on("click", function (event, d) {
            if (modoAtual === "apagar") {
                grafo.removerAresta(d.source, d.target);
                links = links.filter(l =>
                    !(l.source === d.source && l.target === d.target) &&
                    !(l.bidirectional && l.source === d.target && l.target === d.source)
                );
                desenharGrafoCompleto();
                return;
            }

            if (modoAtual !== "selecionar") return;
            event.stopPropagation();
            resetarSelecaoVisual();
            d3.select(this)
                .attr("stroke", "#EB3A3B")
                .classed("selecionado", true);
            itemSelecionado = d;
        })
        .on("mouseover", function (event, d) {
            if (modoAtual !== "selecionar") return;
            const distance = grafo.distanciaEntre(d.source, d.target);
            nodeTooltip
                .style("display", "block")
                .html(`Distância: ${distance !== null && isFinite(distance) ? distance.toFixed(2) : 'N/A'}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mousemove", function (event) {
            nodeTooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            nodeTooltip.style("display", "none");
        });
}

function calcularTamanhoStroke(tamanhoVertice) {
    return tamanhoVertice * 0.2;
}

function gerarIdSequencial() {
    return `${contadorId++}`;
}

function atualizarPosicaoArestas() {
    atualizarDistanciaSetas();
    zoomGroup.selectAll(".link")
        .attr("x1", l => grafo.vertices.get(l.source).x)
        .attr("y1", l => grafo.vertices.get(l.source).y)
        .attr("x2", l => calcularPontoFinalX(l, true))
        .attr("y2", l => calcularPontoFinalY(l, true));

    if (mostrarPesosArestas) {
        zoomGroup.selectAll(".link-weight-label")
            .attr("x", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                const midX = (from.x + to.x) / 2;
                const offset = 5;
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                return midX + Math.sin(angle) * offset;
            })
            .attr("y", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                const midY = (from.y + to.y) / 2;
                const offset = 5;
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                return midY - Math.cos(angle) * offset;
            });
        zoomGroup.selectAll(".link-weight-label")
            .text(d => {
                const distance = grafo.distanciaEntre(d.source, d.target);
                return distance !== null && isFinite(distance) ? distance.toFixed(2) : '';
            });
    }
}

function calcularPontoFinalX(aresta, useLogicalCoords = false) {
    const {dx, len} = calcularDiferencasEComprimento(aresta, useLogicalCoords);
    const to = grafo.vertices.get(aresta.target);
    const xTo = to.x;

    return aresta.bidirectional
        ? xTo
        : (len > 0 ? xTo - (dx / len) * distanciaSeta : xTo);
}

function calcularPontoFinalY(aresta, useLogicalCoords = false) {
    const {dy, len} = calcularDiferencasEComprimento(aresta, useLogicalCoords);
    const to = grafo.vertices.get(aresta.target);
    const yTo = to.y;

    return aresta.bidirectional
        ? yTo
        : (len > 0 ? yTo - (dy / len) * distanciaSeta : yTo);
}

function calcularDiferencasEComprimento(aresta) {
    const from = grafo.vertices.get(aresta.source);
    const to = grafo.vertices.get(aresta.target);

    const xFrom = from.x;
    const yFrom = from.y;
    const xTo = to.x;
    const yTo = to.y;

    const dx = xTo - xFrom;
    const dy = yTo - yFrom;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {dx, dy, len};
}

function cancelarDesenhoAresta() {
    if (currentLine) {
        currentLine.remove();
        currentLine = null;
    }
    isDrawingEdge = false;
    startNode = null;
}

document.addEventListener("keydown", (e) => {
    if (modoAtual !== "selecionar" || !itemSelecionado) return;
    if (e.key === "Delete") {
        if (itemSelecionado.id) {
            const id = itemSelecionado.id;
            grafo.removerVertice(id);
            nodes = nodes.filter(n => n.id !== id);
            links = links.filter(l => l.source !== id && l.target !== id);
        } else if (itemSelecionado.source && itemSelecionado.target) {
            grafo.removerAresta(itemSelecionado.source, itemSelecionado.target);
            links = links.filter(l =>
                !(l.source === itemSelecionado.source && l.target === itemSelecionado.target) &&
                !(l.bidirectional && l.source === itemSelecionado.target && l.target === itemSelecionado.source)
            );
        }
        itemSelecionado = null;
        desenharGrafoCompleto();
    }
});

function encontrarVerticeMaisProximo(xCoordInZoomGroup, yCoordInZoomGroup) {
    const tolerance = 1;
    return nodes.find(n => {
        return Math.hypot(n.x - xCoordInZoomGroup, n.y - yCoordInZoomGroup) <= (tamanhoVertice + tolerance);
    }) || null;
}

// --- CARREGAMENTO INICIAL DO GRAFO ---
const grafoSalvo = localStorage.getItem("grafo-importado");

if (grafoSalvo) {
    const data = JSON.parse(grafoSalvo);
    grafo = new Grafo();

    const minX = Math.min(...data.nodes.map(n => n.x));
    const minY = Math.min(...data.nodes.map(n => n.y));

    nodes = data.nodes.map(n => ({
        id: n.id,
        x: n.x - minX,
        y: (n.y - minY) * -1
    }));

    grafo.carregarDoJSON({ nodes: nodes, edges: data.edges });

    links = data.edges.map(e => ({
        source: e.from,
        target: e.to,
        bidirectional: e.bidirectional !== false
    }));
    desenharGrafoCompleto();
    centralizarGrafo();
} else {
    desenharGrafoCompleto();
    if (nodes.length > 0) {
        centralizarGrafo();
    } else {
        const svgHeight = svg.node().getBoundingClientRect().height;
        const initialTransform = d3.zoomIdentity.scale(1, -1).translate(0, -svgHeight);
        svg.call(zoom.transform, initialTransform);
        currentTransform = initialTransform;
    }
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

function fazParteDoCaminho(d, caminho) {
    for (let i = 0; i < caminho.length - 1; i++) {
        const a = caminho[i];
        const b = caminho[i + 1];

        if (d.source === a && d.target === b) return true;
        if (d.bidirectional && d.source === b && d.target === a) return true;
    }
    return false;
}

function atualizarVertices() {
    const strokeWidth = calcularTamanhoStroke(tamanhoVertice);
    zoomGroup.selectAll(".node")
        .attr("r", tamanhoVertice)
        .attr("stroke-width", strokeWidth);
    zoomGroup.selectAll(".selected-node")
        .attr("r", tamanhoVertice)
        .attr("stroke-width", strokeWidth);
    if (enumerarVertices) {
        zoomGroup.selectAll(".node-label")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .raise(); // traz os rótulos para frente
    }
}

function atualizarArestas() {
    zoomGroup.selectAll(".link").attr("stroke-width", larguraAresta);
}

function atualizarSetas() {
    svg.select("#arrowhead")
        .attr("markerWidth", tamanhoSeta)
        .attr("markerHeight", tamanhoSeta);

    svg.select("#arrowhead-green")
        .attr("markerWidth", tamanhoSeta)
        .attr("markerHeight", tamanhoSeta);
}

function atualizarDistanciaSetas() {
    zoomGroup.selectAll(".link.directional")
        .attr("x2", d => calcularPontoFinalX(d, true))
        .attr("y2", d => calcularPontoFinalY(d, true));
}

function desenharGrafoCompleto() {
    zoomGroup.selectAll("*").remove();

    const linksSelection = zoomGroup.selectAll(".link")
        .data(links)
        .enter()
        .append("line")
        .attr("class", d => d.bidirectional ? "link" : "link directional")
        .attr("stroke-width", larguraAresta)
        .attr("stroke", "#868baf")
        .attr("marker-end", d => {
            return d.bidirectional ? null : "url(#arrowhead)";
        })
        .attr("x1", d => grafo.vertices.get(d.source).x)
        .attr("y1", d => grafo.vertices.get(d.source).y)
        .attr("x2", d => calcularPontoFinalX(d, true))
        .attr("y2", d => calcularPontoFinalY(d, true));
    configurarEventosAresta(linksSelection);

    const nodesSelection = zoomGroup.selectAll(".node")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", tamanhoVertice)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("fill", "#4960dd");
    configurarEventosNo(nodesSelection);

    atualizarSetas();
    atualizarVertices();
    atualizarArestas();
    atualizarDistanciaSetas();
    // Chamar atualização de visibilidade de labels e pesos ao redesenhar
    atualizarEnumeracaoVertices();
    atualizarPesosArestas();
}

// --- FUNÇÕES DE LÓGICA DO GRAFO (DIJKSTRA) ---

window.executarDijkstra = function () {
    if (origemClicada === null || destinoClicada === null) {
        document.getElementById("status").textContent = "Status = Selecione Dois Vértices ⚠️";
        return;
    }

    document.getElementById("status").textContent = "Status = Calculando...";

    const inicio = performance.now();
    const resultado = grafo.dijkstra(origemClicada, destinoClicada);
    const fim = performance.now();

    const tempoDecorrido = ((fim - inicio) / 1000).toFixed(3);

    document.getElementById("velocidade").textContent = `Velocidade = ${tempoDecorrido}s`;
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

window.resetarSelecao = function () {
    tabela.innerHTML = "";
    origemClicada = null;
    destinoClicada = null;

    circulosSelecionados.forEach(circulo => {
        circulo
            .attr("fill", "#4960dd")
            .attr("r", tamanhoVertice);
    });

    circulosSelecionados = [];

    svg.selectAll(".link").classed("path", false);
    zoomGroup.selectAll(".link")
        .classed("path", false)
        .attr("marker-end", d => d.bidirectional ? null : "url(#arrowhead)");

    zoomGroup.selectAll(".node")
        .classed("path", false);

    document.getElementById("velocidade").textContent = "Velocidade = 0s";
    document.getElementById("status").textContent = "Status = Aguardando";
    document.getElementById("explorados").textContent = "Nós explorados = 0";
    document.getElementById("custo").textContent = "Custo = 0";
};

// Limpa todos os nós, arestas e reinicia o estado do grafo
window.limparGrafo = function () {
    grafo = new Grafo();
    nodes = [];
    links = [];
    itemSelecionado = null;
    origemClicada = null;
    destinoClicada = null;
    zoomGroup.selectAll(".selected-node.temp-selection").remove();
    circulosSelecionados = [];
    contadorId = 1;
    desenharGrafoCompleto(); // Redesenha o grafo vazio e reaplica configurações visuais
    resetarSelecao(); // Limpa a tabela e stats
    centralizarGrafo(); // Centraliza a view para o grafo vazio
};

// Copia a imagem atual do SVG do grafo para a área de transferência
window.copiarImagemGrafo = async function () {
    try {
        const svgElement = document.querySelector("svg");
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });

        const canvas = document.createElement("canvas");
        const rect = svgElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext("2d");

        const img = new Image();
        const url = URL.createObjectURL(svgBlob);

        img.onload = async () => {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            alert("Imagem do grafo copiada para a área de transferência!");
        };

        img.src = url;
    } catch (err) {
        console.error("Erro ao copiar grafo:", err);
        alert("Falha ao copiar o grafo. Verifique permissões do navegador.");
    }
};


function centralizarGrafo() {
    const svgRect = svg.node().getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    if (nodes.length === 0) {
        const initialTransform = d3.zoomIdentity.scale(1, -1).translate(0, -svgHeight);
        svg.transition().duration(750).call(zoom.transform, initialTransform);
        currentTransform = initialTransform;
        return;
    }

    const minX = d3.min(nodes, d => d.x);
    const maxX = d3.max(nodes, d => d.x);
    const minY = d3.min(nodes, d => d.y);
    const maxY = d3.max(nodes, d => d.y);

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const padding = 0.1;

    const scaleX = svgWidth / (graphWidth * (1 + padding));
    const scaleY = svgHeight / (graphHeight * (1 + padding));
    const finalScale = Math.min(scaleX, scaleY);
    const effectiveScale = isFinite(finalScale) && finalScale > 0 ? finalScale : 1;

    const graphCenterX = minX + graphWidth / 2;
    const graphCenterY = minY + graphHeight / 2;

    const newTransform = d3.zoomIdentity
        .translate(svgWidth / 2, svgHeight / 2)
        .scale(effectiveScale, -effectiveScale)
        .translate(-graphCenterX, -graphCenterY);

    svg.transition()
        .duration(750)
        .call(zoom.transform, newTransform);

    currentTransform = newTransform;
}

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
configurarToolbar();
configurarMenuPrincipal(); // NOVO: Chama a função para configurar o menu principal