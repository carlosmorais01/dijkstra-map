/**
 * @class Grafo
 * @description Representa um grafo com vértices e arestas, permitindo operações como adição, remoção e busca de caminhos.
 */
export class Grafo {
  /**
   * @private
   * @property {Map<string, {id: string, x: number, y: number}>} vertices - Armazena os vértices do grafo, onde a chave é o ID do vértice e o valor são suas coordenadas.
   */
  vertices = new Map();

  /**
   * @private
   * @property {Map<string, Map<string, {bidirectional: boolean}>>} adjacencia - Armazena a lista de adjacência do grafo, onde a chave é o ID do vértice de origem e o valor é um mapa de vértices de destino com informações da aresta (e.g., se é bidirecional).
   */
  adjacencia = new Map();

  /**
   * @constructor
   * @description Inicializa uma nova instância da classe Grafo.
   */
  constructor() {
    this.vertices = new Map();
    this.adjacencia = new Map();
  }

  /**
   * Carrega o grafo a partir de um objeto JSON contendo nós (nodes) e arestas (edges).
   * Os vértices são adicionados com seus IDs e coordenadas (x, y).
   * As arestas são adicionadas com seus IDs de origem e destino, e se são bidirecionais.
   * @param {object} data - O objeto JSON contendo 'nodes' e 'edges'.
   * @param {Array<object>} data.nodes - Um array de objetos de nó, cada um com 'id', 'x' e 'y'.
   * @param {Array<object>} data.edges - Um array de objetos de aresta, cada um com 'from', 'to' e 'bidirectional'.
   */
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

  /**
   * Adiciona um novo vértice ao grafo. Se o vértice já existir, suas coordenadas (x, y) serão atualizadas.
   * @param {string} id - O identificador único do vértice.
   * @param {number} x - A coordenada X do vértice.
   * @param {number} y - A coordenada Y do vértice.
   */
  adicionarVertice(id, x, y) {
    if (!this.vertices.has(id)) {
      this.vertices.set(id, { id: id, x: x, y: y });
      this.adjacencia.set(id, new Map());
    } else {
      this.vertices.get(id).x = x;
      this.vertices.get(id).y = y;
    }
  }

  /**
   * Remove um vértice e todas as arestas associadas a ele do grafo.
   * @param {string} id - O identificador do vértice a ser removido.
   */
  removerVertice(id) {
    if (this.vertices.has(id)) {
      this.vertices.delete(id);
      this.adjacencia.delete(id);

      this.adjacencia.forEach(adjList => {
        adjList.delete(id);
      });
    }
  }

  /**
   * Adiciona uma aresta entre dois vértices no grafo.
   * Se a aresta for bidirecional, uma aresta também será adicionada na direção oposta.
   * A aresta não armazena peso, pois este é calculado dinamicamente.
   * @param {string} fromId - O identificador do vértice de origem.
   * @param {string} toId - O identificador do vértice de destino.
   * @param {boolean} [bidirectional=false] - Indica se a aresta é bidirecional.
   */
  adicionarAresta(fromId, toId, bidirectional = false) {
    if (!this.vertices.has(fromId) || !this.vertices.has(toId)) {
      console.error("Um ou ambos os vértices não existem!");
      return;
    }
    this.adjacencia.get(fromId).set(toId, { bidirectional: bidirectional });
    if (bidirectional) {
      this.adjacencia.get(toId).set(fromId, { bidirectional: bidirectional });
    }
  }

  /**
   * Remove uma aresta entre dois vértices. Se a aresta for bidirecional, a aresta na direção oposta também será removida.
   * @param {string} fromId - O identificador do vértice de origem da aresta a ser removida.
   * @param {string} toId - O identificador do vértice de destino da aresta a ser removida.
   */
  removerAresta(fromId, toId) {
    if (this.adjacencia.has(fromId)) {
      const edgeData = this.adjacencia.get(fromId).get(toId);
      this.adjacencia.get(fromId).delete(toId);
      if (edgeData && edgeData.bidirectional && this.adjacencia.has(toId)) {
        this.adjacencia.get(toId).delete(fromId);
      }
    }
  }

