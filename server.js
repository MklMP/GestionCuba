const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DATA_FILE = path.join(__dirname, 'data', 'productos.json');
const FEEDBACK_FILE = path.join(__dirname, 'data', 'feedback.json');
const PEDIDOS_FILE = path.join(__dirname, 'data', 'pedidos.json');
let EMAIL_USER = process.env.EMAIL_USER || '';
let EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_TO = process.env.EMAIL_TO || 'maykelmillan96@gmail.com';
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'email-config.json'), 'utf-8'));
  if (!EMAIL_USER) EMAIL_USER = cfg.user || '';
  if (!EMAIL_PASS) EMAIL_PASS = cfg.pass || '';
} catch {};

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const USUARIOS_FILE = path.join(DATA_DIR, 'usuarios.json');
const sessions = new Map();
const pendingCodes = new Map(); // email -> { code, expires, data }

function leerUsuarios() {
  try { let d = fs.readFileSync(USUARIOS_FILE, 'utf-8'); if (d.charCodeAt(0) === 0xFEFF) d = d.slice(1); return JSON.parse(d); } catch { return []; }
}
function guardarUsuarios(u) { fs.writeFileSync(USUARIOS_FILE, JSON.stringify(u, null, 2), 'utf-8'); }

function hashPassword(pwd, salt) {
  return crypto.createHash('sha256').update(salt + pwd).digest('hex');
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No autorizado' });
  const token = header.replace('Bearer ', '');
  // Check sessions map
  const userId = sessions.get(token);
  if (userId) {
    if (userId === 'admin') {
      req.user = { id: 'admin', username: 'admin', role: 'admin' };
      return next();
    }
    const usuarios = leerUsuarios();
    const user = usuarios.find(u => u.id === userId);
    if (user && user.estado !== 'banned') {
      req.user = { id: user.id, username: user.username, role: 'user' };
      return next();
    }
    sessions.delete(token);
  }
  res.status(401).json({ error: 'No autorizado' });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function leerProductos() {
  try {
    let data = fs.readFileSync(DATA_FILE, 'utf-8');
    if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
    const productos = JSON.parse(data);
    productos.forEach((p, idx) => {
      if (!p.imagenes && p.imagenBase64) p.imagenes = [p.imagenBase64];
      if (!p.imagenes) p.imagenes = [];
      if (!p.enlaces) p.enlaces = [];
      if (!p.municipio) p.municipio = '';
      if (!p.estado) p.estado = 'disponible';
      if (!p.codigo) p.codigo = '';
      if (!p.precioAnterior && p.precioAnterior !== 0) p.precioAnterior = null;
      if (!p.createdAt) p.createdAt = Date.now() - (productos.length - 1 - idx) * 86400000;
    });
    return productos;
  } catch {
    return [];
  }
}

function guardarProductos(productos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(productos, null, 2), 'utf-8');
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No autorizado' });
  const token = header.replace('Bearer ', '');
  const userId = sessions.get(token);
  if (userId === 'admin') return next();
  if (token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'No autorizado' });
}

app.get('/api/productos', (req, res) => {
  res.json(leerProductos());
});

app.get('/api/productos/:id', (req, res) => {
  const productos = leerProductos();
  const producto = productos.find(p => p.id === req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
});

app.get('/api/productos/:id/imagen/:index', (req, res) => {
  const productos = leerProductos();
  const p = productos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).end();
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : (p.imagenBase64 ? [p.imagenBase64] : []);
  const idx = parseInt(req.params.index) || 0;
  const img = imagenes[idx];
  if (!img) return res.status(404).end();
  const mime = img.match(/^data:(image\/\w+);base64,/);
  if (!mime) return res.status(404).end();
  const base64 = img.replace(/^data:image\/\w+;base64,/, '');
  res.set('Content-Type', mime[1]);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(base64, 'base64'));
});

function sendCodeEmail(email, code, nombre, type) {
  if (!EMAIL_USER || !EMAIL_PASS) { console.error('Email no configurado, código', code, 'no enviado a', email); return; }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
  const subject = type === 'reset' ? 'Recuperación de contraseña - Gestión Cuba' : 'Código de verificación - Gestión Cuba';
  const text = type === 'reset'
    ? `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contraseña en Gestión Cuba.\n\nTu código de verificación es: ${code}\n\nEste código expira en 10 minutos.\n\nSi no solicitaste esto, ignorá este mensaje.`
    : `Hola ${nombre},\n\nGracias por registrarte en Gestión Cuba.\n\nTu código de verificación es: ${code}\n\nEste código expira en 10 minutos.\n\nIngresalo en la aplicación para completar tu registro.`;
  transporter.sendMail({ from: EMAIL_USER, to: email, subject, text })
    .then(() => console.log(`Code ${type} sent to ${email}`))
    .catch(err => console.error(`Code email error (${email}):`, err.message));
}

