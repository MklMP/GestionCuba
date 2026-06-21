const MUNICIPIOS = {
  'Pinar del Río': ['Consolación del Sur','Guane','La Palma','Los Palacios','Mantua','Minas de Matahambre','Pinar del Río','San Juan y Martínez','San Luis','Sandino','Viñales'],
  'Artemisa': ['Alquízar','Artemisa','Bauta','Caimito','Guanajay','Güira de Melena','Mariel','San Antonio de los Baños','Bahía Honda','Candelaria','San Cristóbal'],
  'La Habana': ['Playa','Plaza de la Revolución','Centro Habana','La Habana Vieja','Regla','La Habana del Este','Guanabacoa','San Miguel del Padrón','Diez de Octubre','Cerro','Marianao','La Lisa','Boyeros','Arroyo Naranjo','Cotorro'],
  'Mayabeque': ['Batabanó','Bejucal','Güines','Jaruco','Madruga','Melena del Sur','Nueva Paz','Quivicán','San José de las Lajas','San Nicolás de Bari','Santa Cruz del Norte'],
  'Matanzas': ['Calimete','Cárdenas','Ciénaga de Zapata','Colón','Jagüey Grande','Jovellanos','Limonar','Los Arabos','Martí','Matanzas','Pedro Betancourt','Perico','Unión de Reyes'],
  'Cienfuegos': ['Abreus','Aguada de Pasajeros','Cienfuegos','Cruces','Cumanayagua','Lajas','Palmira','Rodas'],
  'Villa Clara': ['Caibarién','Camajuaní','Cifuentes','Corralillo','Encrucijada','Manicaragua','Placetas','Quemado de Güines','Ranchuelo','Remedios','Sagua la Grande','Santa Clara','Santo Domingo'],
  'Sancti Spíritus': ['Cabaiguán','Fomento','Jatibonico','La Sierpe','Sancti Spíritus','Taguasco','Trinidad','Yaguajay'],
  'Ciego de Ávila': ['Baraguá','Bolivia','Chambas','Ciego de Ávila','Ciro Redondo','Florencia','Majagua','Morón','Primero de Enero','Venezuela'],
  'Camagüey': ['Camagüey','Carlos Manuel de Céspedes','Esmeralda','Florida','Guáimaro','Jimaguayú','Minas','Najasa','Nuevitas','Santa Cruz del Sur','Sibanicú','Sierra de Cubitas','Vertientes'],
  'Las Tunas': ['Amancio','Colombia','Jesús Menéndez','Jobabo','Las Tunas','Majibacoa','Manatí','Puerto Padre'],
  'Holguín': ['Antilla','Báguanos','Banes','Cacocum','Calixto García','Cueto','Frank País','Gibara','Holguín','Mayarí','Moa','Rafael Freyre','Sagua de Tánamo','Urbano Noris'],
  'Granma': ['Bartolomé Masó','Bayamo','Buey Arriba','Campechuela','Cauto Cristo','Guisa','Jiguaní','Manzanillo','Media Luna','Niquero','Pilón','Río Cauto','Yara'],
  'Santiago de Cuba': ['Contramaestre','Guamá','Mella','Palma Soriano','San Luis','Santiago de Cuba','Segundo Frente','Songo-La Maya','Tercer Frente'],
  'Guantánamo': ['Baracoa','Caimanera','El Salvador','Guantánamo','Imías','Maisí','Manuel Tames','Niceto Pérez','San Antonio del Sur','Yateras'],
  'Isla de la Juventud': ['Isla de la Juventud']
};

const CUBAN_PROVINCES = Object.keys(MUNICIPIOS);
const CURRENCY_SYMBOLS = { CUP: '$', USD: '$' };
const ESTADO_LABELS = { disponible: 'Disponible', agotado: 'Agotado', proximamente: 'Por Encargo' };

const DB_NAME = 'gestionCuba'; const DB_VER = 1; const DB_STORE = 'productos';
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains(DB_STORE)) e.target.result.createObjectStore(DB_STORE, { keyPath: 'id' }); };
    r.onsuccess = (e) => res(e.target.result);
    r.onerror = (e) => rej(e.target.error);
  });
}
async function dbGuardar(productos) {
  try {
    const db = await abrirDB(); const tx = db.transaction(DB_STORE, 'readwrite'); const store = tx.objectStore(DB_STORE);
    for (const p of productos) store.put(p);
    await new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = (e) => rej(e.target.error); });
    db.close();
  } catch (_) {}
}
async function dbCargar() {
  try {
    const db = await abrirDB(); const tx = db.transaction(DB_STORE, 'readonly');
    const all = tx.objectStore(DB_STORE).getAll();
    const datos = await new Promise((res, rej) => { all.onsuccess = () => res(all.result); all.onerror = (e) => rej(e.target.error); });
    db.close();
    return datos;
  } catch (_) { return null; }
}

let productos = [];
let productosFiltrados = [];
let renderLimit = 20;
const RENDER_STEP = 20;
let carrito = [];
let adminToken = '';
let editingId = null;
let uploadedImages = [];
let currentInterval = null;
let cartVisible = false;
let pendingCartImport = [];

const el = id => document.getElementById(id);
const searchInput = el('searchInput');
const productGrid = el('productGrid');
const loadingIndicator = el('loadingIndicator');
const provinciaFilter = el('provinciaFilter');
const municipioFilter = el('municipioFilter');
const categoriaFilter = el('categoriaFilter');
const estadoFilter = el('estadoFilter');
const monedaFilter = el('monedaFilter');
const sortSelect = el('sortSelect');
const precioMin = el('precioMin');
const precioMax = el('precioMax');
const precioFilterToggle = el('precioFilterToggle');
const precioFilterRow = el('precioFilterRow');
const filterBar = el('filterBar');
const cartToggle = el('cartToggle');
const cartBadge = el('cartBadge');
const cartDrawer = el('cartDrawer');
const cartOverlay = el('cartOverlay');
const cartItems = el('cartItems');
const cartTotals = el('cartTotals');
const closeCart = el('closeCart');
const comprarBtn = el('comprarBtn');
const shareCartBtn = el('shareCartBtn');
const clearCartBtn = el('clearCartBtn');
const productModal = el('productModal');
const modalBody = el('modalBody');
const closeProductModal = el('closeProductModal');
const adminModal = el('adminModal');
const adminPassword = el('adminPassword');
const adminLoginBtn = el('adminLoginBtn');
const adminPanel = el('adminPanel');
const adminForm = el('adminForm');
const adminLogin = el('adminLogin');
const adminTitle = el('adminTitle');
const adminFormTitle = el('adminFormTitle');
const adminNombre = el('adminNombre');
const adminDesc = el('adminDesc');
const adminCodigo = el('adminCodigo');
const adminEstado = el('adminEstado');
const adminPrecio = el('adminPrecio');
const adminPrecioAnterior = el('adminPrecioAnterior');
const adminVentaCantidad = el('adminVentaCantidad');
const adminMoneda = el('adminMoneda');
adminMoneda.value = 'CUP';
const adminCategoria = el('adminCategoria');
const adminTelefono = el('adminTelefono');
const adminProvincia = el('adminProvincia');
const adminMunicipio = el('adminMunicipio');
const adminEnlaces = document.querySelectorAll('.adminEnlace');
const dropZone = el('dropZone');
const adminImagenes = el('adminImagenes');
const imagePreview = el('imagePreview');
const saveProductBtn = el('saveProductBtn');
const cancelFormBtn = el('cancelFormBtn');
const previewProductBtn = el('previewProductBtn');
const newProductBtn = el('newProductBtn');
const adminProductList = el('adminProductList');
const closeAdmin = el('closeAdmin');
const adminError = el('adminError');
const toast = el('toast');
const gestorToggle = el('gestorToggle');
const offlineBanner = el('offlineBanner');
const whatsappFloat = el('whatsappFloat');
const backToTop = el('backToTop');
const lightboxOverlay = el('lightboxOverlay');
const lightboxImg = el('lightboxImg');
const previewModal = el('previewModal');
const previewBody = el('previewBody');
const closePreview = el('closePreview');
const gestorModal = el('gestorModal');
const closeGestorModal = el('closeGestorModal');
const gestorWhatsAppLink = el('gestorWhatsAppLink');
const logoLink = el('logoLink');
const feedbackModal = el('feedbackModal');
const feedbackName = el('feedbackName');
const feedbackProducto = el('feedbackProducto');
const feedbackMsg = el('feedbackMsg');
const sendFeedbackBtn = el('sendFeedbackBtn');
const closeFeedback = el('closeFeedback');
const themeToggle = el('themeToggle');
const adminToggle = el('adminToggle');
const adminFeedbackList = el('adminFeedbackList');
const feedbackFloat = el('feedbackFloat');
const orderFormModal = el('orderFormModal');
const closeOrderForm = el('closeOrderForm');
const orderNombre = el('orderNombre');
const orderCelular = el('orderCelular');
const orderCarnet = el('orderCarnet');
const orderMetodoPago = el('orderMetodoPago');
const orderDomicilio = el('orderDomicilio');
const orderDireccion = el('orderDireccion');
const orderDireccionRow = el('orderDireccionRow');
const confirmOrderBtn = el('confirmOrderBtn');
const cancelOrderBtn = el('cancelOrderBtn');
const orderItemsSummary = el('orderItemsSummary');
const cartActionsRow = el('cartActionsRow');
const cartImportPreviewModal = el('cartImportPreviewModal');
const cartPreviewList = el('cartPreviewList');
const cartPreviewAccept = el('cartPreviewAccept');
const cartPreviewCancel = el('cartPreviewCancel');
const closeCartImportPreview = el('closeCartImportPreview');

