/**
 * @file graphBuilder.js
 * @brief Este arquivo é responsável por construir e gerenciar a interface gráfica de um grafo usando D3.js.
 * Ele lida com a interatividade do usuário, como adicionar, remover e mover nós e arestas,
 * além de funcionalidades de importação/exportação e visualização de algoritmos de caminho mínimo.
 * @author Carlos
 * @date 19/06/2025
 */

import { Grafo } from './grafo.js'; // Importa a classe Grafo de um módulo local
import { parseOSM } from './mapConverter.js'; // Importa a função parseOSM para lidar com arquivos OpenStreetMap

/** @global {string|null} origemClicada - O ID do nó de origem selecionado para o cálculo de caminho. */
let origemClicada = null;
/** @global {string|null} destinoClicada - O ID do nó de destino selecionado para o cálculo de caminho. */
let destinoClicada = null;
/** @global {Array<d3.Selection>} circulosSelecionados - Array de seleções D3 para os círculos de nós que foram clicados (origem/destino). */
let circulosSelecionados = [];

/** @global {d3.Selection} svg - A seleção D3 para o elemento SVG principal onde o grafo é desenhado. */
const svg = d3.select("svg");
/** @global {HTMLElement} tabela - A referência ao corpo da tabela HTML onde os detalhes do caminho são exibidos. */
const tabela = document.querySelector("#tabela-caminho tbody");
/** @global {HTMLElement} totalNodesSpan - A referência ao span HTML onde o total de nós é exibido. */
const totalNodesSpan = document.querySelector("#total-nodes"); // <-- Adicione esta linha
/** @global {Grafo} grafo - Uma instância da classe Grafo que representa a estrutura de dados do grafo. */
let grafo = new Grafo();
/** @global {Array<Object>} nodes - Um array de objetos representando os nós do grafo com suas coordenadas (id, x, y). */
let nodes = [];
/** @global {Array<Object>} links - Um array de objetos representando as arestas do grafo (source, target, bidirectional). */
let links = [];
/** @global {number} contadorId - Um contador para gerar IDs sequenciais para novos nós. */
let contadorId = 1;

/** @global {d3.Selection} zoomGroup - Um grupo SVG para aplicar transformações de zoom e pan ao grafo. */
const zoomGroup = svg.append("g");
/** @global {d3.Selection} nodeTooltip - A seleção D3 para o elemento HTML do tooltip do nó. */
const nodeTooltip = d3.select("#node-tooltip");

/** @global {boolean} isDrawingEdge - Sinalizador que indica se o usuário está atualmente desenhando uma aresta. */
let isDrawingEdge = false;
/** @global {string|null} startNode - O ID do nó onde o desenho da aresta começou. */
let startNode = null;
/** @global {d3.Selection|null} currentLine - A seleção D3 para a linha temporária que representa a aresta sendo desenhada. */
let currentLine = null;
/** @global {string} edgeType - O tipo de aresta a ser adicionada ('undirected' ou 'directed'). */
let edgeType = 'undirected';

/** @global {number} tamanhoVertice - O raio dos nós em pixels. */
let tamanhoVertice = 3;
/** @global {number} larguraAresta - A largura das arestas em pixels. */
let larguraAresta = 1.5;
/** @global {number} tamanhoSeta - O tamanho das setas das arestas direcionadas. */
let tamanhoSeta = 6;
/** @global {number} distanciaSeta - A distância da seta do nó de destino em arestas direcionadas. */
let distanciaSeta = 1;

/** @global {boolean} enumerarVertices - Sinalizador para controlar a exibição dos IDs dos nós. */
let enumerarVertices = false;
/** @global {boolean} mostrarPesosArestas - Sinalizador para controlar a exibição dos pesos das arestas. */
let mostrarPesosArestas = false;

// Listeners para os sliders de configuração visual
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

// Definição das setas (markers) para arestas direcionadas
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

/** @global {string} modoAtual - O modo de interação atual ('selecionar', 'add-node', 'add-edge-undirected', 'add-edge-directed', 'origem-destino', 'apagar'). */
let modoAtual = "selecionar";
/** @global {Object|null} itemSelecionado - O nó ou aresta atualmente selecionado no modo 'selecionar'. */
let itemSelecionado = null;

