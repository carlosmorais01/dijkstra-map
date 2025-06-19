/**
 * @file script.js
 * @description Lida com a seleção de arquivos (OSM ou JSON) para importação de dados de grafo
 * e redireciona o usuário para a página de visualização do grafo.
 */

import { parseOSM } from '../graph/mapConverter.js';

/**
 * @const {HTMLInputElement} fileInput - O elemento de input de arquivo com o ID "fileInput".
 */
const fileInput = document.getElementById("fileInput");

/**
 * Adiciona um ouvinte de evento para o evento 'change' no input de arquivo.
 * Quando um arquivo é selecionado:
 * - Lê o conteúdo do arquivo como texto.
 * - Tenta parsear o conteúdo como um arquivo OSM ou JSON, com base na extensão do arquivo.
 * - Armazena o grafo parseado no `localStorage` sob a chave "grafo-importado".
 * - Redireciona o navegador para "graphVisualization.html".
 * - Em caso de erro (formato não suportado ou erro de parse), exibe um alerta e loga o erro.
 */
fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = String(e.target.result);
        let grafo;

        try {
            if (file.name.endsWith(".osm")) {
                grafo = parseOSM(content);
            } else if (file.name.endsWith(".json")) {
                grafo = JSON.parse(content);
            } else {
                alert("Formato de arquivo não suportado. Use .json ou .osm");
                return;
            }

            localStorage.setItem("grafo-importado", JSON.stringify(grafo));
            window.location.href = "graphVisualization.html";
        } catch (err) {
            alert("Erro ao importar o arquivo. Verifique se o conteúdo está correto.");
            console.error(err);
        }
    };

    reader.readAsText(file);
});

/**
 * Adiciona um ouvinte de evento para o clique no botão com o ID "gerarGrafo".
 * Quando o botão é clicado:
 * - Previne o comportamento padrão do formulário (se houver).
 * - Remove qualquer grafo previamente importado do `localStorage`.
 * - Redireciona o navegador para "graphVisualization.html" para iniciar uma nova visualização de grafo.
 */
document.getElementById("gerarGrafo").addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("grafo-importado");
    window.location.href = "graphVisualization.html";
});