(function () {
  'use strict';

  var URL_KEY = '7store_supabase_url';
  var ANON_KEY_KEY = '7store_supabase_anon_key';
  var SESSION_KEY = '7store_supabase_session';

  function normalizeUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function nowInSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  function parseJsonSafe(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function getConfig() {
    var fromWindow = window.SUPABASE_CONFIG || {};

    var configuredUrl = normalizeUrl(localStorage.getItem(URL_KEY) || fromWindow.url || '');
    var configuredAnonKey = String(localStorage.getItem(ANON_KEY_KEY) || fromWindow.anonKey || '').trim();

    return {
      url: configuredUrl,
      anonKey: configuredAnonKey
    };
  }

  function hasConfig() {
    var config = getConfig();
    return Boolean(config.url && config.anonKey);
  }

  function setConfig(url, anonKey) {
    var normalizedUrl = normalizeUrl(url);
    var normalizedAnonKey = String(anonKey || '').trim();

    if (!/^https:\/\//i.test(normalizedUrl)) {
      throw new Error('URL do Supabase invalida. Use https://...');
    }

    if (normalizedAnonKey.length < 20) {
      throw new Error('Anon key invalida.');
    }

    localStorage.setItem(URL_KEY, normalizedUrl);
    localStorage.setItem(ANON_KEY_KEY, normalizedAnonKey);

    return getConfig();
  }

  function clearConfig() {
    localStorage.removeItem(URL_KEY);
    localStorage.removeItem(ANON_KEY_KEY);
  }

  function getStoredSession() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    var parsed = parseJsonSafe(raw, null);
    if (!parsed || !parsed.access_token) {
      return null;
    }

    return parsed;
  }

  function saveSession(sessionPayload) {
    if (!sessionPayload || !sessionPayload.access_token) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    var expiresAt = Number(sessionPayload.expires_at || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      if (sessionPayload.expires_in) {
        expiresAt = nowInSeconds() + Number(sessionPayload.expires_in);
      }
    }

    var session = {
      access_token: String(sessionPayload.access_token),
      refresh_token: String(sessionPayload.refresh_token || ''),
      expires_at: Number.isFinite(expiresAt) ? expiresAt : nowInSeconds() + 3600,
      token_type: String(sessionPayload.token_type || 'bearer'),
      user: sessionPayload.user || null
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isSessionExpired(session, skewSeconds) {
    if (!session || !session.access_token) {
      return true;
    }

    var skew = Number.isFinite(skewSeconds) ? skewSeconds : 45;
    return Number(session.expires_at || 0) <= nowInSeconds() + skew;
  }

  function getAuthSummary() {
    var session = getStoredSession();
    if (!session) {
      return {
        authenticated: false,
        email: '',
        expiresAt: null
      };
    }

    return {
      authenticated: !isSessionExpired(session, 0),
      email: session.user && session.user.email ? session.user.email : '',
      expiresAt: Number(session.expires_at || 0) || null
    };
  }

  function isAuthenticated() {
    return getAuthSummary().authenticated;
  }

  async function parseResponse(response) {
    var responseText = await response.text();

    if (!response.ok) {
      var message = 'Erro de comunicacao com Supabase.';

      if (responseText) {
        var parsedError = parseJsonSafe(responseText, null);
        if (parsedError) {
          message = parsedError.message || parsedError.error_description || parsedError.error || responseText;
        } else {
          message = responseText;
        }
      }

      throw new Error(message);
    }

    if (!responseText) {
      return null;
    }

    var parsed = parseJsonSafe(responseText, null);
    return parsed == null ? responseText : parsed;
  }

  async function refreshSessionIfNeeded() {
    var config = getConfig();
    var current = getStoredSession();

    if (!current) {
      throw new Error('Sessao Supabase nao encontrada.');
    }

    if (!isSessionExpired(current, 45)) {
      return current.access_token;
    }

    if (!current.refresh_token) {
      clearSession();
      throw new Error('Sessao expirada. Faca login novamente no Supabase.');
    }

    var response = await fetch(config.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: current.refresh_token
      })
    });

    var refreshed = await parseResponse(response);
    var saved = saveSession(refreshed);
    return saved.access_token;
  }

  async function getAuthorizationToken(authMode) {
    var config = getConfig();

    if (authMode === 'user') {
      var session = getStoredSession();
      if (!session) {
        throw new Error('Login Supabase obrigatorio para esta acao.');
      }

      return refreshSessionIfNeeded();
    }

    return config.anonKey;
  }

  async function request(path, options, authMode) {
    var config = getConfig();

    if (!config.url || !config.anonKey) {
      throw new Error('Supabase nao configurado.');
    }

    var mode = authMode || 'anon';
    var token = await getAuthorizationToken(mode);

    var extraHeaders = (options && options.headers) || {};
    var headers = {
      apikey: config.anonKey,
      Authorization: 'Bearer ' + token
    };

    Object.keys(extraHeaders).forEach(function (key) {
      headers[key] = extraHeaders[key];
    });

    var response = await fetch(config.url + path, {
      method: (options && options.method) || 'GET',
      headers: headers,
      body: options && options.body ? options.body : undefined
    });

    return parseResponse(response);
  }

  function toRemoteProduct(product) {
    return {
      id: product.id,
      nome: product.nome,
      categoria: product.categoria,
      brand: product.brand || null,
      sku: product.sku || null,
      preco: product.preco,
      cost_price: product.costPrice == null ? product.cost_price : product.costPrice,
      preco_original: product.precoOriginal,
      desconto: product.desconto,
      imagem: product.imagem,
      descricao: product.descricao,
      popularity_score: product.popularityScore,
      stock: product.stock,
      is_active: product.isActive !== false,
      is_featured: product.isFeatured === true,
      currency: product.currency || 'BRL'
    };
  }

  function toLocalProduct(remoteProduct) {
    return {
      id: remoteProduct.id,
      nome: remoteProduct.nome,
      categoria: remoteProduct.categoria,
      brand: remoteProduct.brand,
      sku: remoteProduct.sku,
      preco: Number(remoteProduct.preco || 0),
      costPrice: remoteProduct.cost_price == null ? null : Number(remoteProduct.cost_price),
      precoOriginal: remoteProduct.preco_original == null ? null : Number(remoteProduct.preco_original),
      desconto: remoteProduct.desconto == null ? null : Number(remoteProduct.desconto),
      imagem: remoteProduct.imagem,
      descricao: remoteProduct.descricao,
      popularityScore: Number(remoteProduct.popularity_score || 0),
      stock: Number(remoteProduct.stock || 0),
      isActive: remoteProduct.is_active !== false,
      isFeatured: remoteProduct.is_featured === true,
      currency: remoteProduct.currency || 'BRL'
    };
  }

  async function signInAdmin(email, password) {
    var config = getConfig();

    if (!email || !password) {
      throw new Error('Informe email e senha do admin Supabase.');
    }

    var response = await fetch(config.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: String(email).trim(),
        password: String(password)
      })
    });

    var payload = await parseResponse(response);
    saveSession(payload);
    return getAuthSummary();
  }

  async function signOutAdmin() {
    try {
      await request('/auth/v1/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, 'user');
    } catch (error) {
      // ignora falha remota e encerra sessao local
    }

    clearSession();
    return true;
  }

  async function testConnection() {
    await request('/rest/v1/products?select=id&limit=1', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'anon');

    return true;
  }

  async function testAdminAccess() {
    await request('/rest/v1/products?select=id&limit=1', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');

    return true;
  }

  async function pullProducts() {
    var rows = await request('/rest/v1/products?select=*&order=id.asc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map(toLocalProduct);
  }

  async function pullPublicProducts() {
    var rows = await request('/rest/v1/products?select=*&is_active=eq.true&order=id.asc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'anon');

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map(toLocalProduct);
  }

  async function pushProducts(localProducts) {
    if (!Array.isArray(localProducts)) {
      throw new Error('Lista local de produtos invalida.');
    }

    var payload = localProducts.map(toRemoteProduct);

    await request('/rest/v1/products?on_conflict=id', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    }, 'user');

    return payload.length;
  }

  async function clearRemoteProducts() {
    await request('/rest/v1/products?id=gt.0', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Prefer: 'return=minimal'
      }
    }, 'user');

    return true;
  }

  async function replaceRemoteWithLocal(localProducts) {
    await clearRemoteProducts();
    return pushProducts(localProducts);
  }

  async function pullOrders(limit) {
    var lim = Number.isFinite(Number(limit)) ? Number(limit) : 30;
    var rows = await request('/rest/v1/orders?select=*,order_items(*)&order=created_at.desc&limit=' + lim, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');

    return Array.isArray(rows) ? rows : [];
  }

  async function updateOrder(orderId, patch) {
    if (!orderId) {
      throw new Error('orderId obrigatorio.');
    }

    await request('/rest/v1/orders?id=eq.' + encodeURIComponent(orderId), {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patch || {})
    }, 'user');

    return true;
  }

  async function pullCoupons() {
    var rows = await request('/rest/v1/coupons?select=*&order=created_at.desc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertCoupon(coupon) {
    await request('/rest/v1/coupons?on_conflict=code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([coupon])
    }, 'user');
    return true;
  }

  async function deleteCoupon(couponId) {
    await request('/rest/v1/coupons?id=eq.' + encodeURIComponent(couponId), {
      method: 'DELETE',
      headers: { Accept: 'application/json', Prefer: 'return=minimal' }
    }, 'user');
    return true;
  }

  async function pullBannersPublic() {
    var rows = await request('/rest/v1/banners?select=*&is_active=eq.true&order=created_at.desc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'anon');
    return Array.isArray(rows) ? rows : [];
  }

  async function pullBanners() {
    var rows = await request('/rest/v1/banners?select=*&order=created_at.desc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertBanner(banner) {
    await request('/rest/v1/banners', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([banner])
    }, 'user');
    return true;
  }

  async function deleteBanner(bannerId) {
    await request('/rest/v1/banners?id=eq.' + encodeURIComponent(bannerId), {
      method: 'DELETE',
      headers: { Accept: 'application/json', Prefer: 'return=minimal' }
    }, 'user');
    return true;
  }

  async function pullCategoriesPublic() {
    var rows = await request('/rest/v1/categories?select=*&is_active=eq.true&order=name.asc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'anon');
    return Array.isArray(rows) ? rows : [];
  }

  async function pullCategories() {
    var rows = await request('/rest/v1/categories?select=*&order=name.asc', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');
    return Array.isArray(rows) ? rows : [];
  }

  async function upsertCategory(category) {
    await request('/rest/v1/categories?on_conflict=slug', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([category])
    }, 'user');
    return true;
  }

  async function deleteCategory(categoryId) {
    await request('/rest/v1/categories?id=eq.' + encodeURIComponent(categoryId), {
      method: 'DELETE',
      headers: { Accept: 'application/json', Prefer: 'return=minimal' }
    }, 'user');
    return true;
  }

  async function pullProductRanking() {
    var rows = await request('/rest/v1/product_ranking?select=id,nome,categoria,brand,units_sold,gross_revenue,gross_margin,margin_rate,stock,turnover_ratio&order=margin_rate.desc.nullslast&limit=60', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }, 'user');
    return Array.isArray(rows) ? rows : [];
  }

  function sanitizePathSegment(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'file';
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== 'function') {
        resolve(null);
        return;
      }
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  async function optimizeImageFile(file, options) {
    var maxWidth = options && options.maxWidth ? Number(options.maxWidth) : 1400;
    var maxHeight = options && options.maxHeight ? Number(options.maxHeight) : 1400;
    var quality = options && options.quality ? Number(options.quality) : 0.82;

    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      return file;
    }

    if (typeof createImageBitmap !== 'function') {
      return file;
    }

    var bitmap = await createImageBitmap(file);
    var width = bitmap.width;
    var height = bitmap.height;

    var ratio = Math.min(1, maxWidth / width, maxHeight / height);
    var targetW = Math.max(1, Math.round(width * ratio));
    var targetH = Math.max(1, Math.round(height * ratio));

    var canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    var blob = await canvasToBlob(canvas, 'image/webp', quality);
    var outType = 'image/webp';
    if (!blob) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      outType = 'image/jpeg';
    }

    if (!blob) {
      return file;
    }

    return new File([blob], file.name, { type: outType });
  }

  async function uploadProductImage(file, options) {
    var config = getConfig();
    var bucket = 'product-images';
    var optimized = await optimizeImageFile(file, options || {});
    var ext = optimized.type === 'image/webp' ? 'webp' : (optimized.type === 'image/png' ? 'png' : 'jpg');
    var base = sanitizePathSegment((options && options.prefix) || 'products');
    var name = sanitizePathSegment(optimized.name || 'image');
    var objectPath = base + '/' + Date.now() + '-' + name + '.' + ext;

    var token = await getAuthorizationToken('user');

    var response = await fetch(config.url + '/storage/v1/object/' + bucket + '/' + objectPath, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: 'Bearer ' + token,
        'Content-Type': optimized.type || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: optimized
    });

    var payload = await parseResponse(response);

    return {
      bucket: bucket,
      path: objectPath,
      publicUrl: config.url + '/storage/v1/object/public/' + bucket + '/' + objectPath,
      raw: payload
    };
  }

  window.cloudSync = {
    hasConfig: hasConfig,
    getConfig: getConfig,
    setConfig: setConfig,
    clearConfig: clearConfig,
    signInAdmin: signInAdmin,
    signOutAdmin: signOutAdmin,
    isAuthenticated: isAuthenticated,
    getAuthSummary: getAuthSummary,
    testConnection: testConnection,
    testAdminAccess: testAdminAccess,
    pullPublicProducts: pullPublicProducts,
    pullProducts: pullProducts,
    pushProducts: pushProducts,
    clearRemoteProducts: clearRemoteProducts,
    replaceRemoteWithLocal: replaceRemoteWithLocal,
    uploadProductImage: uploadProductImage,
    pullOrders: pullOrders,
    updateOrder: updateOrder,
    pullCoupons: pullCoupons,
    upsertCoupon: upsertCoupon,
    deleteCoupon: deleteCoupon,
    pullBannersPublic: pullBannersPublic,
    pullBanners: pullBanners,
    upsertBanner: upsertBanner,
    deleteBanner: deleteBanner,
    pullCategoriesPublic: pullCategoriesPublic,
    pullCategories: pullCategories,
    upsertCategory: upsertCategory,
    deleteCategory: deleteCategory
    ,
    pullProductRanking: pullProductRanking
  };
})();