// Send verification code for registration
app.post('/api/auth/send-register-code', (req, res) => {
  const { username, nombre, email, telefono, password } = req.body;
  if (!username || !password || !nombre || !email) return res.status(400).json({ error: 'Todos los campos requeridos' });
  if (username.length < 3) return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  if (!/^[^\s@]+@gmail\.com$/i.test(email)) return res.status(400).json({ error: 'Debe ser un correo @gmail.com válido' });
  const usuarios = leerUsuarios();
  if (usuarios.find(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(400).json({ error: 'El usuario ya existe' });
  if (usuarios.find(u => u.email && u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'El correo ya está registrado' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingCodes.set(email.toLowerCase(), { code, expires: Date.now() + 600000, data: { username, nombre, email: email.toLowerCase(), telefono: telefono || '', password } });
  sendCodeEmail(email, code, nombre, 'verify');
  res.json({ success: true, message: 'Código enviado a tu correo Gmail.' });
});

// Verify registration code and create user
app.post('/api/auth/verify-register-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email y código requeridos' });
  const entry = pendingCodes.get(email.toLowerCase());
  if (!entry) return res.status(400).json({ error: 'No hay código pendiente. Solicita uno nuevo.' });
  if (Date.now() > entry.expires) { pendingCodes.delete(email.toLowerCase()); return res.status(400).json({ error: 'Código expirado. Solicita uno nuevo.' }); }
  if (entry.code !== code) return res.status(400).json({ error: 'Código incorrecto' });
  const { data } = entry;
  pendingCodes.delete(email.toLowerCase());
  const salt = crypto.randomBytes(8).toString('hex');
  const isAdminEmail = email.toLowerCase() === 'maykelmillan96@gmail.com';
  const user = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    username: data.username, nombre: data.nombre, email: data.email, telefono: data.telefono,
    salt, password: hashPassword(data.password, salt),
    estado: 'activo', verificado: isAdminEmail, creado: Date.now()
  };
  const usuarios = leerUsuarios();
  usuarios.push(user);
  guardarUsuarios(usuarios);
  const token = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  sessions.set(token, user.id);
  res.status(201).json({ success: true, token, user: { id: user.id, username: user.username, nombre: user.nombre, role: 'user' } });
});

// Send reset code
app.post('/api/auth/send-reset-code', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const usuarios = leerUsuarios();
  const user = usuarios.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No hay cuenta con ese correo' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingCodes.set(email.toLowerCase(), { code, expires: Date.now() + 600000, data: { userId: user.id } });
  sendCodeEmail(email, code, user.nombre, 'reset');
  res.json({ success: true, message: 'Código enviado a tu correo Gmail.' });
});

// Verify reset code and change password
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code || !password) return res.status(400).json({ error: 'Email, código y nueva contraseña requeridos' });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  const entry = pendingCodes.get(email.toLowerCase());
  if (!entry) return res.status(400).json({ error: 'No hay código pendiente. Solicita uno nuevo.' });
  if (Date.now() > entry.expires) { pendingCodes.delete(email.toLowerCase()); return res.status(400).json({ error: 'Código expirado. Solicita uno nuevo.' }); }
  if (entry.code !== code) return res.status(400).json({ error: 'Código incorrecto' });
  pendingCodes.delete(email.toLowerCase());
  const usuarios = leerUsuarios();
  const idx = usuarios.findIndex(u => u.id === entry.data.userId);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
  const salt = crypto.randomBytes(8).toString('hex');
  usuarios[idx].salt = salt;
  usuarios[idx].password = hashPassword(password, salt);
  guardarUsuarios(usuarios);
  res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  const usernameLower = username.toLowerCase();
  if (usernameLower === 'admin' || usernameLower === 'mklmillan') {
    const adminPass = usernameLower === 'mklmillan' ? 'Mkl040523*' : ADMIN_PASSWORD;
    const displayName = usernameLower === 'mklmillan' ? 'MklMillan' : 'admin';
    if (password === adminPass) {
      const token = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      sessions.set(token, 'admin');
      return res.json({ success: true, token, user: { id: 'admin', username: displayName, nombre: 'Administrador', role: 'admin' } });
    }
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const usuarios = leerUsuarios();
  const user = usuarios.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
  if (user.estado === 'banned') return res.status(403).json({ error: 'Usuario baneado' });
  if (hashPassword(password, user.salt) !== user.password) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const token = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  sessions.set(token, user.id);
  res.json({ success: true, token, user: { id: user.id, username: user.username, nombre: user.nombre, role: 'user' } });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization;
  if (header) sessions.delete(header.replace('Bearer ', ''));
  res.json({ success: true });
});

