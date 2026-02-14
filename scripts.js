// ====================================================================
// ========================= 1. ESTADO GLOBAL =========================
// ====================================================================

let textoPesquisar = '';
let categoriaAtual = 'all';
let sortType = 'relevance';
let cartItems = loadCart() || [];
let produtos = [];
let runtimeCatalog = null;
let catalogLoadStatus = 'idle';
let catalogLoadMessage = '';
let filterState = {
  minPrice: null,
  maxPrice: null,
  brand: 'all',
  inStockOnly: false
};

const SEARCH_HISTORY_KEY = '7store_search_history';
const HISTORY_MAX_ITEMS = 5;
const FRETE_FIXO = 50.0;
const CUSTOMER_SESSION_KEY = '7store_customer_session';
const CUSTOMER_PROFILE_MAP_KEY = '7store_customer_profile_map';

const containerProdutos = document.querySelector('.products-container');
const input = document.querySelector('.search-input');
const todosBotoes = document.querySelectorAll('.category-btn');
const sortSelect = document.getElementById('sort-select');
const filterMinPriceInput = document.getElementById('filter-min-price');
const filterMaxPriceInput = document.getElementById('filter-max-price');
const filterBrandSelect = document.getElementById('filter-brand');
const filterInStockInput = document.getElementById('filter-instock');
const filterResetBtn = document.getElementById('filter-reset');
const searchHistoryDropdown = document.querySelector('.search-history-dropdown');
const searchIcon = document.querySelector('.search-container i');

const sideCart = document.querySelector('.side-cart');
const cartItemsContainer = document.querySelector('.cart-items-container');
const cartTotalSpan = document.getElementById('cart-total');
const cartItemCountSpan = document.querySelector('.cart-item-count');
const cartSubtotalSpan = document.getElementById('cart-subtotal');
const overlay = document.querySelector('.overlay');

const CHECKOUT_URL = 'checkout.html';
const ACCOUNT_URL = 'minha-conta.html';

// ====================================================================
// ========================= 2. UTILIDADES ============================
// ====================================================================

function debounce(func, delay) {
  let timeoutId;
  return function debounced(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getStorePublicProducts() {
  if (Array.isArray(runtimeCatalog)) {
    return runtimeCatalog.filter((product) => product.isActive !== false);
  }

  return [];
}

function getStoreAllProducts() {
  if (Array.isArray(runtimeCatalog)) {
    return [...runtimeCatalog];
  }

  return [];
}

function refreshProducts() {
  produtos = getStoreAllProducts();
}

async function loadCatalogFromCloudIfAvailable() {
  if (!window.cloudSync || typeof window.cloudSync.hasConfig !== 'function') {
    runtimeCatalog = [];
    catalogLoadStatus = 'missing_config';
    catalogLoadMessage = 'CloudSync indisponivel.';
    return false;
  }

  if (!window.cloudSync.hasConfig() || typeof window.cloudSync.pullPublicProducts !== 'function') {
    runtimeCatalog = [];
    catalogLoadStatus = 'missing_config';
    catalogLoadMessage = 'Supabase nao configurado no front-end.';
    return false;
  }

  try {
    const publicProducts = await window.cloudSync.pullPublicProducts();
    if (Array.isArray(publicProducts)) {
      runtimeCatalog = publicProducts;
      refreshProducts();
      catalogLoadStatus = publicProducts.length > 0 ? 'ok' : 'empty';
      catalogLoadMessage = publicProducts.length > 0 ? '' : 'Nenhum produto publicado na nuvem.';

      return publicProducts.length > 0;
    }

    runtimeCatalog = [];
    catalogLoadStatus = 'error';
    catalogLoadMessage = 'Resposta invalida da nuvem.';
    return false;
  } catch (error) {
    runtimeCatalog = [];
    catalogLoadStatus = 'error';
    catalogLoadMessage = String(error && error.message ? error.message : 'Falha ao carregar catalogo cloud.');
  }

  return false;
}

function findProductById(productId, allowInactive = false) {
  const id = toNumber(productId, null);
  if (id === null) {
    return null;
  }

  refreshProducts();
  const product = produtos.find((item) => item.id === id) || null;
  if (!product) {
    return null;
  }

  if (!allowInactive && product.isActive === false) {
    return null;
  }

  return product;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBRL(value) {
  const num = toNumber(value, 0);
  return `R$ ${num.toFixed(2)}`;
}

function buildLoginUrl(nextUrl) {
  const next = nextUrl || window.location.href;
  return `login.html?next=${encodeURIComponent(next)}`;
}

async function rpcCall(functionName, body, requireAuth = true) {
  if (!hasCloudPublicConfig()) {
    throw new Error('Supabase nao configurado no front-end.');
  }

  const { url, anonKey } = getCloudPublicConfig();
  const headers = {
    apikey: anonKey,
    'Content-Type': 'application/json'
  };

  if (requireAuth) {
    let session = getCustomerSession();
    if (isCustomerCloudSession(session)) {
      session = await refreshCustomerCloudSessionIfNeeded(session);
    }

    if (!isCustomerCloudSession(session)) {
      throw new Error('Login obrigatorio.');
    }
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {})
  });

  const payloadText = await response.text();
  let payload = null;
  try {
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch (error) {
    payload = payloadText;
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.message || payload.error || payload.hint)) ||
      (typeof payload === 'string' && payload) ||
      'Erro RPC no Supabase.';
    throw new Error(message);
  }

  return payload;
}

// ====================================================================
// ==================== 3. LOGIN / CADASTRO ==========================
// ====================================================================

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getCloudPublicConfig() {
  if (window.cloudSync && typeof window.cloudSync.getConfig === 'function') {
    const config = window.cloudSync.getConfig();
    return {
      url: String(config.url || '').trim().replace(/\/+$/, ''),
      anonKey: String(config.anonKey || '').trim()
    };
  }

  const config = window.SUPABASE_CONFIG || {};
  return {
    url: String(config.url || '').trim().replace(/\/+$/, ''),
    anonKey: String(config.anonKey || '').trim()
  };
}

function hasCloudPublicConfig() {
  const config = getCloudPublicConfig();
  return /^https:\/\//i.test(config.url) && config.anonKey.length > 20;
}

function isCustomerCloudSession(session) {
  return Boolean(session && session.mode === 'cloud' && session.access_token);
}

function isSessionExpired(expiresAt, skewSeconds = 30) {
  const expires = Number(expiresAt || 0);
  const now = Math.floor(Date.now() / 1000);
  return !Number.isFinite(expires) || expires <= now + skewSeconds;
}

function getCustomerSession() {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.mode !== 'cloud') {
      if (parsed) {
        clearCustomerSession();
      }
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveCustomerSession(user) {
  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(user));
}

function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
}

function loadCustomerProfileMap() {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveCustomerProfileMap(profileMap) {
  localStorage.setItem(CUSTOMER_PROFILE_MAP_KEY, JSON.stringify(profileMap));
}

function setCustomerDisplayName(email, nome) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(nome || '').trim();
  if (!normalizedEmail || !normalizedName) return;

  const map = loadCustomerProfileMap();
  map[normalizedEmail] = normalizedName;
  saveCustomerProfileMap(map);
}

function getCustomerDisplayName(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return '';
  const map = loadCustomerProfileMap();
  return String(map[normalizedEmail] || '').trim();
}

function parseSupabaseError(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage;
  }

  return (
    payload.msg ||
    payload.message ||
    payload.error_description ||
    payload.error ||
    fallbackMessage
  );
}

