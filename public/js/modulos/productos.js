let _productoGuardando = false;
let _productoEliminarId = null;
let _productosData = [];

async function cargarProductos() {
    const loading = document.getElementById('productos-loading');
    const tabla   = document.getElementById('productos-tabla');
    const empty   = document.getElementById('productos-empty');
    const total   = document.getElementById('total-productos');
    const tbody   = document.getElementById('productos-tbody');

    loading.style.display = 'flex';
    tabla.style.display   = 'none';
    empty.style.display   = 'none';

    try {
        const res  = await fetch('/api/productos');
        const json = await res.json();

        loading.style.display = 'none';

        if (!json.ok || !json.data.length) {
            empty.style.display = 'flex';
            total.textContent = '';
            return;
        }

        _productosData = json.data;
        total.textContent = `${json.data.length} registro${json.data.length !== 1 ? 's' : ''}`;
        tabla.style.display = 'block';
        _renderTabla(_productosData);
        _cargarFiltrosCategorias(_productosData);

    } catch (err) {
        loading.style.display = 'none';
        empty.style.display   = 'flex';
        console.error('cargarProductos:', err);
    }
}

function _renderTabla(data) {
    const tbody = document.getElementById('productos-tbody');
    const total = document.getElementById('total-productos');

    if (!data.length) {
        document.getElementById('productos-tabla').style.display = 'none';
        document.getElementById('productos-empty').style.display = 'flex';
        total.textContent = '0 registros';
        return;
    }

    document.getElementById('productos-tabla').style.display = 'block';
    document.getElementById('productos-empty').style.display = 'none';
    total.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''}`;

    tbody.innerHTML = data.map((p, i) => `
        <tr>
            <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">${i + 1}</td>
            <td><strong>${_esc(p.nombre_producto)}</strong></td>
            <td><span class="badge badge-blue" style="font-size:11px;">${_esc(p.categoria_nombre || '—')}</span></td>
            <td style="color:var(--muted);font-size:13px;">${_esc(p.nombre_colegio || '—')}</td>
            <td>${_badgeGenero(p.genero)}</td>
            <td style="font-family:var(--mono);font-size:12px;">S/ ${parseFloat(p.precio_costo).toFixed(2)}</td>
            <td style="font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:600;">S/ ${parseFloat(p.precio_venta).toFixed(2)}</td>
            <td>${_badgeEstado(p.estado)}</td>
            <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${_fmtFecha(p.created_at)}</td>
            <td>
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button class="btn-icon" title="Editar" data-accion="editar" data-id="${p.id_producto}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-icon-danger" title="Eliminar" data-accion="eliminar" data-id="${p.id_producto}" data-nombre="${_esc(p.nombre_producto)}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`
    ).join('');
}

function _cargarFiltrosCategorias(data) {
    const select = document.getElementById('filtro-categoria-producto');
    const actuales = [...select.options].map(o => o.value);
    const categorias = [...new Set(data.map(p => p.categoria_nombre).filter(Boolean))].sort();
    categorias.forEach(cat => {
        if (!actuales.includes(cat)) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        }
    });
}

function _aplicarFiltros() {
    const nombre = document.getElementById('filtro-nombre-producto').value.toLowerCase().trim();
    const categoria = document.getElementById('filtro-categoria-producto').value;
    const filtrado = _productosData.filter(p => {
        const matchNombre = !nombre || p.nombre_producto.toLowerCase().includes(nombre);
        const matchCat    = !categoria || p.categoria_nombre === categoria;
        return matchNombre && matchCat;
    });
    _renderTabla(filtrado);
}

async function abrirNuevoProducto() {
    _limpiarModalProducto();
    document.getElementById('modal-producto-titulo').textContent     = 'Nuevo producto';
    document.getElementById('btn-guardar-producto-text').textContent = 'Crear producto';
    await Promise.all([_cargarCategoriasSelect(), _cargarColegiosSelect()]);
    document.getElementById('modal-producto').style.display = 'flex';
}