app.get('/api/usuarios', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const usuarios = leerUsuarios();
  res.json(usuarios.map(u => ({ id: u.id, username: u.username, nombre: u.nombre, email: u.email || '', telefono: u.telefono, estado: u.estado, verificado: !!u.verificado, creado: u.creado })));
});

app.put('/api/usuarios/:id/ban', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const usuarios = leerUsuarios();
  const idx = usuarios.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
  const wasBanned = usuarios[idx].estado === 'banned';
  usuarios[idx].estado = wasBanned ? 'activo' : 'banned';
  guardarUsuarios(usuarios);
  // Invalidate sessions for banned user
  for (const [tok, uid] of sessions) { if (uid === req.params.id) sessions.delete(tok); }
  // If banning, delete all user's products
  if (!wasBanned) {
    let productos = leerProductos();
    const userId = req.params.id;
    const before = productos.length;
    productos = productos.filter(p => p.userId !== userId);
    if (productos.length !== before) guardarProductos(productos);
  }
  res.json({ id: usuarios[idx].id, estado: usuarios[idx].estado });
});

app.post('/api/productos', authMiddleware, (req, res) => {
  const { nombre, descripcion, provincia, municipio, precio, moneda, categoria, telefono, imagenes, imagenBase64, enlaces, codigo, estado, precioAnterior, ventaCantidad } = req.body;
  if (!nombre || !descripcion || !provincia) {
    return res.status(400).json({ error: 'Nombre, descripción y provincia son requeridos' });
  }
  const productos = leerProductos();
  const nuevoProducto = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    userId: req.user.id, username: req.user.username,
    nombre: nombre.trim(),
    descripcion: descripcion.trim(),
    provincia: provincia.trim(),
    municipio: municipio || '',
    precio: precio !== undefined && precio !== '' ? Number(precio) : null,
    precioAnterior: precioAnterior !== undefined && precioAnterior !== '' ? Number(precioAnterior) : null,
    moneda: moneda || 'CUP',
    categoria: categoria || '',
    telefono: telefono || '',
    codigo: codigo || '',
    estado: estado || 'disponible',
    ventaCantidad: !!ventaCantidad,
    imagenes: imagenes || (imagenBase64 ? [imagenBase64] : []),
    enlaces: enlaces || [],
    createdAt: Date.now()
  };
  productos.push(nuevoProducto);
  guardarProductos(productos);
  res.status(201).json(nuevoProducto);
});

app.put('/api/productos/:id', authMiddleware, (req, res) => {
  const { nombre, descripcion, provincia, municipio, precio, moneda, categoria, telefono, imagenes, imagenBase64, enlaces, codigo, estado, precioAnterior, ventaCantidad } = req.body;
  const productos = leerProductos();
  const index = productos.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  const prod = productos[index];
  if (req.user.role !== 'admin' && prod.userId && prod.userId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes permiso para editar este producto' });
  }
  if (!nombre || !descripcion || !provincia) {
    return res.status(400).json({ error: 'Nombre, descripción y provincia son requeridos' });
  }
  const nuevasImagenes = imagenes || (imagenBase64 !== undefined ? [imagenBase64] : undefined);
  productos[index] = {
    ...prod,
    nombre: nombre.trim(),
    descripcion: descripcion.trim(),
    provincia: provincia.trim(),
    municipio: municipio !== undefined ? municipio : prod.municipio || '',
    precio: precio !== undefined && precio !== '' ? Number(precio) : null,
    precioAnterior: precioAnterior !== undefined && precioAnterior !== '' ? Number(precioAnterior) : prod.precioAnterior,
    moneda: moneda || prod.moneda || 'CUP',
    categoria: categoria || '',
    telefono: telefono || '',
    codigo: codigo !== undefined ? codigo : prod.codigo || '',
    estado: estado !== undefined ? estado : prod.estado || 'disponible',
    ventaCantidad: ventaCantidad !== undefined ? !!ventaCantidad : prod.ventaCantidad || false,
    imagenes: nuevasImagenes !== undefined ? nuevasImagenes : prod.imagenes,
    enlaces: enlaces !== undefined ? enlaces : prod.enlaces || []
  };
  guardarProductos(productos);
  res.json(productos[index]);
});

