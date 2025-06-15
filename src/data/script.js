import { parseOSM } from '../graph/mapConverter.js'; // <-- você pode exportar a função parseOSM do código do Claudio

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const osmText = e.target.result;
        const grafo = parseOSM(osmText);

        // Salva temporariamente no localStorage
        localStorage.setItem("grafo-importado", JSON.stringify(grafo));

        // Redireciona para a página de visualização
        window.location.href = "graphVisualization.html";
    };
    reader.readAsText(file);
});