# **DijkstraMap** ![DijkstraMap Logo](public/icon/app-icon.svg)

Uma aplicação _web_ interativa para visualização e cálculo do menor caminho entre dois pontos num grafo usando o algoritmo de Dijkstra.

## 📝 Sobre o Projeto

DijkstraMap é uma ferramenta que permite:
- Importar mapas no formato OSM (OpenStreetMap)
- Criar e editar grafos interativamente
- Calcular e visualizar o menor caminho entre dois pontos
- Trabalhar com grafos direcionados e não direcionados

## 🚀 Funcionalidades

- **Importação de Mapas**: Suporte para arquivos ".osm" do OpenStreetMap
- **Editor de Grafo Interativo**:
    - Adicionar/remover vértices
    - Criar arestas direcionadas e não direcionadas
    - Mover vértices livremente
    - _Zoom_ e navegação pelo grafo
- **Algoritmo de Dijkstra**:
    - Cálculo do menor caminho
    - Visualização do caminho encontrado
    - Métricas de performance (tempo, nós explorados)
    - Visualização do custo total do caminho

## 🛠️ Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- D3.js para visualização de grafos
- Biblioteca própria para implementação do Algoritmo de Dijkstra

## 🎯 Como Usar

1. **Importar um Mapa**:
    - Clique em "Importar mapa"
    - Selecione um arquivo ".osm"

2. **Criar um Grafo**:
    - Use a barra de ferramentas para adicionar vértices e arestas
    - Arraste os vértices para posicioná-los
    - Configure as arestas como direcionadas ou não direcionadas

3. **Encontrar o Menor Caminho**:
    - Selecione o modo "Origem-Destino"
    - Clique em dois vértices para definir origem e destino
    - O caminho mais curto será destacado automaticamente

## 📂 Estrutura do Projeto

```dijkstra-map/ 
├── src/ 
│ ├── data/ 
│ │ └── script.js # Script principal 
│ ├── graph/ 
│ │ ├── grafo.js # Implementação do grafo 
│ │ ├── graphBuilder.js # Construtor de grafos 
│ │ └── mapConverter.js # Conversão de OSM 
│ └── ui/ 
├── styles/ 
├── public/ 
│ ├── gif/ 
│ └── icon/ 
└── docs/
```


## 🧮 Sobre o Algoritmo de Dijkstra

O algoritmo implementado é baseado no trabalho do cientista da computação Edsger W. Dijkstra. Ele encontra o caminho mais curto entre dois pontos num grafo com pesos não negativos, sendo amplamente utilizado em:
- Sistemas de navegação
- Roteamento de redes
- Otimização de rotas

## 🤝 Contribuindo

1. Faça um Fork do projeto
2. Crie uma branch para a sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit as suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença disponível no arquivo [LICENSE](LICENSE).

## ✨ Inspiração

Baseado no trabalho do cientista da computação Edsger W. Dijkstra, que desenvolveu o algoritmo em 1956.