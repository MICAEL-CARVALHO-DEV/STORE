(function () {
  'use strict';

  var loginSection = document.getElementById('admin-login-section');
  var dashboardSection = document.getElementById('admin-dashboard');
  var loginForm = document.getElementById('admin-login-form');
  var loginMessage = document.getElementById('admin-login-message');

  var logoutBtn = document.getElementById('admin-logout');
  var resetCatalogBtn = document.getElementById('admin-reset-catalog');
  var passwordForm = document.getElementById('admin-password-form');
  var passwordMessage = document.getElementById('admin-password-message');
  var cloudUrlInput = document.getElementById('cloud-url');
  var cloudKeyInput = document.getElementById('cloud-key');
  var cloudSaveConfigBtn = document.getElementById('cloud-save-config');
  var cloudTestBtn = document.getElementById('cloud-test');
  var cloudAuthLoginBtn = document.getElementById('cloud-auth-login');
  var cloudAuthLogoutBtn = document.getElementById('cloud-auth-logout');
  var cloudTestAdminBtn = document.getElementById('cloud-test-admin');
  var cloudAdminEmailInput = document.getElementById('cloud-admin-email');
  var cloudAdminPasswordInput = document.getElementById('cloud-admin-password');
  var cloudAuthStatus = document.getElementById('cloud-auth-status');
  var cloudPushBtn = document.getElementById('cloud-push');
  var cloudPullBtn = document.getElementById('cloud-pull');
  var cloudMirrorBtn = document.getElementById('cloud-mirror');
  var cloudMessage = document.getElementById('cloud-message');
  var backupExportBtn = document.getElementById('backup-export');
  var backupImportBtn = document.getElementById('backup-import');
  var backupImportInput = document.getElementById('backup-import-input');
  var backupMessage = document.getElementById('backup-message');

  var productForm = document.getElementById('product-form');
  var productFormMessage = document.getElementById('product-form-message');
  var cancelEditBtn = document.getElementById('product-cancel-edit');
  var productImageFileInput = document.getElementById('product-image-file');
  var productImageUploadBtn = document.getElementById('product-image-upload');
  var productsBody = document.getElementById('admin-products-body');
  var statsContainer = document.getElementById('admin-stats');

  var ordersRefreshBtn = document.getElementById('orders-refresh');
  var ordersBody = document.getElementById('admin-orders-body');
  var ordersMessage = document.getElementById('orders-message');

  var couponForm = document.getElementById('coupon-form');
  var couponsBody = document.getElementById('admin-coupons-body');
  var couponMessage = document.getElementById('coupon-message');

  var bannerForm = document.getElementById('banner-form');
  var bannersBody = document.getElementById('admin-banners-body');
  var bannerMessage = document.getElementById('banner-message');

  var categoryForm = document.getElementById('category-form');
  var categoriesBody = document.getElementById('admin-categories-body');
  var categoryMessage = document.getElementById('category-message');

  var rankingRefreshBtn = document.getElementById('ranking-refresh');
  var rankingBody = document.getElementById('admin-ranking-body');
  var rankingMessage = document.getElementById('ranking-message');

  var editingProductId = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function setFeedback(element, message, type) {
    if (!element) return;
    element.textContent = message || '';
    element.classList.remove('is-error', 'is-success');
    if (type === 'error') {
      element.classList.add('is-error');
    }
    if (type === 'success') {
      element.classList.add('is-success');
    }
  }

  function maskSecret(secret) {
    var value = String(secret || '');
    if (value.length <= 10) {
      return value;
    }

    return value.slice(0, 6) + '...' + value.slice(-4);
  }

  function refreshCloudConfigFields() {
    if (!window.cloudSync || !cloudUrlInput || !cloudKeyInput) return;

    var config = window.cloudSync.getConfig();
    cloudUrlInput.value = config.url || '';
    cloudKeyInput.value = config.anonKey ? maskSecret(config.anonKey) : '';
  }

  function setCloudButtonsEnabled(enabled) {
    [cloudPushBtn, cloudPullBtn, cloudMirrorBtn, cloudTestAdminBtn].forEach(function (button) {
      if (button) {
        button.disabled = !enabled;
      }
    });

    if (cloudAuthLogoutBtn) {
      cloudAuthLogoutBtn.disabled = !enabled;
    }
  }

  function refreshCloudAuthState() {
    if (!window.cloudSync) return;

    var summary = window.cloudSync.getAuthSummary();

    if (!summary.authenticated) {
      setCloudButtonsEnabled(false);
      setFeedback(cloudAuthStatus, 'Nao autenticado no Supabase Auth.', '');
      return;
    }

    setCloudButtonsEnabled(true);
    setFeedback(
      cloudAuthStatus,
      'Cloud admin autenticado: ' + (summary.email || 'usuario sem email') + '.',
      'success'
    );

    // Best-effort refresh of cloud-managed sections.
    setTimeout(function () {
      refreshOrders();
      refreshCoupons();
      refreshBanners();
      refreshCategories();
      refreshRanking();
    }, 0);
  }

  function refreshDashboardViews() {
    renderProductsTable();
    renderStats();
  }

  function shortId(value) {
    var text = String(value || '');
    return text.length > 10 ? text.slice(0, 8) + '...' : text;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderOrdersTable(orders) {
    if (!ordersBody) return;

    if (!orders || orders.length === 0) {
      ordersBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhum pedido.</td></tr>';
      return;
    }

    ordersBody.innerHTML = orders
      .map(function (o) {
        var created = o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '';
        return (
          '<tr data-order-id="' + escapeHtml(o.id) + '">' +
          '<td>' + escapeHtml(shortId(o.id)) + '</td>' +
          '<td>' + escapeHtml(shortId(o.customer_id)) + '</td>' +
          '<td>' +
          '<select class="admin-order-status">' +
          ['pending', 'paid', 'shipped', 'canceled']
            .map(function (s) {
              return '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + s + '</option>';
            })
            .join('') +
          '</select>' +
          '</td>' +
          '<td>' +
          '<select class="admin-order-payment-status">' +
          ['pending', 'paid', 'failed', 'refunded']
            .map(function (s) {
              return '<option value="' + s + '"' + (o.payment_status === s ? ' selected' : '') + '>' + s + '</option>';
            })
            .join('') +
          '</select>' +
          '</td>' +
          '<td>R$ ' + Number(o.total || 0).toFixed(2) + '</td>' +
          '<td>' + escapeHtml(created) + '</td>' +
          '<td><button type="button" class="admin-btn admin-order-save">Salvar</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function refreshOrders() {
    if (!ordersBody) return;
    if (!window.cloudSync) {
      setFeedback(ordersMessage, 'cloud-sync indisponivel.', 'error');
      return;
    }

    try {
      ensureCloudAdminAuthenticated();
      setFeedback(ordersMessage, 'Carregando pedidos...', 'success');
      var orders = await window.cloudSync.pullOrders(40);
      renderOrdersTable(orders);
      setFeedback(ordersMessage, 'Pedidos atualizados.', 'success');
    } catch (error) {
      renderOrdersTable([]);
      setFeedback(ordersMessage, error.message || 'Falha ao carregar pedidos.', 'error');
    }
  }

  function renderCouponsTable(coupons) {
    if (!couponsBody) return;
    if (!coupons || coupons.length === 0) {
      couponsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum cupom.</td></tr>';
      return;
    }

    couponsBody.innerHTML = coupons
      .map(function (c) {
        return (
          '<tr data-coupon-id="' + escapeHtml(c.id) + '">' +
          '<td>' + escapeHtml(c.code) + '</td>' +
          '<td>' + escapeHtml(c.discount_type) + '</td>' +
          '<td>' + Number(c.discount_value || 0).toFixed(2) + '</td>' +
          '<td>' + (c.is_active ? 'Sim' : 'Nao') + '</td>' +
          '<td>' + Number(c.used_count || 0) + '</td>' +
          '<td><button type="button" class="admin-btn admin-btn-danger admin-coupon-delete">Excluir</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function refreshCoupons() {
    if (!couponsBody) return;
    if (!window.cloudSync) return;

    try {
      ensureCloudAdminAuthenticated();
      setFeedback(couponMessage, 'Carregando cupons...', 'success');
      var coupons = await window.cloudSync.pullCoupons();
      renderCouponsTable(coupons);
      setFeedback(couponMessage, '', '');
    } catch (error) {
      renderCouponsTable([]);
      setFeedback(couponMessage, error.message || 'Falha ao carregar cupons.', 'error');
    }
  }

  function renderBannersTable(banners) {
    if (!bannersBody) return;
    if (!banners || banners.length === 0) {
      bannersBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum banner.</td></tr>';
      return;
    }

    bannersBody.innerHTML = banners
      .map(function (b) {
        return (
          '<tr data-banner-id="' + escapeHtml(b.id) + '">' +
          '<td>' + escapeHtml(b.title) + '</td>' +
          '<td>' + escapeHtml(b.position || '') + '</td>' +
          '<td>' + (b.is_active ? 'Sim' : 'Nao') + '</td>' +
          '<td><button type="button" class="admin-btn admin-btn-danger admin-banner-delete">Excluir</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function refreshBanners() {
    if (!bannersBody) return;
    if (!window.cloudSync) return;

    try {
      ensureCloudAdminAuthenticated();
      setFeedback(bannerMessage, 'Carregando banners...', 'success');
      var banners = await window.cloudSync.pullBanners();
      renderBannersTable(banners);
      setFeedback(bannerMessage, '', '');
    } catch (error) {
      renderBannersTable([]);
      setFeedback(bannerMessage, error.message || 'Falha ao carregar banners.', 'error');
    }
  }

  function renderCategoriesTable(categories) {
    if (!categoriesBody) return;
    if (!categories || categories.length === 0) {
      categoriesBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma categoria.</td></tr>';
      return;
    }

    categoriesBody.innerHTML = categories
      .map(function (c) {
        return (
          '<tr data-category-id="' + escapeHtml(c.id) + '">' +
          '<td>' + escapeHtml(c.slug) + '</td>' +
          '<td>' + escapeHtml(c.name) + '</td>' +
          '<td>' + (c.is_active ? 'Sim' : 'Nao') + '</td>' +
          '<td><button type="button" class="admin-btn admin-btn-danger admin-category-delete">Excluir</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function refreshCategories() {
    if (!categoriesBody) return;
    if (!window.cloudSync) return;

    try {
      ensureCloudAdminAuthenticated();
      setFeedback(categoryMessage, 'Carregando categorias...', 'success');
      var categories = await window.cloudSync.pullCategories();
      renderCategoriesTable(categories);
      setFeedback(categoryMessage, '', '');
    } catch (error) {
      renderCategoriesTable([]);
      setFeedback(categoryMessage, error.message || 'Falha ao carregar categorias.', 'error');
    }
  }

  function renderRankingTable(rows) {
    if (!rankingBody) return;
    if (!rows || rows.length === 0) {
      rankingBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Sem dados de ranking.</td></tr>';
      return;
    }

    rankingBody.innerHTML = rows
      .map(function (r) {
        var pct = r.margin_rate == null ? '' : String(Math.round(Number(r.margin_rate) * 10000) / 100) + '%';
        var giro = r.turnover_ratio == null ? '' : String(Number(r.turnover_ratio).toFixed(2));
        return (
          '<tr>' +
          '<td>' + escapeHtml(r.nome) + '</td>' +
          '<td>' + escapeHtml(r.brand || '') + '</td>' +
          '<td>' + Number(r.units_sold || 0) + '</td>' +
          '<td>R$ ' + Number(r.gross_revenue || 0).toFixed(2) + '</td>' +
          '<td>R$ ' + Number(r.gross_margin || 0).toFixed(2) + '</td>' +
          '<td>' + escapeHtml(pct) + '</td>' +
          '<td>' + escapeHtml(giro) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  async function refreshRanking() {
    if (!rankingBody) return;
    if (!window.cloudSync) return;

    try {
      ensureCloudAdminAuthenticated();
      setFeedback(rankingMessage, 'Carregando ranking...', 'success');
      var rows = await window.cloudSync.pullProductRanking();
      renderRankingTable(rows);
      setFeedback(rankingMessage, '', '');
    } catch (error) {
      renderRankingTable([]);
      setFeedback(rankingMessage, error.message || 'Falha ao carregar ranking.', 'error');
    }
  }

  function setVisibility() {
    var isAuthed = window.dataStore.isAdminAuthenticated();
    loginSection.hidden = isAuthed;
    dashboardSection.hidden = !isAuthed;

    if (isAuthed) {
      refreshDashboardViews();
      refreshCloudConfigFields();
      refreshCloudAuthState();
    }
  }

  function getFormData() {
    var nome = byId('product-nome').value.trim();
    var categoria = byId('product-categoria').value;
    var preco = toNumber(byId('product-preco').value, NaN);
    var precoOriginalRaw = byId('product-preco-original').value;
    var stock = toNumber(byId('product-stock').value, NaN);
    var popularity = toNumber(byId('product-popularity').value, NaN);
    var brand = String((byId('product-brand') && byId('product-brand').value) || '').trim();
    var sku = String((byId('product-sku') && byId('product-sku').value) || '').trim();
    var costRaw = (byId('product-cost') && byId('product-cost').value) || '';
    var costPrice = costRaw === '' ? null : toNumber(costRaw, NaN);
    var imagem = byId('product-imagem').value.trim();
    var descricao = byId('product-descricao').value.trim();
    var isActive = byId('product-active').checked;
    var isFeatured = byId('product-featured').checked;

    if (!nome || !categoria || !imagem || !descricao) {
      throw new Error('Preencha os campos obrigatorios.');
    }

    if (!Number.isFinite(preco) || preco < 0) {
      throw new Error('Preco invalido.');
    }

    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error('Estoque invalido.');
    }

    if (!Number.isFinite(popularity) || popularity < 0 || popularity > 100) {
      throw new Error('Popularidade deve estar entre 0 e 100.');
    }

    if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) {
      throw new Error('Custo invalido.');
    }

    return {
      nome: nome,
      categoria: categoria,
      preco: preco,
      precoOriginal: precoOriginalRaw === '' ? null : toNumber(precoOriginalRaw, null),
      brand: brand || null,
      sku: sku || null,
      costPrice: costPrice,
      imagem: imagem,
      descricao: descricao,
      popularityScore: popularity,
      stock: stock,
      isActive: isActive,
      isFeatured: isFeatured
    };
  }

  function resetForm() {
    productForm.reset();
    byId('product-id').value = '';
    byId('product-active').checked = true;
    byId('product-featured').checked = false;
    if (byId('product-image-file')) {
      byId('product-image-file').value = '';
    }
    editingProductId = null;
    cancelEditBtn.hidden = true;
    setFeedback(productFormMessage, '', '');
  }

  function fillFormForEdit(product) {
    byId('product-id').value = String(product.id);
    byId('product-nome').value = product.nome || '';
    byId('product-categoria').value = product.categoria || 'accessories';
    byId('product-preco').value = String(product.preco || 0);
    byId('product-preco-original').value = product.precoOriginal == null ? '' : String(product.precoOriginal);
    byId('product-stock').value = String(product.stock || 0);
    byId('product-popularity').value = String(product.popularityScore || 0);
    if (byId('product-brand')) byId('product-brand').value = product.brand || '';
    if (byId('product-sku')) byId('product-sku').value = product.sku || '';
    if (byId('product-cost')) byId('product-cost').value = product.costPrice == null ? '' : String(product.costPrice);
    byId('product-imagem').value = product.imagem || '';
    byId('product-descricao').value = product.descricao || '';
    byId('product-active').checked = product.isActive !== false;
    byId('product-featured').checked = product.isFeatured === true;

    editingProductId = product.id;
    cancelEditBtn.hidden = false;
    setFeedback(productFormMessage, 'Editando produto #' + product.id, 'success');
    byId('product-nome').focus();
  }

  function renderStats() {
    var products = window.dataStore.getProducts();
    var active = products.filter(function (product) {
      return product.isActive !== false;
    }).length;
    var inactive = products.length - active;
    var lowStock = products.filter(function (product) {
      return Number(product.stock || 0) <= 3;
    }).length;

    statsContainer.innerHTML = [
      '<div class="admin-stat-card"><strong>' + products.length + '</strong><span>Total de produtos</span></div>',
      '<div class="admin-stat-card"><strong>' + active + '</strong><span>Ativos</span></div>',
      '<div class="admin-stat-card"><strong>' + inactive + '</strong><span>Inativos</span></div>',
      '<div class="admin-stat-card"><strong>' + lowStock + '</strong><span>Estoque baixo</span></div>'
    ].join('');
  }

  function renderProductsTable() {
    var products = window.dataStore
      .getProducts()
      .sort(function (a, b) {
        return a.id - b.id;
      });

    if (products.length === 0) {
      productsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhum produto cadastrado.</td></tr>';
      return;
    }

    var rows = products
      .map(function (product) {
        var statusText = product.isActive !== false ? 'Ativo' : 'Inativo';
        var stock = Number(product.stock || 0);
        var stockClass = stock <= 3 ? 'admin-stock-low' : '';

        return (
          '<tr>' +
          '<td>' + product.id + '</td>' +
          '<td>' +
          '<div class="admin-product-cell">' +
          '<img src="' + product.imagem + '" alt="' + product.nome + '">' +
          '<div><strong>' + product.nome + '</strong><small>' + product.descricao + '</small></div>' +
          '</div>' +
          '</td>' +
          '<td>' + product.categoria + '</td>' +
          '<td>R$ ' + Number(product.preco || 0).toFixed(2) + '</td>' +
          '<td class="' + stockClass + '">' + stock + '</td>' +
          '<td>' + statusText + '</td>' +
          '<td>' +
          '<div class="admin-actions-inline">' +
          '<button type="button" class="admin-btn" data-action="edit" data-id="' + product.id + '">Editar</button>' +
          '<button type="button" class="admin-btn" data-action="toggle" data-id="' + product.id + '">' +
          (product.isActive !== false ? 'Inativar' : 'Ativar') +
          '</button>' +
          '<button type="button" class="admin-btn admin-btn-danger" data-action="delete" data-id="' + product.id + '">Excluir</button>' +
          '</div>' +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    productsBody.innerHTML = rows;
  }

  function handleTableAction(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;

    var action = button.getAttribute('data-action');
    var id = Number(button.getAttribute('data-id'));
    var product = window.dataStore.getProductById(id);

    if (!product) {
      setFeedback(productFormMessage, 'Produto nao encontrado.', 'error');
      return;
    }

    if (action === 'edit') {
      fillFormForEdit(product);
      return;
    }

    if (action === 'toggle') {
      window.dataStore.updateProductStatus(id, product.isActive === false);
      refreshDashboardViews();
      setFeedback(productFormMessage, 'Status atualizado.', 'success');
      return;
    }

    if (action === 'delete') {
      if (!window.confirm('Deseja excluir o produto #' + id + '?')) {
        return;
      }

      window.dataStore.deleteProduct(id);
      refreshDashboardViews();
      setFeedback(productFormMessage, 'Produto excluido com sucesso.', 'success');

      if (editingProductId === id) {
        resetForm();
      }
    }
  }

  function setupThemeToggle() {
    var btn = document.getElementById('toggleTheme');
    var icon = btn ? btn.querySelector('i') : null;

    function loadTheme() {
      if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
        if (icon) icon.className = 'fa-solid fa-sun';
      } else if (icon) {
        icon.className = 'fa-solid fa-moon';
      }
    }

    function toggleTheme() {
      document.body.classList.toggle('dark');
      var isDark = document.body.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    loadTheme();
    if (btn) btn.addEventListener('click', toggleTheme);
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var username = byId('admin-username').value;
    var password = byId('admin-password').value;

    var ok = window.dataStore.loginAdmin(username, password);
    if (!ok) {
      setFeedback(loginMessage, 'Usuario ou senha invalidos.', 'error');
      return;
    }

    setFeedback(loginMessage, '', '');
    setVisibility();
    setFeedback(productFormMessage, 'Sessao iniciada como ' + window.dataStore.getAdminUsername() + '.', 'success');
  });

  logoutBtn.addEventListener('click', function () {
    window.dataStore.logoutAdmin();
    resetForm();
    setVisibility();
  });

  resetCatalogBtn.addEventListener('click', function () {
    if (!window.confirm('Deseja restaurar o catalogo padrao?')) {
      return;
    }

    window.dataStore.resetCatalog();
    resetForm();
    refreshDashboardViews();
    setFeedback(productFormMessage, 'Catalogo restaurado.', 'success');
  });

  productForm.addEventListener('submit', function (event) {
    event.preventDefault();

    try {
      var data = getFormData();

      if (editingProductId) {
        window.dataStore.updateProduct(editingProductId, data);
      } else {
        window.dataStore.createProduct(data);
      }

      var successText = editingProductId ? 'Produto atualizado com sucesso.' : 'Produto criado com sucesso.';
      resetForm();
      refreshDashboardViews();
      setFeedback(productFormMessage, successText, 'success');
    } catch (error) {
      setFeedback(productFormMessage, error.message || 'Erro ao salvar produto.', 'error');
    }
  });

  passwordForm.addEventListener('submit', function (event) {
    event.preventDefault();

    try {
      var currentPassword = byId('admin-current-password').value;
      var newPassword = byId('admin-new-password').value;
      window.dataStore.updateAdminPassword(currentPassword, newPassword);
      passwordForm.reset();
      setFeedback(passwordMessage, 'Senha mestre atualizada com sucesso.', 'success');
    } catch (error) {
      setFeedback(passwordMessage, error.message || 'Erro ao atualizar senha.', 'error');
    }
  });

  function resolveAnonKeyFromInput() {
    var typedValue = String(cloudKeyInput.value || '').trim();
    var currentConfig = window.cloudSync.getConfig();
    var currentMasked = currentConfig.anonKey ? maskSecret(currentConfig.anonKey) : '';

    if (typedValue && typedValue === currentMasked) {
      return currentConfig.anonKey;
    }

    return typedValue;
  }

  function ensureCloudAdminAuthenticated() {
    if (!window.cloudSync || !window.cloudSync.isAuthenticated()) {
      throw new Error('Faca login no Supabase Auth para executar esta acao.');
    }
  }

  async function handleImageUpload() {
    if (!productImageFileInput) {
      setFeedback(productFormMessage, 'Input de upload nao encontrado.', 'error');
      return;
    }

    var file = productImageFileInput.files && productImageFileInput.files[0];
    if (!file) {
      setFeedback(productFormMessage, 'Selecione um arquivo de imagem.', 'error');
      return;
    }

    try {
      ensureCloudAdminAuthenticated();
      setFeedback(productFormMessage, 'Enviando imagem para Storage...', 'success');
      var result = await window.cloudSync.uploadProductImage(file, { prefix: 'products', maxWidth: 1400, maxHeight: 1400, quality: 0.82 });
      byId('product-imagem').value = result.publicUrl;
      productImageFileInput.value = '';
      setFeedback(productFormMessage, 'Imagem enviada. URL preenchida no campo.', 'success');
    } catch (error) {
      setFeedback(productFormMessage, error.message || 'Falha ao enviar imagem.', 'error');
    }
  }

  if (cloudSaveConfigBtn) {
    cloudSaveConfigBtn.addEventListener('click', function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      try {
        var url = cloudUrlInput.value;
        var anonKey = resolveAnonKeyFromInput();
        window.cloudSync.setConfig(url, anonKey);
        refreshCloudConfigFields();
        refreshCloudAuthState();
        setFeedback(cloudMessage, 'Credenciais salvas no navegador.', 'success');
      } catch (error) {
        setFeedback(cloudMessage, error.message || 'Erro ao salvar credenciais.', 'error');
      }
    });
  }

  if (cloudTestBtn) {
    cloudTestBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      try {
        setFeedback(cloudMessage, 'Testando conexao...', 'success');
        await window.cloudSync.testConnection();
        setFeedback(cloudMessage, 'Conexao com Supabase OK.', 'success');
      } catch (error) {
        setFeedback(cloudMessage, error.message || 'Falha na conexao com Supabase.', 'error');
      }
    });
  }

  if (cloudAuthLoginBtn) {
    cloudAuthLoginBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      try {
        var email = String((cloudAdminEmailInput && cloudAdminEmailInput.value) || '').trim();
        var password = String((cloudAdminPasswordInput && cloudAdminPasswordInput.value) || '');
        setFeedback(cloudMessage, 'Autenticando no Supabase Auth...', 'success');
        await window.cloudSync.signInAdmin(email, password);
        if (cloudAdminPasswordInput) {
          cloudAdminPasswordInput.value = '';
        }
        refreshCloudAuthState();
        setFeedback(cloudMessage, 'Login cloud admin realizado com sucesso.', 'success');
      } catch (error) {
        refreshCloudAuthState();
        setFeedback(cloudMessage, error.message || 'Falha no login cloud admin.', 'error');
      }
    });
  }

  if (cloudAuthLogoutBtn) {
    cloudAuthLogoutBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      try {
        await window.cloudSync.signOutAdmin();
        refreshCloudAuthState();
        setFeedback(cloudMessage, 'Logout cloud admin concluido.', 'success');
      } catch (error) {
        refreshCloudAuthState();
        setFeedback(cloudMessage, error.message || 'Falha ao sair do cloud admin.', 'error');
      }
    });
  }

  if (cloudTestAdminBtn) {
    cloudTestAdminBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      try {
        ensureCloudAdminAuthenticated();
        setFeedback(cloudMessage, 'Validando acesso admin no Supabase...', 'success');
        await window.cloudSync.testAdminAccess();
        refreshCloudAuthState();
        setFeedback(cloudMessage, 'Acesso admin validado com sucesso.', 'success');
      } catch (error) {
        refreshCloudAuthState();
        setFeedback(cloudMessage, error.message || 'Acesso admin negado no Supabase.', 'error');
      }
    });
  }

  if (cloudPushBtn) {
    cloudPushBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      try {
        ensureCloudAdminAuthenticated();
        var localProducts = window.dataStore.getProducts();
        setFeedback(cloudMessage, 'Enviando produtos para nuvem...', 'success');
        var totalSent = await window.cloudSync.pushProducts(localProducts);
        refreshCloudAuthState();
        setFeedback(cloudMessage, totalSent + ' produtos enviados com upsert.', 'success');
      } catch (error) {
        refreshCloudAuthState();
        setFeedback(cloudMessage, error.message || 'Erro ao enviar para nuvem.', 'error');
      }
    });
  }

  if (cloudPullBtn) {
    cloudPullBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      if (!window.confirm('Baixar da nuvem e substituir catalogo local atual?')) {
        return;
      }

      try {
        ensureCloudAdminAuthenticated();
        setFeedback(cloudMessage, 'Baixando produtos da nuvem...', 'success');
        var remoteProducts = await window.cloudSync.pullProducts();
        window.dataStore.replaceProducts(remoteProducts);
        resetForm();
        refreshDashboardViews();
        refreshCloudAuthState();
        setFeedback(cloudMessage, remoteProducts.length + ' produtos baixados da nuvem.', 'success');
      } catch (error) {
        refreshCloudAuthState();
        setFeedback(cloudMessage, error.message || 'Erro ao baixar da nuvem.', 'error');
      }
    });
  }

  if (cloudMirrorBtn) {
    cloudMirrorBtn.addEventListener('click', async function () {
      if (!window.cloudSync) {
        setFeedback(cloudMessage, 'Modulo cloud-sync indisponivel.', 'error');
        return;
      }

      if (!window.confirm('Isso vai apagar a tabela products na nuvem e reenviar o catalogo local. Continuar?')) {
        return;
      }

      try {
        ensureCloudAdminAuthenticated();
        var localProducts = window.dataStore.getProducts();
        setFeedback(cloudMessage, 'Espelhando local para nuvem...', 'success');
        var totalMirrored = await window.cloudSync.replaceRemoteWithLocal(localProducts);
        refreshCloudAuthState();
        setFeedback(cloudMessage, totalMirrored + ' produtos espelhados com sucesso.', 'success');
      } catch (error) {
        refreshCloudAuthState();
        setFeedback(cloudMessage, error.message || 'Erro ao espelhar catalogo.', 'error');
      }
    });
  }

  if (backupExportBtn) {
    backupExportBtn.addEventListener('click', function () {
      try {
        var json = window.dataStore.exportProductsJson();
        var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = '7store-products-backup.json';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setFeedback(backupMessage, 'Backup exportado com sucesso.', 'success');
      } catch (error) {
        setFeedback(backupMessage, error.message || 'Erro ao exportar backup.', 'error');
      }
    });
  }

  if (backupImportBtn && backupImportInput) {
    backupImportBtn.addEventListener('click', function () {
      backupImportInput.click();
    });

    backupImportInput.addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (loadEvent) {
        try {
          var text = String(loadEvent.target.result || '');
          window.dataStore.importProductsFromJson(text);
          resetForm();
          refreshDashboardViews();
          setFeedback(backupMessage, 'Backup importado com sucesso.', 'success');
        } catch (error) {
          setFeedback(backupMessage, error.message || 'Erro ao importar backup.', 'error');
        } finally {
          backupImportInput.value = '';
        }
      };
      reader.onerror = function () {
        setFeedback(backupMessage, 'Falha ao ler o arquivo.', 'error');
        backupImportInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  window.addEventListener('products:changed', function () {
    if (window.dataStore.isAdminAuthenticated()) {
      refreshDashboardViews();
    }
  });

  cancelEditBtn.addEventListener('click', resetForm);
  productsBody.addEventListener('click', handleTableAction);

  if (productImageUploadBtn) {
    productImageUploadBtn.addEventListener('click', function () {
      handleImageUpload();
    });
  }

  if (ordersRefreshBtn) {
    ordersRefreshBtn.addEventListener('click', function () {
      refreshOrders();
    });
  }

  if (rankingRefreshBtn) {
    rankingRefreshBtn.addEventListener('click', function () {
      refreshRanking();
    });
  }

  if (ordersBody) {
    ordersBody.addEventListener('click', async function (event) {
      var btn = event.target.closest('button.admin-order-save');
      if (!btn) return;

      try {
        ensureCloudAdminAuthenticated();
        var row = btn.closest('tr[data-order-id]');
        var orderId = row ? row.getAttribute('data-order-id') : '';
        if (!orderId) return;

        var statusSelect = row.querySelector('select.admin-order-status');
        var paySelect = row.querySelector('select.admin-order-payment-status');
        var patch = {
          status: statusSelect ? statusSelect.value : undefined,
          payment_status: paySelect ? paySelect.value : undefined
        };

        btn.disabled = true;
        setFeedback(ordersMessage, 'Salvando pedido...', 'success');
        await window.cloudSync.updateOrder(orderId, patch);
        setFeedback(ordersMessage, 'Pedido atualizado.', 'success');
        await refreshOrders();
      } catch (error) {
        setFeedback(ordersMessage, error.message || 'Falha ao salvar pedido.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (couponForm) {
    couponForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      try {
        ensureCloudAdminAuthenticated();
        var code = String(byId('coupon-code').value || '').trim().toUpperCase();
        var type = String(byId('coupon-type').value || '').trim();
        var value = toNumber(byId('coupon-value').value, NaN);
        var minTotal = toNumber(byId('coupon-min-total').value, 0);
        var active = byId('coupon-active').checked === true;

        if (!code) throw new Error('Codigo obrigatorio.');
        if (!Number.isFinite(value) || value < 0) throw new Error('Valor invalido.');

        setFeedback(couponMessage, 'Salvando cupom...', 'success');
        await window.cloudSync.upsertCoupon({
          code: code,
          discount_type: type,
          discount_value: value,
          min_order_total: minTotal,
          is_active: active
        });

        couponForm.reset();
        byId('coupon-active').checked = true;
        setFeedback(couponMessage, 'Cupom salvo.', 'success');
        await refreshCoupons();
      } catch (error) {
        setFeedback(couponMessage, error.message || 'Falha ao salvar cupom.', 'error');
      }
    });
  }

  if (couponsBody) {
    couponsBody.addEventListener('click', async function (event) {
      var btn = event.target.closest('button.admin-coupon-delete');
      if (!btn) return;
      var row = btn.closest('tr[data-coupon-id]');
      var id = row ? row.getAttribute('data-coupon-id') : '';
      if (!id) return;
      if (!window.confirm('Excluir cupom?')) return;

      try {
        ensureCloudAdminAuthenticated();
        btn.disabled = true;
        await window.cloudSync.deleteCoupon(id);
        await refreshCoupons();
      } catch (error) {
        setFeedback(couponMessage, error.message || 'Falha ao excluir cupom.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (bannerForm) {
    bannerForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      try {
        ensureCloudAdminAuthenticated();
        var title = String(byId('banner-title').value || '').trim();
        var subtitle = String(byId('banner-subtitle').value || '').trim();
        var imageUrl = String(byId('banner-image').value || '').trim();
        var linkUrl = String(byId('banner-link').value || '').trim();
        var position = String(byId('banner-position').value || '').trim() || 'home_hero';
        var active = byId('banner-active').checked === true;

        if (!title) throw new Error('Titulo obrigatorio.');

        setFeedback(bannerMessage, 'Salvando banner...', 'success');
        await window.cloudSync.upsertBanner({
          title: title,
          subtitle: subtitle || null,
          image_url: imageUrl || null,
          link_url: linkUrl || null,
          position: position,
          is_active: active
        });

        bannerForm.reset();
        byId('banner-position').value = 'home_hero';
        byId('banner-active').checked = true;
        setFeedback(bannerMessage, 'Banner salvo.', 'success');
        await refreshBanners();
      } catch (error) {
        setFeedback(bannerMessage, error.message || 'Falha ao salvar banner.', 'error');
      }
    });
  }

  if (bannersBody) {
    bannersBody.addEventListener('click', async function (event) {
      var btn = event.target.closest('button.admin-banner-delete');
      if (!btn) return;
      var row = btn.closest('tr[data-banner-id]');
      var id = row ? row.getAttribute('data-banner-id') : '';
      if (!id) return;
      if (!window.confirm('Excluir banner?')) return;

      try {
        ensureCloudAdminAuthenticated();
        btn.disabled = true;
        await window.cloudSync.deleteBanner(id);
        await refreshBanners();
      } catch (error) {
        setFeedback(bannerMessage, error.message || 'Falha ao excluir banner.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (categoryForm) {
    categoryForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      try {
        ensureCloudAdminAuthenticated();
        var slug = String(byId('category-slug').value || '').trim().toLowerCase();
        var name = String(byId('category-name').value || '').trim();
        var icon = String(byId('category-icon').value || '').trim();
        var active = byId('category-active').checked === true;

        if (!slug) throw new Error('Slug obrigatorio.');
        if (!name) throw new Error('Nome obrigatorio.');

        setFeedback(categoryMessage, 'Salvando categoria...', 'success');
        await window.cloudSync.upsertCategory({
          slug: slug,
          name: name,
          icon: icon || null,
          is_active: active
        });

        categoryForm.reset();
        byId('category-active').checked = true;
        setFeedback(categoryMessage, 'Categoria salva.', 'success');
        await refreshCategories();
      } catch (error) {
        setFeedback(categoryMessage, error.message || 'Falha ao salvar categoria.', 'error');
      }
    });
  }

  if (categoriesBody) {
    categoriesBody.addEventListener('click', async function (event) {
      var btn = event.target.closest('button.admin-category-delete');
      if (!btn) return;
      var row = btn.closest('tr[data-category-id]');
      var id = row ? row.getAttribute('data-category-id') : '';
      if (!id) return;
      if (!window.confirm('Excluir categoria?')) return;

      try {
        ensureCloudAdminAuthenticated();
        btn.disabled = true;
        await window.cloudSync.deleteCategory(id);
        await refreshCategories();
      } catch (error) {
        setFeedback(categoryMessage, error.message || 'Falha ao excluir categoria.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  setupThemeToggle();
  refreshCloudAuthState();
  setVisibility();
})();
