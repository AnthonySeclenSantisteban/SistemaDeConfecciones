let _todosProductos = [];
let _productoActual = null;
let _varianteActual = null;
let _carrito = [];
let _metodoPago = 'yape';
let _metodosPagoEmpresa = [];
let _pasoActual = 1;

const EMOJIS_CATEGORIA = {
    'polo': '👕', 'camisa': '👔', 'blusa': '👗',
    'pantalón': '👖', 'falda': '🩱', 'short': '🩳',
    'buzo': '🧥', 'chompa': '🧶', 'casaca': '🧥',
    'accesorios': '🎀', 'corbata': '👔', 'cinturón': '👜'
};

function _emojiCategoria(categoria) {
    if (!categoria) return '🎽';
    const k = categoria.toLowerCase();
    for (const [key, emoji] of Object.entries(EMOJIS_CATEGORIA)) {
        if (k.includes(key)) return emoji;
    }
    return '🎽';
}


document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    cargarMetodosPago();
    cargarLogoYSliders();
    initEventListeners();
    initCarritoLocal();
});

/* ── CARGAR PRODUCTOS ── */
async function cargarProductos() {
    try {
        const res = await fetch('/api/catalogo/productos');
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);

        _todosProductos = json.data;
        poblarFiltros(_todosProductos);
        renderProductos(_todosProductos);
    } catch (err) {
        console.error('Error cargando productos:', err);
        document.getElementById('productosGrid').innerHTML =
            `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#64748b;">
                Error al cargar productos. Intenta recargar la página.
             </div>`;
    }
}

async function cargarMetodosPago() {
    try {
        const res = await fetch('/api/metodos-pago');
        const json = await res.json();
        if (json.ok) _metodosPagoEmpresa = json.data;
    } catch (err) { console.error('Error metodos pago:', err); }
}

/* ── POBLAR FILTROS ── */
function poblarFiltros(productos) {
    const selectColegio = document.getElementById('filtroColegio');
    const selectCategoria = document.getElementById('filtroCategoria');

    const colegios = [...new Set(productos.map(p => p.nombre_colegio).filter(Boolean))].sort();
    const categorias = [...new Set(productos.map(p => p.categoria_nombre).filter(Boolean))].sort();

    colegios.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        selectColegio.appendChild(opt);
    });

    categorias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        selectCategoria.appendChild(opt);
    });
}

