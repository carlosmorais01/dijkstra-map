import {Grafo} from './grafo.js';

let origemClicada = null;
let destinoClicada = null;
let circulosSelecionados = [];
let xScale, yScale;

const svg = d3.select("svg");
const tabela = document.querySelector("#tabela-caminho tbody");
let grafo = new Grafo();
let nodes = [], links = [];

const zoomGroup = svg.append("g");

// Sliders e valores padrão
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
    .attr("refX", 0)  // distância do final da linha até a seta
    .attr("refY", 0)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#868baf");  // cor da seta

svg.on("click", (event) => {
    if (origemClicada && destinoClicada) return;
    const [mouseX, mouseY] = d3.pointer(event);

    // Aplicar transformação reversa do zoom:
    const transform = d3.zoomTransform(svg.node());
    const xDestransformado = (mouseX - transform.x) / transform.k;
    const yDestransformado = (mouseY - transform.y) / transform.k;

    // Encontrar o nó mais próximo da posição clicada
    const maisProximo = nodes.reduce((maisPerto, n) => {
        const distAtual = Math.hypot(xScale(n.x) - xDestransformado, yScale(n.y) - yDestransformado);
        return distAtual < maisPerto.dist ? { id: n.id, dist: distAtual, x: xScale(n.x), y: yScale(n.y) } : maisPerto;
    }, { id: null, dist: Infinity, x: 0, y: 0 });

    if (maisProximo.id !== null) {
        if (!origemClicada) {
            origemClicada = maisProximo.id;
        } else if (!destinoClicada) {
            destinoClicada = maisProximo.id;
        }

        const circulo = zoomGroup.append("circle")
            .attr("cx", maisProximo.x)
            .attr("cy", maisProximo.y)
            .attr("r", tamanhoVertice)
            .attr("fill", origemClicada && !destinoClicada ? "orange" : "red")
            .attr("class", "selected-node");

        circulosSelecionados.push(circulo);
    }
});

svg.call(
    d3.zoom()
        .scaleExtent([0.2, 2000])  // pode ir até 20x mais próximo
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        })
);

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
    zoomGroup.selectAll(".node").attr("r", tamanhoVertice);
    zoomGroup.selectAll(".selected-node").attr("r", tamanhoVertice);
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
    // Recalcula apenas as posições finais das arestas direcionais
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


function desenharGrafo() {
    zoomGroup.selectAll("*").remove();
    const padding = 100;
    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);
    const width = 1500;

    const aspect = (yExtent[1] - yExtent[0]) / (xExtent[1] - xExtent[0]);
    const height = width * aspect;


    xScale = d3.scaleLinear()
        .domain([xExtent[0] - padding, xExtent[1] + padding])
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain([yExtent[0] - padding, yExtent[1] + padding])
        .range([height, 0]); // <- aqui inverte o Y

    const encurtar = distanciaSeta;
    zoomGroup.selectAll(".link")
        .data(links)
        .enter()
        .append("line")
        .attr("class", d => d.bidirectional ? "link" : "link directional")
        .attr("stroke-width", larguraAresta)
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

            return xTo - (dx / len) * encurtar;
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

            return yTo - (dy / len) * encurtar;
        })

    zoomGroup.selectAll(".node")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", tamanhoVertice)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("fill", "#4960dd");

    svg.select("#arrowhead")
        .attr("markerWidth", tamanhoSeta)
        .attr("markerHeight", tamanhoSeta);

    svg.select("#arrowhead-green")
        .attr("markerWidth", tamanhoSeta)
        .attr("markerHeight", tamanhoSeta);

    atualizarVertices();
    atualizarArestas();
    atualizarSetas();
    atualizarDistanciaSetas();
}

window.executarDijkstra = function() {
    if (origemClicada === null || destinoClicada === null) {
        document.getElementById("status").textContent = "Status = Selecione dois vértices ⚠️";
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
        document.getElementById("status").textContent = "Status = Caminho não encontrado ❌";
    } else {
        document.getElementById("status").textContent = "Status = Caminho calculado ✅";
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

        linha.innerHTML =`
            <td>${atual}</td>
        <td>${distancia}</td>
        <td>${proximo}</td>
        `
        ;

        tabela.appendChild(linha);
    }
}

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

    document.getElementById("velocidade").textContent = "Velocidade = 0s";
    document.getElementById("status").textContent = "Status = Aguardando";
    document.getElementById("explorados").textContent = "Nós explorados = 0";
    document.getElementById("custo").textContent = "Custo = 0";
};

const toggle = document.getElementById("dropdownToggle");
const menu = document.getElementById("dropdownMenu");

toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", () => {
    menu.style.display = "none";
});