/**
 * @brief Configura os event listeners para os botões da barra de ferramentas.
 * Permite alternar entre diferentes modos de interação (selecionar, adicionar nó, adicionar aresta, apagar, origem/destino).
 */
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

    document.addEventListener("click", (event) => {
        if (!edgeMainButton.contains(event.target) && !edgeDropdown.contains(event.target)) {
            edgeDropdown.classList.remove("show");
        }
        const mainMenuToggle = document.getElementById("menu-toggle-arrow");
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

// Adicione esta função em algum lugar do seu graphBuilder.js (por exemplo, abaixo de 'resetarSelecao')
/**
 * @brief Atualiza a exibição do total de nós na interface.
 */
function atualizarContagemNos() {
    totalNodesSpan.textContent = `Total de Nós = ${nodes.length}`;
}

/**
 * @brief Configura os event listeners para os itens do menu principal.
 * Inclui funcionalidades como novo grafo, importação/exportação, copiar imagem e configurações de visualização.
 */
function configurarMenuPrincipal() {
    const mainMenuToggle = document.getElementById("menu-toggle-arrow");
    const mainMenuContent = document.getElementById("app-main-menu");
    const fileInput = document.getElementById("file-input");

    if (mainMenuToggle) {
        mainMenuToggle.addEventListener("click", (event) => {
            event.stopPropagation();
            mainMenuContent.classList.toggle("show");
        });
    }

    document.querySelectorAll(".dropdown-item.has-submenu").forEach(item => {
        item.addEventListener("mouseenter", () => {
            item.querySelector(".submenu-content").style.display = "block";
        });
        item.addEventListener("mouseleave", () => {
            item.querySelector(".submenu-content").style.display = "none";
        });
    });

    document.getElementById("new-graph-btn").addEventListener("click", () => {
        window.limparGrafo();
        mainMenuContent.classList.remove("show");
    });

    document.getElementById("import-graph-btn").addEventListener("click", () => {
        fileInput.click();
        mainMenuContent.classList.remove("show");
    });

    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = String(e.target.result);

                try {
                    if (file.name.endsWith(".osm")) {
                        const parsed = parseOSM(content);
                        importarGrafo(parsed);
                    } else {
                        const data = JSON.parse(content);
                        importarGrafo(data);
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

    /**
     * @brief Importa dados de grafo de um objeto JSON (ou OSM parseado) e os desenha na interface.
     * @param {Object} data - O objeto contendo os nós e arestas do grafo.
     * @param {Array<Object>} data.nodes - Array de objetos de nós com id, x, y.
     * @param {Array<Object>} data.edges - Array de objetos de arestas com from, to, bidirectional.
     */
    function importarGrafo(data) {
        grafo = new Grafo();

        // Normaliza as coordenadas para que o ponto mais à esquerda/inferior seja (0,0) ou similar
        const minX = Math.min(...data.nodes.map(n => n.x));
        const minY = Math.min(...data.nodes.map(n => n.y));

        nodes = data.nodes.map(n => ({
            id: n.id,
            x: n.x - minX,
            y: (n.y - minY) * -1 // Inverte o eixo Y para exibição no SVG (origem no canto superior esquerdo)
        }));

        grafo.carregarDoJSON({ nodes, edges: data.edges });

        links = data.edges.map(e => ({
            source: e.from,
            target: e.to,
            bidirectional: e.bidirectional !== false // Assume true se não especificado
        }));

        desenharGrafoCompleto();
        centralizarGrafo();
        window.resetarSelecao();
        atualizarContagemNos();

        if (nodes.length > 0) {
            // Atualiza o contador de ID para continuar a partir do maior ID existente
            const max = Math.max(...nodes.map(n => parseInt(String(n.id).replace(/\D+/g, ''))).filter(n => !isNaN(n)));
            contadorId = max + 1;
        }
    }

    document.getElementById("copy-to-clipboard-btn").addEventListener("click", () => {
        window.copiarImagemGrafo();
        mainMenuContent.classList.remove("show");
    });

    document.getElementById("save-graph-btn").addEventListener("click", () => {
        salvarGrafoLocal();
        mainMenuContent.classList.remove("show");
    });

    const enumerateNodesSwitch = document.getElementById("enumerate-nodes-switch");
    const showEdgeWeightsSwitch = document.getElementById("show-edge-weights-switch");

    // Carrega as preferências de exibição do localStorage
    enumerarVertices = localStorage.getItem("enumerarVertices") === "true";
    mostrarPesosArestas = localStorage.getItem("mostrarPesosArestas") === "true";

    enumerateNodesSwitch.checked = enumerarVertices;
    showEdgeWeightsSwitch.checked = mostrarPesosArestas;

    enumerateNodesSwitch.addEventListener("change", (event) => {
        enumerarVertices = event.target.checked;
        localStorage.setItem("enumerarVertices", enumerarVertices);
        atualizarEnumeracaoVertices();
    });

    showEdgeWeightsSwitch.addEventListener("change", (event) => {
        mostrarPesosArestas = event.target.checked;
        localStorage.setItem("mostrarPesosArestas", mostrarPesosArestas);
        atualizarPesosArestas();
    });
}

/**
 * @brief Salva o grafo atual em um arquivo JSON local.
 * Inclui os nós e arestas com suas respectivas propriedades.
 */
function salvarGrafoLocal() {
    const dataToSave = {
        nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y * -1 })), // Inverte o Y de volta para o formato original
        edges: links.map(l => ({ from: l.source, to: l.target, bidirectional: l.bidirectional }))
    };
    const dataStr = JSON.stringify(dataToSave, null, 2);

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

/**
 * @brief Atualiza a exibição dos IDs dos vértices no grafo.
 * Adiciona, atualiza ou remove os rótulos de texto com base na variável `enumerarVertices`.
 */
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
                .attr("font-size", d => Math.max(0.001, tamanhoVertice) + "px") // Garante tamanho mínimo
                .attr("x", d => d.x)
                .attr("y", d => d.y + 0.25) // Pequeno offset para centralização visual
                .text(d => d.id),
            update => update
                .attr("x", d => d.x)
                .attr("y", d => d.y + 0.25)
                .attr("font-size", d => Math.max(0.001, tamanhoVertice) + "px")
                .text(d => d.id),
            exit => exit.remove()
        );

        zoomGroup.selectAll(".node-label").raise(); // Garante que os rótulos fiquem acima dos nós
    } else {
        zoomGroup.selectAll(".node-label").remove();
    }
}