const userBtn = el('userBtn');
const userModal = el('userModal');
const closeUserModal = el('closeUserModal');
const userLoginForm = el('userLoginForm');
const userRegisterForm = el('userRegisterForm');
const userCodeForm = el('userCodeForm');
const userForgotForm = el('userForgotForm');
const userResetForm = el('userResetForm');
const userLoggedIn = el('userLoggedIn');
const userDisplayName = el('userDisplayName');
const userRoleBadge = el('userRoleBadge');
const userLoginUsername = el('userLoginUsername');
const userLoginPassword = el('userLoginPassword');
const userLoginBtn = el('userLoginBtn');
const userLoginError = el('userLoginError');
const userRegisterBtn = el('userRegisterBtn');
const userRegUsername = el('userRegUsername');
const userRegNombre = el('userRegNombre');
const userRegEmail = el('userRegEmail');
const userRegTelefono = el('userRegTelefono');
const userRegPassword = el('userRegPassword');
const userRegError = el('userRegError');
const userCodeTitle = el('userCodeTitle');
const userCodeDesc = el('userCodeDesc');
const userCodeInput = el('userCodeInput');
const userCodeVerifyBtn = el('userCodeVerifyBtn');
const userCodeError = el('userCodeError');
const userCodeBackLink = el('userCodeBackLink');
const userForgotEmail = el('userForgotEmail');
const userForgotSendBtn = el('userForgotSendBtn');
const userForgotError = el('userForgotError');
const forgotBackLink = el('forgotBackLink');
const showForgotLink = el('showForgotLink');
const userResetCode = el('userResetCode');
const userResetPassword = el('userResetPassword');
const userResetBtn = el('userResetBtn');
const userResetError = el('userResetError');
const resetBackLink = el('resetBackLink');
const userLogoutBtn = el('userLogoutBtn');
const showRegisterLink = el('showRegisterLink');
const showLoginLink = el('showLoginLink');

let pendingRegData = null;

let userToken = localStorage.getItem('gestionCubaToken') || '';
let currentUser = null;

function mostrarUser() {
  if (userToken) {
    showUserForm('none');
    userLoggedIn.style.display = 'block';
    userDisplayName.textContent = currentUser?.nombre || 'Usuario';
    userRoleBadge.textContent = currentUser?.role === 'admin' ? 'Administrador' : 'Usuario';
  } else {
    showUserForm('login');
    userLoggedIn.style.display = 'none';
  }
}
function limpiarUser() {
  // Save cart to anonymous before logging out
  localStorage.setItem('gestionCubaCart', JSON.stringify(carrito));
  localStorage.removeItem('gestionCubaCart_' + (currentUser?.id || ''));
  userToken = ''; currentUser = null;
  localStorage.removeItem('gestionCubaToken'); localStorage.removeItem('gestionCubaUser');
  cargarCarrito();
  mostrarUser(); userBtn.title = 'Iniciar sesión';
}
async function loginUser(username, password) {
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al iniciar sesión'); }
  const data = await res.json();
  // Migrate anonymous cart to user cart
  const anonCart = (() => { try { return JSON.parse(localStorage.getItem('gestionCubaCart')) || []; } catch { return []; } })();
  userToken = data.token; currentUser = data.user;
  localStorage.setItem('gestionCubaToken', userToken); localStorage.setItem('gestionCubaUser', JSON.stringify(currentUser));
  // Load user's existing cart or migrate anonymous one
  const userCart = (() => { try { return JSON.parse(localStorage.getItem(cartKey())) || []; } catch { return []; } })();
  const merged = [...userCart];
  anonCart.forEach(a => { const ex = merged.find(m => m.id === a.id); if (ex) ex.qty += a.qty; else merged.push(a); });
  carrito = merged; guardarCarrito();
  localStorage.removeItem('gestionCubaCart');
  mostrarUser(); userBtn.title = currentUser.nombre; userModal.style.display = 'none';
  return data;
}

function mostrarToast(msg) {
  toast.textContent = msg; toast.style.display = 'block';
  clearTimeout(toast._timer); toast._timer = setTimeout(() => toast.style.display = 'none', 2500);
}

function cartKey() { return currentUser ? 'gestionCubaCart_' + currentUser.id : 'gestionCubaCart'; }
function cargarCarrito() {
  try { carrito = JSON.parse(localStorage.getItem(cartKey())) || []; } catch (e) { carrito = []; }
  actualizarBadge();
}
function guardarCarrito() {
  localStorage.setItem(cartKey(), JSON.stringify(carrito));
  actualizarBadge();
}
function actualizarBadge() {
  const total = carrito.reduce((s, i) => s + i.qty, 0);
  if (total > 0) { cartBadge.style.display = 'flex'; cartBadge.textContent = total; }
  else { cartBadge.style.display = 'none'; }
}

function toggleCart(show) {
  cartVisible = show !== undefined ? show : !cartVisible;
  cartDrawer.style.display = cartVisible ? 'flex' : 'none';
  cartOverlay.style.display = cartVisible ? 'block' : 'none';
  if (cartVisible) renderCart();
}

function renderCart() {
  if (!cartVisible) return;
  if (!carrito.length) {
    cartItems.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:20px 0">El carrito está vacío</p>';
    cartTotals.innerHTML = '';
    comprarBtn.style.display = 'none';
    cartActionsRow.style.display = 'none';
    return;
  }
  let html = '';
  const totals = {};
  carrito.forEach(item => {
    const p = productos.find(x => x.id === item.id);
    if (!p) return;
    const img = (p.imagenes && p.imagenes[0]) || p.imagenBase64 || '';
    const precio = p.precio !== null ? p.precio : 0;
    const key = p.moneda || 'CUP';
    if (!totals[key]) totals[key] = 0;
    totals[key] += precio * item.qty;
    html += `<div class="cart-item" onclick="abrirModalProducto('${item.id}')">
      <img src="${img || 'icon.svg'}" alt="${p.nombre}" loading="lazy">
      <div class="cart-item-info">
        <h4>${p.nombre}</h4>
        <p class="cart-item-price">${CURRENCY_SYMBOLS[key]}${Number(precio).toLocaleString('es-CU')} ${key}</p>
        <div class="cart-item-qty" onclick="event.stopPropagation()">
          <button onclick="cambiarQty('${item.id}',-1)">-</button>
          <span>${item.qty}</span>
          <button onclick="cambiarQty('${item.id}',1)">+</button>
        </div>
      </div>
    </div>`;
  });
  cartItems.innerHTML = html;
  let totalHtml = '';
  for (const [moneda, total] of Object.entries(totals)) {
    const sym = CURRENCY_SYMBOLS[moneda] || '$';
    totalHtml += `<p>${sym}${Number(total).toLocaleString('es-CU')} ${moneda}</p>`;
  }
  cartTotals.innerHTML = totalHtml;
  comprarBtn.style.display = 'flex';
  cartActionsRow.style.display = 'flex';
}