app.delete('/api/productos/:id', authMiddleware, (req, res) => {
  const productos = leerProductos();
  const index = productos.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  const prod = productos[index];
  if (req.user.role !== 'admin' && prod.userId && prod.userId !== req.user.id) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar este producto' });
  }
  const eliminado = productos.splice(index, 1);
  guardarProductos(productos);
  res.json(eliminado[0]);
});

function leerFeedback() {
  try { let d = fs.readFileSync(FEEDBACK_FILE, 'utf-8'); if (d.charCodeAt(0) === 0xFEFF) d = d.slice(1); return JSON.parse(d); } catch { return []; }
}
function guardarFeedback(data) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/feedback', adminAuth, (req, res) => {
  res.json(leerFeedback());
});

app.post('/api/feedback', (req, res) => {
  const { nombre, mensaje, producto } = req.body;
  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }
  const feedback = leerFeedback();
  feedback.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    nombre: (nombre || '').trim(),
    mensaje: mensaje.trim(),
    producto: (producto || '').trim(),
    fecha: new Date().toISOString()
  });
  guardarFeedback(feedback);
  res.status(201).json({ success: true });
});

function leerPedidos() {
  try { let d = fs.readFileSync(PEDIDOS_FILE, 'utf-8'); if (d.charCodeAt(0) === 0xFEFF) d = d.slice(1); return JSON.parse(d); } catch { return []; }
}
function guardarPedidos(data) {
  fs.writeFileSync(PEDIDOS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.post('/api/pedidos', async (req, res) => {
  const { nombre, celular, carnet, metodoPago, domicilio, direccion, items, total, moneda } = req.body;
  if (!nombre || !celular || !metodoPago) {
    return res.status(400).json({ error: 'Nombre, celular y método de pago son requeridos' });
  }
  const pedidos = leerPedidos();
  const pedido = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    nombre: nombre.trim(),
    celular: celular.trim(),
    carnet: (carnet || '').trim(),
    metodoPago,
    domicilio: !!domicilio,
    direccion: domicilio ? (direccion || '').trim() : '',
    items: items || [],
    total: total || 0,
    moneda: moneda || 'CUP',
    fecha: new Date().toISOString(),
    estado: 'pendiente'
  };
  pedidos.push(pedido);
  guardarPedidos(pedidos);
  if (EMAIL_USER && EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
      });
      const itemsList = pedido.items.map(i => `- ${i.nombre} x${i.qty}: $${i.precio} ${i.moneda || 'CUP'}`).join('\n');
      const productNames = pedido.items.map(i => i.nombre).join(', ');
      const totalsByCurrency = {};
      pedido.items.forEach(i => { const m = i.moneda || 'CUP'; totalsByCurrency[m] = (totalsByCurrency[m] || 0) + (i.precio * i.qty); });
      const totalsStr = Object.entries(totalsByCurrency).map(([m, t]) => `$${t} ${m}`).join(', ');
      const waMsg = encodeURIComponent(`Hola ${pedido.nombre}, gracias por tu pedido de: ${productNames}. Total: ${totalsStr}.`);
      // Notify admin
      await transporter.sendMail({
        from: EMAIL_USER, to: EMAIL_TO,
        subject: `Nuevo pedido de ${pedido.nombre}`,
        text: `Nuevo pedido
Nombre: ${pedido.nombre}
Celular: https://wa.me/${pedido.celular.replace(/[^0-9]/g,'')}?text=${waMsg}
Carnet: ${pedido.carnet}
Pago: ${pedido.metodoPago}
Domicilio: ${pedido.domicilio ? 'Sí - ' + pedido.direccion : 'No'}

Productos:
${itemsList}

Total: ${totalsStr}`
      });
      // Notify each seller
      const allProducts = leerProductos();
      const usuarios = leerUsuarios();
      const sellerNotified = new Set();
      for (const item of pedido.items) {
        const prod = allProducts.find(p => p.id === item.id);
        if (!prod || !prod.userId) continue;
        const seller = usuarios.find(u => u.id === prod.userId);
        if (!seller || !seller.email || sellerNotified.has(seller.id)) continue;
        sellerNotified.add(seller.id);
        const sellerItems = pedido.items.filter(i => allProducts.find(p => p.id === i.id && p.userId === seller.id));
        const sellerList = sellerItems.map(i => `- ${i.nombre} x${i.qty}: $${i.precio} ${i.moneda || 'CUP'}`).join('\n');
        const sellerWaMsg = encodeURIComponent(`Hola, te han comprado: ${sellerItems.map(i => i.nombre).join(', ')}. Contacta al comprador: ${pedido.nombre} - WhatsApp: ${pedido.celular}`);
        const waLink = `https://wa.me/${pedido.celular.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(`Hola ${pedido.nombre}, soy ${seller.nombre}, vi tu pedido de ${sellerItems.map(i => i.nombre).join(', ')}.`)}`;
        transporter.sendMail({
          from: EMAIL_USER, to: seller.email,
          subject: `Vendiste: ${sellerItems.map(i => i.nombre).join(', ')} - Gestion Cuba`,
          text: `Hola ${seller.nombre},

Te compraron los siguientes productos:
${sellerList}

Comprador: ${pedido.nombre}
Celular: ${pedido.celular}
WhatsApp del comprador: ${waLink}
Pago: ${pedido.metodoPago}
${pedido.domicilio ? `Domicilio: ${pedido.direccion}` : ''}

Gracias por usar Gestion Cuba.`
        }).then(() => console.log('Seller notified:', seller.email)).catch(err => console.error('Seller email error:', err.message));
      }
      console.log('Email enviado correctamente');
    } catch (err) { console.error('Error al enviar email:', err.message); }
  } else {
    console.log('Nuevo pedido:', JSON.stringify(pedido, null, 2));
  }
  res.status(201).json(pedido);
});