function buildCloudSessionFromAuthPayload(payload, fallbackEmail = '', fallbackName = '') {
  const expiresAtRaw = payload.expires_at;
  const expiresInRaw = payload.expires_in;
  const expiresAt =
    Number(expiresAtRaw) ||
    (Number(expiresInRaw) ? Math.floor(Date.now() / 1000) + Number(expiresInRaw) : 0);

  const user = payload.user || {};
  const userEmail = normalizeEmail(user.email || fallbackEmail);
  const metadata = user.user_metadata || {};
  const profileName =
    String(metadata.nome || metadata.name || fallbackName || getCustomerDisplayName(userEmail) || '').trim();

  if (userEmail && profileName) {
    setCustomerDisplayName(userEmail, profileName);
  }

  return {
    mode: 'cloud',
    email: userEmail,
    nome: profileName || userEmail.split('@')[0] || 'Cliente',
    access_token: String(payload.access_token || ''),
    refresh_token: String(payload.refresh_token || ''),
    expires_at: Number(expiresAt || 0),
    token_type: String(payload.token_type || 'bearer'),
    loginAt: new Date().toISOString()
  };
}

async function refreshCustomerCloudSessionIfNeeded(session) {
  if (!isCustomerCloudSession(session)) {
    return session;
  }

  if (!isSessionExpired(session.expires_at, 45)) {
    return session;
  }

  if (!session.refresh_token || !hasCloudPublicConfig()) {
    clearCustomerSession();
    return null;
  }

  const { url, anonKey } = getCloudPublicConfig();

  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: session.refresh_token
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      clearCustomerSession();
      return null;
    }

    const refreshed = buildCloudSessionFromAuthPayload(payload, session.email, session.nome);
    saveCustomerSession(refreshed);
    return refreshed;
  } catch (error) {
    clearCustomerSession();
    return null;
  }
}

async function customerCloudSignOut() {
  const session = getCustomerSession();
  if (!isCustomerCloudSession(session) || !hasCloudPublicConfig()) {
    clearCustomerSession();
    return;
  }

  const { url, anonKey } = getCloudPublicConfig();
  try {
    await fetch(`${url}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // logout remoto falhou, segue logout local
  }

  clearCustomerSession();
}

function ensureFormFeedback(form, id) {
  let feedback = document.getElementById(id);
  if (feedback) {
    return feedback;
  }

  feedback = document.createElement('p');
  feedback.id = id;
  feedback.style.marginTop = '0.75rem';
  feedback.style.fontSize = '0.95rem';
  feedback.style.minHeight = '1.2rem';
  form.appendChild(feedback);
  return feedback;
}

function setFormFeedback(element, message, type = '') {
  if (!element) return;
  element.textContent = message || '';
  element.style.color = type === 'error' ? '#d92d20' : '#0f9d58';
}

function injectSupabaseQuickConfig(form, feedback) {
  if (!form || document.getElementById('supabase-quick-config')) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'supabase-quick-config';
  wrapper.style.marginTop = '0.75rem';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '0.5rem';
  wrapper.style.flexWrap = 'wrap';
  wrapper.style.alignItems = 'center';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-btn';
  btn.textContent = 'Configurar Supabase';

  const tip = document.createElement('small');
  tip.style.color = 'var(--text-secondary-color)';
  tip.textContent = 'Use a Project URL e a anon key (public).';

  btn.addEventListener('click', () => {
    try {
      const url = window.prompt('Cole a Project URL do Supabase (https://...supabase.co):', '') || '';
      const key = window.prompt('Cole a anon public key do Supabase:', '') || '';

      if (!url.trim() || !key.trim()) {
        setFormFeedback(feedback, 'Preencha URL e anon key.', 'error');
        return;
      }

      if (window.cloudSync && typeof window.cloudSync.setConfig === 'function') {
        window.cloudSync.setConfig(url.trim(), key.trim());
      } else {
        window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
        window.SUPABASE_CONFIG.url = url.trim();
        window.SUPABASE_CONFIG.anonKey = key.trim();
      }

      setFormFeedback(feedback, 'Supabase configurado. Recarregando...', 'success');
      setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setFormFeedback(feedback, error.message || 'Falha ao configurar Supabase.', 'error');
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(tip);

  form.appendChild(wrapper);
}

function injectSupabaseQuickConfigPanel(mountEl) {
  if (!mountEl || document.getElementById('supabase-quick-config-panel')) {
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'supabase-quick-config-panel';
  panel.style.maxWidth = '520px';
  panel.style.margin = '1rem auto 0';
  panel.style.padding = '1rem';
  panel.style.border = '1px solid var(--border-color)';
  panel.style.borderRadius = '0.75rem';
  panel.style.background = 'var(--surface-color)';
  panel.style.boxShadow = '0 4px 10px var(--shadow-color)';
  panel.style.gridColumn = '1 / -1';

  panel.innerHTML = `
    <p style="margin:0 0 0.75rem; color: var(--text-secondary-color);">
      Supabase nao configurado. Configure para carregar o catalogo da nuvem.
    </p>
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      <button type="button" class="admin-btn" id="supabase-panel-btn">Configurar Supabase</button>
      <small style="color: var(--text-secondary-color);">Project URL + anon key (public).</small>
    </div>
    <p id="supabase-panel-feedback" style="margin:0.75rem 0 0; min-height:1.2rem;"></p>
  `;

  mountEl.appendChild(panel);

  const feedback = panel.querySelector('#supabase-panel-feedback');
  const btn = panel.querySelector('#supabase-panel-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    try {
      const url = window.prompt('Cole a Project URL do Supabase (https://...supabase.co):', '') || '';
      const key = window.prompt('Cole a anon public key do Supabase:', '') || '';

      if (!url.trim() || !key.trim()) {
        if (feedback) setFormFeedback(feedback, 'Preencha URL e anon key.', 'error');
        return;
      }

      if (window.cloudSync && typeof window.cloudSync.setConfig === 'function') {
        window.cloudSync.setConfig(url.trim(), key.trim());
      } else {
        window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
        window.SUPABASE_CONFIG.url = url.trim();
        window.SUPABASE_CONFIG.anonKey = key.trim();
      }

      if (feedback) setFormFeedback(feedback, 'Supabase configurado. Recarregando...', 'success');
      setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      if (feedback) setFormFeedback(feedback, error.message || 'Falha ao configurar Supabase.', 'error');
    }
  });
}

async function setupCustomerHeaderUI() {
  const authLinks = document.querySelector('.login-container .auth-links');
  if (!authLinks) return;

  const mainLink = authLinks.querySelector('.main-link');
  const firstSubLink = authLinks.querySelector('.sub-link');
  let session = getCustomerSession();
  if (isCustomerCloudSession(session)) {
    session = await refreshCustomerCloudSessionIfNeeded(session);
  }

  if (!session || !mainLink || !firstSubLink) return;

  const firstName = (session.nome || 'Cliente').split(' ')[0];
  mainLink.textContent = `Ola, ${firstName}`;
  mainLink.href = ACCOUNT_URL;

  firstSubLink.textContent = 'Sair';
  firstSubLink.href = '#';
  firstSubLink.addEventListener('click', async (event) => {
    event.preventDefault();
    await customerCloudSignOut();
    window.location.reload();
  });
}

async function tooManyLoginAttempts(email) {
  try {
    const result = await rpcCall('too_many_login_attempts', { p_email: email }, false);
    return result === true;
  } catch (error) {
    return false;
  }
}

async function registerLoginAttempt(email, success) {
  try {
    await rpcCall('register_login_attempt', { p_email: email, p_success: !!success }, false);
  } catch (error) {
    // ignora telemetria
  }
}

function setupRegisterPage() {
  const nameInput = document.getElementById('register-name');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  if (!nameInput || !emailInput || !passwordInput) return;

  const form = nameInput.closest('form');
  if (!form) return;

  const feedback = ensureFormFeedback(form, 'register-feedback');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nome = String(nameInput.value || '').trim();
    const email = normalizeEmail(emailInput.value);
    const senha = String(passwordInput.value || '');

    if (!nome || !email || !senha) {
      setFormFeedback(feedback, 'Preencha todos os campos.', 'error');
      return;
    }

    if (!form.checkValidity()) {
      setFormFeedback(feedback, 'Verifique os campos e tente novamente.', 'error');
      return;
    }

    if (!hasCloudPublicConfig()) {
      setFormFeedback(feedback, 'Supabase nao configurado no front-end.', 'error');
      injectSupabaseQuickConfig(form, feedback);
      return;
    }

    const { url, anonKey } = getCloudPublicConfig();
    try {
      setFormFeedback(feedback, 'Criando conta na nuvem...', 'success');
      const response = await fetch(`${url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password: senha,
          data: { nome }
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFormFeedback(feedback, parseSupabaseError(payload, 'Falha ao cadastrar na nuvem.'), 'error');
        return;
      }

      setCustomerDisplayName(email, nome);

      if (payload && payload.access_token) {
        saveCustomerSession(buildCloudSessionFromAuthPayload(payload, email, nome));
        setFormFeedback(feedback, 'Cadastro realizado. Redirecionando...', 'success');
        const nextParam = new URLSearchParams(window.location.search).get('next');
        setTimeout(() => {
          window.location.href = nextParam ? String(nextParam) : 'index.html';
        }, 700);
        return;
      }

      setFormFeedback(
        feedback,
        'Conta criada. Se necessario, confirme o email e faca login.',
        'success'
      );
      setTimeout(() => {
        window.location.href = `login.html?email=${encodeURIComponent(email)}`;
      }, 1000);
    } catch (error) {
      setFormFeedback(feedback, 'Falha ao conectar com o Supabase.', 'error');
    }
  });
}

