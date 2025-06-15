let grafoGlobal = null;
let nomeBase = "grafo";

document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        nomeBase = file.name.replace(/\.[^/.]+$/, "");
        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const graph = parseOSM(text);
            grafoGlobal = graph;
            document.getElementById("output").textContent = JSON.stringify(graph, null, 2);
            document.getElementById("exportBtn").disabled = false;
        };
        reader.readAsText(file);
    }
});

export function parseOSM(osmText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(osmText, "text/xml");

    const nodeMap = new Map();
    const nodes = [];
    let internalId = 0;

    xmlDoc.querySelectorAll("node").forEach((nodeEl) => {
        const id = nodeEl.getAttribute("id");
        const lat = parseFloat(nodeEl.getAttribute("lat"));
        const lon = parseFloat(nodeEl.getAttribute("lon"));

        nodeMap.set(id, internalId);

        const { x, y } = converterParaUTM(lat, lon);

        nodes.push({ id: internalId, lat, lon, x, y });
        internalId++;
    });

    const edges = [];
    let edgeId = 0;

    xmlDoc.querySelectorAll("way").forEach((wayEl) => {
        const onewayTag = wayEl.querySelector('tag[k="oneway"]');
        const oneway = onewayTag ? onewayTag.getAttribute("v") : null;
        const isOneWay = oneway === "yes" || oneway === "1" || oneway === "true";
        const isReverse = oneway === "-1";
        const bidirectional = !(isOneWay || isReverse);

        const ndList = wayEl.querySelectorAll("nd");
        for (let i = 0; i < ndList.length - 1; i++) {
            const fromId = nodeMap.get(ndList[i].getAttribute("ref"));
            const toId = nodeMap.get(ndList[i + 1].getAttribute("ref"));

            if (fromId !== undefined && toId !== undefined) {
                if (isReverse) {
                    edges.push({ id: edgeId++, from: toId, to: fromId, bidirectional: false });
                } else {
                    edges.push({ id: edgeId++, from: fromId, to: toId, bidirectional });
                }
            }
        }
    });

    return { nodes, edges };
}

function converterParaUTM(latDeg, lonDeg) {
    const PI = Math.PI;

    const a = 6378137.0;
    const f = 1.0 / 298.257223563;
    const k0 = 0.9996;

    const zone = Math.floor((lonDeg + 180) / 6) + 1;
    const lon0_deg = (zone - 1) * 6 - 180 + 3;
    const lon0 = lon0_deg * PI / 180.0;

    const e2 = f * (2 - f);
    const ep2 = e2 / (1 - e2);

    const lat = latDeg * PI / 180.0;
    const lon = lonDeg * PI / 180.0;

    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const T = Math.tan(lat) ** 2;
    const C = ep2 * Math.cos(lat) ** 2;
    const A = (lon - lon0) * Math.cos(lat);

    const M = a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat)
        - (35 * e2 ** 3 / 3072) * Math.sin(6 * lat)
    );

    let easting = k0 * N * (
        A + (1 - T + C) * A ** 3 / 6
        + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120
    ) + 500000.0;

    let northing = k0 * (
        M + N * Math.tan(lat) * (
            A ** 2 / 2
            + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
            + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720
        )
    );

    if (latDeg < 0) {
        northing += 10000000.0;
    }

    return { x: easting, y: northing, zone };
}