function cambiarQty(id, delta) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) carrito = carrito.filter(i => i.id !== id);
  guardarCarrito();
  renderCart();
}

function obtenerUrlProducto(id) { return window.location.origin + '/producto/' + encodeURIComponent(id); }

comprarBtn.addEventListener('click', () => {
  if (!carrito.length) return;
  let html = '', totalGlobal = 0;
  const monedas = {};
  carrito.forEach(item => {
    const p = productos.find(x => x.id === item.id);
    if (!p) return;
    const precio = p.precio || 0;
    const key = p.moneda || 'CUP';
    totalGlobal += precio * item.qty;
    monedas[key] = (monedas[key]||0) + precio * item.qty;
    html += `<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:3px 0">${p.nombre} x${item.qty} <span>$${Number(precio*item.qty).toLocaleString('es-CU')} ${key}</span></div>`;
  });
  let totalHtml = '';
  for (const [m, t] of Object.entries(monedas)) totalHtml += `<div style="display:flex;justify-content:space-between;font-weight:700;padding:3px 0;border-top:1px solid var(--border)">Total ${m} <span>$${Number(t).toLocaleString('es-CU')}</span></div>`;
  orderItemsSummary.innerHTML = html + totalHtml;
  orderNombre.value = ''; orderCelular.value = ''; orderCarnet.value = '';
  orderMetodoPago.value = ''; orderDomicilio.checked = false;
  orderDireccionRow.style.display = 'none'; orderDireccion.value = '';
  toggleCart(false);
  orderFormModal.style.display = 'flex';
});

shareCartBtn.addEventListener('click', () => {
  if (!carrito.length) return;
  const data = carrito.map(i => `${i.id},${i.qty}`).join(';');
  const url = window.location.origin + '/#/carrito/' + encodeURIComponent(data);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => mostrarToast('Link copiado al portapapeles'));
  } else {
    const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    mostrarToast('Link copiado al portapapeles');
  }
});

clearCartBtn.addEventListener('click', () => { carrito = []; guardarCarrito(); renderCart(); mostrarToast('Carrito vaciado'); });



cartToggle.addEventListener('click', () => toggleCart());
closeCart.addEventListener('click', () => toggleCart(false));
cartOverlay.addEventListener('click', () => toggleCart(false));

feedbackFloat.addEventListener('click', () => { feedbackModal.style.display = 'flex'; });

orderDomicilio.addEventListener('change', () => {
  orderDireccionRow.style.display = orderDomicilio.checked ? 'block' : 'none';
});

cancelOrderBtn.addEventListener('click', () => { orderFormModal.style.display = 'none'; });
closeOrderForm.addEventListener('click', () => { orderFormModal.style.display = 'none'; });
confirmOrderBtn.addEventListener('click', async () => {
  const nombre = orderNombre.value.trim();
  const celular = orderCelular.value.trim();
  const metodoPago = orderMetodoPago.value;
  if (!nombre || !celular || !metodoPago) { mostrarToast('Completá nombre, celular y método de pago'); return; }
  const items = carrito.map(item => {
    const p = productos.find(x => x.id === item.id);
    return p ? { id: p.id, nombre: p.nombre, qty: item.qty, precio: (p.precio||0) * item.qty, moneda: p.moneda||'CUP' } : null;
  }).filter(Boolean);
  let total = 0;
  const monedas = {};
  items.forEach(i => { total += i.precio; monedas[i.moneda] = (monedas[i.moneda]||0) + i.precio; });
  const totalStr = Object.entries(monedas).map(([m, t]) => `$${Number(t).toLocaleString('es-CU')} ${m}`).join(' + ');
  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre, celular, carnet: orderCarnet.value.trim(), metodoPago,
        domicilio: orderDomicilio.checked, direccion: orderDireccion.value.trim(),
        items, total, moneda: Object.keys(monedas).join('/')
      })
    });
    if (!res.ok) { mostrarToast('Error al crear pedido'); return; }
    orderFormModal.style.display = 'none';
    carrito = []; guardarCarrito(); renderCart();
    mostrarToast('Pedido enviado con éxito');
  } catch (e) { mostrarToast('Error al enviar pedido'); }
});

themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light');
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
  localStorage.setItem('gestionCubaTheme', isLight ? 'dark' : 'light');
  const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  themeToggle.innerHTML = isLight ? SUN_SVG : MOON_SVG;
});

adminToggle.addEventListener('click', () => {
  if (!currentUser) {
    userModal.style.display = 'flex';
    showUserForm('login');
    userLoginError.style.display = 'none'; userRegError.style.display = 'none';
    userLoginUsername.value = ''; userLoginPassword.value = '';
    return;
  }
  adminModal.style.display = 'flex';
  adminForm.style.display = 'none';
  adminError.style.display = 'none';
  if (currentUser?.role === 'admin' || currentUser?.role === 'user') {
    adminLogin.style.display = 'none';
    adminPanel.style.display = 'block';
    adminToken = userToken;
    adminTitle.textContent = currentUser?.role === 'admin' ? 'Panel de Administración' : 'Mis Publicaciones';
    // Show/hide admin-only tabs
    const isAdmin = currentUser?.role === 'admin';
    document.querySelectorAll('.admin-tab').forEach(tab => {
      if (tab.dataset.tab === 'feedback' || tab.dataset.tab === 'pedidos' || tab.dataset.tab === 'usuarios') {
        tab.style.display = isAdmin ? '' : 'none';
      }
    });
    // If non-admin is on an admin tab, switch to products
    if (!isAdmin) {
      const activeTab = document.querySelector('.admin-tab.active');
      if (activeTab && (activeTab.dataset.tab === 'feedback' || activeTab.dataset.tab === 'pedidos' || activeTab.dataset.tab === 'usuarios')) {
        document.querySelector('.admin-tab[data-tab="products"]').click();
      }
    }
    listarProductosAdmin();
    if (isAdmin) {
      cargarFeedbackAdmin();
      cargarPedidosAdmin();
      el('adminTabUsuariosBtn').style.display = '';
    }
  } else {
    adminLogin.style.display = 'block';
    adminPanel.style.display = 'none';
    adminPassword.value = '';
  }
});

userBtn.addEventListener('click', () => {
  userModal.style.display = 'flex';
  userLoginError.style.display = 'none'; userRegError.style.display = 'none';
  userLoginUsername.value = ''; userLoginPassword.value = '';
  if (userToken) mostrarUser();
  else { showUserForm('login'); userLoggedIn.style.display = 'none'; }
});
closeUserModal.addEventListener('click', () => { userModal.style.display = 'none'; });

userLoginBtn.addEventListener('click', async () => {
  const u = userLoginUsername.value.trim(); const p = userLoginPassword.value;
  if (!u || !p) { userLoginError.textContent = 'Completá todos los campos'; userLoginError.style.display = 'block'; return; }
  try {
    userLoginError.style.display = 'none';
    userLoginBtn.disabled = true; userLoginBtn.textContent = 'Entrando...';
    await loginUser(u, p);
  } catch (e) { userLoginError.textContent = e.message; userLoginError.style.display = 'block'; }
  finally { userLoginBtn.disabled = false; userLoginBtn.textContent = 'Entrar'; }
});

userRegisterBtn.addEventListener('click', async () => {
  const username = userRegUsername.value.trim(); const nombre = userRegNombre.value.trim();
  const email = userRegEmail.value.trim(); const telefono = userRegTelefono.value.trim(); const password = userRegPassword.value;
  if (!username || !nombre || !email || !password) { userRegError.textContent = 'Completá todos los campos requeridos'; userRegError.style.display = 'block'; return; }
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) { userRegError.textContent = 'Debe ser un correo @gmail.com válido'; userRegError.style.display = 'block'; return; }
  try {
    userRegError.style.display = 'none';
    userRegisterBtn.disabled = true; userRegisterBtn.textContent = 'Enviando código...';
    const res = await fetch('/api/auth/send-register-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, nombre, email, telefono, password }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
    pendingRegData = { email };
    userRegisterForm.style.display = 'none';
    userCodeForm.style.display = 'block';
    userCodeTitle.textContent = 'Verificar código de registro';
    userCodeDesc.textContent = `Ingresá el código enviado a ${email}`;
    userCodeInput.value = '';
    userCodeError.style.display = 'none';
    mostrarToast('Código enviado a tu correo Gmail');
  } catch (e) { userRegError.textContent = e.message; userRegError.style.display = 'block'; }
  finally { userRegisterBtn.disabled = false; userRegisterBtn.textContent = 'Registrarse'; }
});