function setupLoginPage() {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const forgotLink = document.getElementById('forgot-password-link');
  if (!emailInput || !passwordInput) return;

  const queryEmail = new URLSearchParams(window.location.search).get('email');
  if (queryEmail) {
    emailInput.value = queryEmail;
  }

  const form = emailInput.closest('form');
  if (!form) return;

  const feedback = ensureFormFeedback(form, 'login-feedback');

  if (forgotLink) {
    forgotLink.addEventListener('click', async (event) => {
      event.preventDefault();

      const email = normalizeEmail(emailInput.value);
      if (!email) {
        setFormFeedback(feedback, 'Digite seu email para recuperar a senha.', 'error');
        return;
      }

      if (!hasCloudPublicConfig()) {
        setFormFeedback(feedback, 'Supabase nao configurado no front-end.', 'error');
        return;
      }

      const { url, anonKey } = getCloudPublicConfig();
      try {
        setFormFeedback(feedback, 'Enviando email de recuperacao...', 'success');
        const body = { email };
        if (/^https?:\/\//i.test(window.location.origin)) {
          body.redirect_to = `${window.location.origin}/login.html`;
        }

        const response = await fetch(`${url}/auth/v1/recover`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setFormFeedback(feedback, parseSupabaseError(payload, 'Falha ao enviar email.'), 'error');
          return;
        }

        setFormFeedback(feedback, 'Confira seu email para redefinir a senha.', 'success');
      } catch (error) {
        setFormFeedback(feedback, 'Falha de conexao com o Supabase.', 'error');
      }
    });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = normalizeEmail(emailInput.value);
    const senha = String(passwordInput.value || '');

    if (!email || !senha) {
      setFormFeedback(feedback, 'Informe email e senha.', 'error');
      return;
    }

    if (!hasCloudPublicConfig()) {
      setFormFeedback(feedback, 'Supabase nao configurado no front-end.', 'error');
      injectSupabaseQuickConfig(form, feedback);
      return;
    }

    const { url, anonKey } = getCloudPublicConfig();
    try {
      const blocked = await tooManyLoginAttempts(email);
      if (blocked) {
        setFormFeedback(feedback, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.', 'error');
        return;
      }

      setFormFeedback(feedback, 'Validando login na nuvem...', 'success');
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password: senha
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.access_token) {
        await registerLoginAttempt(email, false);
        const rawMsg = parseSupabaseError(payload, 'Email ou senha invalidos.');
        const msg = /confirm|confirmed|not confirmed/i.test(rawMsg)
          ? 'Seu email ainda nao foi confirmado. Verifique sua caixa de entrada e spam.'
          : rawMsg;
        setFormFeedback(feedback, msg, 'error');
        return;
      }

      await registerLoginAttempt(email, true);
      const fallbackName = getCustomerDisplayName(email);
      saveCustomerSession(buildCloudSessionFromAuthPayload(payload, email, fallbackName));
      setFormFeedback(feedback, 'Login realizado com sucesso. Redirecionando...', 'success');
      const nextParam = new URLSearchParams(window.location.search).get('next');
      setTimeout(() => {
        window.location.href = nextParam ? String(nextParam) : 'index.html';
      }, 600);
    } catch (error) {
      setFormFeedback(feedback, 'Falha de conexao com o Supabase.', 'error');
    }
  });
}

function setupCustomerAuthPages() {
  setupRegisterPage();
  setupLoginPage();
}

// ====================================================================
// ==================== 4. HISTORICO DE BUSCA ========================
// ====================================================================

function loadSearchHistory() {
  const history = localStorage.getItem(SEARCH_HISTORY_KEY);
  return history ? JSON.parse(history) : [];
}

function saveSearchHistory(history) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function addSearchTermToHistory(term) {
  if (!term || term.trim() === '') return;

  const normalized = term.trim();
  let history = loadSearchHistory();

  history = history.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
  history.unshift(normalized);
  history = history.slice(0, HISTORY_MAX_ITEMS);

  saveSearchHistory(history);
}

function renderSearchHistory(term = '') {
  if (!searchHistoryDropdown) return;

  let history = loadSearchHistory();

  if (term.trim() !== '') {
    history = history.filter((item) => item.toLowerCase().includes(term.toLowerCase()));
  }

  if (history.length === 0) {
    searchHistoryDropdown.classList.remove('active');
    return;
  }

  const html = history
    .map(
      (item) => `
        <div class="history-item" data-term="${escapeHtml(item)}">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span>${escapeHtml(item)}</span>
        </div>
    `
    )
    .join('');

  searchHistoryDropdown.innerHTML = html;
  searchHistoryDropdown.classList.add('active');

  searchHistoryDropdown.querySelectorAll('.history-item').forEach((itemEl) => {
    itemEl.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const clickedTerm = itemEl.getAttribute('data-term') || '';
      if (input) {
        input.value = clickedTerm;
      }
      textoPesquisar = clickedTerm;
      executeSearch();
    });
  });
}

// ====================================================================
// ======================= 5. CARRINHO ================================
// ====================================================================

function saveCart() {
  localStorage.setItem('7store_cart', JSON.stringify(cartItems));
}

function loadCart() {
  const savedCart = localStorage.getItem('7store_cart');
  return savedCart ? JSON.parse(savedCart) : [];
}

function syncCartWithCatalog() {
  refreshProducts();
  if (produtos.length === 0) {
    return;
  }

  const catalogMap = new Map(produtos.map((product) => [product.id, product]));

  cartItems = cartItems
    .map((item) => {
      const product = catalogMap.get(item.id);
      if (!product || product.isActive === false) {
        return null;
      }

      return {
        ...item,
        nome: product.nome,
        preco: toNumber(product.preco, 0),
        imagem: product.imagem
      };
    })
    .filter(Boolean);
}

function openCart() {
  if (sideCart) sideCart.classList.add('open');
  if (overlay) overlay.classList.add('active');
}

