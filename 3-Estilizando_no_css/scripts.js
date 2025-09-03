/*
        JavaScript NÃO é JAVA

        Lógica de programação
        - Aprender a falar com o computador em Algoritmo

        Receita de bolo

        Algoritmo
        [x] colocar os produtos na tela 
        [x] saber quem são os produtos
        [x] onde colocar os produtos
        [x] Estilizar os produtos
        [x] Quando algo doi digitado no input
        [x] Filtra os produtos que contenham a palavra chave
        [x] Colocar os produtos filtrados na tela
        [x] filtra produtos pelo input
        [x] filtra produtos pelo menu
        [x] Saber quando o botão foi clicado
        [x] Qual botão foi clicado
        [x] Trocar o CSS do botão clicado
        [x] Filtrar os produtos de acordo com a Categorias
        
        VARIÁVEIS
        FUNÇÃO

        LAÇOS DE REPETIÇÃO (forEach)
        TEMPLETE STRING
        EVENTOS
        SELETORES
        ESTRUTURA DE DADOS
        ARRAY (MATRIZ)
        OBJETOS - ORGANIZAR MELHOR

        HTML = DOCUMENT
        QUERYSELECTOR = SELETOR
 */


window.onload = ('DOMContentLoaded', () => {

    // Mostrar todos os produtos
    mostrarProdutos()

    // Ouvinte de Eventos no Input
    input.addEventListener('input', pesquisar)

    // Ouvinte de Eventos em TODOS os botões
    todosBotoes.forEach(botao => {

        botao.addEventListener('click', () => {
            let categoria = botao.getAttribute("data-category")
            trocarCategoria(categoria)
            mostrarProdutos()
        })

    })

  // --- INÍCIO: LÓGICA DO CARRINHO DE COMPRAS ---

    // Seleciona os elementos do DOM
    const cartIcon = document.querySelector('.cart-icon');
    const sideCart = document.querySelector('.side-cart');
    const closeCartBtn = document.querySelector('.close-cart-btn');
    const cartItemsContainer = document.querySelector('.cart-items-container');
    const cartTotalSpan = document.getElementById('cart-total');
    const cartItemCountSpan = document.querySelector('.cart-item-count');
    const overlay = document.querySelector('.overlay');

    // Eventos para abrir e fechar o carrinho
    cartIcon.addEventListener('click', openCart);
    closeCartBtn.addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);

    // Adiciona um evento que "escuta" cliques no container de produtos
    document.querySelector('.products-container').addEventListener('click', function(e) {
        // Verifica se o que foi clicado foi um botão de "adicionar ao carrinho"
        if (e.target.classList.contains('add-to-cart-btn')) {
            const productId = parseInt(e.target.getAttribute('data-id'));
            addToCart(productId);
        }
    });

    // --- FIM: LÓGICA DO CARRINHO DE COMPRAS (APENAS OUVINTES DE EVENTO) ---



    // --- INÍCIO: CÓDIGO PARA EFEITO DE SCROLL NO MENU DE CATEGORIAS ---

    const stickyWrapper = document.querySelector('.sticky-section-wrapper'); // <- Mude aqui
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > 90) {
            stickyWrapper.classList.add('scrolled'); // <- E aqui
        } else {
            stickyWrapper.classList.remove('scrolled'); // <- E aqui
        }

        if (currentScrollY > lastScrollY) {
            stickyWrapper.classList.add('hidden'); // <- E aqui
        } else {
            stickyWrapper.classList.remove('hidden'); // <- E aqui
        }

        lastScrollY = currentScrollY;
    }); // --- FIM: CÓDIGO PARA EFEITO DE SCROLL ---

})

let textoPesquisar = ""
let categoriaAtual = "all" // Todos 
let produtos = [
    {
        id: 1,
        nome: "iPhone 15 Pro",
        categoria: "smartphones",
        preco: 7999,
        precoOriginal: 8999,
        desconto: 11,
        imagem: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400",
        descricao: "Smartphone Apple com câmera avançada"
    },
    {
        id: 2,
        nome: "MacBook Air M2",
        categoria: "laptops",
        preco: 8999,
        precoOriginal: 10999,
        desconto: 18,
        imagem: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400",
        descricao: "Notebook Apple ultrafino e potente"
    },
    {
        id: 3,
        nome: "AirPods Pro",
        categoria: "headphones",
        preco: 1899,
        precoOriginal: 2299,
        desconto: 17,
        imagem: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400",
        descricao: "Fones sem fio com cancelamento de ruído"
    },
    {
        id: 4,
        nome: "Samsung Galaxy S24",
        categoria: "smartphones",
        preco: 5499,
        precoOriginal: 6299,
        desconto: 13,
        imagem: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400",
        descricao: "Smartphone Samsung com tela AMOLED"
    },
    {
        id: 5,
        nome: "Apple Watch Series 9",
        categoria: "smartwatch",
        preco: 3299,
        precoOriginal: 3799,
        desconto: 13,
        imagem: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400",
        descricao: "Relógio inteligente com monitoramento"
    },
    {
        id: 6,
        nome: "Teclado Mecânico",
        categoria: "accessories",
        preco: 499,
        precoOriginal: null,
        desconto: null,
        imagem: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400",
        descricao: "Teclado mecânico RGB para gamers"
    },
    {
        id: 7,
        nome: "Sony WH-1000XM5",
        categoria: "headphones",
        preco: 2499,
        precoOriginal: 2999,
        desconto: 17,
        imagem: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400",
        descricao: "Fone com cancelamento de ruído"
    },
    {
        id: 8,
        nome: "Dell XPS 13",
        categoria: "laptops",
        preco: 7999,
        precoOriginal: null,
        desconto: null,
        imagem: "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400",
        descricao: "Notebook Windows premium"
    }
];

let containerProdutos = document.querySelector(".products-container")
let input = document.querySelector(".search-input")
let todosBotoes = document.querySelectorAll(".category-btn")

// All = TUDO

function mostrarProdutos() {
    let htmlProdutos = ""

    let produtosFiltrados = produtos.filter(prd => {

        let passouCategoria = (categoriaAtual === "all" || prd.categoria === categoriaAtual)
        /*
            || OU / ou 1 ou outro
            && E / Esse e Esse

            ||   true e false => true
                 true e true => true
                 false e false => false

            &&  true e false => false
                true e true => true
                false e false => false
        */


        let passouPesquisa = prd.nome.toLowerCase().includes(textoPesquisar.toLowerCase())


        return passouPesquisa && passouCategoria
    })



    produtosFiltrados.forEach(prd => {


        htmlProdutos = htmlProdutos + `
  <div class="product-card">
       <img class="product-img"  src="${prd.imagem}" alt="${prd.nome}">
            <div class="product-info">
                <h3 class="product-name">${prd.nome}</h3>
                <p  class= "product-description">${prd.descricao}</p>
                <p class="product-price">R$ ${prd.preco}</p>
               <button class="product-button add-to-cart-btn" data-id="${prd.id}">Adicionar ao Carrinho</button>
        </div>
        </div>
        `;

    });

    containerProdutos.innerHTML = htmlProdutos
}

function pesquisar() {
    textoPesquisar = input.value

    mostrarProdutos()

}

function trocarCategoria(categoria) {
    categoriaAtual = categoria

    todosBotoes.forEach(botao => {
        botao.classList.remove("active")

        if (botao.getAttribute("data-category") === categoria) {
            botao.classList.add("active")
        }
    })

    mostrarProdutos()

    // --- INÍCIO: LÓGICA DO CARRINHO DE COMPRAS ---



// --- FIM: LÓGICA DO CARRINHO DE COMPRAS ---

}

