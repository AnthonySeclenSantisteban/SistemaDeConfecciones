/* ═══════════════════════════════════════════════════════
   CONFECCIONES LIX — CATÁLOGO JS
═══════════════════════════════════════════════════════ */

let todosLosProductos = [];
let metodosPago        = [];
let metodoPagoSel      = null;
let varianteSeleccionada = null;

const iconosPorCategoria = {
    'polo':      '👕', 'camisa':    '👔', 'blusa':   '👚',
    'pantalón':  '👖', 'falda':     '👗', 'short':   '🩳',
    'buzo':      '🧥', 'chompa':    '🧶', 'casaca':  '🧥',
    'corbata':   '👔', 'accesorios':'🎀', 'default': '👕'
};

function icono(categoria = '') {
    const k = categoria.toLowerCase();
    for (const key in iconosPorCategoria) {
        if (k.includes(key)) return iconosPorCategoria[key];
    }
    return iconosPorCategoria.default;
}

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    cargarFiltros();
    cargarMetodosPago();
    actualizarCarritoUI();
    cargarColegiosDropdown();
    cargarSlider();

    // Listeners filtros
    ['filtroColegio','filtroCategoria','filtroGenero'].forEach(id => {
        document.getElementById(id).addEventListener('change', aplicarFiltros);
    });
    document.getElementById('filtroBusqueda').addEventListener('input', aplicarFiltros);

    // Mostrar/ocultar campos delivery
    document.querySelectorAll('input[name="tipoEntrega"]').forEach(r =>
        r.addEventListener('change', () => {
            document.getElementById('camposDelivery').style.display =
                r.value === 'delivery' ? 'block' : 'none';
        })
    );
});


async function cargarProductos() {
    try {
        const res  = await fetch('/api/catalogo/productos');
        const data = await res.json();
        if (!data.ok) return;

        todosLosProductos = data.data;
        document.getElementById('totalProductos').textContent = todosLosProductos.length;
        renderizarProductos(todosLosProductos);
    } catch (e) {
        console.error('Error cargando productos:', e);
    }
}

async function cargarFiltros() {
    try {
        const [resCat, resCol] = await Promise.all([
            fetch('/api/catalogo/categorias'),
            fetch('/api/catalogo/colegios')
        ]);
        const dataCat = await resCat.json();
        const dataCol = await resCol.json();

        if (dataCat.ok) {
            const sel = document.getElementById('filtroCategoria');
            dataCat.data.forEach(c => {
                const o = document.createElement('option');
                o.value = c.id_categoria;
                o.textContent = c.nombre;
                sel.appendChild(o);
            });
        }
        if (dataCol.ok) {
            const sel = document.getElementById('filtroColegio');
            dataCol.data.forEach(c => {
                const o = document.createElement('option');
                o.value = c.id_colegio;
                o.textContent = c.nombre_colegio;
                sel.appendChild(o);
            });
            document.getElementById('totalColegios').textContent = dataCol.data.length;
        }
    } catch (e) { console.error(e); }
}

async function cargarMetodosPago() {
    try {
        const res  = await fetch('/api/metodos-pago');
        const data = await res.json();
        if (data.ok) {
            metodosPago = data.data;
            renderizarMetodosPago();
        }
    } catch (e) { console.error(e); }
}