/**
 * @brief Atualiza a exibição dos pesos das arestas no grafo.
 * Adiciona, atualiza ou remove os rótulos de texto com base na variável `mostrarPesosArestas`.
 */
function atualizarPesosArestas() {
    if (mostrarPesosArestas) {
        const weightLabels = zoomGroup.selectAll(".link-weight-label")
            .data(links, d => `${d.source}-${d.target}-${d.bidirectional}`);

        weightLabels.enter()
            .append("text")
            .attr("class", "link-weight-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .merge(weightLabels)
            .attr("x", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                let midX = (from.x + to.x) / 2;
                let midY = (from.y + to.y) / 2;

                const offset = 5; // Offset para evitar sobreposição com a aresta
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                midX += Math.sin(angle) * offset;
                midY -= Math.cos(angle) * offset;
                return midX;
            })
            .attr("y", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                let midX = (from.x + to.x) / 2;
                let midY = (from.y + to.y) / 2;

                const offset = 5;
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                midX += Math.sin(angle) * offset;
                midY -= Math.cos(angle) * offset;
                return midY;
            })
            .attr("font-size", d => Math.max(2, larguraAresta * 5) + "px") // Tamanho da fonte proporcional à largura da aresta
            .attr("fill", "#393939")
            .attr("pointer-events", "none") // Impede que o texto bloqueie eventos de mouse nas arestas
            .text(d => {
                const distance = grafo.distanciaEntre(d.source, d.target);
                return distance !== null && isFinite(distance) ? distance.toFixed(2) : '';
            });

        weightLabels.exit().remove();
    } else {
        zoomGroup.selectAll(".link-weight-label").remove();
    }
}

/**
 * @brief Reinicia a seleção visual de todos os nós e arestas para o estado padrão.
 * Remove classes 'selecionado' e redefine cores e raios.
 */
function resetarSelecaoVisual() {
    zoomGroup.selectAll(".node").attr("fill", "#4960dd").classed("selecionado", false);
    zoomGroup.selectAll(".link").attr("stroke", "#868baf").classed("selecionado", false);
    itemSelecionado = null;
}

/** @global {d3.ZoomTransform} currentTransform - A transformação de zoom atual aplicada ao `zoomGroup`. */
let currentTransform = d3.zoomIdentity;

/** @global {d3.ZoomBehavior} zoom - O comportamento de zoom e pan do D3.js. */
const zoom = d3.zoom()
    .scaleExtent([0.02, 1000]) // Define os limites de escala
    .on("zoom", (event) => {
        currentTransform = event.transform;
        zoomGroup.attr("transform", currentTransform);
        atualizarEnumeracaoVertices();
        atualizarPesosArestas();
    });

svg.call(zoom); // Aplica o comportamento de zoom ao SVG