function closeCart() {
  if (sideCart) sideCart.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function increaseQuantity(productId) {
  const item = cartItems.find((cartItem) => cartItem.id === productId);
  if (!item) return;

  item.quantity += 1;
  saveCart();
  updateCartDisplay();
}

function decreaseQuantity(productId) {
  const itemIndex = cartItems.findIndex((cartItem) => cartItem.id === productId);
  if (itemIndex < 0) return;

  if (cartItems[itemIndex].quantity > 1) {
    cartItems[itemIndex].quantity -= 1;
  } else {
    cartItems.splice(itemIndex, 1);
  }

  saveCart();
  updateCartDisplay();
}

function addToCart(productId, quantity = 1) {
  const normalizedQuantity = Math.max(1, parseInt(quantity, 10) || 1);
  const productToAdd = findProductById(productId, false);

  if (!productToAdd) {
    return;
  }

  const existingItem = cartItems.find((item) => item.id === productToAdd.id);

  if (existingItem) {
    existingItem.quantity += normalizedQuantity;
  } else {
    cartItems.push({
      id: productToAdd.id,
      nome: productToAdd.nome,
      preco: toNumber(productToAdd.preco, 0),
      imagem: productToAdd.imagem,
      quantity: normalizedQuantity
    });
  }

  saveCart();
  updateCartDisplay();
  openCart();
}

function updateCartDisplay() {
  if (!cartItemsContainer) return;

  syncCartWithCatalog();

  let itemCount = 0;
  let subtotal = 0;
  let htmlItems = '';

  cartItems.forEach((item) => {
    const itemTotal = item.preco * item.quantity;
    subtotal += itemTotal;
    itemCount += item.quantity;

    htmlItems += `
      <div class="cart-item">
        <img src="${item.imagem}" alt="${escapeHtml(item.nome)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 0.5rem;">
        <div class="cart-item-details">
          <h4>${escapeHtml(item.nome)}</h4>
          <p class="cart-item-price">R$ ${item.preco.toFixed(2)}</p>
          <div class="quantity-wrapper">
            <button class="quantity-btn decrease" data-action="decrease" data-id="${item.id}" aria-label="Diminuir quantidade">
              <i class="fa-solid fa-minus"></i>
            </button>
            <span class="quantity-value">${item.quantity}</span>
            <button class="quantity-btn increase" data-action="increase" data-id="${item.id}" aria-label="Aumentar quantidade">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
        <div class="item-subtotal">R$ ${itemTotal.toFixed(2)}</div>
      </div>
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.5rem 0;">
    `;
  });

  const total = subtotal + FRETE_FIXO;

  cartItemsContainer.innerHTML =
    htmlItems || '<p style="text-align: center; color: var(--text-secondary-color); padding: 2rem;">Seu carrinho esta vazio.</p>';

  if (cartSubtotalSpan) cartSubtotalSpan.textContent = `R$ ${subtotal.toFixed(2)}`;
  if (cartTotalSpan) cartTotalSpan.textContent = `R$ ${total.toFixed(2)}`;
  if (cartItemCountSpan) cartItemCountSpan.textContent = itemCount;

  saveCart();
}

// ====================================================================
// =================== 6. FILTROS E ORDENACAO ========================
// ====================================================================

function sortProducts(products, type) {
  const copy = [...products];

  switch (type) {
    case 'price_asc':
      return copy.sort((a, b) => a.preco - b.preco);
    case 'price_desc':
      return copy.sort((a, b) => b.preco - a.preco);
    case 'popularity':
      return copy.sort((a, b) => toNumber(b.popularityScore, 0) - toNumber(a.popularityScore, 0));
    case 'relevance':
    default:
      return copy;
  }
}

function getFilteredPublicProducts() {
  const publicProducts = getStorePublicProducts();

  return publicProducts.filter((product) => {
    const passouCategoria = categoriaAtual === 'all' || product.categoria === categoriaAtual;
    const passouPesquisa = product.nome.toLowerCase().includes(textoPesquisar.toLowerCase());

    const min = filterState.minPrice == null ? null : toNumber(filterState.minPrice, null);
    const max = filterState.maxPrice == null ? null : toNumber(filterState.maxPrice, null);
    const selectedBrand = String(filterState.brand || 'all');
    const inStockOnly = filterState.inStockOnly === true;

    const price = toNumber(product.preco, 0);
    const productBrand = String(product.brand || '').trim() || 'Sem marca';

    const passouPrecoMin = min == null ? true : price >= min;
    const passouPrecoMax = max == null ? true : price <= max;
    const passouMarca = selectedBrand === 'all' ? true : productBrand === selectedBrand;
    const passouEstoque = inStockOnly ? toNumber(product.stock, 0) > 0 : true;

    return passouCategoria && passouPesquisa && passouPrecoMin && passouPrecoMax && passouMarca && passouEstoque;
  });
}

function mostrarProdutos() {
  if (!containerProdutos) return;

  const allPublicProducts = getStorePublicProducts();
  if (allPublicProducts.length === 0) {
    let message = 'Nenhum produto publicado na nuvem.';

    if (catalogLoadStatus === 'missing_config') {
      message = 'Supabase nao configurado. Configure na Vercel (env vars) ou no admin.';
    } else if (catalogLoadStatus === 'error') {
      message = `Erro ao carregar da nuvem: ${escapeHtml(catalogLoadMessage || 'falha desconhecida')}`;
    } else if (catalogLoadStatus === 'empty') {
      message = 'Catalogo cloud vazio. Publique produtos pelo painel admin.';
    }

    containerProdutos.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary-color);">${message}</p>`;
    if (catalogLoadStatus === 'missing_config') {
      injectSupabaseQuickConfigPanel(containerProdutos);
    }
    return;
  }

  const filtered = getFilteredPublicProducts();
  const ordered = sortProducts(filtered, sortType);

  if (ordered.length === 0) {
    containerProdutos.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary-color);">Nenhum produto encontrado.</p>';
    return;
  }

  const html = ordered
    .map(
      (product) => `
      <a href="detalhe-produto.html?id=${product.id}" class="product-card">
        <img class="product-img" src="${product.imagem}" alt="${escapeHtml(product.nome)}">
        <div class="product-info">
          <h3 class="product-name">${escapeHtml(product.nome)}</h3>
          <p class="product-description">${escapeHtml(product.descricao)}</p>
          <p class="product-price">R$ ${toNumber(product.preco, 0).toFixed(2)}</p>
          <button type="button" class="product-button add-to-cart-btn" data-id="${product.id}">
            Adicionar ao Carrinho
          </button>
        </div>
      </a>
    `
    )
    .join('');

  containerProdutos.innerHTML = html;

  containerProdutos.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const id = toNumber(btn.getAttribute('data-id'), null);
      if (id != null) {
        addToCart(id, 1);
      }
    });
  });
}

function pesquisar() {
  if (!input) return;

  textoPesquisar = input.value;
  renderSearchHistory(textoPesquisar);
}

function executeSearch() {
  if (!input) return;

  textoPesquisar = input.value;

  if (textoPesquisar.trim() !== '') {
    addSearchTermToHistory(textoPesquisar);
  }

  sortType = 'relevance';
  if (sortSelect) sortSelect.value = 'relevance';

  if (containerProdutos) {
    mostrarProdutos();
  } else if (textoPesquisar.trim() !== '') {
    window.location.href = `index.html?q=${encodeURIComponent(textoPesquisar.trim())}`;
    return;
  }

  if (searchHistoryDropdown) searchHistoryDropdown.classList.remove('active');
}

function trocarCategoria(categoria) {
  categoriaAtual = categoria;

  if (input) input.value = '';
  textoPesquisar = '';

  sortType = 'relevance';
  if (sortSelect) sortSelect.value = 'relevance';

  document.querySelectorAll('.category-btn').forEach((botao) => {
    botao.classList.remove('active');
    if (botao.getAttribute('data-category') === categoria) {
      botao.classList.add('active');
    }
  });

  mostrarProdutos();
}