// ───────────────────────────────────────────────────────
//  RENDERIZADO DE PRODUCTOS
// ───────────────────────────────────────────────────────
function renderizarProductos(lista) {
    const grid   = document.getElementById('productosGrid');
    const empty  = document.getElementById('emptyState');
    const count  = document.getElementById('resultadoCount');

    grid.innerHTML = '';
    count.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

    if (!lista.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    lista.forEach(p => {
        const tieneStock = p.variantes && p.variantes.length > 0;
        const ico = icono(p.categoria_nombre);

        const card = document.createElement('div');
        card.className = 'producto-card';
        card.innerHTML = `
            <div class="card-imagen">
                <span>${ico}</span>
                <div class="card-badges">
                    ${p.genero ? `<span class="badge-genero ${p.genero}">${p.genero}</span>` : ''}
                    ${p.nombre_colegio ? `<span class="badge-colegio">${abreviar(p.nombre_colegio)}</span>` : ''}
                </div>
            </div>
            <div class="card-body">
                <div class="card-nombre">${p.nombre_producto}</div>
                <div class="card-categoria">${p.categoria_nombre || ''}</div>
                <div class="card-precio">
                    S/ ${Number(p.precio_venta).toFixed(2)}
                    <small>/ unidad</small>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn-detalle" onclick="abrirDetalle(${p.id_producto})">Ver detalle</button>
                <button class="btn-agregar" ${!tieneStock ? 'disabled' : ''} onclick="event.stopPropagation(); abrirDetalle(${p.id_producto})">
                    ${tieneStock ? '🛒 Agregar' : 'Sin stock'}
                </button>
            </div>`;
        grid.appendChild(card);
    });
}

function abreviar(nombre) {
    if (!nombre) return '';
    return nombre.length > 12 ? nombre.substring(0, 12) + '...' : nombre;
}

// ───────────────────────────────────────────────────────
//  FILTROS
// ───────────────────────────────────────────────────────
function aplicarFiltros() {
    const colegio   = document.getElementById('filtroColegio').value;
    const categoria = document.getElementById('filtroCategoria').value;
    const genero    = document.getElementById('filtroGenero').value;
    const busqueda  = document.getElementById('filtroBusqueda').value.toLowerCase().trim();

    const filtrados = todosLosProductos.filter(p => {
        if (colegio   && String(p.id_colegio)    !== colegio)   return false;
        if (categoria && String(p.id_categoria)  !== categoria) return false;
        if (genero    && p.genero !== genero)                    return false;
        if (busqueda  && !p.nombre_producto.toLowerCase().includes(busqueda)) return false;
        return true;
    });

    renderizarProductos(filtrados);
}

function limpiarFiltros() {
    ['filtroColegio','filtroCategoria','filtroGenero'].forEach(id =>
        document.getElementById(id).value = ''
    );
    document.getElementById('filtroBusqueda').value = '';
    renderizarProductos(todosLosProductos);
}

// ───────────────────────────────────────────────────────
//  MODAL DETALLE PRODUCTO
// ───────────────────────────────────────────────────────
function abrirDetalle(id) {
    const p = todosLosProductos.find(x => x.id_producto === id);
    if (!p) return;

    varianteSeleccionada = null;
    const ico = icono(p.categoria_nombre);
    const variantes = p.variantes || [];

    // Agrupar por talla
    const tallaMap = {};
    variantes.forEach(v => {
        const k = `${v.talla || 'Sin talla'} - ${v.color}`;
        if (!tallaMap[k]) tallaMap[k] = v;
    });

    const variantesHtml = Object.values(tallaMap).map(v => {
        const label = [v.talla, v.color].filter(Boolean).join(' / ');
        return `<button class="variante-btn ${v.stock === 0 ? 'sin-stock' : ''}"
            onclick="seleccionarVariante(this, ${v.id_variante}, ${v.stock})"
            data-id="${v.id_variante}" data-stock="${v.stock}">
            ${label} ${v.stock === 0 ? '(Agotado)' : ''}
        </button>`;
    }).join('');

    const html = `
        <div class="mp-header">
            <div style="font-size:3rem;text-align:center;margin-bottom:0.8rem;">${ico}</div>
            <div class="mp-nombre">${p.nombre_producto}</div>
            ${p.nombre_colegio ? `<div class="mp-colegio">🏫 ${p.nombre_colegio}</div>` : ''}
            ${p.genero ? `<div style="margin-top:0.3rem;"><span class="badge-genero ${p.genero}">${p.genero}</span></div>` : ''}
        </div>
        <div class="mp-precio">S/ ${Number(p.precio_venta).toFixed(2)}</div>
        ${p.descripcion ? `<p class="mp-descripcion">${p.descripcion}</p>` : ''}

        ${variantes.length ? `
        <div class="mp-selector">
            <label>Talla / Color</label>
            <div class="variantes-grid">${variantesHtml}</div>
        </div>
        <div class="mp-stock sin-stock" id="mpStockInfo">Selecciona talla y color</div>
        ` : '<p style="color:#dc2626;font-size:0.88rem;">Sin stock disponible actualmente.</p>'}

        ${variantes.length ? `
        <div class="mp-cantidad">
            <label>Cantidad</label>
            <div class="cantidad-ctrl">
                <button onclick="cambiarCantidad(-1)">−</button>
                <input type="number" id="mpCantidad" value="1" min="1" max="99">
                <button onclick="cambiarCantidad(1)">+</button>
            </div>
        </div>
        <button class="btn-agregar-modal" id="btnAgregarModal"
            onclick="agregarAlCarritoDesdeModal(${p.id_producto})" disabled>
            🛒 Selecciona una variante
        </button>
        ` : ''}`;

    document.getElementById('modalProductoBody').innerHTML = html;
    document.getElementById('modalProducto').classList.add('active');
}

function seleccionarVariante(btn, idVariante, stock) {
    if (stock === 0) return;
    document.querySelectorAll('.variante-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    varianteSeleccionada = idVariante;

    const stockEl = document.getElementById('mpStockInfo');
    if (stockEl) {
        stockEl.className = `mp-stock ${stock > 0 ? '' : 'sin-stock'}`;
        stockEl.textContent = stock > 0 ? `Stock disponible: ${stock} unidades` : 'Sin stock';
    }
    const btnModal = document.getElementById('btnAgregarModal');
    if (btnModal) {
        btnModal.disabled = false;
        btnModal.textContent = '🛒 Agregar al carrito';
        btnModal.setAttribute('data-max-stock', stock);
    }
    const inputCant = document.getElementById('mpCantidad');
    if (inputCant) inputCant.max = stock;
}

function cambiarCantidad(delta) {
    const input = document.getElementById('mpCantidad');
    if (!input) return;
    let val = parseInt(input.value) + delta;
    const maxStock = parseInt(input.max) || 99;
    val = Math.max(1, Math.min(val, maxStock));
    input.value = val;
}

async function agregarAlCarritoDesdeModal(idProducto) {
    if (!varianteSeleccionada) {
        mostrarToast('⚠️ Selecciona talla y color primero', 'warn');
        return;
    }
    const cantidad = parseInt(document.getElementById('mpCantidad').value) || 1;
    await agregarAlCarrito(idProducto, varianteSeleccionada, cantidad);
    cerrarModalProductoBtn();
}

function cerrarModalProducto(e) {
    if (e.target === document.getElementById('modalProducto'))
        document.getElementById('modalProducto').classList.remove('active');
}
function cerrarModalProductoBtn() {
    document.getElementById('modalProducto').classList.remove('active');
}

// ───────────────────────────────────────────────────────
//  CARRITO
// ───────────────────────────────────────────────────────
async function agregarAlCarrito(idProducto, idVariante, cantidad = 1) {
    try {
        const res  = await fetch('/api/carrito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_producto: idProducto, id_variante: idVariante, cantidad })
        });
        const data = await res.json();
        if (data.ok) {
            mostrarToast('✅ Agregado al carrito');
            document.getElementById('badgeCarrito').textContent = data.cantidad_items;
            actualizarCarritoUI();
        } else {
            mostrarToast('⚠️ ' + data.mensaje, 'warn');
        }
    } catch (e) {
        mostrarToast('Error al agregar', 'error');
    }
}

async function actualizarCarritoUI() {
    try {
        const res  = await fetch('/api/carrito');
        const data = await res.json();
        if (!data.ok) return;

        const items  = data.data;
        const total  = data.total;
        const badge  = document.getElementById('badgeCarrito');
        badge.textContent = items.length;

        const contenedor = document.getElementById('carritoItems');
        const empty      = document.getElementById('carritoEmpty');
        const footer     = document.getElementById('carritoFooter');

        if (!items.length) {
            contenedor.innerHTML = '';
            contenedor.appendChild(empty);
            empty.style.display = 'block';
            footer.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        footer.style.display = 'block';
        document.getElementById('carritoTotal').textContent = `S/ ${total}`;

        contenedor.innerHTML = items.map((item, idx) => `
            <div class="carrito-item" id="carritoItem${idx}">
                <div class="item-icon">${icono(item.nombre)}</div>
                <div class="item-info">
                    <div class="item-nombre">${item.nombre}</div>
                    <div class="item-detalle">${[item.talla, item.color].filter(Boolean).join(' / ') || 'Sin variante'}</div>
                    <div class="item-precio">S/ ${item.subtotal}</div>
                    <div class="item-controles">
                        <button onclick="cambiarCantidadCarrito(${idx}, -1)">−</button>
                        <span>${item.cantidad}</span>
                        <button onclick="cambiarCantidadCarrito(${idx}, 1)">+</button>
                    </div>
                </div>
                <button class="item-eliminar" onclick="eliminarDelCarrito(${idx})" title="Eliminar">🗑</button>
            </div>`
        ).join('');
    } catch (e) { console.error(e); }
}

async function cambiarCantidadCarrito(idx, delta) {
    const res  = await fetch('/api/carrito');
    const data = await res.json();
    if (!data.ok) return;

    const item = data.data[idx];
    if (!item) return;
    const nuevaCant = item.cantidad + delta;
    if (nuevaCant < 1) return;

    await fetch(`/api/carrito/${idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad: nuevaCant })
    });
    actualizarCarritoUI();
}

async function eliminarDelCarrito(idx) {
    await fetch(`/api/carrito/${idx}`, { method: 'DELETE' });
    actualizarCarritoUI();
}

function abrirCarrito() {
    document.getElementById('carritoOverlay').classList.add('active');
    document.getElementById('carritoDrawer').classList.add('active');
    actualizarCarritoUI();
}

function cerrarCarrito() {
    document.getElementById('carritoOverlay').classList.remove('active');
    document.getElementById('carritoDrawer').classList.remove('active');
}

// ───────────────────────────────────────────────────────
//  CHECKOUT
// ───────────────────────────────────────────────────────
function irCheckout() {
    cerrarCarrito();
    irPaso(1);
    // Actualizar total en paso 3
    fetch('/api/carrito').then(r => r.json()).then(data => {
        document.getElementById('checkoutTotal').textContent = `S/ ${data.total}`;
        document.getElementById('montoYapePlin').textContent = `S/ ${data.total}`;
        document.getElementById('montoTransferencia').textContent = `S/ ${data.total}`;
    });
    document.getElementById('modalCheckout').classList.add('active');
}

function cerrarCheckout(e) {
    if (e.target === document.getElementById('modalCheckout'))
        document.getElementById('modalCheckout').classList.remove('active');
}

function irPaso(n) {
    [1, 2, 3].forEach(i => {
        document.getElementById(`paso${i}`).style.display    = i === n ? 'block' : 'none';
        document.getElementById(`paso${i}Tab`).classList.toggle('active', i === n);
    });

    // Validaciones al avanzar
    if (n === 2 && !validarPaso1()) return;
    if (n === 3 && !validarPaso2()) return;
}

function validarPaso1() {
    const nombres  = document.getElementById('chkNombres').value.trim();
    const telefono = document.getElementById('chkTelefono').value.trim();
    if (!nombres)  { mostrarToast('⚠️ Ingresa tu nombre', 'warn'); irPasoSin(1); return false; }
    if (!telefono || telefono.length < 9) { mostrarToast('⚠️ Ingresa un teléfono válido', 'warn'); irPasoSin(1); return false; }
    return true;
}

function validarPaso2() {
    const entrega = document.querySelector('input[name="tipoEntrega"]:checked')?.value;
    if (entrega === 'delivery') {
        const dir = document.getElementById('chkDireccion').value.trim();
        if (!dir) { mostrarToast('⚠️ Ingresa tu dirección', 'warn'); irPasoSin(2); return false; }
    }
    return true;
}

function irPasoSin(n) {
    [1, 2, 3].forEach(i => {
        document.getElementById(`paso${i}`).style.display    = i === n ? 'block' : 'none';
        document.getElementById(`paso${i}Tab`).classList.toggle('active', i === n);
    });
}

// ───────────────────────────────────────────────────────
//  MÉTODOS DE PAGO
// ───────────────────────────────────────────────────────
function renderizarMetodosPago() {
    const grid = document.getElementById('metodosPagoGrid');
    if (!grid) return;

    const iconos = { yape: '💜', plin: '💙', transferencia: '🏦', visa: '💳' };
    const labels = { yape: 'Yape', plin: 'Plin', transferencia: 'BCP', visa: 'Tarjeta Visa' };

    grid.innerHTML = metodosPago.map(m => `
        <button class="metodo-btn" onclick="seleccionarMetodoPago('${m.tipo}', this)"
            data-numero="${m.numero_telefono || ''}" data-cuenta="${m.numero_cuenta || ''}">
            <span class="metodo-icon">${iconos[m.tipo] || '💳'}</span>
            ${labels[m.tipo] || m.tipo}
        </button>
    `).join('');
}

function seleccionarMetodoPago(tipo, btn) {
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    metodoPagoSel = tipo;

    // Ocultar todos los paneles
    ['panelYapePlin','panelTransferencia','panelVisa'].forEach(id =>
        document.getElementById(id).style.display = 'none'
    );

    if (tipo === 'yape' || tipo === 'plin') {
        const numero = btn.getAttribute('data-numero') || '945952450';
        document.getElementById('numeroYapePlin').textContent = numero;
        document.getElementById('panelYapePlin').style.display = 'block';
    } else if (tipo === 'transferencia') {
        const cuenta = btn.getAttribute('data-cuenta') || '';
        document.getElementById('numeroCuenta').textContent = cuenta;
        document.getElementById('panelTransferencia').style.display = 'block';
    } else if (tipo === 'visa') {
        document.getElementById('panelVisa').style.display = 'block';
    }
}

// ───────────────────────────────────────────────────────
//  CONFIRMAR PEDIDO
// ───────────────────────────────────────────────────────
async function confirmarPedido() {
    if (!metodoPagoSel) {
        mostrarToast('⚠️ Selecciona un método de pago', 'warn'); return;
    }

    const entrega  = document.querySelector('input[name="tipoEntrega"]:checked')?.value || 'recojo_tienda';
    const tipoDoc  = document.querySelector('input[name="tipoDoc"]:checked')?.value || 'nota_venta';

    // Número de operación según método
    let nroOp = null;
    let fechaOp = null;
    if (metodoPagoSel === 'yape' || metodoPagoSel === 'plin') {
        nroOp = document.getElementById('nroOperacionYP').value.trim() || null;
    } else if (metodoPagoSel === 'transferencia') {
        nroOp  = document.getElementById('nroOperacionBCP').value.trim();
        fechaOp = document.getElementById('fechaOperacion').value;
        if (!nroOp) { mostrarToast('⚠️ Ingresa el N° de operación BCP', 'warn'); return; }
    } else if (metodoPagoSel === 'visa') {
        if (!validarVisa()) return;
        nroOp = 'VISA-SIM-' + Date.now();
    }

    const body = {
        nombres:        document.getElementById('chkNombres').value.trim(),
        apellidos:      document.getElementById('chkApellidos').value.trim(),
        telefono:       document.getElementById('chkTelefono').value.trim(),
        correo:         document.getElementById('chkCorreo').value.trim(),
        direccion:      document.getElementById('chkDireccion').value.trim(),
        distrito:       document.getElementById('chkDistrito').value.trim(),
        referencia:     document.getElementById('chkReferencia').value.trim(),
        tipo_entrega:   entrega,
        tipo_documento: tipoDoc,
        metodo_pago:    metodoPagoSel,
        numero_operacion: nroOp,
        fecha_operacion:  fechaOp
    };

    const btn = document.getElementById('btnConfirmar');
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        const res  = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.ok) {
            document.getElementById('modalCheckout').classList.remove('active');
            mostrarConfirmacion(data, body);
            actualizarCarritoUI();
        } else {
            mostrarToast('❌ ' + data.mensaje, 'error');
        }
    } catch (e) {
        mostrarToast('Error al procesar el pedido', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Confirmar pedido';
    }
}

function validarVisa() {
    const num   = document.getElementById('visaNumero').value.replace(/\s/g, '');
    const fecha = document.getElementById('visaFecha').value;
    const cvv   = document.getElementById('visaCvv').value;
    const nombre= document.getElementById('visaNombre').value.trim();
    if (num.length < 16)  { mostrarToast('⚠️ Número de tarjeta inválido', 'warn'); return false; }
    if (!fecha.match(/^\d{2}\/\d{2}$/)) { mostrarToast('⚠️ Fecha inválida (MM/AA)', 'warn'); return false; }
    if (cvv.length < 3)   { mostrarToast('⚠️ CVV inválido', 'warn'); return false; }
    if (!nombre)           { mostrarToast('⚠️ Ingresa el nombre de la tarjeta', 'warn'); return false; }
    return true;
}

function formatearTarjeta(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    input.value = val.replace(/(.{4})/g, '$1 ').trim();
}

function formatearFechaVisa(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2);
    input.value = val;
}

function mostrarConfirmacion(data, body) {
    const tipoLabel = body.tipo_documento === 'boleta' ? 'Boleta' : 'Nota de Venta';
    document.getElementById('confirmacionDatos').innerHTML = `
        <p><span>${tipoLabel}:</span> <strong>${data.numero_venta}</strong></p>
        <p><span>Código seguimiento:</span> <strong>${data.codigo_seguimiento}</strong></p>
        <p><span>Total:</span> <strong>S/ ${data.total}</strong></p>
        <p><span>Método de pago:</span> <strong>${metodoPagoSel}</strong></p>
        <p><span>Entrega:</span> <strong>${body.tipo_entrega === 'delivery' ? '🚚 Delivery' : '🏪 Recojo en tienda'}</strong></p>
    `;

    const msg = encodeURIComponent(
        `Hola! Acabo de hacer un pedido en Confecciones Lix.\n` +
        `N° ${tipoLabel}: ${data.numero_venta}\n` +
        `Total: S/ ${data.total}\n` +
        `Pago: ${metodoPagoSel}`
    );
    document.getElementById('btnWhatsapp').href = `https://wa.me/51945952450?text=${msg}`;
    document.getElementById('modalConfirmacion').classList.add('active');
}

function cerrarConfirmacion() {
    document.getElementById('modalConfirmacion').classList.remove('active');
    metodoPagoSel = null;
}

// ───────────────────────────────────────────────────────
//  SEGUIMIENTO
// ───────────────────────────────────────────────────────
function abrirModalSeguimiento() {
    document.getElementById('modalSeguimiento').classList.add('active');
}

function cerrarModalSeg(e) {
    if (e.target === document.getElementById('modalSeguimiento'))
        document.getElementById('modalSeguimiento').classList.remove('active');
}

async function rastrearPedido() {
    const codigo = document.getElementById('inputSeguimiento').value.trim();
    if (!codigo) { mostrarToast('⚠️ Ingresa el código de seguimiento', 'warn'); return; }

    const contenedor = document.getElementById('resultadoSeguimiento');
    contenedor.innerHTML = '<p style="color:#64748b;font-size:0.85rem;">Buscando...</p>';

    try {
        const res  = await fetch(`/api/seguimiento/${encodeURIComponent(codigo)}`);
        const data = await res.json();

        if (!data.ok) {
            contenedor.innerHTML = `<p style="color:#dc2626;font-size:0.85rem;">❌ ${data.mensaje}</p>`;
            return;
        }

        const p = data.data;
        contenedor.innerHTML = `
            <div class="seguimiento-card">
                <div class="seg-fila"><span>N° Venta</span><strong>${p.numero_venta || '—'}</strong></div>
                <div class="seg-fila"><span>Cliente</span><strong>${p.nombres} ${p.apellidos || ''}</strong></div>
                <div class="seg-fila"><span>Fecha</span><strong>${new Date(p.fecha_pedido).toLocaleDateString('es-PE')}</strong></div>
                <div class="seg-fila"><span>Total</span><strong>S/ ${p.total}</strong></div>
                <div class="seg-fila"><span>Pago</span><span class="estado-badge ${p.estado_pago}">${p.estado_pago || 'pendiente'}</span></div>
                <div class="seg-fila"><span>Estado pedido</span><span class="estado-badge ${p.estado}">${p.estado}</span></div>
                <div class="seg-fila"><span>Entrega</span><span class="estado-badge ${p.estado_entrega}">${p.estado_entrega || 'pendiente'}</span></div>
            </div>`;
    } catch (e) {
        contenedor.innerHTML = '<p style="color:#dc2626;">Error al consultar el pedido</p>';
    }
}

function mostrarToast(msg, tipo = 'ok') {
    const toast = document.createElement('div');
    const colores = { ok: '#059669', warn: '#f59e0b', error: '#dc2626' };
    toast.style.cssText = `
        position:fixed;bottom:5rem;left:50%;transform:translateX(-50%) translateY(20px);
        background:${colores[tipo]||colores.ok};color:#fff;padding:0.7rem 1.4rem;
        border-radius:10px;font-size:0.9rem;font-weight:600;z-index:9999;
        box-shadow:0 4px 20px rgba(0,0,0,.2);transition:all .3s;opacity:0;white-space:nowrap;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
// ── COLEGIOS EN EL DROPDOWN ──
async function cargarColegiosDropdown() {
    const res  = await fetch('/api/catalogo/colegios');
    const data = await res.json();
    if (!data.ok) return;
    const menu = document.getElementById('menuColegios');
    if (!menu) return;
    menu.innerHTML = data.data.map(c =>
        `<a onclick="filtrarPorColegio(${c.id_colegio}, '${c.nombre_colegio}')">
            <i class="ti ti-school"></i> ${c.nombre_colegio}
         </a>`
    ).join('');
}

function filtrarPorColegio(id, nombre) {
    const sel = document.getElementById('filtroColegio');
    if (sel) { sel.value = id; aplicarFiltros(); }
    // Scroll suave al catálogo
    document.querySelector('.catalogo-main')?.scrollIntoView({ behavior: 'smooth' });
}

// ── SLIDER (solo se muestra si hay imágenes en BD) ──
let sliderIndex = 0;
let sliderSlides = [];

async function cargarSlider() {
    try {
        const res  = await fetch('/api/catalogo/slider');
        const data = await res.json();
        if (!data.ok || !data.data.length) return; // oculto si no hay imágenes

        sliderSlides = data.data;
        const section = document.getElementById('sliderSection');
        const track   = document.getElementById('sliderTrack');
        const dots    = document.getElementById('sliderDots');

        section.style.display = 'block';
        track.innerHTML = sliderSlides.map(s =>
            `<img src="${s.url_imagen}" alt="${s.titulo || 'Promoción'}">`
        ).join('');
        dots.innerHTML = sliderSlides.map((_, i) =>
            `<div class="slider-dot ${i === 0 ? 'active' : ''}" onclick="irSlide(${i})"></div>`
        ).join('');

        // Auto-avance cada 5 segundos
        setInterval(() => moverSlider(1), 5000);
    } catch (e) { /* slider se queda oculto */ }
}

function moverSlider(dir) {
    sliderIndex = (sliderIndex + dir + sliderSlides.length) % sliderSlides.length;
    irSlide(sliderIndex);
}

function irSlide(idx) {
    sliderIndex = idx;
    document.getElementById('sliderTrack').style.transform = `translateX(-${idx * 100}%)`;
    document.querySelectorAll('.slider-dot').forEach((d, i) =>
        d.classList.toggle('active', i === idx)
    );
}