// Event listener para o clique no SVG (usado para adicionar nós)
svg.on("click", (event) => {
    if (modoAtual === "add-node") {
        const [mouseX, mouseY] = d3.pointer(event);
        const [xLogico, yLogico] = currentTransform.invert([mouseX, mouseY]);

        const id = gerarIdSequencial();
        grafo.adicionarVertice(id, xLogico, yLogico);
        nodes.push({ id, x: xLogico, y: yLogico });
        desenharNovoNo(id, xLogico, yLogico);
        atualizarContagemNos();
    }
});

/**
 * @brief Configura os eventos de mouse e arrasto para uma seleção de nós.
 * @param {d3.Selection} selection - A seleção D3 dos elementos de círculo que representam os nós.
 */
function configurarEventosNo(selection) {
    selection
        .on("click", function (event, d) {
            event.stopPropagation(); // Impede que o clique se propague para o SVG pai

            if (modoAtual === "origem-destino") {
                if (origemClicada && destinoClicada) {
                    return; // Já selecionou origem e destino
                }

                if (d.id === origemClicada || d.id === destinoClicada) {
                    return; // Clicou em um nó já selecionado como origem ou destino
                }

                if (!origemClicada) {
                    origemClicada = d.id;
                    d3.select(this).attr("fill", "orange").attr("r", tamanhoVertice * 1.2); // Destaca a origem
                    circulosSelecionados.push(d3.select(this));
                } else if (!destinoClicada) {
                    destinoClicada = d.id;
                    d3.select(this).attr("fill", "red").attr("r", tamanhoVertice * 1.2); // Destaca o destino
                    circulosSelecionados.push(d3.select(this));
                }
            } else if (modoAtual === "apagar") {
                grafo.removerVertice(d.id);
                nodes = nodes.filter(n => n.id !== d.id);
                links = links.filter(l => l.source !== d.id && l.target !== d.id);
                desenharGrafoCompleto(); // Redesenha o grafo após a remoção
                atualizarContagemNos();
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
                .filter(event => modoAtual === "selecionar" || modoAtual.startsWith("add-edge-")) // Permite arrastar no modo selecionar ou para desenhar arestas
                .on("start", function (event, d) {
                    nodeTooltip.style("display", "none");
                    d._dragStart = { x: event.x, y: event.y }; // Salva a posição inicial do arrasto

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
                            .attr("stroke-dasharray", "5,5"); // Linha tracejada para indicar desenho
                    } else if (modoAtual === "selecionar") {
                        d3.select(this).raise().attr("stroke", "black"); // Move o nó selecionado para frente e adiciona borda
                        zoomGroup.selectAll(".node-label")
                            .filter(lbl => lbl.id === d.id)
                            .raise(); // Garante que o rótulo do nó também seja elevado
                    }
                })
                .on("drag", function (event, d) {
                    if (modoAtual === "selecionar") {
                        d.x = event.x;
                        d.y = event.y;
                        grafo.vertices.set(d.id, { x: d.x, y: d.y }); // Atualiza a posição no objeto Grafo

                        const index = nodes.findIndex(n => n.id === d.id);
                        if (index !== -1) {
                            nodes[index].x = d.x;
                            nodes[index].y = d.y;
                        }

                        d3.select(this)
                            .attr("cx", d.x)
                            .attr("cy", d.y);
                        atualizarPosicaoArestas(); // Atualiza a posição das arestas conectadas
                        atualizarEnumeracaoVertices(); // Atualiza a posição dos rótulos
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
                    const moved = Math.sqrt(dx * dx + dy * dy) > 2; // Verifica se houve movimento significativo

                    if (modoAtual === "selecionar") {
                        d3.select(this).attr("stroke", null); // Remove a borda após arrastar
                    } else if (modoAtual.startsWith("add-edge-")) {
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
                            // Verifica se a aresta já existe para evitar duplicatas
                            const existingLink = links.find(
                                l => (l.source === startNode && l.target === endNode.id && l.bidirectional === bidirectional) ||
                                    (l.source === endNode.id && l.target === startNode && l.bidirectional === bidirectional && bidirectional)
                            );

                            if (!existingLink) {
                                grafo.adicionarAresta(startNode, endNode.id, bidirectional);
                                links.push({source: startNode, target: endNode.id, bidirectional: bidirectional});
                                desenharNovaAresta(startNode, endNode.id, bidirectional);
                            }
                        }
                        startNode = null;
                    }
                })
        )
}

/**
 * @brief Desenha um novo nó no SVG.
 * @param {string} id - O ID do novo nó.
 * @param {number} x - A coordenada X do nó.
 * @param {number} y - A coordenada Y do nó.
 */
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
    atualizarEnumeracaoVertices(); // Atualiza os rótulos de nós, caso estejam habilitados
    atualizarContagemNos();
}