userCodeVerifyBtn.addEventListener('click', async () => {
  const code = userCodeInput.value.trim();
  if (!code || code.length !== 6) { userCodeError.textContent = 'Ingresá el código de 6 dígitos'; userCodeError.style.display = 'block'; return; }
  try {
    userCodeError.style.display = 'none';
    userCodeVerifyBtn.disabled = true; userCodeVerifyBtn.textContent = 'Verificando...';
    const res = await fetch('/api/auth/verify-register-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pendingRegData.email, code }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Código incorrecto'); }
    const data = await res.json();
    const anonCart = (() => { try { return JSON.parse(localStorage.getItem('gestionCubaCart')) || []; } catch { return []; } })();
    userToken = data.token; currentUser = data.user;
    localStorage.setItem('gestionCubaToken', userToken); localStorage.setItem('gestionCubaUser', JSON.stringify(currentUser));
    const userCart = (() => { try { return JSON.parse(localStorage.getItem(cartKey())) || []; } catch { return []; } })();
    carrito = [...userCart, ...anonCart.filter(a => !userCart.find(m => m.id === a.id))];
    guardarCarrito();
    localStorage.removeItem('gestionCubaCart');
    mostrarUser(); userBtn.title = currentUser.nombre;
    userModal.style.display = 'none';
    userCodeForm.style.display = 'none';
    mostrarToast('Registrado exitosamente');
  } catch (e) { userCodeError.textContent = e.message; userCodeError.style.display = 'block'; }
  finally { userCodeVerifyBtn.disabled = false; userCodeVerifyBtn.textContent = 'Verificar código'; }
});

userLogoutBtn.addEventListener('click', () => { fetch('/api/auth/logout', { headers: { 'Authorization': `Bearer ${userToken}` } }).catch(() => {}); limpiarUser(); userModal.style.display = 'none'; mostrarToast('Sesión cerrada'); });
userModal.addEventListener('click', (e) => { if (e.target === userModal) userModal.style.display = 'none'; });

function showUserForm(form) {
  userLoginForm.style.display = form === 'login' ? 'block' : 'none';
  userRegisterForm.style.display = form === 'register' ? 'block' : 'none';
  userCodeForm.style.display = form === 'code' ? 'block' : 'none';
  userForgotForm.style.display = form === 'forgot' ? 'block' : 'none';
  userResetForm.style.display = form === 'reset' ? 'block' : 'none';
  userLoggedIn.style.display = 'none';
}

showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showUserForm('register'); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showUserForm('login'); });
userCodeBackLink.addEventListener('click', (e) => { e.preventDefault(); pendingRegData = null; showUserForm('register'); });
showForgotLink.addEventListener('click', (e) => { e.preventDefault(); userForgotEmail.value = ''; userForgotError.style.display = 'none'; showUserForm('forgot'); });
forgotBackLink.addEventListener('click', (e) => { e.preventDefault(); showUserForm('login'); });
resetBackLink.addEventListener('click', (e) => { e.preventDefault(); showUserForm('login'); });

userForgotSendBtn.addEventListener('click', async () => {
  const email = userForgotEmail.value.trim();
  if (!email) { userForgotError.textContent = 'Ingresá tu correo'; userForgotError.style.display = 'block'; return; }
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) { userForgotError.textContent = 'Debe ser un correo @gmail.com válido'; userForgotError.style.display = 'block'; return; }
  try {
    userForgotError.style.display = 'none';
    userForgotSendBtn.disabled = true; userForgotSendBtn.textContent = 'Enviando...';
    const res = await fetch('/api/auth/send-reset-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
    showUserForm('reset');
    userResetCode.value = '';
    userResetPassword.value = '';
    userResetError.style.display = 'none';
    mostrarToast('Código enviado a tu correo');
  } catch (e) { userForgotError.textContent = e.message; userForgotError.style.display = 'block'; }
  finally { userForgotSendBtn.disabled = false; userForgotSendBtn.textContent = 'Enviar código'; }
});

userResetBtn.addEventListener('click', async () => {
  const code = userResetCode.value.trim();
  const password = userResetPassword.value;
  if (!code || code.length !== 6 || !password) { userResetError.textContent = 'Completá todos los campos'; userResetError.style.display = 'block'; return; }
  if (password.length < 4) { userResetError.textContent = 'La contraseña debe tener al menos 4 caracteres'; userResetError.style.display = 'block'; return; }
  try {
    userResetError.style.display = 'none';
    userResetBtn.disabled = true; userResetBtn.textContent = 'Cambiando...';
    const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userForgotEmail.value.trim(), code, password }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
    mostrarToast('Contraseña actualizada. Iniciá sesión.');
    showUserForm('login');
  } catch (e) { userResetError.textContent = e.message; userResetError.style.display = 'block'; }
  finally { userResetBtn.disabled = false; userResetBtn.textContent = 'Cambiar contraseña'; }
});

userLoginUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') userLoginBtn.click(); });
userLoginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') userLoginBtn.click(); });
userRegPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') userRegisterBtn.click(); });
userCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') userCodeVerifyBtn.click(); });
userForgotEmail.addEventListener('keydown', (e) => { if (e.key === 'Enter') userForgotSendBtn.click(); });
userResetCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') userResetBtn.click(); });
userResetPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') userResetBtn.click(); });

cartPreviewAccept.addEventListener('click', () => {
  pendingCartImport.forEach(n => {
    const existente = carrito.find(i => i.id === n.id);
    if (existente) existente.qty += n.qty;
    else carrito.push(n);
  });
  guardarCarrito();
  cartImportPreviewModal.style.display = 'none';
  history.replaceState(null, '', window.location.pathname);
  mostrarToast('Carrito importado');
});
cartPreviewCancel.addEventListener('click', () => {
  cartImportPreviewModal.style.display = 'none';
  history.replaceState(null, '', window.location.pathname);
});
closeCartImportPreview.addEventListener('click', () => {
  cartImportPreviewModal.style.display = 'none';
  history.replaceState(null, '', window.location.pathname);
});

function mostrarPreviewCarrito(nuevos) {
  pendingCartImport = nuevos;
  const html = nuevos.map(n => {
    const p = productos.find(x => x.id === n.id);
    if (!p) return '';
    const img = (p.imagenes && p.imagenes[0]) || p.imagenBase64 || '';
    const precio = p.precio !== null ? `${CURRENCY_SYMBOLS[p.moneda||'CUP']}${Number(p.precio).toLocaleString('es-CU')} ${p.moneda||'CUP'}` : 'Sin precio';
    return `<div class="cart-preview-item">
      <img src="${img || 'icon.svg'}" alt="${p.nombre}" loading="lazy">
      <div><strong>${p.nombre}</strong><br><span style="font-size:0.85rem;color:var(--text-light)">${precio} x${n.qty}</span></div>
    </div>`;
  }).join('');
  cartPreviewList.innerHTML = html || '<p style="color:var(--text-light)">No se encontraron productos</p>';
  cartImportPreviewModal.style.display = 'flex';
}

