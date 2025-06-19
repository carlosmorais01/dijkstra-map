import { parseOSM } from '../graph/mapConverter.js';

const fileInput = document.getElementById("fileInput");

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

document.getElementById("gerarGrafo").addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("grafo-importado");
    window.location.href = "graphVisualization.html";
});
