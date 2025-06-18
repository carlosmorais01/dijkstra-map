export class Grafo {
  constructor() {
    this.vertices = new Map(); // Armazena { id: { x, y } }
    this.adjacencia = new Map(); // Armazena id_origem -> Map<id_destino, {peso, bidirectional}>
  }

  // Carrega grafo a partir de um JSON (com nodes e edges)
  carregarDoJSON(data) {
    this.vertices = new Map();
    this.adjacencia = new Map();

    data.nodes.forEach(node => {
      this.adicionarVertice(node.id, node.x, node.y);
    });

    data.edges.forEach(edge => {
      this.adicionarAresta(edge.from, edge.to, edge.bidirectional);
    });
  }

  adicionarVertice(id, x, y) {
    if (!this.vertices.has(id)) {
      this.vertices.set(id, { id: id, x: x, y: y });
      this.adjacencia.set(id, new Map());
    } else {
      // OPCIONAL: Atualizar posição se o vértice já existe
      this.vertices.get(id).x = x;
      this.vertices.get(id).y = y;
    }
  }

  removerVertice(id) {
    if (this.vertices.has(id)) {
      this.vertices.delete(id);
      this.adjacencia.delete(id); // Remove o próprio vértice da lista de adjacência

      // Remove todas as arestas que apontam para este vértice
      this.adjacencia.forEach(adjList => {
        adjList.delete(id);
      });
    }
  }

  adicionarAresta(fromId, toId, bidirectional = false) {
    if (!this.vertices.has(fromId) || !this.vertices.has(toId)) {
      console.error("Um ou ambos os vértices não existem!");
      return;
    }
    // NÃO ARMAZENAMOS O PESO AQUI, ELE SERÁ CALCULADO DINAMICAMENTE
    this.adjacencia.get(fromId).set(toId, { bidirectional: bidirectional });
    if (bidirectional) {
      this.adjacencia.get(toId).set(fromId, { bidirectional: bidirectional });
    }
  }
  removerAresta(fromId, toId) {
    if (this.adjacencia.has(fromId)) {
      const edgeData = this.adjacencia.get(fromId).get(toId);
      this.adjacencia.get(fromId).delete(toId);
      if (edgeData && edgeData.bidirectional && this.adjacencia.has(toId)) {
        this.adjacencia.get(toId).delete(fromId);
      }
    }
  }

  dijkstra(origem, destino) {
    const dist = new Map();
    const prev = new Map();
    const visitados = new Set();
    let nosExploradosContador = 0; // NOVO: Contador para nós explorados

    // Inicializa distâncias e predecessores
    for (const id of this.vertices.keys()) {
      dist.set(id, Infinity);
      prev.set(id, null);
    }
    dist.set(origem, 0);

    // Loop principal do Dijkstra
    while (visitados.size < this.vertices.size) {
      let u = null;
      let menorDist = Infinity;

      // Encontra o vértice não visitado com a menor distância
      for (const [id, d] of dist.entries()) {
        if (!visitados.has(id) && d < menorDist) {
          menorDist = d;
          u = id;
        }
      }

      // Se não há mais vértices alcançáveis ou o destino foi encontrado
      if (u === null) break; // Não há mais nós alcançáveis
      if (u === destino) break; // Destino encontrado

      visitados.add(u);
      nosExploradosContador++; // Incrementa o contador ao visitar um nó

      // Itera sobre os vizinhos do vértice 'u'
      // ALTERADO: Agora iteramos sobre a lista de adjacência de 'u'
      for (const [vizinhoId, edgeData] of this.adjacencia.get(u).entries()) { // ALTERADO AQUI
        // NOVO: OBTÉM A DISTÂNCIA (PESO) DINAMICAMENTE
        const distanciaAresta = this.distanciaEntre(u, vizinhoId);

        // Certifica-se de que a aresta realmente existe e tem uma distância finita
        if (distanciaAresta === null || !isFinite(distanciaAresta)) {
          continue; // Pula se não houver aresta válida ou se o vizinho não existe/estiver desconectado
        }

        const alt = dist.get(u) + distanciaAresta; // USANDO A DISTÂNCIA CALCULADA
        if (alt < dist.get(vizinhoId)) { // USANDO vizinhoId, não vizinho.id
          dist.set(vizinhoId, alt); // USANDO vizinhoId
          prev.set(vizinhoId, u); // USANDO vizinhoId
        }
      }
    }

    // Reconstruir caminho
    const caminho = [];
    let atual = destino;
    // NOVO: Adiciona verificação para garantir que o destino é alcançável
    if (dist.get(destino) === Infinity) {
      return {
        caminho: [],
        custo: Infinity,
        visitados: nosExploradosContador // Retorna o contador correto mesmo sem caminho
      };
    }

    while (atual !== null) {
      caminho.unshift(atual);
      atual = prev.get(atual);
    }

    return {
      caminho,
      custo: dist.get(destino),
      visitados: nosExploradosContador // Retorna o contador de nós explorados
    };
  }

  /**
   * NOVO/ALTERADO: CALCULA A DISTÂNCIA EUCLIDIANA ENTRE DOIS VÉRTICES.
   * @param {string} fromId - ID DO VÉRTICE DE ORIGEM.
   * @param {string} toId - ID DO VÉRTICE DE DESTINO.
   * @returns {number|null} A DISTÂNCIA OU NULL SE OS VÉRTICES NÃO EXISTIREM OU NÃO HOUVER CONEXÃO.
   */
  distanciaEntre(fromId, toId) {
    const fromVertex = this.vertices.get(fromId);
    const toVertex = this.vertices.get(toId);

    if (!fromVertex || !toVertex) {
      return null; // VÉRTICES NÃO ENCONTRADOS
    }

    // VERIFICA SE EXISTE UMA ARESTA DIRECIONAL (FROM -> TO)
    const edgeExists = this.adjacencia.has(fromId) && this.adjacencia.get(fromId).has(toId);

    // SE NÃO HOUVER ARESTA ENTRE ELES, RETORNA NULL OU INFINITY, DEPENDENDO DA SUA LÓGICA
    // PARA ALGORITMOS DE BUSCA, INFINITY É GERALMENTE MELHOR.
    if (!edgeExists) {
      return Infinity; // OU UM VALOR QUE INDIQUE AUSÊNCIA DE ARESTA
    }

    // CALCULA A DISTÂNCIA EUCLIDIANA
    const dx = fromVertex.x - toVertex.x;
    const dy = fromVertex.y - toVertex.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

}