function abrirModalProducto(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : (p.imagenBase64 ? [p.imagenBase64] : []);
  const hasMultiple = imagenes.length > 1;
  let carouselHtml = '';
  if (imagenes.length) {
    carouselHtml = `<div class="modal-carousel" id="modalCarousel">
      ${imagenes.map((img, i) => `<img src="${img}" alt="${p.nombre} ${i+1}" class="${i===0?'active':''}" data-index="${i}" loading="lazy">`).join('')}
      ${hasMultiple ? `<span class="carousel-counter">1/${imagenes.length}</span>` : ''}
    </div>`;
  } else {
    carouselHtml = `<div class="modal-carousel" id="modalCarousel" style="display:flex;align-items:center;justify-content:center;color:var(--text-light);font-size:0.85rem">Sin imagen</div>`;
  }
  const estadoHtml = p.estado && p.estado !== 'disponible' ? `<span class="estado-badge ${p.estado}">${ESTADO_LABELS[p.estado]}</span> ` : '';
  const codigoHtml = p.codigo ? `<p class="modal-meta"><strong>Codigo:</strong> ${p.codigo}</p>` : '';
  const precioAnteriorHtml = p.precioAnterior ? `<span class="modal-precio-anterior">${CURRENCY_SYMBOLS[p.moneda||'CUP']}${Number(p.precioAnterior).toLocaleString('es-CU')}</span>` : '';
  const precioHtml = p.precio !== null ? `<div class="modal-precio">${CURRENCY_SYMBOLS[p.moneda||'CUP']}${Number(p.precio).toLocaleString('es-CU')} ${p.moneda||'CUP'}${precioAnteriorHtml}</div>` : '';
  const enlacesHtml = p.enlaces && p.enlaces.filter(e => e).length ? `<div class="modal-enlaces">${p.enlaces.filter(e => e).map(e => `<a href="${e}" target="_blank" rel="noopener">Enlace</a>`).join('')}</div>` : '';
  const telefonoHtml = p.telefono ? `<a href="https://wa.me/53${p.telefono.replace(/[^0-9]/g,'')}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Contactar</a>` : '';
  modalBody.innerHTML = `
    <div class="modal-carousel-wrap">${carouselHtml}</div>
    <div class="modal-info-wrap">
      <h2>${estadoHtml}${p.nombre}</h2>
      ${codigoHtml}
      <p class="modal-meta">${p.provincia}${p.municipio ? ' - ' + p.municipio : ''}${p.categoria ? ' | ' + p.categoria : ''}</p>
      ${p.ventaCantidad ? '<span class="venta-cantidad-tag">Ventas por Cantidad</span>' : ''}
      ${precioHtml}
      <div class="modal-desc">${p.descripcion}</div>
      ${enlacesHtml}
      <div class="modal-actions">
        ${telefonoHtml}
        <button onclick="agregarAlCarrito('${p.id}')" class="btn btn-primary btn-sm">Agregar al carrito</button>
        <button onclick="compartirProducto('${p.id}')" class="btn btn-secondary btn-sm">Compartir</button>
      </div>
    </div>`;
  productModal.style.display = 'flex';
  if (hasMultiple) iniciarCarouselModal(imagenes);
  const mc = document.getElementById('modalCarousel');
  if (mc && imagenes.length > 0) mc.addEventListener('click', () => abrirLightbox(imagenes, 0));
}

function abrirLightbox(imagenes, idx) {
  lightboxImg.src = imagenes[idx] || imagenes[0];
  lightboxOverlay.style.display = 'flex';
  lightboxOverlay._imagenes = imagenes;
  lightboxOverlay._idx = idx || 0;
}
lightboxOverlay.addEventListener('click', (e) => {
  if (e.target === lightboxOverlay || e.target.classList.contains('lightbox-close')) {
    lightboxOverlay.style.display = 'none';
  }
});
lightboxImg.addEventListener('click', () => {
  const imgs = lightboxOverlay._imagenes;
  if (!imgs || imgs.length <= 1) return;
  let idx = (lightboxOverlay._idx + 1) % imgs.length;
  lightboxOverlay._idx = idx;
  lightboxImg.src = imgs[idx];
});

function iniciarCarouselModal(imagenes) {
  if (currentInterval) clearInterval(currentInterval);
  const mc = document.getElementById('modalCarousel');
  if (!mc) return;
  const imgs = mc.querySelectorAll('img');
  const counter = mc.querySelector('.carousel-counter');
  let idx = 0;
  currentInterval = setInterval(() => {
    if (!mc || !mc.parentElement) { clearInterval(currentInterval); return; }
    imgs.forEach(i => i.classList.remove('active'));
    idx = (idx + 1) % imgs.length;
    imgs[idx].classList.add('active');
    if (counter) counter.textContent = `${idx+1}/${imagenes.length}`;
  }, 4000);
}
closeProductModal.addEventListener('click', () => { productModal.style.display = 'none'; if (currentInterval) clearInterval(currentInterval); });
productModal.addEventListener('click', (e) => { if (e.target === productModal) { productModal.style.display = 'none'; if (currentInterval) clearInterval(currentInterval); } });

function agregarAlCarrito(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  if (p.estado === 'agotado') { mostrarToast('Producto agotado'); return; }
  const item = carrito.find(i => i.id === id);
  if (item) item.qty += 1;
  else carrito.push({ id, qty: 1 });
  guardarCarrito();
  if (cartVisible) renderCart();
  mostrarToast(`${p.nombre} agregado al carrito`);
}

function compartirProducto(id) {
  const url = obtenerUrlProducto(id);
  if (navigator.share) {
    navigator.share({ title: 'Gestion Cuba', url }).catch(() => {});
  } else {
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => mostrarToast('Link copiado'));
    else { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); mostrarToast('Link copiado'); }
  }
}

function normalizar(s) { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_-]+/g,'').toLowerCase(); }

function filtrarProductos() {
  const prov = provinciaFilter.value;
  const mun = municipioFilter.value;
  const cat = categoriaFilter.value;
  const est = estadoFilter.value;
  const mon = monedaFilter.value;
  const min = parseFloat(precioMin.value) || 0;
  const max = parseFloat(precioMax.value) || 0;
  const q = normalizar(searchInput.value);
  productosFiltrados = productos.filter(p => {
    if (q && !normalizar(p.nombre).includes(q) && !normalizar(p.descripcion).includes(q) && !normalizar(p.codigo).includes(q)) return false;
    if (prov && p.provincia !== prov) return false;
    if (mun && p.municipio !== mun) return false;
    if (cat && p.categoria !== cat) return false;
    if (est && p.estado !== est) return false;
    if (mon && p.moneda !== mon) return false;
    if (min && (p.precio === null || p.precio < min)) return false;
    if (max && (p.precio === null || p.precio > max)) return false;
    return true;
  });
  ordenarProductos();
  renderLimit = 20;
  productGrid.innerHTML = '';
  cargarMasProductos();
}

function ordenarProductos() {
  const sort = sortSelect.value;
  if (sort === 'aleatorio') {
    for (let i = productosFiltrados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [productosFiltrados[i], productosFiltrados[j]] = [productosFiltrados[j], productosFiltrados[i]];
    }
  } else if (sort === 'recientes') {
    productosFiltrados.sort((a, b) => (b.createdAt||0) - (a.createdAt||0));
  } else if (sort === 'asc') {
    productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  } else if (sort === 'desc') {
    productosFiltrados.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es'));
  } else if (sort === 'categoria') {
    productosFiltrados.sort((a, b) => (a.categoria||'').localeCompare(b.categoria||'', 'es'));
  }
}