/* ── RENDER PRODUCTOS ── */
function renderProductos(productos) {
    const grid = document.getElementById('productosGrid');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('resultadoCount');

    count.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''}`;

    if (!productos.length) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = productos.map(p => tarjetaProducto(p)).join('');

    // Animación escalonada
    grid.querySelectorAll('.producto-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'opacity .4s ease, transform .4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, i * 60);
    });
}

function tarjetaProducto(p) {
    const emoji = _emojiCategoria(p.categoria_nombre);
    const variantes = p.variantes || [];
    const hayStock = variantes.some(v => v.stock > 0);
    const tieneImagenes = p.imagenes && p.imagenes.length > 0;

    const badgeGenero = p.genero
        ? `<span class="badge badge-${p.genero === 'masculino' ? 'masc' : p.genero === 'femenino' ? 'fem' : 'uni'}">${p.genero === 'masculino' ? 'Niños' : p.genero === 'femenino' ? 'Niñas' : 'Unisex'}</span>`
        : '';
    const badgeColegio = p.nombre_colegio
        ? `<span class="badge badge-col">${p.nombre_colegio}</span>`
        : '';

    const imgPrincipal = tieneImagenes
        ? `<img class="card-img-principal" src="${p.imagenes[0]}" alt="${p.nombre_producto}" loading="lazy" onerror="this.style.display='none'">`
        : '';
    const imgHover = tieneImagenes && p.imagenes.length > 1
        ? `<img class="card-img-hover" src="${p.imagenes[1]}" alt="${p.nombre_producto}" loading="lazy" onerror="this.style.display='none'">`
        : '';

    return `
    <div class="producto-card" data-id="${p.id_producto}" onclick="abrirDetalle(${p.id_producto})">
        <div class="card-imagen">
            ${imgPrincipal}
            ${imgHover}
            ${!tieneImagenes ? `<div class="card-emoji">${emoji}</div>` : ''}
            <div class="card-badges">
                ${badgeGenero}
                ${badgeColegio}
            </div>
            <button class="card-quick-add" onclick="event.stopPropagation();agregarRapido(${p.id_producto})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar al carrito
            </button>
        </div>
        <div class="card-body">
            ${p.nombre_colegio ? `<div class="card-colegio">${p.nombre_colegio}</div>` : ''}
            <div class="card-nombre">${p.nombre_producto}</div>
            ${p.categoria_nombre ? `<div class="card-categoria">${p.categoria_nombre}</div>` : ''}
            <div class="card-precio">S/ ${parseFloat(p.precio_venta).toFixed(2)}</div>
        </div>
        <div class="card-footer">
            <button class="btn-card-ver" onclick="event.stopPropagation();abrirDetalle(${p.id_producto})">
                Ver detalle
            </button>
        </div>
    </div>`;
}

/* ── FILTROS ── */
function aplicarFiltros() {
    const genero = document.querySelector('.chip.active')?.dataset.genero || '';
    const colegio = document.getElementById('filtroColegio').value;
    const categoria = document.getElementById('filtroCategoria').value;
    const busqueda = document.getElementById('inputBuscar')?.value?.toLowerCase().trim() || '';

    let filtrados = _todosProductos.filter(p => {
        const matchGenero = !genero || p.genero === genero;
        const matchColegio = !colegio || p.nombre_colegio === colegio;
        const matchCat = !categoria || p.categoria_nombre === categoria;
        const matchBusq = !busqueda ||
            p.nombre_producto.toLowerCase().includes(busqueda) ||
            (p.nombre_colegio || '').toLowerCase().includes(busqueda) ||
            (p.categoria_nombre || '').toLowerCase().includes(busqueda);
        return matchGenero && matchColegio && matchCat && matchBusq;
    });

    renderProductos(filtrados);
}

function limpiarFiltros() {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-genero=""]').classList.add('active');
    document.getElementById('filtroColegio').value = '';
    document.getElementById('filtroCategoria').value = '';
    if (document.getElementById('inputBuscar')) document.getElementById('inputBuscar').value = '';
    aplicarFiltros();
}

function filtrarPorColegio(colegio) {
    document.getElementById('filtroColegio').value = colegio;
    document.getElementById('seccionCatalogo').scrollIntoView({ behavior: 'smooth' });
    aplicarFiltros();
}

/* ── MODAL DETALLE ── */
async function abrirDetalle(id) {
    const producto = _todosProductos.find(p => p.id_producto === id);
    if (!producto) return;

    _productoActual = producto;
    _varianteActual = null;

    // Mostrar modal
    abrirModal('modalDetalle');

    // Galería
    const galeria = document.getElementById('galeriaPrincipal');
    if (producto.imagenes && producto.imagenes.length > 0) {
        galeria.innerHTML = `<img class="galeria-img" src="${producto.imagenes[0]}" alt="${producto.nombre_producto}" onerror="this.style.display='none'">`;
    } else {
        document.getElementById('galeriaEmoji').textContent = _emojiCategoria(producto.categoria_nombre);
        galeria.innerHTML = `<div class="galeria-emoji">${_emojiCategoria(producto.categoria_nombre)}</div>`;
    }

    // Info
    document.getElementById('detalleNombre').textContent = producto.nombre_producto;
    document.getElementById('detalleColegio').textContent = producto.nombre_colegio || '';
    document.getElementById('detallePrecio').textContent = `S/ ${parseFloat(producto.precio_venta).toFixed(2)}`;
    document.getElementById('detalleDesc').textContent = producto.descripcion || '';

    // Badges
    const badges = [];
    if (producto.genero) {
        const g = producto.genero;
        badges.push(`<span class="badge badge-${g === 'masculino' ? 'masc' : g === 'femenino' ? 'fem' : 'uni'}">${g === 'masculino' ? 'Niños' : g === 'femenino' ? 'Niñas' : 'Unisex'}</span>`);
    }
    if (producto.nombre_colegio) badges.push(`<span class="badge badge-col">${producto.nombre_colegio}</span>`);
    if (producto.categoria_nombre) badges.push(`<span class="badge" style="background:#f1f5f9;color:#64748b;">${producto.categoria_nombre}</span>`);
    document.getElementById('detalleBadges').innerHTML = badges.join('');

    // Variantes
    const variantes = producto.variantes || [];
    const varWrap = document.getElementById('detalleVariantesWrap');
    const varChips = document.getElementById('variantesChips');

    if (variantes.length > 0) {
        varWrap.style.display = 'block';
        varChips.innerHTML = variantes.map(v => {
            const label = [v.talla, v.color].filter(Boolean).join(' / ');
            return `<button class="variante-chip ${v.stock <= 0 ? 'sin-stock' : ''}"
                data-variante='${JSON.stringify(v)}'
                onclick="seleccionarVariante(this)"
                ${v.stock <= 0 ? 'disabled' : ''}>
                ${label || 'Estándar'}
                ${v.stock <= 0 ? ' (sin stock)' : ''}
            </button>`;
        }).join('');

        // Seleccionar primera variante con stock
        const primera = variantes.find(v => v.stock > 0);
        if (primera) {
            setTimeout(() => {
                const firstBtn = varChips.querySelector('.variante-chip:not(.sin-stock)');
                if (firstBtn) { firstBtn.click(); }
            }, 50);
        }
    } else {
        varWrap.style.display = 'none';
        document.getElementById('detalleStock').innerHTML = '<span class="stock-ok">✓ Disponible</span>';
    }

    document.getElementById('inputCantidad').value = 1;

    // Recomendaciones
    cargarRecomendaciones(producto);
}

function seleccionarVariante(btn) {
    document.querySelectorAll('.variante-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    try {
        _varianteActual = JSON.parse(btn.dataset.variante);
    } catch { _varianteActual = null; }

    if (_varianteActual) {
        const stock = parseInt(_varianteActual.stock);
        const stockEl = document.getElementById('detalleStock');
        if (stock <= 0) {
            stockEl.innerHTML = '<span class="stock-cero">✗ Sin stock</span>';
            document.getElementById('btnAgregarDetalle').disabled = true;
        } else if (stock <= 5) {
            stockEl.innerHTML = `<span class="stock-bajo">⚠ Solo ${stock} disponibles</span>`;
            document.getElementById('btnAgregarDetalle').disabled = false;
        } else {
            stockEl.innerHTML = `<span class="stock-ok">✓ ${stock} en stock</span>`;
            document.getElementById('btnAgregarDetalle').disabled = false;
        }
    }
}

function cargarRecomendaciones(producto) {
    const recom = _todosProductos
        .filter(p => p.id_producto !== producto.id_producto &&
            (p.nombre_colegio === producto.nombre_colegio || p.categoria_nombre === producto.categoria_nombre))
        .slice(0, 6);

    const grid = document.getElementById('recomGrid');
    if (!recom.length) {
        grid.parentElement.style.display = 'none';
        return;
    }
    grid.parentElement.style.display = 'block';
    grid.innerHTML = recom.map(p => `
        <div class="recom-card" onclick="abrirDetalle(${p.id_producto})">
            <div class="recom-img">
                ${p.imagenes && p.imagenes[0]
                    ? `<img src="${p.imagenes[0]}" alt="${p.nombre_producto}" loading="lazy">`
                    : _emojiCategoria(p.categoria_nombre)}
            </div>
            <div class="recom-info">
                <div class="recom-nombre">${p.nombre_producto}</div>
                <div class="recom-precio">S/ ${parseFloat(p.precio_venta).toFixed(2)}</div>
            </div>
        </div>`).join('');
}

/* ── AGREGAR AL CARRITO ── */
function agregarRapido(id) {
    const producto = _todosProductos.find(p => p.id_producto === id);
    if (!producto) return;

    const variantes = producto.variantes || [];
    if (variantes.length === 0) {
        // Sin variantes, agregar directamente
        agregarAlCarrito(producto, null, 1);
    } else {
        // Abrir detalle para seleccionar variante
        abrirDetalle(id);
    }
}

document.addEventListener('click', function(e) {
    if (e.target.id === 'btnAgregarDetalle' || e.target.closest('#btnAgregarDetalle')) {
        if (!_productoActual) return;
        const cantidad = parseInt(document.getElementById('inputCantidad').value) || 1;
        const variantes = _productoActual.variantes || [];

        if (variantes.length > 0 && !_varianteActual) {
            mostrarToast('Selecciona una talla/presentación', 'warning');
            return;
        }

        agregarAlCarrito(_productoActual, _varianteActual, cantidad);
        cerrarModal('modalDetalle');
        abrirCarrito();
    }
});

function agregarAlCarrito(producto, variante, cantidad) {
    const key = `${producto.id_producto}-${variante?.id_variante || 'null'}`;
    const existente = _carrito.findIndex(i => i.key === key);

    if (existente >= 0) {
        _carrito[existente].cantidad += cantidad;
    } else {
        _carrito.push({
            key,
            id_producto: producto.id_producto,
            id_variante: variante?.id_variante || null,
            nombre: producto.nombre_producto,
            colegio: producto.nombre_colegio || '',
            talla: variante?.talla || '',
            color: variante?.color || '',
            precio: parseFloat(producto.precio_venta),
            cantidad,
            imagen: producto.imagenes?.[0] || null,
            emoji: _emojiCategoria(producto.categoria_nombre)
        });
    }

    guardarCarritoLocal();
    actualizarBadgeCarrito();
    renderCarritoDrawer();
    mostrarToast(`${producto.nombre_producto} agregado al carrito`, 'success');
}

/* ── CARRITO ── */
function renderCarritoDrawer() {
    const itemsEl = document.getElementById('carritoItems');
    const footer = document.getElementById('carritoFooter');
    const vacioel = document.getElementById('carritoVacio');

    if (!_carrito.length) {
        vacioel.style.display = 'block';
        footer.style.display = 'none';
        itemsEl.innerHTML = '';
        itemsEl.appendChild(vacioel);
        return;
    }

    vacioel.style.display = 'none';
    footer.style.display = 'block';

    itemsEl.innerHTML = _carrito.map((item, idx) => `
        <div class="carrito-item">
            <div class="item-icono">
                ${item.imagen
                    ? `<img src="${item.imagen}" alt="${item.nombre}" loading="lazy">`
                    : item.emoji}
            </div>
            <div class="item-info">
                <div class="item-nombre">${item.nombre}</div>
                <div class="item-detalle">${[item.talla, item.color].filter(Boolean).join(' · ') || 'Estándar'}</div>
                <div class="item-precio">S/ ${(item.precio * item.cantidad).toFixed(2)}</div>
                <div class="item-controles">
                    <button onclick="cambiarCantidadCarrito(${idx}, -1)">−</button>
                    <span>${item.cantidad}</span>
                    <button onclick="cambiarCantidadCarrito(${idx}, 1)">+</button>
                </div>
            </div>
            <button class="item-eliminar" onclick="eliminarDeCarrito(${idx})" title="Eliminar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
        </div>`).join('');

    const total = _carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    document.getElementById('carritoTotal').textContent = `S/ ${total.toFixed(2)}`;
}

function cambiarCantidadCarrito(idx, delta) {
    _carrito[idx].cantidad += delta;
    if (_carrito[idx].cantidad <= 0) _carrito.splice(idx, 1);
    guardarCarritoLocal();
    actualizarBadgeCarrito();
    renderCarritoDrawer();
}

function eliminarDeCarrito(idx) {
    _carrito.splice(idx, 1);
    guardarCarritoLocal();
    actualizarBadgeCarrito();
    renderCarritoDrawer();
}

function actualizarBadgeCarrito() {
    const total = _carrito.reduce((s, i) => s + i.cantidad, 0);
    const badge = document.getElementById('carritoBadge');
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
}

function guardarCarritoLocal() {
    try { sessionStorage.setItem('lix_carrito', JSON.stringify(_carrito)); } catch {}
}

function initCarritoLocal() {
    try {
        const saved = sessionStorage.getItem('lix_carrito');
        if (saved) { _carrito = JSON.parse(saved); actualizarBadgeCarrito(); }
    } catch {}
}

/* ── CHECKOUT ── */
function irPaso(n) {
    // Validar paso actual
    if (n === 2) {
        const nombres = document.getElementById('chkNombres').value.trim();
        const telefono = document.getElementById('chkTelefono').value.trim();
        if (!nombres) { mostrarToast('Ingresa tu nombre', 'error'); return; }
        if (!telefono || telefono.length < 9) { mostrarToast('Ingresa un teléfono válido', 'error'); return; }
    }
    if (n === 3) {
        const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked')?.value;
        if (tipoEntrega === 'delivery') {
            const direccion = document.getElementById('chkDireccion').value.trim();
            if (!direccion) { mostrarToast('Ingresa tu dirección', 'error'); return; }
        }
        renderResumenMini();
        renderPanelPago(_metodoPago);
    }

    _pasoActual = n;

    // Mostrar/ocultar pasos
    [1, 2, 3].forEach(i => {
        document.getElementById(`paso${i}`).style.display = i === n ? 'block' : 'none';
    });

    // Actualizar indicadores
    document.querySelectorAll('.checkout-pasos .paso').forEach((el, i) => {
        el.classList.remove('active', 'done');
        if (i + 1 === n) el.classList.add('active');
        if (i + 1 < n) el.classList.add('done');
    });
}

function renderResumenMini() {
    const total = _carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    document.getElementById('resumenMini').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:var(--gris);font-size:.85rem;">${_carrito.length} producto${_carrito.length !== 1 ? 's' : ''}</span>
            <div class="resumen-mini-total">S/ ${total.toFixed(2)}</div>
        </div>`;
}