function handleSortChange() {
  if (!sortSelect) return;
  sortType = sortSelect.value;
  mostrarProdutos();
}

function getAvailableBrands() {
  const products = getStorePublicProducts();
  const brands = new Set();
  products.forEach((p) => {
    const b = String(p.brand || '').trim() || 'Sem marca';
    brands.add(b);
  });
  return Array.from(brands).sort((a, b) => a.localeCompare(b));
}

function refreshBrandFilterOptions() {
  if (!filterBrandSelect) return;
  const current = String(filterState.brand || 'all');
  const brands = getAvailableBrands();
  const options = ['all', ...brands];

  filterBrandSelect.innerHTML = options
    .map((b) => {
      const label = b === 'all' ? 'Todas' : b;
      return `<option value="${escapeHtml(b)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  filterBrandSelect.value = options.includes(current) ? current : 'all';
}

function applyFiltersFromUI() {
  if (filterMinPriceInput) {
    const v = String(filterMinPriceInput.value || '').trim();
    filterState.minPrice = v === '' ? null : toNumber(v, null);
  }

  if (filterMaxPriceInput) {
    const v = String(filterMaxPriceInput.value || '').trim();
    filterState.maxPrice = v === '' ? null : toNumber(v, null);
  }

  if (filterBrandSelect) {
    filterState.brand = String(filterBrandSelect.value || 'all');
  }

  if (filterInStockInput) {
    filterState.inStockOnly = filterInStockInput.checked === true;
  }

  mostrarProdutos();
}

function resetFiltersUI() {
  filterState.minPrice = null;
  filterState.maxPrice = null;
  filterState.brand = 'all';
  filterState.inStockOnly = false;

  if (filterMinPriceInput) filterMinPriceInput.value = '';
  if (filterMaxPriceInput) filterMaxPriceInput.value = '';
  if (filterBrandSelect) filterBrandSelect.value = 'all';
  if (filterInStockInput) filterInStockInput.checked = false;

  mostrarProdutos();
}

function setupFiltersSidebar() {
  if (!filterMinPriceInput && !filterMaxPriceInput && !filterBrandSelect && !filterInStockInput) {
    return;
  }

  refreshBrandFilterOptions();

  const onChange = debounce(() => applyFiltersFromUI(), 120);
  if (filterMinPriceInput) filterMinPriceInput.addEventListener('input', onChange);
  if (filterMaxPriceInput) filterMaxPriceInput.addEventListener('input', onChange);
  if (filterBrandSelect) filterBrandSelect.addEventListener('change', onChange);
  if (filterInStockInput) filterInStockInput.addEventListener('change', onChange);
  if (filterResetBtn) filterResetBtn.addEventListener('click', resetFiltersUI);
}

async function setupPublicMarketingContent() {
  try {
    const categoriesBar = document.querySelector('.categories-bar');
    if (categoriesBar && window.cloudSync && typeof window.cloudSync.pullCategoriesPublic === 'function') {
      const categories = await window.cloudSync.pullCategoriesPublic();
      if (Array.isArray(categories) && categories.length > 0) {
        const categoryButtons = categories
          .filter((c) => c && c.slug && c.is_active !== false)
          .map((c) => {
            const icon = String(c.icon || '').trim();
            const iconHtml = icon ? `<i class="${escapeHtml(icon)}"></i>` : '<i class="fa-solid fa-tag"></i>';
            return `
              <button class="category-btn" data-category="${escapeHtml(c.slug)}">
                ${iconHtml}
                ${escapeHtml(c.name || c.slug)}
              </button>
            `;
          })
          .join('');

        categoriesBar.innerHTML = `
          <button class="category-btn active" data-category="all">
            <i class="fa-solid fa-border-all"></i>
            Todos
          </button>
          ${categoryButtons}
        `;
      }
    }

    const hero = document.querySelector('.hero-section');
    if (hero && window.cloudSync && typeof window.cloudSync.pullBannersPublic === 'function') {
      const banners = await window.cloudSync.pullBannersPublic();
      const banner = Array.isArray(banners)
        ? banners.find((b) => b && b.is_active !== false && String(b.position || '') === 'home_hero')
        : null;

      if (banner) {
        const titleEl = hero.querySelector('h2');
        const subtitleEl = hero.querySelector('.hero-p') || hero.querySelector('p');
        if (titleEl) titleEl.textContent = String(banner.title || '').trim() || titleEl.textContent;
        if (subtitleEl) subtitleEl.textContent = String(banner.subtitle || '').trim() || subtitleEl.textContent;

        const img = String(banner.image_url || '').trim();
        if (img) {
          hero.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25)), url('${img}')`;
          hero.style.backgroundSize = 'cover';
          hero.style.backgroundPosition = 'center';
        }
      }
    }
  } catch (error) {
    // marketing is best-effort
  }
}

// ====================================================================
// =================== 7. DETALHE DO PRODUTO ==========================
// ====================================================================