function crearCard(p) {
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : (p.imagenBase64 ? [p.imagenBase64] : []);
  const hasMultiple = imagenes.length > 1;
  const estadoBadge = p.estado && p.estado !== 'disponible' ? `<span class="estado-badge ${p.estado}">${ESTADO_LABELS[p.estado]}</span>` : '';
  const precioAnteriorHtml = p.precioAnterior ? `<span class="card-precio-anterior">${CURRENCY_SYMBOLS[p.moneda||'CUP']}${Number(p.precioAnterior).toLocaleString('es-CU')}</span>` : '';
  const descPct = p.precioAnterior ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
  const descuentoBadge = descPct > 0 ? `<div class="discount-badge">-${descPct}%</div>` : '';
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.id = p.id;
  let carouselHtml = '';
  if (imagenes.length) {
    carouselHtml = `<div class="card-carousel" id="carousel-${p.id}">
      ${imagenes.map((img, i) => `<img src="${img}" alt="${p.nombre} ${i+1}" class="${i===0?'active':''}" data-index="${i}" loading="lazy">`).join('')}
      ${descuentoBadge}
      <button class="card-cart-btn" data-id="${p.id}" aria-label="Agregar al carrito" title="Agregar al carrito">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 14.75l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4h-.01l-1.1 2-2.76 5H8.53l-.13-.27L6.16 6l-.95-2-.94-2H1v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25z"/></svg>
      </button>
      ${hasMultiple ? `<span class="carousel-counter">1/${imagenes.length}</span>` : ''}
    </div>`;
  } else {
    carouselHtml = `<div class="card-carousel" style="display:flex;align-items:center;justify-content:center;color:var(--text-light);font-size:0.85rem">Sin imagen${descuentoBadge}</div>`;
  }
  const precioStr = p.precio !== null ? `${CURRENCY_SYMBOLS[p.moneda||'CUP']}${Number(p.precio).toLocaleString('es-CU')} ${p.moneda||'CUP'}` : '';
  const ventaCantidadTag = p.ventaCantidad ? '<span class="venta-cantidad-tag">Ventas por Cantidad</span>' : '';
  card.innerHTML = `${carouselHtml}<div class="card-body">
    <h3>${estadoBadge}${p.nombre}</h3>
    <div class="card-meta">${p.provincia}${p.municipio ? ' - ' + p.municipio : ''}${p.categoria ? ' | ' + p.categoria : ''}</div>
    ${precioStr ? `<div class="card-precio">${precioStr}${precioAnteriorHtml}</div>` : ''}${ventaCantidadTag}
  </div>`;
  card.addEventListener('click', (e) => { if (!e.target.closest('.card-cart-btn')) abrirModalProducto(p.id); });
  card.querySelector('.card-cart-btn')?.addEventListener('click', (e) => { e.stopPropagation(); agregarAlCarrito(p.id); });
  if (hasMultiple) {
    const delay = Math.random() * 4000;
    setTimeout(() => {
      const carousel = card.querySelector('.card-carousel');
      if (!carousel || !carousel.parentElement) return;
      const imgs = carousel.querySelectorAll('img');
      const counter = carousel.querySelector('.carousel-counter');
      let idx = 0;
      setInterval(() => {
        if (!carousel || !carousel.parentElement) { return; }
        imgs.forEach(i => i.classList.remove('active'));
        idx = (idx + 1) % imgs.length;
        imgs[idx].classList.add('active');
        if (counter) counter.textContent = `${idx+1}/${imagenes.length}`;
      }, 4000);
    }, delay);
  }
  return card;
}

function cargarMasProductos() {
  const nuevos = productosFiltrados.slice(0, renderLimit);
  const existing = productGrid.children.length;
  const fragment = document.createDocumentFragment();
  for (let i = existing; i < nuevos.length; i++) {
    fragment.appendChild(crearCard(nuevos[i]));
  }
  productGrid.appendChild(fragment);
  if (renderLimit < productosFiltrados.length) {
    loadingIndicator.style.display = 'block';
  } else {
    loadingIndicator.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => { if (m.style.display !== 'none') m.style.display = 'none'; });
    toggleCart(false);
    if (currentInterval) clearInterval(currentInterval);
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) { searchInput.focus(); }
});

async function cargarProductos() {
  try {
    const res = await fetch('/api/productos');
    productos = await res.json();
    dbGuardar(productos).then(() => console.log('Productos guardados en IndexedDB')).catch(() => {});
    actualizarFiltros();
    filtrarProductos();
  } catch (err) {
    const desdeDB = await dbCargar();
    if (desdeDB && desdeDB.length) {
      productos = desdeDB;
      actualizarFiltros();
      filtrarProductos();
    } else {
      productGrid.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-light)">Sin conexión y sin datos locales. Conectate al servidor al menos una vez para poder ver productos offline.</p>';
    }
  }
}

function actualizarFiltros() {
  const provincias = [...new Set(productos.map(p => p.provincia).filter(Boolean))];
  provincias.sort((a, b) => a.localeCompare(b, 'es'));
  provinciaFilter.innerHTML = '<option value="">Todas las provincias</option>' + provincias.map(p => `<option value="${p}">${p}</option>`).join('');

  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
  categorias.sort((a, b) => a.localeCompare(b, 'es'));
  categoriaFilter.innerHTML = '<option value="">Todas las categorías</option>' + categorias.map(c => `<option value="${c}">${c}</option>`).join('');

  const monedas = [...new Set(productos.map(p => p.moneda).filter(Boolean))];
  monedaFilter.innerHTML = '<option value="">Todas las monedas</option>' + monedas.map(m => `<option value="${m}">${m}</option>`).join('');

  adminProvincia.innerHTML = '<option value="">Seleccioná una provincia</option>' + CUBAN_PROVINCES.map(p => `<option value="${p}">${p}</option>`).join('');
  adminProvincia.addEventListener('change', actualizarMunicipiosAdmin);
  provinciaFilter.addEventListener('change', actualizarMunicipiosFiltro);
}

function actualizarMunicipiosAdmin() {
  const prov = adminProvincia.value;
  adminMunicipio.innerHTML = '<option value="">' + (prov ? 'Seleccioná un municipio' : 'Primero seleccioná una provincia') + '</option>';
  if (prov && MUNICIPIOS[prov]) {
    MUNICIPIOS[prov].forEach(m => { adminMunicipio.innerHTML += `<option value="${m}">${m}</option>`; });
  }
}

function actualizarMunicipiosFiltro() {
  const prov = provinciaFilter.value;
  municipioFilter.innerHTML = '<option value="">Todos los municipios</option>';
  if (prov && MUNICIPIOS[prov]) {
    MUNICIPIOS[prov].forEach(m => { municipioFilter.innerHTML += `<option value="${m}">${m}</option>`; });
  } else {
    Object.values(MUNICIPIOS).flat().forEach(m => { municipioFilter.innerHTML += `<option value="${m}">${m}</option>`; });
  }
}

searchInput.addEventListener('input', filtrarProductos);
provinciaFilter.addEventListener('change', filtrarProductos);
municipioFilter.addEventListener('change', filtrarProductos);
categoriaFilter.addEventListener('change', filtrarProductos);
estadoFilter.addEventListener('change', filtrarProductos);
monedaFilter.addEventListener('change', filtrarProductos);
sortSelect.addEventListener('change', filtrarProductos);
precioMin.addEventListener('input', filtrarProductos);
precioMax.addEventListener('input', filtrarProductos);

precioFilterToggle.addEventListener('click', () => {
  const show = precioFilterRow.style.display === 'none';
  precioFilterRow.style.display = show ? 'flex' : 'none';
  precioFilterToggle.classList.toggle('active', show);
});

window.addEventListener('scroll', () => {
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;
  if (nearBottom && renderLimit < productosFiltrados.length) {
    renderLimit += RENDER_STEP;
    cargarMasProductos();
  }
  backToTop.style.display = window.scrollY > 300 ? 'flex' : 'none';
});

backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

whatsappFloat.addEventListener('click', () => {
  const text = 'Vengo de Gestion Cuba quiero formar parte de la red de Gestores, soy de ';
  window.open('https://wa.me/5359609074?text=' + encodeURIComponent(text), '_blank');
});

gestorToggle.addEventListener('click', () => {
  const prov = provinciaFilter.value;
  const mun = municipioFilter.value;
  if (prov || mun) {
    const text = `Vengo de Gestion Cuba quiero formar parte de la red de Gestores, soy de ${prov || ''}${prov && mun ? ', ' : ''}${mun || ''}`;
    gestorWhatsAppLink.href = 'https://wa.me/5359609074?text=' + encodeURIComponent(text);
  }
  gestorModal.style.display = 'flex';
});
closeGestorModal.addEventListener('click', () => gestorModal.style.display = 'none');
gestorModal.addEventListener('click', (e) => { if (e.target === gestorModal) gestorModal.style.display = 'none'; });

logoLink.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

sendFeedbackBtn.addEventListener('click', async () => {
  const mensaje = feedbackMsg.value.trim();
  if (!mensaje) { mostrarToast('Escribí un mensaje'); return; }
  const body = { nombre: feedbackName.value.trim(), mensaje, producto: feedbackProducto.value.trim() };
  try {
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    mostrarToast('Gracias por tu sugerencia');
    feedbackModal.style.display = 'none';
    feedbackName.value = ''; feedbackMsg.value = ''; feedbackProducto.value = '';
  } catch (e) { mostrarToast('Error al enviar'); }
});
closeFeedback.addEventListener('click', () => feedbackModal.style.display = 'none');

