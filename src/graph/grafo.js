// grafo.js - Módulo 2

export class Grafo {
  constructor() {
    this.vertices = new Map(); // id => { x, y }
    this.adjacencias = new Map(); // id => [ { id, peso } ]
  }

  // Carrega grafo a partir de um JSON (com nodes e edges)
  carregarDoJSON(json) {
    json.nodes.forEach(n => {
      this.adicionarVertice(n.id, n.x, n.y);
    });
    if (json.edges) {
      json.edges.forEach(e => {
        const bidir = e.bidirectional !== false;
        this.adicionarAresta(e.from, e.to, bidir);
      });
    }
  }

  adicionarVertice(id, x, y) {
    if (!this.vertices.has(id)) {
      this.vertices.set(id, { x, y });
      this.adjacencias.set(id, []);
    }
  }

  removerVertice(id) {
    this.vertices.delete(id);
    this.adjacencias.delete(id);
    for (const vizinhos of this.adjacencias.values()) {
      const i = vizinhos.findIndex(v => v.id === id);
      if (i !== -1) vizinhos.splice(i, 1);
    }
  }

  adicionarAresta(origem, destino, bidirecional = true) {
    const v1 = this.vertices.get(origem);
    const v2 = this.vertices.get(destino);
    if (!v1 || !v2) return;
    const peso = this.distancia(v1, v2);
    this.adjacencias.get(origem).push({ id: destino, peso });
    if (bidirecional) {
      this.adjacencias.get(destino).push({ id: origem, peso });
    }
  }

  removerAresta(origem, destino) {
    this.adjacencias.set(
      origem,
      this.adjacencias.get(origem).filter(v => v.id !== destino)
    );
    this.adjacencias.set(
      destino,
      this.adjacencias.get(destino).filter(v => v.id !== origem)
    );
  }

  distancia(v1, v2) {
    return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
  }

  dijkstra(origem, destino) {
    const dist = new Map();
    const prev = new Map();
    const visitados = new Set();

    for (const id of this.vertices.keys()) {
      dist.set(id, Infinity);
      prev.set(id, null);
    }
    dist.set(origem, 0);

    while (visitados.size < this.vertices.size) {
      let u = null;
      let menorDist = Infinity;

      for (const [id, d] of dist.entries()) {
        if (!visitados.has(id) && d < menorDist) {
          menorDist = d;
          u = id;
        }
      }

      if (u === null || u === destino) break;
      visitados.add(u);

      for (const vizinho of this.adjacencias.get(u)) {
        const alt = dist.get(u) + vizinho.peso;
        if (alt < dist.get(vizinho.id)) {
          dist.set(vizinho.id, alt);
          prev.set(vizinho.id, u);
        }
      }
    }

    // Reconstruir caminho
    const caminho = [];
    let atual = destino;
    while (atual !== null) {
      caminho.unshift(atual);
      atual = prev.get(atual);
    }

    return {
      caminho,
      custo: dist.get(destino),
      visitados: visitados.size
    };
  }

  distanciaEntre(origem, destino) {
    const vizinhos = this.adjacencias.get(origem);
    if (!vizinhos) return null;

    const aresta = vizinhos.find(v => v.id === destino);
    return aresta ? aresta.peso : null;
  }

}