app.get('/api/pedidos', adminAuth, (req, res) => {
  const pedidos = leerPedidos();
  pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  res.json(pedidos);
});

app.put('/api/pedidos/:id', adminAuth, (req, res) => {
  const pedidos = leerPedidos();
  const idx = pedidos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (req.body.estado) pedidos[idx].estado = req.body.estado;
  guardarPedidos(pedidos);
  res.json(pedidos[idx]);
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

app.get('/producto/:id', (req, res) => {
  const productos = leerProductos();
  const p = productos.find(x => x.id === req.params.id);
  if (!p) return res.redirect('/');
  const imagenes = p.imagenes && p.imagenes.length > 0 ? p.imagenes : (p.imagenBase64 ? [p.imagenBase64] : []);
  const imgUrl = imagenes[0]
    ? `${req.protocol}://${req.get('host')}/api/productos/${p.id}/imagen/0`
    : `${req.protocol}://${req.get('host')}/icon.svg`;
  const desc = (p.descripcion || '').substring(0, 200).replace(/"/g, '&quot;');
  const precio = p.precio !== null
    ? `${p.moneda === 'USD' ? '$' + Number(p.precio).toFixed(2) + ' USD' : '$' + Number(p.precio).toLocaleString('es-CU') + ' ' + (p.moneda || 'CUP')}`
    : '';
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>${p.nombre} - Gesti\u00f3n Cuba</title>
<meta property="og:title" content="${p.nombre} - Gesti\u00f3n Cuba">
<meta property="og:description" content="${desc}${precio ? ' | Precio base: ' + precio : ''}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:url" content="${req.protocol}://${req.get('host')}/producto/${p.id}">
<meta property="og:type" content="product">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2e7d32">
<meta http-equiv="refresh" content="0;url=/#/producto/${encodeURIComponent(p.id)}">
</head><body><script>location.href='/#/producto/${encodeURIComponent(p.id)}'</script></body></html>`);
});

app.get('/sitemap.xml', (req, res) => {
  const productos = leerProductos();
  const base = 'https://gestioncuba.com';
  let urls = `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  productos.forEach(p => {
    urls += `<url><loc>${base}/producto/${p.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  });
  res.set('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://gestioncuba.com/sitemap.xml');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const os = require('os');
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Accesible desde la red en http://${getLocalIP()}:${PORT}`);
  if (EMAIL_USER && EMAIL_PASS) {
    setTimeout(async () => {
      try {
        const testTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 465, secure: true,
          auth: { user: EMAIL_USER, pass: EMAIL_PASS },
          connectionTimeout: 5000
        });
        await testTransporter.verify();
        console.log(`Email configurado y conectado: ${EMAIL_TO}`);
      } catch (e) {
        console.error(`Email NO conectado - ${e.message}`);
      }
    }, 100);
  } else {
    console.log('Email NO configurado - los pedidos solo se guardan localmente');
  }
});