async function cargarFeedbackAdmin() {
  if (!adminToken) return;
  try {
    const res = await fetch('/api/feedback', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const data = await res.json();
    if (!data.length) { adminFeedbackList.innerHTML = '<p>No hay sugerencias aun.</p>'; return; }
    adminFeedbackList.innerHTML = data.map(f => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <p><strong>${f.nombre || 'Anonimo'}</strong> <span style="font-size:0.8rem;color:var(--text-light)">${new Date(f.fecha).toLocaleString('es-CU')}</span></p>
        ${f.producto ? `<p style="font-size:0.85rem;color:var(--text-light)">Producto: ${f.producto}</p>` : ''}
        <p>${f.mensaje}</p>
      </div>
    `).join('');
  } catch (e) { adminFeedbackList.innerHTML = '<p>Error al cargar sugerencias.</p>'; }
}

async function cargarPedidosAdmin() {
  if (!adminToken) return;
  const list = el('adminOrderList');
  if (!list) return;
  try {
    const res = await fetch('/api/pedidos', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const data = await res.json();
    if (!data.length) { list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light)">No hay pedidos aún.</p>'; return; }
    list.innerHTML = data.map(p => `
      <div class="admin-order-item">
        <div class="order-header">
          <strong>${p.nombre}</strong>
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:6px;background:${p.estado==='completado'?'var(--green)':'var(--orange)'};color:#fff">${p.estado}</span>
        </div>
        <div class="order-meta">${p.fecha ? new Date(p.fecha).toLocaleString('es-CU') : ''} | ${p.celular}${p.carnet ? ' | CI: ' + p.carnet : ''}</div>
        <div class="order-meta">Pago: ${p.metodoPago}${p.domicilio ? ' | Domicilio: ' + (p.direccion || 'Sí') : ''}</div>
        <div class="order-meta">Total: $${Number(p.total || 0).toLocaleString('es-CU')} ${p.moneda || 'CUP'} | ${(p.items||[]).length} producto(s)</div>
        ${p.estado !== 'completado' ? `<button onclick="completarPedido('${p.id}')" class="btn btn-sm btn-primary" style="margin-top:6px">Marcar completado</button>` : ''}
      </div>
    `).join('');
  } catch (e) { list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light)">Error al cargar pedidos.</p>'; }
}

async function cargarUsuariosAdmin() {
  const list = el('adminUserList');
  if (!list) return;
  try {
    const res = await fetch('/api/usuarios', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (!res.ok) { list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light)">Solo administradores</p>'; return; }
    const data = await res.json();
    if (!data.length) { list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light)">No hay usuarios registrados.</p>'; return; }
    list.innerHTML = data.map(u => `
      <div class="admin-product-item">
        <div class="item-info"><h4>${u.nombre} (${u.username})</h4><p>${u.email || 'Sin email'}${u.telefono ? ' | ' + u.telefono : ''} | ${new Date(u.creado).toLocaleDateString('es-CU')} | ${u.verificado ? '✅ Verificado' : '⏳ Pendiente'}</p></div>
        <div class="item-actions">
          <span style="font-size:0.7rem;padding:2px 8px;border-radius:6px;background:${u.estado==='banned'?'var(--red)':'var(--green)'};color:#fff">${u.estado}</span>
          <button onclick="toggleBan('${u.id}')" class="btn btn-sm ${u.estado==='banned'?'btn-primary':'btn-danger'}">${u.estado==='banned'?'Desbanear':'Banear'}</button>
        </div>
      </div>
    `).join('');
  } catch (e) { list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light)">Error al cargar usuarios.</p>'; }
}
async function toggleBan(id) {
  try {
    const res = await fetch(`/api/usuarios/${id}/ban`, { method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (res.ok) { cargarUsuariosAdmin(); mostrarToast('Estado de usuario actualizado'); }
  } catch (e) { mostrarToast('Error al actualizar'); }
}

async function completarPedido(id) {
  try {
    const res = await fetch(`/api/pedidos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ estado: 'completado' })
    });
    if (res.ok) { cargarPedidosAdmin(); mostrarToast('Pedido marcado como completado'); }
  } catch (e) { mostrarToast('Error al actualizar'); }
}

function initAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('adminTab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
      if (target) target.classList.add('active');
      if (tab.dataset.tab === 'feedback') cargarFeedbackAdmin();
      if (tab.dataset.tab === 'pedidos') cargarPedidosAdmin();
      if (tab.dataset.tab === 'usuarios') cargarUsuariosAdmin();
    });
  });
}
initAdminTabs();

adminLoginBtn.addEventListener('click', async () => {
  const password = adminPassword.value.trim();
  if (!password) return;
  try {
    let res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'MklMillan', password }) });
    if (!res.ok) res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) });
    if (!res.ok) { adminError.style.display = 'block'; return; }
    const data = await res.json();
    const anonCart = (() => { try { return JSON.parse(localStorage.getItem('gestionCubaCart')) || []; } catch { return []; } })();
    userToken = data.token; currentUser = data.user;
    localStorage.setItem('gestionCubaToken', userToken); localStorage.setItem('gestionCubaUser', JSON.stringify(currentUser));
    const userCart = (() => { try { return JSON.parse(localStorage.getItem(cartKey())) || []; } catch { return []; } })();
    const merged = [...userCart];
    anonCart.forEach(a => { const ex = merged.find(m => m.id === a.id); if (ex) ex.qty += a.qty; else merged.push(a); });
    carrito = merged; guardarCarrito();
    localStorage.removeItem('gestionCubaCart');
    adminToken = data.token;
    adminLogin.style.display = 'none';
    adminPanel.style.display = 'block';
    adminTitle.textContent = 'Panel de Administración';
    adminError.style.display = 'none';
    listarProductosAdmin();
    cargarFeedbackAdmin();
    cargarPedidosAdmin();
    el('adminTabUsuariosBtn').style.display = '';
    mostrarUser(); userBtn.title = 'Administrador';
  } catch (e) { adminError.style.display = 'block'; }
});
adminPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminLoginBtn.click(); });

closeAdmin.addEventListener('click', () => { adminModal.style.display = 'none'; adminForm.style.display = 'none'; adminPanel.style.display = 'none'; adminLogin.style.display = 'block'; adminPassword.value = ''; });

newProductBtn.addEventListener('click', () => {
  editingId = null;
  adminFormTitle.textContent = 'Nuevo producto';
  saveProductBtn.textContent = 'Guardar producto';
  limpiarFormulario();
  adminPanel.style.display = 'none';
  adminForm.style.display = 'block';
});

cancelFormBtn.addEventListener('click', () => {
  adminForm.style.display = 'none';
  adminPanel.style.display = 'block';
  limpiarFormulario();
});

function limpiarFormulario() {
  adminNombre.value = ''; adminDesc.value = ''; adminCodigo.value = ''; adminEstado.value = 'disponible';
  adminPrecio.value = ''; adminPrecioAnterior.value = ''; adminVentaCantidad.checked = false; adminMoneda.value = 'CUP'; adminCategoria.value = '';
  adminTelefono.value = ''; adminProvincia.value = ''; adminMunicipio.innerHTML = '<option value="">Primero seleccioná una provincia</option>';
  uploadedImages = []; imagePreview.innerHTML = '';
  adminEnlaces.forEach(e => e.value = '');
}