function renderPanelPago(metodo) {
    const panel = document.getElementById('panelPago');
    const comprobanteWrap = document.getElementById('comprobanteWrap');
    const total = _carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

    const metodoData = _metodosPagoEmpresa.find(m => m.tipo === metodo);

    if (metodo === 'yape' || metodo === 'plin') {
        panel.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;">
                <div style="font-size:3rem;">${metodo === 'yape' ? '💜' : '💙'}</div>
                <div>
                    <div class="panel-numero">${metodoData?.numero_telefono || '945 952 450'}</div>
                    <div class="panel-titular">${metodoData?.nombre_titular || 'Confecciones Lix'}</div>
                    <div style="font-size:.82rem;color:var(--gris);margin-top:.3rem;">Monto a pagar: <strong style="color:var(--accent);">S/ ${total.toFixed(2)}</strong></div>
                </div>
            </div>
            <div style="background:#fff8e1;border-radius:8px;padding:.6rem .8rem;margin-top:.8rem;font-size:.8rem;color:#92400e;">
                📸 Envíanos el comprobante por WhatsApp después de pagar
            </div>`;
        comprobanteWrap.style.display = 'block';
    } else if (metodo === 'transferencia') {
        panel.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;">
                <div style="font-size:2.5rem;">🏦</div>
                <div>
                    <div style="font-size:.78rem;color:var(--gris);text-transform:uppercase;letter-spacing:.05em;">Banco BCP</div>
                    <div class="panel-numero">${metodoData?.numero_cuenta || '305-98113774-0-08'}</div>
                    <div class="panel-titular">${metodoData?.nombre_titular || 'Confecciones Lix'}</div>
                    <div style="font-size:.82rem;color:var(--gris);margin-top:.3rem;">Monto: <strong style="color:var(--accent);">S/ ${total.toFixed(2)}</strong></div>
                </div>
            </div>`;
        comprobanteWrap.style.display = 'block';
    } else if (metodo === 'efectivo') {
        panel.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;">
                <div style="font-size:2.5rem;">💵</div>
                <div>
                    <div style="font-weight:700;color:var(--text);">Pago contra entrega</div>
                    <div style="font-size:.85rem;color:var(--gris);margin-top:.3rem;">Paga al recoger o al recibir tu pedido</div>
                    <div style="font-size:.82rem;margin-top:.3rem;">Total: <strong style="color:var(--accent);">S/ ${total.toFixed(2)}</strong></div>
                </div>
            </div>`;
        comprobanteWrap.style.display = 'none';
    }
}

async function confirmarPedido() {
    const nombres = document.getElementById('chkNombres').value.trim();
    const apellidos = document.getElementById('chkApellidos').value.trim();
    const telefono = document.getElementById('chkTelefono').value.trim();
    const dni = document.getElementById('chkDni').value.trim();
    const correo = document.getElementById('chkCorreo').value.trim();
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked')?.value || 'recojo_tienda';
    const direccion = document.getElementById('chkDireccion').value.trim();
    const distrito = document.getElementById('chkDistrito').value.trim();
    const referencia = document.getElementById('chkReferencia').value.trim();
    const tipoDoc = document.querySelector('input[name="tipoDoc"]:checked')?.value || 'nota_venta';
    const numOp = document.getElementById('chkNumOp').value.trim();

    const alertEl = document.getElementById('alertCheckout');
    alertEl.style.display = 'none';

    if (!_carrito.length) { mostrarAlertCheckout('El carrito está vacío'); return; }

    const btn = document.getElementById('btnConfirmarPedido');
    btn.disabled = true;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Procesando...';

    try {
        const total = _carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombres, apellidos, telefono, correo: correo || null,
                direccion: tipoEntrega === 'delivery' ? direccion : '',
                distrito: tipoEntrega === 'delivery' ? distrito : '',
                referencia: tipoEntrega === 'delivery' ? referencia : '',
                tipo_entrega: tipoEntrega,
                tipo_documento: tipoDoc,
                metodo_pago: _metodoPago,
                numero_operacion: numOp || null,
                fecha_operacion: new Date().toISOString(),
                monto_confirmado: total.toFixed(2)
            })
        });

        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);

        // Éxito
        cerrarModal('modalCheckout');
        mostrarConfirmacion(json, nombres, tipoEntrega);
        _carrito = [];
        guardarCarritoLocal();
        actualizarBadgeCarrito();
        renderCarritoDrawer();

    } catch (err) {
        mostrarAlertCheckout(err.message || 'Error al procesar el pedido');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Confirmar pedido';
    }
}

function mostrarAlertCheckout(msg) {
    const el = document.getElementById('alertCheckout');
    el.textContent = msg;
    el.style.display = 'block';
}

function mostrarConfirmacion(data, nombres, tipoEntrega) {
    document.getElementById('confirmacionDatos').innerHTML = `
        <div class="conf-fila"><span>Cliente</span><strong>${nombres}</strong></div>
        <div class="conf-fila"><span>N° Venta</span><strong>${data.numero_venta}</strong></div>
        <div class="conf-fila"><span>Código seguimiento</span><strong>${data.codigo_seguimiento}</strong></div>
        <div class="conf-fila"><span>Total</span><strong>S/ ${parseFloat(data.total).toFixed(2)}</strong></div>
        <div class="conf-fila"><span>Entrega</span><strong>${tipoEntrega === 'delivery' ? '🚗 Delivery' : '🏪 Recojo en tienda'}</strong></div>`;

    const msg = encodeURIComponent(`Hola! Acabo de realizar mi pedido en Confecciones Lix.\n*N° Venta:* ${data.numero_venta}\n*Código:* ${data.codigo_seguimiento}\n*Total:* S/ ${parseFloat(data.total).toFixed(2)}`);
    document.getElementById('btnWaConfirm').href = `https://wa.me/51945952450?text=${msg}`;

    abrirModal('modalConfirmacion');
}

function cerrarConfirmacion() {
    cerrarModal('modalConfirmacion');
}

/* ── SEGUIMIENTO ── */
function abrirSeguimiento() {
    abrirModal('modalSeguimiento');
}

async function buscarSeguimiento() {
    const codigo = document.getElementById('inputSeguimiento').value.trim();
    const resultado = document.getElementById('resultadoSeguimiento');

    if (!codigo) { resultado.innerHTML = '<p style="color:#dc2626;font-size:.85rem;">Ingresa un código de seguimiento</p>'; return; }

    resultado.innerHTML = '<p style="color:#64748b;font-size:.85rem;">Buscando...</p>';

    try {
        const res = await fetch(`/api/seguimiento/${codigo}`);
        const json = await res.json();

        if (!json.ok) {
            resultado.innerHTML = '<div style="color:#dc2626;font-size:.88rem;">Pedido no encontrado. Verifica el código.</div>';
            return;
        }

        const d = json.data;
        const estadoClase = `estado-${d.estado || 'pendiente'}`;
        resultado.innerHTML = `
            <div class="seg-card">
                <div class="seg-fila"><span>Código</span><span>${d.codigo_seguimiento}</span></div>
                <div class="seg-fila"><span>Estado</span><span class="estado-seg ${estadoClase}">${d.estado}</span></div>
                <div class="seg-fila"><span>Total</span><span>S/ ${parseFloat(d.total).toFixed(2)}</span></div>
                <div class="seg-fila"><span>Entrega</span><span>${d.tipo_entrega === 'delivery' ? '🚗 Delivery' : '🏪 Recojo en tienda'}</span></div>
                ${d.estado_entrega ? `<div class="seg-fila"><span>Estado envío</span><span>${d.estado_entrega}</span></div>` : ''}
            </div>`;
    } catch (err) {
        resultado.innerHTML = '<div style="color:#dc2626;font-size:.88rem;">Error al buscar el pedido</div>';
    }
}

/* ── UTILS MODAL / DRAWER ── */
function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
    if (!document.querySelector('.modal-overlay.active') && !document.querySelector('.carrito-drawer.active')) {
        document.body.style.overflow = '';
    }
}