async function abrirEditarProducto(id) {
    _limpiarModalProducto();
    document.getElementById('modal-producto-titulo').textContent     = 'Editar producto';
    document.getElementById('btn-guardar-producto-text').textContent = 'Guardar cambios';
    document.getElementById('producto-id').value = id;

    await Promise.all([_cargarCategoriasSelect(), _cargarColegiosSelect()]);

    try {
        const res  = await fetch(`/api/productos/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);
        const p = json.data;
        document.getElementById('producto-nombre').value      = p.nombre_producto;
        document.getElementById('producto-descripcion').value = p.descripcion || '';
        document.getElementById('producto-precio-costo').value = p.precio_costo;
        document.getElementById('producto-precio-venta').value = p.precio_venta;
        document.getElementById('producto-categoria').value   = p.id_categoria || '';
        document.getElementById('producto-colegio').value     = p.id_colegio || '';
        document.getElementById('producto-genero').value      = p.genero || '';
        document.getElementById('producto-estado').value      = p.estado;
    } catch (err) {
        _mostrarAlertaProducto('No se pudo cargar el producto');
    }

    document.getElementById('modal-producto').style.display = 'flex';
}

async function guardarProducto() {
    if (_productoGuardando) return;

    const id             = document.getElementById('producto-id').value;
    const nombre_producto = document.getElementById('producto-nombre').value.trim();
    const descripcion    = document.getElementById('producto-descripcion').value.trim();
    const precio_costo = document.getElementById('producto-precio-costo').value;
    const precio_venta = document.getElementById('producto-precio-venta').value;
    const id_categoria   = document.getElementById('producto-categoria').value;
    const id_colegio     = document.getElementById('producto-colegio').value;
    const genero         = document.getElementById('producto-genero').value;
    const estado         = document.getElementById('producto-estado').value;

    if (!nombre_producto) { _mostrarAlertaProducto('El nombre es requerido'); return; }
    if (!precio_costo || parseFloat(precio_costo) <= 0) { _mostrarAlertaProducto('El precio costo debe ser mayor a 0'); return; }
    if (!precio_venta || parseFloat(precio_venta) <= 0) { _mostrarAlertaProducto('El precio venta debe ser mayor a 0'); return; }

    const btn = document.getElementById('btn-guardar-producto');
    if (btn.dataset.procesando) return;

    _productoGuardando     = true;
    btn.dataset.procesando = '1';
    btn.disabled           = true;
    document.getElementById('btn-guardar-producto-text').textContent    = 'Guardando…';
    document.getElementById('btn-guardar-producto-spinner').style.display = 'block';

    const url    = id ? `/api/productos/${id}` : '/api/productos';
    const method = id ? 'PUT' : 'POST';

    try {
        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_producto,
                descripcion,
                precio_costo: parseFloat(precio_costo),
                precio_venta: parseFloat(precio_venta),
                id_categoria: id_categoria || null,
                id_colegio:   id_colegio   || null,
                genero:       genero       || null,
                estado:       parseInt(estado)
            })
        });
        const json = await res.json();
        if (json.ok) {
            cerrarModalProducto();
            cargarProductos();
            mostrarToast(json.mensaje, 'success');
        } else {
            _mostrarAlertaProducto(json.mensaje || 'Error al guardar');
        }
    } catch (err) {
        _mostrarAlertaProducto('Error de conexión');
    } finally {
        _productoGuardando = false;
        delete btn.dataset.procesando;
        btn.disabled = false;
        document.getElementById('btn-guardar-producto-text').textContent =
            document.getElementById('producto-id').value ? 'Guardar cambios' : 'Crear producto';
        document.getElementById('btn-guardar-producto-spinner').style.display = 'none';
    }
}

function abrirEliminarProducto(id, nombre) {
    _productoEliminarId = id;
    document.getElementById('eliminar-producto-nombre').textContent = nombre;
    document.getElementById('modal-eliminar-producto').style.display = 'flex';
}

async function confirmarEliminarProducto() {
    if (!_productoEliminarId) return;

    const btn = document.getElementById('btn-confirmar-eliminar-producto');
    if (btn.dataset.procesando) return;

    btn.dataset.procesando = '1';
    btn.disabled = true;
    document.getElementById('btn-eliminar-producto-text').textContent = 'Eliminando…';

    try {
        const res  = await fetch(`/api/productos/${_productoEliminarId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            cerrarModalEliminarProducto();
            cargarProductos();
            mostrarToast(json.mensaje, 'success');
        } else {
            mostrarToast(json.mensaje || 'No se pudo eliminar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        delete btn.dataset.procesando;
        btn.disabled = false;
        document.getElementById('btn-eliminar-producto-text').textContent = 'Sí, eliminar';
        _productoEliminarId = null;
    }
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').style.display = 'none';
}

function cerrarModalEliminarProducto() {
    document.getElementById('modal-eliminar-producto').style.display = 'none';
    _productoEliminarId = null;
}

async function _cargarCategoriasSelect() {
    const select = document.getElementById('producto-categoria');
    select.innerHTML = '<option value="">Sin categoría</option>';
    try {
        const res  = await fetch('/api/categorias');
        const json = await res.json();
        if (!json.ok) return;
        json.data.forEach(c => {
            const opt = document.createElement('option');
            opt.value       = c.id_categoria;
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    } catch (err) { console.error('_cargarCategoriasSelect:', err); }
}

async function _cargarColegiosSelect() {
    const select = document.getElementById('producto-colegio');
    select.innerHTML = '<option value="">Sin colegio</option>';
    try {
        const res  = await fetch('/api/colegios');
        const json = await res.json();
        if (!json.ok) return;
        json.data.forEach(c => {
            const opt = document.createElement('option');
            opt.value       = c.id_colegio;
            opt.textContent = c.nombre_colegio;
            select.appendChild(opt);
        });
    } catch (err) { console.error('_cargarColegiosSelect:', err); }
}

function _limpiarModalProducto() {
    document.getElementById('producto-id').value          = '';
    document.getElementById('producto-nombre').value      = '';
    document.getElementById('producto-descripcion').value = '';
    document.getElementById('producto-precio-costo').value = '';
    document.getElementById('producto-precio-venta').value = '';
    document.getElementById('producto-genero').value      = '';
    document.getElementById('producto-estado').value      = '1';
    document.getElementById('modal-producto-alert').style.display = 'none';
}

function _mostrarAlertaProducto(msg) {
    const el = document.getElementById('modal-producto-alert');
    document.getElementById('modal-producto-alert-msg').textContent = msg;
    el.style.display = 'flex';
}

function _badgeGenero(genero) {
    if (genero === 'masculino') return '<span class="badge badge-blue" style="font-size:11px;">Masculino</span>';
    if (genero === 'femenino')  return '<span class="badge badge-accent" style="font-size:11px;">Femenino</span>';
    if (genero === 'unisex')    return '<span class="badge badge-amber" style="font-size:11px;">Unisex</span>';
    return '<span style="color:var(--muted);font-size:12px;">—</span>';
}

function _badgeEstado(estado) {
    if (estado === 1) return '<span class="badge badge-green">Activo</span>';
    if (estado === 0) return '<span class="badge badge-amber">Inactivo</span>';
    return '<span class="badge badge-red">Eliminado</span>';
}

function _fmtFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function mostrarToast(msg, tipo = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
    }
    const iconos = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `${iconos[tipo] || ''}<span>${_esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, 3500);
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.procesando) return;

    const accionEl = e.target.closest('[data-accion]');
    if (accionEl?.dataset.accion === 'editar')   { abrirEditarProducto(accionEl.dataset.id); return; }
    if (accionEl?.dataset.accion === 'eliminar') { abrirEliminarProducto(accionEl.dataset.id, accionEl.dataset.nombre); return; }

    const id = e.target.closest('button')?.id || e.target.id;
    if (id === 'btn-nuevo-producto')               abrirNuevoProducto();
    if (id === 'btn-guardar-producto')             guardarProducto();
    if (id === 'btn-cerrar-modal-producto')        cerrarModalProducto();
    if (id === 'btn-cancelar-modal-producto')      cerrarModalProducto();
    if (id === 'btn-cerrar-eliminar-producto')     cerrarModalEliminarProducto();
    if (id === 'btn-cancelar-eliminar-producto')   cerrarModalEliminarProducto();
    if (id === 'btn-confirmar-eliminar-producto')  confirmarEliminarProducto();
    if (e.target.id === 'modal-producto')          cerrarModalProducto();
    if (e.target.id === 'modal-eliminar-producto') cerrarModalEliminarProducto();
});

document.addEventListener('input', function(e) {
    if (e.target.id === 'filtro-nombre-producto') _aplicarFiltros();
});

document.addEventListener('change', function(e) {
    if (e.target.id === 'filtro-categoria-producto') _aplicarFiltros();
});

function cargar_productos() {
    cargarProductos();
}