function listarProductosAdmin() {
  const userProducts = currentUser?.role === 'admin' ? productos : productos.filter(p => p.userId === currentUser?.id);
  if (!userProducts.length) { adminProductList.innerHTML = '<p>No hay productos.</p>'; return; }
  adminProductList.innerHTML = userProducts.map(p => {
    const img = (p.imagenes && p.imagenes[0]) || p.imagenBase64 || '';
    return `<div class="admin-product-item">
      <img src="${img || 'icon.svg'}" alt="${p.nombre}" loading="lazy">
      <div class="item-info"><h4>${p.nombre}</h4><p>${p.provincia}${p.categoria ? ' | ' + p.categoria : ''}</p></div>
      <div class="item-actions">
        <button onclick="editarProducto('${p.id}')" style="background:var(--green);color:#fff">Editar</button>
        <button onclick="eliminarProducto('${p.id}')" style="background:var(--red);color:#fff">Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

function editarProducto(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  adminFormTitle.textContent = 'Editar producto';
  saveProductBtn.textContent = 'Actualizar producto';
  adminNombre.value = p.nombre;
  adminDesc.value = p.descripcion;
  adminCodigo.value = p.codigo || '';
  adminEstado.value = p.estado || 'disponible';
  adminPrecio.value = p.precio !== null ? p.precio : '';
  adminPrecioAnterior.value = p.precioAnterior || '';
  adminVentaCantidad.checked = p.ventaCantidad || false;
  adminMoneda.value = p.moneda || 'CUP';
  adminCategoria.value = p.categoria || '';
  adminTelefono.value = p.telefono || '';
  adminProvincia.value = p.provincia || '';
  actualizarMunicipiosAdmin();
  if (p.municipio) adminMunicipio.value = p.municipio;
  const enlaces = document.querySelectorAll('.adminEnlace');
  (p.enlaces || []).forEach((e, i) => { if (enlaces[i]) enlaces[i].value = e; });
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : (p.imagenBase64 ? [p.imagenBase64] : []);
  uploadedImages = imagenes.map(img => {
    const sizeEst = Math.round((img.length * 3) / 4 / 1024);
    return { src: img, size: sizeEst };
  });
  renderPreviewImages();
  adminPanel.style.display = 'none';
  adminForm.style.display = 'block';
}

function eliminarProducto(id) {
  if (!confirm('Eliminar este producto?')) return;
    fetch(`/api/productos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` } })
    .then(() => {
      cargarProductos();
      listarProductosAdmin();
      mostrarToast('Producto eliminado');
    }).catch(() => mostrarToast('Error al eliminar'));
}

dropZone.addEventListener('click', () => adminImagenes.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) manejarArchivos(e.dataTransfer.files); });
adminImagenes.addEventListener('change', () => { if (adminImagenes.files.length) manejarArchivos(adminImagenes.files); adminImagenes.value = ''; });

function manejarArchivos(files) {
  Array.from(files).forEach(file => comprimirImagen(file, (src, size) => {
    uploadedImages.push({ src, size });
    renderPreviewImages();
  }));
}

function comprimirImagen(file, callback) {
  if (!file.type.startsWith('image/')) return;
  if (file.type === 'image/png') {
    const reader = new FileReader();
    reader.onload = (e) => { callback(e.target.result, Math.round(file.size / 1024)); };
    reader.readAsDataURL(file);
    return;
  }
  const img = new Image();
  img.onload = () => {
    let w = img.width, h = img.height;
    const maxDim = 1200;
    if (w > maxDim || h > maxDim) {
      if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
      else { w = Math.round(w * maxDim / h); h = maxDim; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const src = canvas.toDataURL('image/jpeg', 0.8);
    const size = Math.round((src.length * 3) / 4 / 1024);
    callback(src, size);
  };
  const reader = new FileReader();
  reader.onload = (e) => { img.src = e.target.result; };
  reader.readAsDataURL(file);
}

function renderPreviewImages() {
  imagePreview.innerHTML = uploadedImages.map((img, i) =>
    `<div class="preview-item">
      <img src="${img.src}" alt="Preview ${i+1}">
      <div class="preview-size">${img.size} KB</div>
      <button class="preview-remove" onclick="eliminarImagen(${i})">x</button>
    </div>`
  ).join('');
}
function eliminarImagen(idx) {
  uploadedImages.splice(idx, 1);
  renderPreviewImages();
}

previewProductBtn.addEventListener('click', () => {
  const data = obtenerDatosFormulario();
  if (!data) return;
  const previewProduct = {
    ...data,
    id: 'preview',
    imagenes: uploadedImages.length ? uploadedImages.map(i => i.src) : [],
    createdAt: Date.now()
  };
  previewBody.innerHTML = '';
  previewBody.appendChild(crearCard(previewProduct));
  previewModal.style.display = 'flex';
});
closePreview.addEventListener('click', () => previewModal.style.display = 'none');
previewModal.addEventListener('click', (e) => { if (e.target === previewModal) previewModal.style.display = 'none'; });

function obtenerDatosFormulario() {
  const nombre = adminNombre.value.trim();
  const descripcion = adminDesc.value.trim();
  const provincia = adminProvincia.value;
  if (!nombre || !descripcion || !provincia) {
    mostrarToast('Completá nombre, descripción y provincia');
    return null;
  }
  return {
    nombre, descripcion, provincia,
    municipio: adminMunicipio.value,
    precio: adminPrecio.value !== '' ? Number(adminPrecio.value) : null,
    precioAnterior: adminPrecioAnterior.value !== '' ? Number(adminPrecioAnterior.value) : null,
    moneda: adminMoneda.value,
    categoria: adminCategoria.value,
    telefono: adminTelefono.value,
    codigo: adminCodigo.value,
    estado: adminEstado.value,
    ventaCantidad: adminVentaCantidad.checked,
    enlaces: Array.from(adminEnlaces).map(e => e.value.trim()).filter(Boolean)
  };
}

saveProductBtn.addEventListener('click', async () => {
  const data = obtenerDatosFormulario();
  if (!data) return;
  data.imagenes = uploadedImages.map(i => i.src);
  const url = editingId ? `/api/productos/${editingId}` : '/api/productos';
  const method = editingId ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` }, body: JSON.stringify(data) });
    if (!res.ok) { mostrarToast('Error al guardar'); return; }
    mostrarToast(editingId ? 'Producto actualizado' : 'Producto creado');
    adminForm.style.display = 'none';
    adminPanel.style.display = 'block';
    limpiarFormulario();
    await cargarProductos();
    listarProductosAdmin();
  } catch (e) { mostrarToast('Error al guardar'); }
});

function handleHashRoute() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  if (hash.startsWith('/producto/')) {
    const id = decodeURIComponent(hash.replace('/producto/', ''));
    setTimeout(() => { abrirModalProducto(id); }, 300);
  } else if (hash.startsWith('/carrito/')) {
    const data = decodeURIComponent(hash.replace('/carrito/', ''));
    try {
      const parts = data.split(';');
      const nuevos = [];
      parts.forEach(p => {
        const [id, qty] = p.split(',');
        if (id && qty && productos.find(x => x.id === id)) nuevos.push({ id, qty: parseInt(qty) || 1 });
      });
      if (nuevos.length) {
        setTimeout(() => mostrarPreviewCarrito(nuevos), 300);
      }
    } catch (e) { /* ignore */ }
  }
}

window.addEventListener('hashchange', handleHashRoute);

function init() {
  const savedUser = localStorage.getItem('gestionCubaUser');
  if (savedUser) { try { currentUser = JSON.parse(savedUser); userBtn.title = currentUser.nombre; } catch (_) { limpiarUser(); } }
  mostrarUser();
  const savedTheme = localStorage.getItem('gestionCubaTheme');
  const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  if (savedTheme === 'light') { document.body.classList.add('light'); document.body.classList.remove('dark'); themeToggle.innerHTML = MOON_SVG; }
  else { document.body.classList.add('dark'); document.body.classList.remove('light'); themeToggle.innerHTML = SUN_SVG; }
  cargarCarrito();
  cargarProductos().then(() => { handleHashRoute(); });
  const phrases = ['Buscar productos...', 'Busca por nombre...', 'Ej: arroz, leche...', '¿Qué necesitas?'];
  let pi = 0, ci = 0, isDeleting = false;
  function typeLoop() {
    const p = phrases[pi];
    if (!isDeleting) {
      if (ci < p.length) { ci++; searchInput.placeholder = p.substring(0, ci); setTimeout(typeLoop, 80); }
      else { isDeleting = true; setTimeout(typeLoop, 2000); }
    } else {
      if (ci > 0) { ci--; searchInput.placeholder = p.substring(0, ci); setTimeout(typeLoop, 40); }
      else { isDeleting = false; pi = (pi + 1) % phrases.length; setTimeout(typeLoop, 200); }
    }
  }
  typeLoop();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js?v=8').then(reg => {
      if (reg.active && !navigator.serviceWorker.controller) {
        reg.addEventListener('updatefound', () => {
          if (reg.installing) {
            reg.installing.addEventListener('statechange', () => {
              if (reg.installing.state === 'installed' && navigator.serviceWorker.controller) {
                reg.installing.postMessage({ action: 'skipWaiting' });
              }
            });
          }
        });
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { location.reload(); });
  }
  offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
  window.addEventListener('online', () => { offlineBanner.style.display = 'none'; location.reload(); });
  window.addEventListener('offline', () => { offlineBanner.style.display = 'block'; });
}



init();