function abrirCarrito() {
    document.getElementById('carritoDrawer').classList.add('active');
    document.getElementById('carritoOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    renderCarritoDrawer();
}

function cerrarCarrito() {
    document.getElementById('carritoDrawer').classList.remove('active');
    document.getElementById('carritoOverlay').classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
        document.body.style.overflow = '';
    }
}

/* ── TOAST ── */
function mostrarToast(msg, tipo = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'toast-wrap';
        wrap.style.cssText = 'position:fixed;bottom:1.5rem;left:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
        document.body.appendChild(wrap);
    }
    const colores = { success: '#059669', error: '#dc2626', warning: '#f59e0b' };
    const t = document.createElement('div');
    t.style.cssText = `background:${colores[tipo] || colores.success};color:#fff;padding:.7rem 1.1rem;border-radius:10px;font-size:.88rem;font-weight:600;font-family:var(--font-body);box-shadow:0 4px 16px rgba(0,0,0,.2);animation:fadeIn .25s ease;max-width:280px;`;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ── EVENT LISTENERS ── */
function initEventListeners() {
    // Buscador
    document.getElementById('btnAbrirBuscar').addEventListener('click', () => {
        document.getElementById('buscadorPanel').classList.toggle('open');
        if (document.getElementById('buscadorPanel').classList.contains('open')) {
            document.getElementById('inputBuscar').focus();
        }
    });
    document.getElementById('btnCerrarBuscar').addEventListener('click', () => {
        document.getElementById('buscadorPanel').classList.remove('open');
    });
    document.getElementById('inputBuscar').addEventListener('input', aplicarFiltros);

    // Carrito
    document.getElementById('btnAbrirCarrito').addEventListener('click', abrirCarrito);
    document.getElementById('btnCerrarCarrito').addEventListener('click', cerrarCarrito);
    document.getElementById('carritoOverlay').addEventListener('click', cerrarCarrito);

    // Chips de género
    document.querySelectorAll('.chip[data-genero]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip[data-genero]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            aplicarFiltros();
        });
    });

    // Nav links colegio
    document.querySelectorAll('.nav-link[data-filtro-colegio]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const colegio = link.dataset.filtroColegio;
            document.getElementById('filtroColegio').value = colegio;
            aplicarFiltros();
            document.getElementById('seccionCatalogo').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Filtros select
    document.getElementById('filtroColegio').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroCategoria').addEventListener('change', aplicarFiltros);

    // Modal cerrar
    document.getElementById('btnCerrarDetalle').addEventListener('click', () => cerrarModal('modalDetalle'));
    document.getElementById('modalDetalle').addEventListener('click', e => { if (e.target === document.getElementById('modalDetalle')) cerrarModal('modalDetalle'); });

    // Cantidad en detalle
    document.getElementById('btnMenos').addEventListener('click', () => {
        const inp = document.getElementById('inputCantidad');
        if (parseInt(inp.value) > 1) inp.value = parseInt(inp.value) - 1;
    });
    document.getElementById('btnMas').addEventListener('click', () => {
        const inp = document.getElementById('inputCantidad');
        inp.value = parseInt(inp.value) + 1;
    });

    // Checkout
    document.getElementById('btnCheckout').addEventListener('click', () => {
        if (!_carrito.length) return;
        cerrarCarrito();
        _pasoActual = 1;
        irPaso(1);
        abrirModal('modalCheckout');
    });
    document.getElementById('btnCerrarCheckout').addEventListener('click', () => cerrarModal('modalCheckout'));
    document.getElementById('modalCheckout').addEventListener('click', e => { if (e.target === document.getElementById('modalCheckout')) cerrarModal('modalCheckout'); });

    // Métodos de pago
    document.querySelectorAll('.metodo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _metodoPago = btn.dataset.metodo;
            renderPanelPago(_metodoPago);
        });
    });

    // Tipo entrega
    document.querySelectorAll('input[name="tipoEntrega"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const esDelivery = document.getElementById('radioDelivery').checked;
            document.getElementById('deliveryCampos').style.display = esDelivery ? 'block' : 'none';
        });
    });

    // Confirmar pedido
    document.getElementById('btnConfirmarPedido').addEventListener('click', confirmarPedido);

    // Modal confirmación
    document.getElementById('modalConfirmacion').addEventListener('click', e => {
        if (e.target === document.getElementById('modalConfirmacion')) cerrarConfirmacion();
    });

    // Tecla Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            ['modalDetalle', 'modalCheckout', 'modalConfirmacion', 'modalSeguimiento'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.classList.contains('active')) cerrarModal(id);
            });
            cerrarCarrito();
        }
    });
}
async function cargarLogoYSliders() {
    try {
        const res = await fetch('/api/gestion-tienda/logos');
        const json = await res.json();
        if (json.ok && json.data.length) {
            const logoActivo = json.data.find(l => l.activo);
            if (logoActivo) {
                const brandIcon = document.querySelector('.brand-icon');
                if (brandIcon) {
                    brandIcon.innerHTML = `<img src="${logoActivo.url}" alt="Logo" style="height:40px;width:auto;object-fit:contain;">`;
                    brandIcon.style.fontSize = 'unset';
                }
            }
        }
    } catch (e) { console.error('Error cargando logo:', e); }

    try {
        const res = await fetch('/api/catalogo/slider');
        const json = await res.json();
        if (json.ok && json.data.length) {
            const hero = document.querySelector('.hero');
            if (!hero) return;

            const imgs = json.data;
            hero.style.padding = '0';
            hero.style.minHeight = '500px';
            hero.style.position = 'relative';

            hero.innerHTML = `
                <div class="slider-wrap" style="position:relative;width:100%;min-height:500px;overflow:hidden;">
                    ${imgs.map((img, i) => `
                        <div class="slide" style="position:absolute;inset:0;opacity:${i === 0 ? 1 : 0};transition:opacity .7s ease;background:#1a3c5e;">
                            <img src="${img.url_imagen}" alt="${img.titulo || 'Slider'}"
                               style="width:100%;height:500px;object-fit:cover;"
                                onerror="this.parentElement.style.background='linear-gradient(135deg,#1a3c5e,#2563a8)'">
                            ${img.titulo ? `<div style="position:absolute;bottom:2rem;left:2rem;color:#fff;font-family:var(--font-display);font-size:1.8rem;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.5);">${img.titulo}</div>` : ''}
                        </div>`).join('')}
                    ${imgs.length > 1 ? `
                    <button onclick="_sliderPrev()" style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:1.3rem;cursor:pointer;z-index:10;">‹</button>
                    <button onclick="_sliderNext()" style="position:absolute;right:1rem;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:1.3rem;cursor:pointer;z-index:10;">›</button>
                    <div style="position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);display:flex;gap:.4rem;z-index:10;">
                        ${imgs.map((_, i) => `<button onclick="_sliderIr(${i})" id="sdot-${i}" style="width:8px;height:8px;border-radius:50%;border:none;background:${i === 0 ? '#fff' : 'rgba(255,255,255,.4)'};cursor:pointer;padding:0;transition:background .3s;"></button>`).join('')}
                    </div>` : ''}
                </div>`;
            if (imgs.length > 1) {
                window._sliderIdx = 0;
                window._sliderTotal = imgs.length;
                window._sliderIr = (n) => {
                    const slides = hero.querySelectorAll('.slide');
                    const dots = hero.querySelectorAll('[id^="sdot-"]');
                    slides[window._sliderIdx].style.opacity = '0';
                    dots[window._sliderIdx].style.background = 'rgba(255,255,255,.4)';
                    window._sliderIdx = (n + window._sliderTotal) % window._sliderTotal;
                    slides[window._sliderIdx].style.opacity = '1';
                    dots[window._sliderIdx].style.background = '#fff';
                };
                window._sliderNext = () => window._sliderIr(window._sliderIdx + 1);
                window._sliderPrev = () => window._sliderIr(window._sliderIdx - 1);
                setInterval(window._sliderNext, 5000);
            }
        }
    } catch (e) { console.error('Error cargando sliders:', e); }
}

const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);