/**
 * @brief Desenha uma nova aresta no SVG.
 * @param {string} sourceId - O ID do nó de origem da aresta.
 * @param {string} targetId - O ID do nó de destino da aresta.
 * @param {boolean} bidirectional - Verdadeiro se a aresta for bidirecional, falso caso contrário.
 */
function desenharNovaAresta(sourceId, targetId, bidirectional) {
    const newLink = { source: sourceId, target: targetId, bidirectional: bidirectional };
    const from = grafo.vertices.get(newLink.source);
    const to = grafo.vertices.get(newLink.target);

    const x1 = from.x;
    const y1 = from.y;
    // Calcula o ponto final da aresta considerando a seta, se for direcionada
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

    // Garante que nós e rótulos estejam acima das arestas
    zoomGroup.selectAll(".node").raise();
    zoomGroup.selectAll(".selected-node.temp-selection").raise();
    zoomGroup.selectAll(".node-label").raise();
    atualizarPesosArestas(); // Atualiza os pesos das arestas, caso estejam habilitados
}

/**
 * @brief Configura os eventos de mouse para uma seleção de arestas.
 * @param {d3.Selection} selection - A seleção D3 dos elementos de linha que representam as arestas.
 */
function configurarEventosAresta(selection) {
    selection
        .on("click", function (event, d) {
            if (modoAtual === "apagar") {
                grafo.removerAresta(d.source, d.target);
                // Remove a aresta do array 'links', considerando arestas bidirecionais
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
                .attr("stroke", "#EB3A3B") // Destaca a aresta selecionada
                .classed("selecionado", true);
            itemSelecionado = d; // Armazena a aresta selecionada
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

/**
 * @brief Calcula a largura do traço (stroke) para um nó com base no seu tamanho.
 * @param {number} tamanhoVertice - O raio do vértice.
 * @returns {number} A largura do traço.
 */
function calcularTamanhoStroke(tamanhoVertice) {
    return tamanhoVertice * 0.2;
}

/**
 * @brief Gera um ID sequencial único para novos nós.
 * @returns {string} O próximo ID disponível.
 */
function gerarIdSequencial() {
    return `${contadorId++}`;
}

/**
 * @brief Atualiza a posição de todas as arestas no grafo, incluindo seus rótulos de peso.
 * Chamado quando os nós são movidos.
 */
function atualizarPosicaoArestas() {
    atualizarDistanciaSetas(); // Garante que as setas estejam na posição correta
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
                const midY = (from.y + to.y) / 2;
                const offset = 5;
                const angle = Math.atan2(to.y - from.y, to.x - from.x);
                return midX + Math.sin(angle) * offset;
            })
            .attr("y", d => {
                const from = grafo.vertices.get(d.source);
                const to = grafo.vertices.get(d.target);
                const midX = (from.x + to.x) / 2;
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

/**
 * @brief Calcula a coordenada X do ponto final de uma aresta, ajustando para a posição da seta.
 * @param {Object} aresta - O objeto da aresta (com source, target, bidirectional).
 * @returns {number} A coordenada X final.
 */
function calcularPontoFinalX(aresta) {
    const { dx, len } = calcularDiferencasEComprimento(aresta);
    const to = grafo.vertices.get(aresta.target);
    const xTo = to.x;

    return aresta.bidirectional
        ? xTo
        : (len > 0 ? xTo - (dx / len) * (distanciaSeta + tamanhoVertice / 2) : xTo); // Ajusta pela distância da seta e metade do tamanho do vértice
}

/**
 * @brief Calcula a coordenada Y do ponto final de uma aresta, ajustando para a posição da seta.
 * @param {Object} aresta - O objeto da aresta (com source, target, bidirectional).
 * @returns {number} A coordenada Y final.
 */
function calcularPontoFinalY(aresta) {
    const { dy, len } = calcularDiferencasEComprimento(aresta);
    const to = grafo.vertices.get(aresta.target);
    const yTo = to.y;

    return aresta.bidirectional
        ? yTo
        : (len > 0 ? yTo - (dy / len) * (distanciaSeta + tamanhoVertice / 2) : yTo); // Ajusta pela distância da seta e metade do tamanho do vértice
}

/**
 * @brief Calcula as diferenças nas coordenadas (dx, dy) e o comprimento (len) de uma aresta.
 * @param {Object} aresta - O objeto da aresta (com source, target).
 * @returns {{dx: number, dy: number, len: number}} Um objeto contendo dx, dy e len.
 */
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
    return { dx, dy, len };
}

/**
 * @brief Cancela qualquer operação de desenho de aresta em andamento.
 * Remove a linha temporária e redefine as variáveis de estado.
 */
function cancelarDesenhoAresta() {
    if (currentLine) {
        currentLine.remove();
        currentLine = null;
    }
    isDrawingEdge = false;
    startNode = null;
}

// Event listener para a tecla 'Delete' para remover itens selecionados
document.addEventListener("keydown", (e) => {
    if (modoAtual !== "selecionar" || !itemSelecionado) return;
    if (e.key === "Delete") {
        if (itemSelecionado.id) { // Se for um nó
            const id = itemSelecionado.id;
            grafo.removerVertice(id);
            nodes = nodes.filter(n => n.id !== id);
            links = links.filter(l => l.source !== id && l.target !== id);
            atualizarContagemNos();
        } else if (itemSelecionado.source && itemSelecionado.target) { // Se for uma aresta
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

/**
 * @brief Encontra o vértice mais próximo a uma dada coordenada.
 * @param {number} xCoordInZoomGroup - Coordenada X no grupo de zoom.
 * @param {number} yCoordInZoomGroup - Coordenada Y no grupo de zoom.
 * @returns {Object|null} O nó mais próximo ou null se nenhum for encontrado dentro da tolerância.
 */
function encontrarVerticeMaisProximo(xCoordInZoomGroup, yCoordInZoomGroup) {
    const tolerance = 1; // Tolerância para cliques próximos ao nó
    return nodes.find(n => {
        return Math.hypot(n.x - xCoordInZoomGroup, n.y - yCoordInZoomGroup) <= (tamanhoVertice + tolerance);
    }) || null;
}

// Carrega o grafo salvo localmente ao iniciar
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
        // Se não há grafo salvo e nenhum nó, inicializa a transformação para centralizar o SVG
        const svgHeight = svg.node().getBoundingClientRect().height;
        const initialTransform = d3.zoomIdentity.scale(1, -1).translate(0, -svgHeight);
        svg.call(zoom.transform, initialTransform);
        currentTransform = initialTransform;
    }
}

// Atualiza o contador de ID com base nos nós existentes (após carregar ou se for um novo grafo)
if (nodes.length > 0) {
    const max = Math.max(
        ...nodes
            .map(n => parseInt(String(n.id).replace(/\D+/g, '')))
            .filter(n => !isNaN(n))
    );
    contadorId = max + 1;
}

/**
 * @brief Verifica se uma aresta faz parte de um caminho especificado.
 * @param {Object} d - O objeto da aresta a ser verificada (com source, target, bidirectional).
 * @param {Array<string>} caminho - Um array de IDs de nós que formam o caminho.
 * @returns {boolean} Verdadeiro se a aresta faz parte do caminho, falso caso contrário.
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
 * @brief Atualiza o tamanho visual de todos os vértices no grafo.
 */
function atualizarVertices() {
    const strokeWidth = calcularTamanhoStroke(tamanhoVertice);
    zoomGroup.selectAll(".node")
        .attr("r", tamanhoVertice)
        .attr("stroke-width", strokeWidth);
    zoomGroup.selectAll(".selected-node") // Também atualiza nós de seleção temporária
        .attr("r", tamanhoVertice)
        .attr("stroke-width", strokeWidth);
    if (enumerarVertices) {
        zoomGroup.selectAll(".node-label")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .raise();
    }
}

/**
 * @brief Atualiza a largura visual de todas as arestas no grafo.
 */
function atualizarArestas() {
    zoomGroup.selectAll(".link").attr("stroke-width", larguraAresta);
}

/**
 * @brief Atualiza o tamanho das setas das arestas direcionadas.
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
 * @brief Atualiza a distância das setas do nó de destino para arestas direcionadas.
 */
function atualizarDistanciaSetas() {
    zoomGroup.selectAll(".link.directional")
        .attr("x2", d => calcularPontoFinalX(d, true))
        .attr("y2", d => calcularPontoFinalY(d, true));
}

/**
 * @brief Redesenha completamente o grafo no SVG.
 * Remove todos os elementos existentes e os recria com base nos arrays `nodes` e `links`.
 * Garante que todas as configurações visuais sejam aplicadas.
 */
function desenharGrafoCompleto() {
    // --- Links (Arestas) ---
    const linksSelection = zoomGroup.selectAll(".link")
        .data(links, d => `${d.source}-${d.target}-${d.bidirectional}`);

    linksSelection.join(
        enter => enter.append("line")
            .attr("class", d => d.bidirectional ? "link" : "link directional")
            .attr("stroke-width", larguraAresta)
            .attr("stroke", "#868baf")
            .attr("marker-end", d => {
                return d.bidirectional ? null : "url(#arrowhead)";
            })
            .attr("x1", d => grafo.vertices.get(d.source).x)
            .attr("y1", d => grafo.vertices.get(d.source).y)
            .attr("x2", d => calcularPontoFinalX(d, true))
            .attr("y2", d => calcularPontoFinalY(d, true))
            .call(configurarEventosAresta), // Chama a função de configuração de eventos para as novas arestas
        update => update // Para arestas existentes, apenas atualiza atributos se necessário
            .attr("stroke-width", larguraAresta) // Atualiza largura caso slider mude
            .attr("stroke", "#868baf") // Volta cor padrão
            .attr("marker-end", d => {
                return d.bidirectional ? null : "url(#arrowhead)"; // Volta seta padrão
            })
            .attr("x1", d => grafo.vertices.get(d.source).x)
            .attr("y1", d => grafo.vertices.get(d.source).y)
            .attr("x2", d => calcularPontoFinalX(d, true))
            .attr("y2", d => calcularPontoFinalY(d, true)),
        exit => exit.remove() // Remove arestas que não existem mais nos dados
    );

    // --- Nodes (Vértices) ---
    const nodesSelection = zoomGroup.selectAll(".node")
        .data(nodes, d => d.id); // Key function para identificação única

    nodesSelection.join(
        enter => enter.append("circle")
            .attr("class", "node")
            .attr("r", tamanhoVertice)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("fill", "#4960dd")
            .call(configurarEventosNo), // Chama a função de configuração de eventos para os novos nós
        update => update // Para nós existentes, apenas atualiza atributos se necessário
            .attr("r", tamanhoVertice) // Atualiza raio caso slider mude
            .attr("cx", d => d.x) // Atualiza posição
            .attr("cy", d => d.y) // Atualiza posição
            .attr("fill", "#4960dd"), // Volta cor padrão
        exit => exit.remove() // Remove nós que não existem mais nos dados
    );

// As chamadas para atualizar configurações visuais agora são mais importantes.
// Elas devem atualizar os elementos *após* o join, pois eles podem ter sido criados ou atualizados.
    atualizarSetas();
    atualizarVertices();
    atualizarArestas();
    atualizarDistanciaSetas();
    atualizarEnumeracaoVertices();
    atualizarPesosArestas();

// Garante que nós e rótulos estejam acima das arestas
    zoomGroup.selectAll(".link").lower(); // Manda links para o fundo
    zoomGroup.selectAll(".node").raise(); // Traz nodes para frente
    zoomGroup.selectAll(".node-label").raise(); // Traz labels para frente
    zoomGroup.selectAll(".selected-node.temp-selection").raise(); // Traz seleções temporárias para frente
}

/**
 * @brief Executa o algoritmo de Dijkstra no grafo.
 * Destaca o caminho encontrado e exibe informações sobre o cálculo (tempo, nós explorados, custo).
 * Esta função é exposta globalmente em `window`.
 */
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

    // Destaca as arestas do caminho
    zoomGroup.selectAll(".link")
        .classed("path", d => fazParteDoCaminho(d, resultado.caminho))
        .attr("marker-end", d => {
            // Seta verde para arestas do caminho, mas mantém seta padrão para outras
            return d.bidirectional
                ? null
                : (fazParteDoCaminho(d, resultado.caminho)
                    ? "url(#arrowhead-green)"
                    : "url(#arrowhead)");
        });

    // Destaca os nós do caminho
    zoomGroup.selectAll(".node")
        .classed("path", d => resultado.caminho.includes(d.id));
    circulosSelecionados.forEach(circulo => {
        const nodeId = circulo.datum().id; // Pega o ID do dado associado ao círculo
        if (nodeId === origemClicada) {
            circulo.attr("fill", "orange");
        } else if (nodeId === destinoClicada) {
            circulo.attr("fill", "red");
        }
        circulo.classed("path", false); // Remove a classe .path se for origem/destino
    });
    // *************************************************

    tabela.innerHTML = ""; // Limpa a tabela

    const caminho = resultado.caminho;

    // Preenche a tabela com os detalhes do caminho
    for (let i = 0; i < caminho.length; i++) {
        const atual = caminho[i];
        // Modificação AQUI: verifica se é o último elemento do caminho
        const proximo = (i + 1 < caminho.length) ? caminho[i + 1] : "-";

        let distancia = "-";
        // A condição para calcular a distância permanece a mesma, pois 'proximo' não será '-'
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
 * @brief Reseta a seleção de origem/destino e limpa os resultados do Dijkstra.
 * Esta função é exposta globalmente em `window`.
 */
window.resetarSelecao = function () {
    tabela.innerHTML = "";
    origemClicada = null;
    destinoClicada = null;

    circulosSelecionados.forEach(circulo => {
        circulo
            .attr("fill", "#4960dd") // Volta à cor padrão
            .attr("r", tamanhoVertice); // Volta ao tamanho padrão
    });

    circulosSelecionados = [];

    // Remove o destaque do caminho
    svg.selectAll(".link").classed("path", false);
    zoomGroup.selectAll(".link")
        .classed("path", false)
        .attr("marker-end", d => d.bidirectional ? null : "url(#arrowhead)");

    zoomGroup.selectAll(".node")
        .classed("path", false);

    // Reseta os textos de status
    document.getElementById("velocidade").textContent = "Velocidade = 0s";
    document.getElementById("status").textContent = "Status = Aguardando";
    document.getElementById("explorados").textContent = "Nós explorados = 0";
    document.getElementById("custo").textContent = "Custo = 0";
};

/**
 * @brief Limpa completamente o grafo, removendo todos os nós e arestas.
 * Reinicia o estado do aplicativo para um grafo vazio.
 * Esta função é exposta globalmente em `window`.
 */
window.limparGrafo = function () {
    grafo = new Grafo();
    nodes = [];
    links = [];
    itemSelecionado = null;
    origemClicada = null;
    destinoClicada = null;
    zoomGroup.selectAll(".selected-node.temp-selection").remove();
    circulosSelecionados = [];
    contadorId = 1; // Reseta o contador de ID
    desenharGrafoCompleto();
    resetarSelecao();
    centralizarGrafo(); // Centraliza o SVG vazio
    atualizarContagemNos();
};

/**
 * @brief Copia uma imagem do grafo para a área de transferência do sistema.
 * Converte o SVG para um canvas e depois para um Blob de imagem.
 * Esta função é exposta globalmente em `window`.
 */
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


/**
 * @brief Centraliza o grafo visível dentro do SVG.
 * Ajusta a escala e a translação do zoom para que todos os nós fiquem visíveis e centralizados.
 */
function centralizarGrafo() {
    const svgRect = svg.node().getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    if (nodes.length === 0) {
        // Se não há nós, centraliza a área visível do SVG
        const initialTransform = d3.zoomIdentity.scale(1, -1).translate(0, -svgHeight);
        svg.transition().duration(750).call(zoom.transform, initialTransform);
        currentTransform = initialTransform;
        return;
    }

    // Calcula os limites do grafo
    const minX = d3.min(nodes, d => d.x);
    const maxX = d3.max(nodes, d => d.x);
    const minY = d3.min(nodes, d => d.y);
    const maxY = d3.max(nodes, d => d.y);

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const padding = 0.1; // Espaço extra nas bordas

    // Calcula a escala necessária para encaixar o grafo
    const scaleX = svgWidth / (graphWidth * (1 + padding));
    const scaleY = svgHeight / (graphHeight * (1 + padding));
    const finalScale = Math.min(scaleX, scaleY);
    const effectiveScale = isFinite(finalScale) && finalScale > 0 ? finalScale : 1; // Garante uma escala válida

    // Calcula o centro do grafo
    const graphCenterX = minX + graphWidth / 2;
    const graphCenterY = minY + graphHeight / 2;

    // Cria a nova transformação para centralizar e escalar
    const newTransform = d3.zoomIdentity
        .translate(svgWidth / 2, svgHeight / 2) // Move a origem para o centro do SVG
        .scale(effectiveScale, -effectiveScale) // Aplica a escala (Y invertido)
        .translate(-graphCenterX, -graphCenterY); // Move o centro do grafo para a origem

    svg.transition()
        .duration(750) // Animação suave
        .call(zoom.transform, newTransform);

    currentTransform = newTransform;
}

// Inicializa a barra de ferramentas e o menu principal ao carregar o script
configurarToolbar();
configurarMenuPrincipal();
atualizarContagemNos();