  /**
   * Executa o algoritmo de Dijkstra para encontrar o caminho mais curto entre dois vértices.
   * Retorna o caminho, o custo total e o número de nós explorados.
   * @param {string} origem - O identificador do vértice de origem.
   * @param {string} destino - O identificador do vértice de destino.
   * @returns {{caminho: Array<string>, custo: number, visitados: number}} Um objeto contendo o caminho mais curto (array de IDs de vértice), o custo total e o número de nós explorados durante a busca.
   */
  /**
   * Executa o algoritmo de Dijkstra para encontrar o caminho mais curto entre dois vértices.
   * Retorna o caminho, o custo total e o número de nós explorados.
   * @param {string} origem - O identificador do vértice de origem.
   * @param {string} destino - O identificador do vértice de destino.
   * @returns {{caminho: Array<string>, custo: number, visitados: number}} Um objeto contendo o caminho mais curto (array de IDs de vértice), o custo total e o número de nós explorados durante a busca.
   */
  dijkstra(origem, destino) {
    const dist = new Map();
    const prev = new Map();
    // Não precisamos mais do 'visitados' como Set se o heap for bem gerenciado
    // A contagem de nós explorados será feita por quantos elementos são extraídos do heap
    let nosExploradosContador = 0;

    // Inicializa as distâncias e predecessores
    for (const id of this.vertices.keys()) {
      dist.set(id, Infinity);
      prev.set(id, null);
    }
    dist.set(origem, 0);

    // Instancia a fila de prioridade
    const minHeap = new MinHeap(); // Certifique-se de que a classe MinHeap está disponível (importada ou definida no mesmo arquivo)
    minHeap.insert(origem, 0); // Adiciona o nó de origem com distância 0

    // Enquanto houver elementos na fila de prioridade
    while (!minHeap.isEmpty()) {
      const { element: u, priority: currentDist } = minHeap.extractMin(); // Extrai o vértice com a menor distância

      // Se já encontramos um caminho mais curto para 'u' do que o que estava no heap
      // (pode acontecer se decreasePriority for chamado para um nó que já foi adicionado com distância maior)
      if (currentDist > dist.get(u)) {
        continue;
      }

      // Se alcançamos o destino, podemos parar
      if (u === destino) {
        break;
      }

      nosExploradosContador++; // Incrementa o contador de nós explorados

      // Itera sobre os vizinhos do vértice atual
      for (const [vizinhoId] of this.adjacencia.get(u).entries()) {
        const distanciaAresta = this.distanciaEntre(u, vizinhoId);

        // Garante que a aresta existe e tem um peso finito
        if (distanciaAresta === null || !isFinite(distanciaAresta)) {
          continue;
        }

        const alt = dist.get(u) + distanciaAresta;

        // Se um caminho mais curto para o vizinho for encontrado
        if (alt < dist.get(vizinhoId)) {
          dist.set(vizinhoId, alt); // Atualiza a distância
          prev.set(vizinhoId, u); // Atualiza o predecessor

          // Se o vizinho já estiver no heap, atualiza sua prioridade
          // Caso contrário, insere-o no heap
          if (minHeap.map.has(vizinhoId)) {
            minHeap.decreasePriority(vizinhoId, alt);
          } else {
            minHeap.insert(vizinhoId, alt);
          }
        }
      }
    }

    // Reconstrução do caminho (mesma lógica que você já tem)
    const caminho = [];
    let atual = destino;
    if (dist.get(destino) === Infinity) {
      return {
        caminho: [],
        custo: Infinity,
        visitados: nosExploradosContador
      };
    }

    while (atual !== null) {
      caminho.unshift(atual);
      atual = prev.get(atual);
    }

    return {
      caminho,
      custo: dist.get(destino),
      visitados: nosExploradosContador
    };
  }

  /**
   * Calcula a distância euclidiana entre dois vértices.
   * Retorna a distância se houver uma aresta entre eles, Infinity se não houver aresta, ou null se um dos vértices não existir.
   * @param {string} fromId - O ID do vértice de origem.
   * @param {string} toId - O ID do vértice de destino.
   * @returns {number|null} A distância euclidiana entre os vértices, Infinity se não houver aresta, ou null se um dos vértices não for encontrado.
   */
  distanciaEntre(fromId, toId) {
    const fromVertex = this.vertices.get(fromId);
    const toVertex = this.vertices.get(toId);

    if (!fromVertex || !toVertex) {
      return null;
    }

    const edgeExists = this.adjacencia.has(fromId) && this.adjacencia.get(fromId).has(toId);

    if (!edgeExists) {
      return Infinity;
    }

    const dx = fromVertex.x - toVertex.x;
    const dy = fromVertex.y - toVertex.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

class MinHeap {
  constructor() {
    this.heap = [];
    this.map = new Map(); // Para acesso rápido aos elementos e suas posições no heap
  }

  getParentIndex(i) { return Math.floor((i - 1) / 2); }
  getLeftChildIndex(i) { return 2 * i + 1; }
  getRightChildIndex(i) { return 2 * i + 2; }

  hasParent(i) { return this.getParentIndex(i) >= 0; }
  hasLeftChild(i) { return this.getLeftChildIndex(i) < this.heap.length; }
  hasRightChild(i) { return this.getRightChildIndex(i) < this.heap.length; }

  getParent(i) { return this.heap[this.getParentIndex(i)]; }
  getLeftChild(i) { return this.heap[this.getLeftChildIndex(i)]; }
  getRightChild(i) { return this.heap[this.getRightChildIndex(i)]; }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    this.map.set(this.heap[i].element, i);
    this.map.set(this.heap[j].element, j);
  }

  insert(element, priority) {
    const node = { element, priority };
    this.heap.push(node);
    const index = this.heap.length - 1;
    this.map.set(element, index);
    this.heapifyUp(index);
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) {
      const min = this.heap.pop();
      this.map.delete(min.element);
      return min;
    }

    const min = this.heap[0];
    this.map.delete(min.element);
    this.heap[0] = this.heap.pop();
    this.map.set(this.heap[0].element, 0);
    this.heapifyDown(0);
    return min;
  }

  decreasePriority(element, newPriority) {
    let index = this.map.get(element);
    if (index === undefined) return; // Elemento não está no heap

    this.heap[index].priority = newPriority;
    this.heapifyUp(index);
  }

  heapifyUp(index) {
    while (this.hasParent(index) && this.getParent(index).priority > this.heap[index].priority) {
      const parentIndex = this.getParentIndex(index);
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  heapifyDown(index) {
    let smallestChildIndex = index;

    if (this.hasLeftChild(index) && this.getLeftChild(index).priority < this.heap[smallestChildIndex].priority) {
      smallestChildIndex = this.getLeftChildIndex(index);
    }

    if (this.hasRightChild(index) && this.getRightChild(index).priority < this.heap[smallestChildIndex].priority) {
      smallestChildIndex = this.getRightChildIndex(index);
    }

    if (smallestChildIndex !== index) {
      this.swap(index, smallestChildIndex);
      this.heapifyDown(smallestChildIndex);
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }
}