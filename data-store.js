(function () {
  'use strict';

  var PRODUCTS_KEY = '7store_products';
  var ADMIN_USER_KEY = '7store_admin_user';
  var ADMIN_PASS_KEY = '7store_admin_pass';
  var ADMIN_SESSION_KEY = '7store_admin_session';

  var DEFAULT_ADMIN_USER = 'master';
  // Local-only gate (not real security). Change this in admin.html -> "Atualizar senha mestre".
  var DEFAULT_ADMIN_PASS = '123456';

  var defaultProducts = [
    {
      id: 1,
      nome: 'iPhone 15 Pro',
      categoria: 'smartphones',
      brand: 'Apple',
      sku: 'IPHONE-15-PRO',
      costPrice: 0,
      preco: 7999,
      precoOriginal: 8999,
      desconto: 11,
      imagem: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400',
      descricao: 'Smartphone Apple com camera avancada',
      popularityScore: 50,
      stock: 12,
      isActive: true,
      isFeatured: true,
      currency: 'BRL'
    },
    {
      id: 2,
      nome: 'MacBook Air M2',
      categoria: 'laptops',
      brand: 'Apple',
      sku: 'MBA-M2',
      costPrice: 0,
      preco: 8999,
      precoOriginal: 10999,
      desconto: 18,
      imagem: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
      descricao: 'Notebook Apple ultrafino e potente',
      popularityScore: 30,
      stock: 5,
      isActive: true,
      isFeatured: true,
      currency: 'BRL'
    },
    {
      id: 3,
      nome: 'AirPods Pro',
      categoria: 'headphones',
      brand: 'Apple',
      sku: 'AIRPODS-PRO',
      costPrice: 0,
      preco: 1899,
      precoOriginal: 2299,
      desconto: 17,
      imagem: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400',
      descricao: 'Fones sem fio com cancelamento de ruido',
      popularityScore: 80,
      stock: 20,
      isActive: true,
      isFeatured: false,
      currency: 'BRL'
    },
    {
      id: 4,
      nome: 'Samsung Galaxy S24',
      categoria: 'smartphones',
      brand: 'Samsung',
      sku: 'GALAXY-S24',
      costPrice: 0,
      preco: 5499,
      precoOriginal: 6299,
      desconto: 13,
      imagem: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400',
      descricao: 'Smartphone Samsung com tela AMOLED',
      popularityScore: 60,
      stock: 8,
      isActive: true,
      isFeatured: false,
      currency: 'BRL'
    },
    {
      id: 5,
      nome: 'Apple Watch Series 9',
      categoria: 'smartwatch',
      brand: 'Apple',
      sku: 'WATCH-S9',
      costPrice: 0,
      preco: 3299,
      precoOriginal: 3799,
      desconto: 13,
      imagem: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400',
      descricao: 'Relogio inteligente com monitoramento',
      popularityScore: 20,
      stock: 9,
      isActive: true,
      isFeatured: false,
      currency: 'BRL'
    },
    {
      id: 6,
      nome: 'Teclado Mecanico',
      categoria: 'accessories',
      brand: '7STORE',
      sku: 'KEY-RGB',
      costPrice: 0,
      preco: 499,
      precoOriginal: null,
      desconto: null,
      imagem: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400',
      descricao: 'Teclado mecanico RGB para gamers',
      popularityScore: 70,
      stock: 18,
      isActive: true,
      isFeatured: true,
      currency: 'BRL'
    },
    {
      id: 7,
      nome: 'Sony WH-1000XM5',
      categoria: 'headphones',
      brand: 'Sony',
      sku: 'WH-1000XM5',
      costPrice: 0,
      preco: 2499,
      precoOriginal: 2999,
      desconto: 17,
      imagem: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400',
      descricao: 'Fone com cancelamento de ruido',
      popularityScore: 45,
      stock: 4,
      isActive: true,
      isFeatured: false,
      currency: 'BRL'
    },
    {
      id: 8,
      nome: 'Dell XPS 13',
      categoria: 'laptops',
      brand: 'Dell',
      sku: 'XPS-13',
      costPrice: 0,
      preco: 7999,
      precoOriginal: null,
      desconto: null,
      imagem: 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400',
      descricao: 'Notebook Windows premium',
      popularityScore: 10,
      stock: 7,
      isActive: true,
      isFeatured: false,
      currency: 'BRL'
    }
  ];

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function loadProducts() {
    try {
      var raw = localStorage.getItem(PRODUCTS_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveProducts(products) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    window.dispatchEvent(new CustomEvent('products:changed', { detail: clone(products) }));
  }

  function normalizeProduct(product, fallback) {
    var base = fallback || {};
    var precoOriginal = product.precoOriginal;
    var desconto = product.desconto;
    var costPrice = product.costPrice;
    var sku = product.sku;
    var brand = product.brand;

    if (precoOriginal === '' || precoOriginal === null || typeof precoOriginal === 'undefined') {
      precoOriginal = null;
    }

    if (desconto === '' || desconto === null || typeof desconto === 'undefined') {
      desconto = null;
    }

    if (costPrice === '' || costPrice === null || typeof costPrice === 'undefined') {
      costPrice = null;
    }

    if (sku === '' || sku === null || typeof sku === 'undefined') {
      sku = null;
    }

    if (brand === '' || brand === null || typeof brand === 'undefined') {
      brand = null;
    }

    return {
      id: toNumber(product.id, base.id || Date.now()),
      nome: String(product.nome || base.nome || '').trim(),
      categoria: String(product.categoria || base.categoria || 'accessories').trim(),
      brand: String(brand || base.brand || '').trim() || null,
      sku: String(sku || base.sku || '').trim() || null,
      costPrice: costPrice === null ? null : toNumber(costPrice, toNumber(base.costPrice, 0)),
      preco: toNumber(product.preco, toNumber(base.preco, 0)),
      precoOriginal: precoOriginal === null ? null : toNumber(precoOriginal, null),
      desconto: desconto === null ? null : toNumber(desconto, null),
      imagem: String(product.imagem || base.imagem || '').trim(),
      descricao: String(product.descricao || base.descricao || '').trim(),
      popularityScore: toNumber(product.popularityScore, toNumber(base.popularityScore, 0)),
      stock: toNumber(product.stock, toNumber(base.stock, 0)),
      isActive: typeof product.isActive === 'boolean' ? product.isActive : (typeof base.isActive === 'boolean' ? base.isActive : true),
      isFeatured: typeof product.isFeatured === 'boolean' ? product.isFeatured : (typeof base.isFeatured === 'boolean' ? base.isFeatured : false),
      currency: String(product.currency || base.currency || 'BRL')
    };
  }

  function ensureSeed() {
    var products = loadProducts();
    if (products.length === 0) {
      saveProducts(clone(defaultProducts));
    }
  }

  function ensureAdminSeed() {
    if (!localStorage.getItem(ADMIN_USER_KEY)) {
      localStorage.setItem(ADMIN_USER_KEY, DEFAULT_ADMIN_USER);
    }
    if (!localStorage.getItem(ADMIN_PASS_KEY)) {
      localStorage.setItem(ADMIN_PASS_KEY, DEFAULT_ADMIN_PASS);
    }
  }

  function getProducts() {
    return clone(loadProducts());
  }

  function getPublicProducts() {
    return getProducts().filter(function (product) {
      return product.isActive !== false;
    });
  }

  function getProductById(id) {
    var normalizedId = toNumber(id, null);
    if (normalizedId === null) {
      return null;
    }

    var products = loadProducts();
    var found = products.find(function (product) {
      return product.id === normalizedId;
    });

    return found ? clone(found) : null;
  }

  function getNextProductId(products) {
    return products.reduce(function (max, product) {
      return product.id > max ? product.id : max;
    }, 0) + 1;
  }

  function createProduct(productInput) {
    var products = loadProducts();
    var product = normalizeProduct(productInput, {});

    if (!product.nome || !product.imagem || !product.descricao || !product.categoria) {
      throw new Error('Preencha nome, categoria, imagem e descricao.');
    }

    product.id = getNextProductId(products);
    products.push(product);
    saveProducts(products);
    return clone(product);
  }

  function updateProduct(productId, productInput) {
    var id = toNumber(productId, null);
    var products = loadProducts();
    var index = products.findIndex(function (product) {
      return product.id === id;
    });

    if (index < 0) {
      throw new Error('Produto nao encontrado.');
    }

    var merged = normalizeProduct(productInput, products[index]);
    merged.id = id;

    if (!merged.nome || !merged.imagem || !merged.descricao || !merged.categoria) {
      throw new Error('Preencha nome, categoria, imagem e descricao.');
    }

    products[index] = merged;
    saveProducts(products);
    return clone(merged);
  }

  function deleteProduct(productId) {
    var id = toNumber(productId, null);
    var products = loadProducts();
    var nextProducts = products.filter(function (product) {
      return product.id !== id;
    });

    if (nextProducts.length === products.length) {
      throw new Error('Produto nao encontrado.');
    }

    saveProducts(nextProducts);
    return true;
  }

  function updateProductStatus(productId, isActive) {
    return updateProduct(productId, { isActive: !!isActive });
  }

  function normalizeProductList(productsInput) {
    if (!Array.isArray(productsInput)) {
      throw new Error('Formato invalido: esperado uma lista de produtos.');
    }

    var normalized = [];
    var usedIds = {};
    var nextId = 1;

    productsInput.forEach(function (item) {
      var product = normalizeProduct(item, {});

      if (!product.nome || !product.imagem || !product.descricao || !product.categoria) {
        throw new Error('Produto invalido encontrado durante importacao.');
      }

      if (!Number.isFinite(product.id) || usedIds[product.id]) {
        while (usedIds[nextId]) {
          nextId += 1;
        }
        product.id = nextId;
      }

      usedIds[product.id] = true;
      if (product.id >= nextId) {
        nextId = product.id + 1;
      }

      normalized.push(product);
    });

    return normalized;
  }

  function replaceProducts(productsInput) {
    var products = normalizeProductList(productsInput);
    saveProducts(products);
    return clone(products);
  }

  function exportProductsJson() {
    return JSON.stringify(getProducts(), null, 2);
  }

  function importProductsFromJson(jsonText) {
    if (!jsonText || String(jsonText).trim() === '') {
      throw new Error('Arquivo vazio.');
    }

    var parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error('JSON invalido.');
    }

    return replaceProducts(parsed);
  }

  function resetCatalog() {
    saveProducts(clone(defaultProducts));
  }

  function loginAdmin(username, password) {
    var savedUser = localStorage.getItem(ADMIN_USER_KEY) || DEFAULT_ADMIN_USER;
    var savedPass = localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;

    if (String(username).trim() === savedUser && String(password) === savedPass) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return true;
    }

    return false;
  }

  function logoutAdmin() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  function isAdminAuthenticated() {
    return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  }

  function getAdminUsername() {
    return localStorage.getItem(ADMIN_USER_KEY) || DEFAULT_ADMIN_USER;
  }

  function updateAdminPassword(currentPassword, newPassword) {
    var savedPass = localStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_ADMIN_PASS;

    if (String(currentPassword) !== savedPass) {
      throw new Error('Senha atual invalida.');
    }

    if (!newPassword || String(newPassword).length < 6) {
      throw new Error('Nova senha deve ter no minimo 6 caracteres.');
    }

    localStorage.setItem(ADMIN_PASS_KEY, String(newPassword));
    return true;
  }

  ensureSeed();
  ensureAdminSeed();

  window.dataStore = {
    PRODUCTS_KEY: PRODUCTS_KEY,
    getProducts: getProducts,
    getPublicProducts: getPublicProducts,
    getProductById: getProductById,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    updateProductStatus: updateProductStatus,
    replaceProducts: replaceProducts,
    exportProductsJson: exportProductsJson,
    importProductsFromJson: importProductsFromJson,
    resetCatalog: resetCatalog,
    loginAdmin: loginAdmin,
    logoutAdmin: logoutAdmin,
    isAdminAuthenticated: isAdminAuthenticated,
    getAdminUsername: getAdminUsername,
    updateAdminPassword: updateAdminPassword
  };
})();