function setMetaTag(selector, attr, value) {
  if (!value) return;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    if (selector.startsWith('meta[')) {
      // best-effort: selector should match either name= or property= in caller
    }
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function upsertMetaByName(name, content) {
  if (!content) return;
  const escaped = window.CSS && typeof window.CSS.escape === 'function' ? window.CSS.escape(name) : name;
  let el = document.querySelector(`meta[name="${escaped}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property, content) {
  if (!content) return;
  const escaped = window.CSS && typeof window.CSS.escape === 'function' ? window.CSS.escape(property) : property;
  let el = document.querySelector(`meta[property="${escaped}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLinkRel(rel, href) {
  if (!href) return;
  const escaped = window.CSS && typeof window.CSS.escape === 'function' ? window.CSS.escape(rel) : rel;
  let el = document.querySelector(`link[rel="${escaped}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function updatePageSeoBasics() {
  try {
    const url = window.location.href;
    upsertMetaByProperty('og:url', url);
    upsertLinkRel('canonical', url);
  } catch (error) {
    // best-effort
  }
}

function updateProductSeo(product) {
  try {
    const name = String(product.nome || 'Produto');
    const desc = String(product.descricao || '').slice(0, 160);
    const price = toNumber(product.preco, 0);
    const url = /^https?:\/\//i.test(window.location.origin)
      ? `${window.location.origin}/detalhe-produto.html?id=${encodeURIComponent(product.id)}`
      : `detalhe-produto.html?id=${encodeURIComponent(product.id)}`;

    document.title = `${name} | 7STORE`;
    upsertMetaByName('description', desc || `Compre ${name} na 7STORE.`);

    upsertMetaByProperty('og:title', `${name} | 7STORE`);
    upsertMetaByProperty('og:description', desc || `Confira ${name} na 7STORE.`);
    upsertMetaByProperty('og:type', 'product');
    upsertMetaByProperty('og:url', url);
    if (product.imagem) {
      upsertMetaByProperty('og:image', String(product.imagem));
    }

    upsertMetaByName('twitter:card', 'summary_large_image');
    upsertLinkRel('canonical', url);

    let jsonLdEl = document.getElementById('product-jsonld');
    if (!jsonLdEl) {
      jsonLdEl = document.createElement('script');
      jsonLdEl.type = 'application/ld+json';
      jsonLdEl.id = 'product-jsonld';
      document.head.appendChild(jsonLdEl);
    }

    const availability = toNumber(product.stock, 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description: desc || undefined,
      image: product.imagem ? [String(product.imagem)] : undefined,
      sku: product.sku ? String(product.sku) : undefined,
      brand: product.brand ? { '@type': 'Brand', name: String(product.brand) } : undefined,
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'BRL',
        price: String(price.toFixed(2)),
        availability
      }
    };

    jsonLdEl.textContent = JSON.stringify(jsonLd);
  } catch (error) {
    // SEO best-effort
  }
}

function carregarDetalhesProduto() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = parseInt(urlParams.get('id'), 10);
  const detailContainer = document.getElementById('product-detail-container');

  if (!detailContainer) return;

  if (!productId) {
    detailContainer.innerHTML = '<p style="color: red; font-weight: bold;">Erro: ID do produto nao encontrado na URL.</p>';
    return;
  }

  const produto = findProductById(productId, false);

  if (!produto) {
    detailContainer.innerHTML = '<p style="color: red; font-weight: bold;">Produto nao encontrado no catalogo.</p>';
    return;
  }

  updateProductSeo(produto);

  const semEstoque = toNumber(produto.stock, 0) <= 0;

  detailContainer.innerHTML = `
    <div class="detail-image-area">
      <img src="${produto.imagem}" alt="${escapeHtml(produto.nome)}" class="detail-image">
    </div>
    <div class="detail-info-area">
      <div>
        <h1 class="detail-name">${escapeHtml(produto.nome)}</h1>
        <p class="product-description">${escapeHtml(produto.descricao)}</p>
        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border-color);">

        <p class="detail-description-full">
          Produto disponivel para compra imediata. Consulte condicoes especiais para pagamento e entrega.
        </p>

        <p class="product-price" style="font-size: 2.5rem; margin-bottom: 1.5rem;">R$ ${toNumber(produto.preco, 0).toFixed(2)}</p>

        <div class="quantity-controls">
          <label for="detail-quantity">Quantidade</label>
          <input id="detail-quantity" class="quantity-input" type="number" min="1" max="99" value="1">
        </div>

        <button type="button" id="detail-add-to-cart" class="detail-add-to-cart-btn" ${semEstoque ? 'disabled' : ''}>
          ${semEstoque ? 'Sem Estoque' : 'Adicionar ao Carrinho'}
        </button>
      </div>
    </div>
  `;

  const addBtn = document.getElementById('detail-add-to-cart');
  const qtyInput = document.getElementById('detail-quantity');

  if (addBtn && qtyInput && !semEstoque) {
    addBtn.addEventListener('click', () => {
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      addToCart(produto.id, qty);
    });
  }
}

// ====================================================================
// ================= 8. INIT E EVENT HANDLERS =========================
// ====================================================================

function setupThemeToggle() {
  const btn = document.getElementById('toggleTheme');
  const icon = btn ? btn.querySelector('i') : null;

  const loadTheme = () => {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
      if (icon) icon.className = 'fa-solid fa-sun';
    } else {
      if (icon) icon.className = 'fa-solid fa-moon';
    }
  };

  const toggleTheme = () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  };

  loadTheme();

  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }
}

function setupCommonHandlers() {
  const cartIcon = document.querySelector('.cart-icon');
  const closeCartBtn = document.querySelector('.close-cart-btn');
  const overlayElement = document.querySelector('.overlay');
  const checkoutButtons = document.querySelectorAll('.checkout-btn');

  if (cartIcon) cartIcon.addEventListener('click', openCart);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  if (overlayElement) overlayElement.addEventListener('click', closeCart);

  if (cartItemsContainer) {
    cartItemsContainer.addEventListener('click', (event) => {
      const btn = event.target.closest('button.quantity-btn[data-action][data-id]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = toNumber(btn.getAttribute('data-id'), null);
      if (id == null) return;

      if (action === 'decrease') {
        decreaseQuantity(id);
      } else if (action === 'increase') {
        increaseQuantity(id);
      }
    });
  }

  checkoutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!cartItems || cartItems.length === 0) {
        openCart();
        return;
      }

      const session = getCustomerSession();
      if (!isCustomerCloudSession(session)) {
        window.location.href = buildLoginUrl(CHECKOUT_URL);
        return;
      }

      window.location.href = CHECKOUT_URL;
    });
  });

  updateCartDisplay();
  setupThemeToggle();
  updatePageSeoBasics();
}

async function initializeIndexPage() {
  const queryParams = new URLSearchParams(window.location.search);
  const query = queryParams.get('q');

  if (query && input) {
    textoPesquisar = query;
    input.value = query;
  }

  mostrarProdutos();
  setupFiltersSidebar();
  await setupPublicMarketingContent();

  if (input) {
    input.addEventListener('input', pesquisar);
    input.addEventListener('focus', () => renderSearchHistory(input.value));
    input.addEventListener(
      'blur',
      debounce(() => {
        if (searchHistoryDropdown) searchHistoryDropdown.classList.remove('active');
      }, 150)
    );

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        executeSearch();
        event.preventDefault();
      }
    });
  }

  if (searchIcon) searchIcon.addEventListener('click', executeSearch);
  if (sortSelect) sortSelect.addEventListener('change', handleSortChange);

  const categoriesBar = document.querySelector('.categories-bar');
  if (categoriesBar) {
    categoriesBar.addEventListener('click', (event) => {
      const button = event.target.closest('button.category-btn[data-category]');
      if (!button) return;
      const categoria = button.getAttribute('data-category');
      trocarCategoria(categoria);
    });
  }

  const stickyWrapper = document.querySelector('.sticky-section-wrapper');
  let lastScrollY = window.scrollY;

  if (stickyWrapper) {
    const handleScrollDebounced = debounce(() => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > 90) {
        stickyWrapper.classList.add('scrolled');
      } else {
        stickyWrapper.classList.remove('scrolled');
      }

      if (currentScrollY > lastScrollY) {
        stickyWrapper.classList.add('hidden');
      } else {
        stickyWrapper.classList.remove('hidden');
      }

      lastScrollY = currentScrollY;
    }, 10);

    window.addEventListener('scroll', handleScrollDebounced);
  }
}

function setupDataChangeListener() {
  window.addEventListener('products:changed', () => {
    refreshProducts();

    if (document.querySelector('.products-container')) {
      mostrarProdutos();
    }

    if (document.querySelector('.product-detail-main')) {
      carregarDetalhesProduto();
    }

    updateCartDisplay();
  });
}

// ====================================================================
// =================== 9. CHECKOUT / CONTA ============================
// ====================================================================

function getCartForRpc() {
  return (cartItems || [])
    .map((item) => ({
      product_id: toNumber(item.id, null),
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1)
    }))
    .filter((i) => i.product_id != null);
}

async function getCustomerAuthContext() {
  let session = getCustomerSession();
  if (isCustomerCloudSession(session)) {
    session = await refreshCustomerCloudSessionIfNeeded(session);
  }

  if (!isCustomerCloudSession(session)) {
    throw new Error('Login obrigatorio.');
  }

  const { url, anonKey } = getCloudPublicConfig();
  if (!/^https:\/\//i.test(url) || !anonKey) {
    throw new Error('Supabase nao configurado.');
  }

  return { url, anonKey, accessToken: session.access_token, session };
}

async function fetchCustomerAddresses() {
  const { url, anonKey, accessToken } = await getCustomerAuthContext();

  const response = await fetch(
    `${url}/rest/v1/customer_addresses?select=*&order=is_default.desc&order=created_at.desc`,
    {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    }
  );

  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(parseSupabaseError(payload, 'Falha ao carregar enderecos.'));
  }

  return Array.isArray(payload) ? payload : [];
}

async function createCustomerAddress(address) {
  const { url, anonKey, accessToken } = await getCustomerAuthContext();

  const response = await fetch(`${url}/rest/v1/customer_addresses`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(address)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseSupabaseError(payload, 'Falha ao salvar endereco.'));
  }

  return Array.isArray(payload) ? payload[0] : payload;
}

function renderAddressList(container, addresses, selectedId) {
  if (!container) return;

  if (!addresses || addresses.length === 0) {
    container.innerHTML = '<p class="admin-muted">Nenhum endereco cadastrado.</p>';
    return;
  }

  const html = addresses
    .map((a) => {
      const id = String(a.id || '');
      const checked = selectedId ? id === selectedId : a.is_default === true;
      const line = [
        `${escapeHtml(a.street || '')}`,
        a.number ? escapeHtml(a.number) : '',
        a.district ? escapeHtml(a.district) : '',
        `${escapeHtml(a.city || '')}/${escapeHtml(a.state || '')}`
      ]
        .filter(Boolean)
        .join(', ');

      return `
        <label class="checkout-address-card">
          <input type="radio" name="selected-address" value="${escapeHtml(id)}" ${checked ? 'checked' : ''}>
          <div>
            <strong>${escapeHtml(a.receiver_name || 'Endereco')}</strong>
            <div class="admin-muted">${line}</div>
          </div>
        </label>
      `;
    })
    .join('');

  container.innerHTML = html;
}

async function fetchOrdersForAccount() {
  const { url, anonKey, accessToken } = await getCustomerAuthContext();

  const response = await fetch(
    `${url}/rest/v1/orders?select=*,order_items(*)&order=created_at.desc&limit=30`,
    {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    }
  );

  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(parseSupabaseError(payload, 'Falha ao carregar pedidos.'));
  }

  return Array.isArray(payload) ? payload : [];
}

function renderOrders(container, orders) {
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = '<p class="admin-muted">Nenhum pedido encontrado.</p>';
    return;
  }

  const html = orders
    .map((o) => {
      const created = o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '';
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      const itemsHtml = items
        .map((it) => `<li>${escapeHtml(it.product_name)} x${it.quantity} (${formatBRL(it.line_total)})</li>`)
        .join('');

      const canCancel = o.status === 'pending' && o.payment_status === 'pending';

      return `
        <article class="account-order-card" data-order-id="${escapeHtml(o.id)}">
          <div class="account-order-top">
            <div>
              <strong>Pedido</strong>
              <div class="admin-muted">${escapeHtml(String(o.id).slice(0, 8))}... | ${escapeHtml(created)}</div>
            </div>
            <div class="account-order-status">
              <span>${escapeHtml(o.status || '')}</span>
              <span>${escapeHtml(o.payment_status || '')}</span>
            </div>
          </div>
          <ul class="account-order-items">${itemsHtml}</ul>
          <div class="account-order-bottom">
            <strong>Total: ${formatBRL(o.total)}</strong>
            ${canCancel ? '<button class="admin-btn admin-btn-warn account-cancel-order" type="button">Cancelar</button>' : ''}
          </div>
        </article>
      `;
    })
    .join('');

  container.innerHTML = html;
  container.querySelectorAll('.account-cancel-order').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('[data-order-id]');
      const orderId = card ? card.getAttribute('data-order-id') : '';
      if (!orderId) return;
      if (!window.confirm('Cancelar este pedido?')) return;

      try {
        btn.disabled = true;
        await rpcCall('cancel_order', { order_id: orderId }, true);
        window.location.reload();
      } catch (error) {
        btn.disabled = false;
        window.alert(error.message || 'Falha ao cancelar.');
      }
    });
  });
}

async function setupCheckoutPage() {
  const root = document.querySelector('.checkout-main');
  if (!root) return;

  const session = getCustomerSession();
  if (!isCustomerCloudSession(session)) {
    window.location.href = buildLoginUrl(window.location.href);
    return;
  }

  const userBox = document.getElementById('checkoutUser');
  if (userBox) {
    userBox.textContent = session.email || '';
  }

  const cartBox = document.getElementById('checkoutCartItems');
  const addressList = document.getElementById('checkoutAddressList');
  const addressForm = document.getElementById('checkoutAddressForm');
  const addrFeedback = document.getElementById('checkoutAddressFeedback');

  const couponInput = document.getElementById('checkoutCoupon');
  const couponBtn = document.getElementById('checkoutApplyCoupon');
  const couponFeedback = document.getElementById('checkoutCouponFeedback');

  const sumSubtotal = document.getElementById('sumSubtotal');
  const sumShipping = document.getElementById('sumShipping');
  const sumDiscount = document.getElementById('sumDiscount');
  const sumTotal = document.getElementById('sumTotal');

  const placeOrderBtn = document.getElementById('checkoutPlaceOrder');
  const orderFeedback = document.getElementById('checkoutOrderFeedback');

  const pixBox = document.getElementById('pixPaymentBox');
  const pixQrImg = document.getElementById('pixQrImg');
  const pixCode = document.getElementById('pixCode');
  const pixCopyBtn = document.getElementById('pixCopyBtn');
  const pixFeedback = document.getElementById('pixFeedback');

  const cartForRpc = getCartForRpc();
  if (!cartForRpc.length) {
    if (cartBox) cartBox.innerHTML = '<p class="admin-muted">Seu carrinho esta vazio.</p>';
    if (placeOrderBtn) placeOrderBtn.disabled = true;
    return;
  }

  if (cartBox) {
    cartBox.innerHTML = cartItems
      .map((it) => {
        const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
        const line = toNumber(it.preco, 0) * qty;
        return `
          <div class="checkout-item-row">
            <div class="checkout-item-left">
              <img src="${escapeHtml(it.imagem || '')}" alt="${escapeHtml(it.nome || '')}">
              <div>
                <strong>${escapeHtml(it.nome || '')}</strong>
                <div class="admin-muted">${qty} x ${formatBRL(it.preco)}</div>
              </div>
            </div>
            <strong>${formatBRL(line)}</strong>
          </div>
        `;
      })
      .join('');
  }

  let appliedCoupon = '';
  let quote = null;

  async function refreshQuote() {
    setFormFeedback(couponFeedback, '', '');
    try {
      quote = await rpcCall('quote_cart', { items: cartForRpc, coupon_code: appliedCoupon || null }, true);

      if (sumSubtotal) sumSubtotal.textContent = formatBRL(quote.subtotal);
      if (sumShipping) sumShipping.textContent = formatBRL(quote.shipping);
      if (sumDiscount) sumDiscount.textContent = formatBRL(quote.discount);
      if (sumTotal) sumTotal.textContent = formatBRL(quote.total);
    } catch (error) {
      quote = null;
      if (sumSubtotal) sumSubtotal.textContent = formatBRL(0);
      if (sumDiscount) sumDiscount.textContent = formatBRL(0);
      if (sumTotal) sumTotal.textContent = formatBRL(0);
      setFormFeedback(couponFeedback, error.message || 'Falha ao calcular carrinho.', 'error');
    }
  }

  async function refreshAddresses() {
    try {
      const addresses = await fetchCustomerAddresses();
      renderAddressList(addressList, addresses, null);
    } catch (error) {
      if (addressList) {
        addressList.innerHTML = `<p class="admin-feedback is-error">${escapeHtml(error.message || 'Falha ao carregar enderecos.')}</p>`;
      }
    }
  }

  await refreshAddresses();
  await refreshQuote();

  if (couponBtn) {
    couponBtn.addEventListener('click', async () => {
      const code = String((couponInput && couponInput.value) || '').trim();
      appliedCoupon = code;
      setFormFeedback(couponFeedback, 'Aplicando...', 'success');
      await refreshQuote();
      if (appliedCoupon && quote) {
        setFormFeedback(couponFeedback, 'Cupom aplicado.', 'success');
      } else {
        setFormFeedback(couponFeedback, '', '');
      }
    });
  }

  if (addressForm) {
    addressForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        const receiver = String(document.getElementById('addr-receiver').value || '').trim();
        const phone = String(document.getElementById('addr-phone').value || '').trim();
        const zip = String(document.getElementById('addr-zip').value || '').trim();
        const street = String(document.getElementById('addr-street').value || '').trim();
        const number = String(document.getElementById('addr-number').value || '').trim();
        const complement = String(document.getElementById('addr-complement').value || '').trim();
        const district = String(document.getElementById('addr-district').value || '').trim();
        const city = String(document.getElementById('addr-city').value || '').trim();
        const state = String(document.getElementById('addr-state').value || '').trim();
        const isDefault = document.getElementById('addr-default').checked === true;

        if (!receiver || !street || !city || !state) {
          setFormFeedback(addrFeedback, 'Preencha os campos obrigatorios.', 'error');
          return;
        }

        setFormFeedback(addrFeedback, 'Salvando...', 'success');
        await createCustomerAddress({
          receiver_name: receiver,
          phone: phone || null,
          zip_code: zip || null,
          street,
          number: number || null,
          complement: complement || null,
          district: district || null,
          city,
          state,
          country: 'BR',
          is_default: isDefault
        });

        addressForm.reset();
        setFormFeedback(addrFeedback, 'Endereco salvo.', 'success');
        await refreshAddresses();
      } catch (error) {
        setFormFeedback(addrFeedback, error.message || 'Falha ao salvar.', 'error');
      }
    });
  }

  function getSelectedAddressId() {
    const checked = document.querySelector('input[name="selected-address"]:checked');
    return checked ? checked.value : null;
  }

  function getSelectedPaymentMethod() {
    const checked = document.querySelector('input[name="payment-method"]:checked');
    return checked ? checked.value : 'pix';
  }

  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async () => {
      try {
        placeOrderBtn.disabled = true;
        setFormFeedback(orderFeedback, 'Criando pedido...', 'success');

        const addressId = getSelectedAddressId();
        if (!addressId) {
          placeOrderBtn.disabled = false;
          setFormFeedback(orderFeedback, 'Selecione um endereco.', 'error');
          return;
        }

        const method = getSelectedPaymentMethod();
        const result = await rpcCall(
          'create_order_from_cart',
          {
            items: cartForRpc,
            address_id: addressId,
            coupon_code: appliedCoupon || null,
            payment_method: method
          },
          true
        );

        cartItems = [];
        saveCart();
        updateCartDisplay();

        const orderId = result && result.order_id ? String(result.order_id) : '';
        setFormFeedback(orderFeedback, 'Pedido criado. Preparando pagamento...', 'success');

        if (method === 'pix' && pixBox) {
          try {
            const sessionNow = getCustomerSession();
            const { url, anonKey } = getCloudPublicConfig();
            const res = await fetch(`${url}/functions/v1/create-payment`, {
              method: 'POST',
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${sessionNow.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ order_id: orderId })
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(parseSupabaseError(payload, 'Falha ao criar pagamento Pix.'));
            }

            const code = String(payload.qr_code || '').trim();
            const b64 = String(payload.qr_code_base64 || '').trim();

            pixBox.hidden = false;
            if (pixCode) pixCode.value = code || '';
            if (pixQrImg) {
              if (b64) {
                pixQrImg.src = `data:image/png;base64,${b64}`;
                pixQrImg.hidden = false;
              } else {
                pixQrImg.hidden = true;
              }
            }

            if (pixCopyBtn) {
              pixCopyBtn.onclick = async () => {
                try {
                  if (!code) return;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(code);
                  } else if (pixCode) {
                    pixCode.focus();
                    pixCode.select();
                    document.execCommand('copy');
                  }
                  setFormFeedback(pixFeedback, 'Codigo copiado.', 'success');
                } catch (error) {
                  setFormFeedback(pixFeedback, 'Nao foi possivel copiar.', 'error');
                }
              };
            }

            setFormFeedback(orderFeedback, 'Pedido criado. Pague via Pix abaixo.', 'success');
            return;
          } catch (error) {
            setFormFeedback(orderFeedback, (error && error.message) || 'Pagamento Pix indisponivel.', 'error');
          }
        }

        setFormFeedback(orderFeedback, 'Pedido criado. Pagamento pendente.', 'success');
        setTimeout(() => {
          window.location.href = `${ACCOUNT_URL}?order=${encodeURIComponent(orderId)}`;
        }, 800);
      } catch (error) {
        placeOrderBtn.disabled = false;
        setFormFeedback(orderFeedback, error.message || 'Falha ao criar pedido.', 'error');
      }
    });
  }
}

async function setupAccountPage() {
  const root = document.querySelector('.account-main');
  if (!root) return;

  const session = getCustomerSession();
  if (!isCustomerCloudSession(session)) {
    window.location.href = buildLoginUrl(window.location.href);
    return;
  }

  const subtitle = document.getElementById('accountSubtitle');
  if (subtitle) {
    subtitle.textContent = session.email || '';
  }

  const logoutBtn = document.getElementById('accountLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await customerCloudSignOut();
      window.location.href = 'index.html';
    });
  }

  const list = document.getElementById('accountAddressList');
  const form = document.getElementById('accountAddressForm');
  const feedback = document.getElementById('accountAddressFeedback');

  const ordersBox = document.getElementById('accountOrders');
  const ordersFeedback = document.getElementById('accountOrdersFeedback');

  async function refreshAddresses() {
    const addresses = await fetchCustomerAddresses();
    renderAddressList(list, addresses, null);
  }

  try {
    await refreshAddresses();
  } catch (error) {
    setFormFeedback(feedback, error.message || 'Falha ao carregar enderecos.', 'error');
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const receiver = String(document.getElementById('acc-addr-receiver').value || '').trim();
        const phone = String(document.getElementById('acc-addr-phone').value || '').trim();
        const zip = String(document.getElementById('acc-addr-zip').value || '').trim();
        const street = String(document.getElementById('acc-addr-street').value || '').trim();
        const number = String(document.getElementById('acc-addr-number').value || '').trim();
        const complement = String(document.getElementById('acc-addr-complement').value || '').trim();
        const district = String(document.getElementById('acc-addr-district').value || '').trim();
        const city = String(document.getElementById('acc-addr-city').value || '').trim();
        const state = String(document.getElementById('acc-addr-state').value || '').trim();
        const isDefault = document.getElementById('acc-addr-default').checked === true;

        if (!receiver || !street || !city || !state) {
          setFormFeedback(feedback, 'Preencha os campos obrigatorios.', 'error');
          return;
        }

        setFormFeedback(feedback, 'Salvando...', 'success');
        await createCustomerAddress({
          receiver_name: receiver,
          phone: phone || null,
          zip_code: zip || null,
          street,
          number: number || null,
          complement: complement || null,
          district: district || null,
          city,
          state,
          country: 'BR',
          is_default: isDefault
        });

        form.reset();
        setFormFeedback(feedback, 'Endereco salvo.', 'success');
        await refreshAddresses();
      } catch (error) {
        setFormFeedback(feedback, error.message || 'Falha ao salvar.', 'error');
      }
    });
  }

  try {
    const orders = await fetchOrdersForAccount();
    renderOrders(ordersBox, orders);
  } catch (error) {
    if (ordersFeedback) {
      ordersFeedback.textContent = error.message || 'Falha ao carregar pedidos.';
      ordersFeedback.classList.add('is-error');
    }
  }
}

window.addEventListener('load', async () => {
  const needsCatalog = document.querySelector('.product-detail-main') || document.querySelector('.products-container');
  if (needsCatalog) {
    await loadCatalogFromCloudIfAvailable();
  }

  refreshProducts();
  setupCommonHandlers();
  await setupCustomerHeaderUI();
  setupCustomerAuthPages();
  setupDataChangeListener();
  await setupCheckoutPage();
  await setupAccountPage();

  if (document.querySelector('.product-detail-main')) {
    carregarDetalhesProduto();
  } else if (document.querySelector('.products-container')) {
    await initializeIndexPage();
  }
});
