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
            <td style="font-family:var(--mono);font-size:12px;">${_fmtPrecioCosto(p)}</td>
            <td style="font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:600;">${_fmtPrecioVenta(p)}</td>
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
   document.getElementById('seccion-imagenes').style.display = 'none';
    document.getElementById('seccion-variantes').style.display = 'none';
    document.getElementById('seccion-precios-talla').style.display = 'none';
    document.getElementById('modal-producto').style.display = 'flex';
}

async function abrirEditarProducto(id) {
    if (!document.getElementById('modal-producto')) return;
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
        document.getElementById('producto-stock-minimo').value = p.stock_minimo || 10;
    } catch (err) {
        _mostrarAlertaProducto('No se pudo cargar el producto');
    }
    document.getElementById('seccion-imagenes').style.display = 'block';
    await _cargarImagenesProducto(id);
    document.getElementById('seccion-variantes').style.display = 'block';
    await _cargarTallasDisponibles();
    await _cargarVariantesProducto(id);
    document.getElementById('seccion-precios-talla').style.display = 'block';
    await _cargarPreciosTalla(id);
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
    const stock_minimo   = document.getElementById('producto-stock-minimo').value;

    // Limpiar errores previos
    document.querySelectorAll('#modal-producto .input-wrap').forEach(w => w.classList.remove('campo-invalido'));

    let hayError = false;

    if (!nombre_producto) {
        document.getElementById('producto-nombre').closest('.input-wrap').classList.add('campo-invalido');
        _mostrarAlertaProducto('El nombre del producto es obligatorio.');
        hayError = true;
    }
    if (!id_categoria) {
        document.getElementById('producto-categoria').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto('Debes seleccionar una categoría.');
        hayError = true;
    }
    if (!genero) {
        document.getElementById('producto-genero').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto('Debes seleccionar un género.');
        hayError = true;
    }
    if (!precio_costo || isNaN(parseFloat(precio_costo))) {
        document.getElementById('producto-precio-costo').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto('El precio de costo es obligatorio y debe ser un número válido.');
        hayError = true;
    } else if (parseFloat(precio_costo) <= 0) {
        document.getElementById('producto-precio-costo').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto('El precio de costo debe ser mayor a 0.');
        hayError = true;
    }
    if (!precio_venta || isNaN(parseFloat(precio_venta))) {
        document.getElementById('producto-precio-venta').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto('El precio de venta es obligatorio y debe ser un número válido.');
        hayError = true;
    } else if (parseFloat(precio_venta) <= 0) {
        document.getElementById('producto-precio-venta').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto('El precio de venta debe ser mayor a 0.');
        hayError = true;
    } else if (precio_costo && parseFloat(precio_venta) <= parseFloat(precio_costo)) {
        document.getElementById('producto-precio-venta').closest('.input-wrap').classList.add('campo-invalido');
        if (!hayError) _mostrarAlertaProducto(`El precio de venta (S/ ${parseFloat(precio_venta).toFixed(2)}) debe ser mayor al precio de costo (S/ ${parseFloat(precio_costo).toFixed(2)}).`);
        hayError = true;
    }

    if (hayError) return;

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
                estado:       parseInt(estado),
                stock_minimo: stock_minimo ? parseInt(stock_minimo) : 10
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
    select.innerHTML = '<option value="">-- Selecciona una categoría --</option>';
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
    if (!document.getElementById('producto-id')) return;
    document.getElementById('producto-id').value          = '';
    document.getElementById('producto-nombre').value      = '';
    document.getElementById('producto-descripcion').value = '';
    document.getElementById('producto-precio-costo').value = '';
    document.getElementById('producto-precio-venta').value = '';
    document.getElementById('producto-genero').value      = '';
    document.getElementById('producto-estado').value      = '1';
    document.getElementById('producto-stock-minimo').value = '';
    document.getElementById('modal-producto-alert').style.display = 'none';

    _imagenesProducto = [];
    _renderImagenes();
    const urlInput = document.getElementById('imagen-url-input');
    if (urlInput) urlInput.value = '';
}

function _mostrarAlertaProducto(msg) {
    const el = document.getElementById('modal-producto-alert');
    document.getElementById('modal-producto-alert-msg').textContent = msg;
    el.style.display = 'flex';
}

function _fmtPrecioVenta(p) {
    if (!p.tiene_precios_por_talla) return `S/ ${parseFloat(p.precio_venta).toFixed(2)}`;
    const min = parseFloat(p.precio_venta_min).toFixed(2);
    const max = parseFloat(p.precio_venta_max).toFixed(2);
    if (min === max) return `S/ ${min}`;
    return `S/ ${min} – S/ ${max}`;
}

function _fmtPrecioCosto(p) {
    if (!p.tiene_precios_por_talla) return `S/ ${parseFloat(p.precio_costo).toFixed(2)}`;
    const min = parseFloat(p.precio_costo_min).toFixed(2);
    const max = parseFloat(p.precio_costo_max).toFixed(2);
    if (min === max) return `S/ ${min}`;
    return `S/ ${min} – S/ ${max}`;
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

let _imagenesProducto = [];
async function _cargarImagenesProducto(id) {
    _imagenesProducto = [];
    _renderImagenes();
    if (!id) return;
    try {
        const res = await fetch(`/api/productos/${id}/imagenes`);
        const json = await res.json();
        if (json.ok) { _imagenesProducto = json.data; _renderImagenes(); }
    } catch (e) { console.error('Error cargando imágenes:', e); }
}

function _renderImagenes() {
    const lista = document.getElementById('imagenes-lista');
    if (!lista) return;
    if (!_imagenesProducto.length) {
        lista.innerHTML = '<span style="font-size:12px;color:var(--muted);">Sin imágenes aún</span>';
        return;
    }
    lista.innerHTML = _imagenesProducto.map(img => `
        <div style="position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border);">
            <img src="${_esc(img.url_imagen)}" style="width:100%;height:100%;object-fit:cover;" 
                 onerror="this.style.display='none'">
            ${img.color ? `<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);
                color:#fff;font-size:9px;text-align:center;padding:2px 0;">${_esc(img.color)}</span>` : ''}
            <button type="button" onclick="_eliminarImagenProducto(${img.id_imagen})"
                style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;
                       background:rgba(220,38,38,.85);border:none;color:#fff;cursor:pointer;
                       font-size:12px;display:flex;align-items:center;justify-content:center;padding:0;">
                ×
            </button>
        </div>`).join('');
}

function _esUrlDeImagenValida(url) {
    try {
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) return false;
        return /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(u.pathname);
    } catch (e) { return false; }
}

async function _agregarImagenUrl() {
    const id = document.getElementById('producto-id').value;
    if (!id) { _mostrarAlertaProducto('Guarda el producto primero antes de agregar imágenes'); return; }
    const url = document.getElementById('imagen-url-input').value.trim();
    const color = document.getElementById('imagen-color-input').value.trim();
    if (!url) { _mostrarAlertaProducto('Ingresa una URL de imagen'); return; }
    if (!_esUrlDeImagenValida(url)) {
        _mostrarAlertaProducto('La URL debe ser un enlace válido a una imagen (.jpg, .png, .gif, .webp, .avif o .svg)');
        return;
    }
    if (!color) { _mostrarAlertaProducto('Indica el color de esta imagen antes de agregarla'); return; }
    if (!_colorExisteEnVariantes(color)) {
        _mostrarAlertaProducto(`Primero agrega el color "${color}" en "Colores y tallas disponibles" antes de subirle una imagen`);
        return;
    }
    try {
        const res = await fetch(`/api/productos/${id}/imagenes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url_imagen: url, color: color || null })
        });
        const json = await res.json();
        if (json.ok) {
            document.getElementById('imagen-url-input').value = '';
            document.getElementById('imagen-color-input').value = '';
            await _cargarImagenesProducto(id);
            mostrarToast('Imagen agregada', 'success');
        } else { _mostrarAlertaProducto(json.mensaje); }
    } catch (e) { _mostrarAlertaProducto('Error al agregar imagen'); }
}

function _colorExisteEnVariantes(color) {
    const buscado = color.trim().toLowerCase();
    return _variantesProducto.some(v => (v.color || '').trim().toLowerCase() === buscado);
}

async function _subirImagenLocal(file) {
    const id = document.getElementById('producto-id').value;
    if (!id) { _mostrarAlertaProducto('Guarda el producto primero antes de agregar imágenes'); return; }
    const color = document.getElementById('imagen-color-input').value.trim();
    if (!color) { _mostrarAlertaProducto('Indica el color antes de subir la imagen'); return; }
    if (!_colorExisteEnVariantes(color)) {
        _mostrarAlertaProducto(`Primero agrega el color "${color}" en "Colores y tallas disponibles" antes de subirle una imagen`);
        return;
    }
    if (!file.type.startsWith('image/')) { _mostrarAlertaProducto('El archivo debe ser una imagen'); return; }
    const progress = document.getElementById('imagen-upload-progress');
    progress.style.display = 'block';
    try {
        const fd = new FormData();
        fd.append('imagen', file);
        const up = await fetch('/api/upload/slider', { method: 'POST', body: fd });
        const upJson = await up.json();
        if (!upJson.ok) { _mostrarAlertaProducto(upJson.mensaje); return; }
        const res = await fetch(`/api/productos/${id}/imagenes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url_imagen: upJson.data.url, color: color || null })
        });
        const json = await res.json();
        if (json.ok) {
            document.getElementById('imagen-color-input').value = '';
            await _cargarImagenesProducto(id);
            mostrarToast('Imagen subida correctamente', 'success');
        } else { _mostrarAlertaProducto(json.mensaje); }
    } catch (e) { _mostrarAlertaProducto('Error al subir imagen'); }
    finally { progress.style.display = 'none'; }
}

let _variantesProducto = [];
let _tallasDisponibles = [];
let _preciosTalla = [];
let _colorEnEdicion = null;
let _gruposVariantesActuales = [];

async function _cargarPreciosTalla(id) {
    _preciosTalla = [];
    const select = document.getElementById('precio-talla-select');
    select.innerHTML = '<option value="">-- Selecciona una talla --</option>';
    document.getElementById('precio-talla-costo').value = '';
    document.getElementById('precio-talla-venta').value = '';
    if (!id) return;
    try {
        const res = await fetch(`/api/productos/${id}/precios-talla`);
        const json = await res.json();
        if (!json.ok) return;
        _preciosTalla = json.data;
        select.innerHTML += json.data.map(t => `
            <option value="${t.id_talla}">${_esc(t.nombre_talla)}${t.tiene_precio_propio ? ' ✓' : ''}</option>
        `).join('');
    } catch (e) { console.error('Error cargando precios por talla:', e); }
}

function _onSeleccionarTallaPrecio() {
    const idTalla = document.getElementById('precio-talla-select').value;
    const costoInput = document.getElementById('precio-talla-costo');
    const ventaInput = document.getElementById('precio-talla-venta');
    if (!idTalla) { costoInput.value = ''; ventaInput.value = ''; return; }
    const t = _preciosTalla.find(x => String(x.id_talla) === idTalla);
    if (t && t.tiene_precio_propio) {
        costoInput.value = t.precio_costo;
        ventaInput.value = t.precio_venta;
    } else {
        costoInput.value = '';
        ventaInput.value = '';
    }
}

async function _guardarPrecioTalla() {
    const id = document.getElementById('producto-id').value;
    if (!id) { _mostrarAlertaProducto('Guarda el producto primero antes de poner precio por talla'); return; }
    const idTalla = document.getElementById('precio-talla-select').value;
    if (!idTalla) { _mostrarAlertaProducto('Elige una talla'); return; }
    const precio_costo = document.getElementById('precio-talla-costo').value;
    const precio_venta = document.getElementById('precio-talla-venta').value;
    try {
        const res = await fetch(`/api/productos/${id}/precios-talla/${idTalla}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ precio_costo, precio_venta })
        });
        const json = await res.json();
        if (json.ok) {
            await _cargarPreciosTalla(id);
            document.getElementById('precio-talla-select').value = idTalla;
            mostrarToast(json.mensaje, 'success');
        } else { _mostrarAlertaProducto(json.mensaje); }
    } catch (e) { _mostrarAlertaProducto('Error al guardar el precio de la talla'); }
}

async function _cargarTallasDisponibles() {
    if (_tallasDisponibles.length) { _renderTallasChipsSelector(); return; }
    try {
        const res = await fetch('/api/tallas');
        const json = await res.json();
        if (json.ok) _tallasDisponibles = json.data;
    } catch (e) { console.error('Error cargando tallas:', e); }
    _renderTallasChipsSelector();
}

async function _cargarVariantesProducto(id) {
    _variantesProducto = [];
    _colorEnEdicion = null;
    _renderVariantesLista();
    if (!id) return;
    try {
        const res = await fetch(`/api/productos/${id}/variantes`);
        const json = await res.json();
        if (json.ok) { _variantesProducto = json.data; _renderVariantesLista(); }
    } catch (e) { console.error('Error cargando variantes:', e); }
}

function _agruparVariantesPorColor() {
    const mapa = {};
    _variantesProducto.forEach(v => {
        (mapa[v.color] = mapa[v.color] || []).push(v);
    });
    return Object.entries(mapa).map(([color, variantes]) => ({ color, variantes }));
}

function _renderVariantesLista() {
    const cont = document.getElementById('variantes-lista');
    if (!cont) return;
    if (!_variantesProducto.length) {
        cont.innerHTML = '<span style="font-size:12px;color:var(--muted);">Este producto todavía no tiene colores/tallas creados.</span>';
        _gruposVariantesActuales = [];
        return;
    }
    _gruposVariantesActuales = _agruparVariantesPorColor();

    cont.innerHTML = _gruposVariantesActuales.map((grupo, i) => {
        const tallasTexto = grupo.variantes.map(v => v.nombre_talla || '—').join(', ');
        const enEdicion = _colorEnEdicion === grupo.color;
        return `
        <div class="variante-color-row">
            <div class="variante-color-info">
                <strong style="font-size:13px;">${_esc(grupo.color)}</strong>
                <span style="font-size:12px;color:var(--muted);">${_esc(tallasTexto)}</span>
            </div>
            <div class="variante-color-acciones">
                <button type="button" class="btn-icon-sm" title="Editar tallas" onclick="_toggleEditarColor(${i})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button type="button" class="btn-icon-sm btn-icon-sm-danger" title="Eliminar color" onclick="_confirmarEliminarColor(${i})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                </button>
            </div>
            ${enEdicion ? _renderPanelEdicionColor(grupo, i) : ''}
        </div>`;
    }).join('');
}

function _renderPanelEdicionColor(grupo, i) {
    const chips = _tallasDisponibles.map(t => {
        const variante = grupo.variantes.find(v => v.id_talla === t.id_talla);
        const asignada = !!variante;
        const conStock = asignada && Number(variante.stock) > 0;
        const clases = ['talla-chip-select'];
        if (asignada) clases.push('active');
        if (conStock) clases.push('locked');
        const title = conStock
            ? `No se puede desmarcar: tiene ${variante.stock} en stock`
            : '';
        return `<button type="button" class="${clases.join(' ')}"
                    data-id-talla="${t.id_talla}" data-locked="${conStock ? '1' : '0'}"
                    title="${_esc(title)}" onclick="_toggleTallaChipEdicion(this)">
                    ${_esc(t.nombre_talla)}
                </button>`;
    }).join('');

    return `
    <div class="variante-color-editar-panel">
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600;">
            Editar tallas de "${_esc(grupo.color)}"
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;" id="edicion-tallas-chips-${i}">
            ${chips}
        </div>
        <div style="display:flex;gap:8px;">
            <button type="button" class="btn-secondary" style="flex:1;" onclick="_cancelarEdicionColor()">Cancelar</button>
            <button type="button" class="btn-primary" style="flex:1;" onclick="_guardarEdicionColor(${i})">Guardar cambios</button>
        </div>
        <div class="variante-color-editar-nota">Las tallas en rojo tienen stock y no se pueden desmarcar; ajusta el stock desde Inventario primero.</div>
    </div>`;
}

function _toggleTallaChipEdicion(btn) {
    if (btn.dataset.locked === '1') {
        mostrarToast('Esta talla tiene stock, no se puede desmarcar. Ajusta el stock desde Inventario primero.', 'error');
        return;
    }
    btn.classList.toggle('active');
}

function _toggleEditarColor(i) {
    const grupo = _gruposVariantesActuales[i];
    if (!grupo) return;
    _colorEnEdicion = (_colorEnEdicion === grupo.color) ? null : grupo.color;
    _renderVariantesLista();
}

function _cancelarEdicionColor() {
    _colorEnEdicion = null;
    _renderVariantesLista();
}

async function _guardarEdicionColor(i) {
    const grupo = _gruposVariantesActuales[i];
    if (!grupo) return;
    const id = document.getElementById('producto-id').value;
    const cont = document.getElementById(`edicion-tallas-chips-${i}`);
    const idTallas = [...cont.querySelectorAll('.talla-chip-select.active')].map(b => parseInt(b.dataset.idTalla));

    if (!idTallas.length) {
        mostrarToast('Debe quedar al menos una talla para este color. Si quieres quitarlo del todo, usa el botón Eliminar.', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/productos/${id}/variantes/${encodeURIComponent(grupo.color)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_tallas: idTallas })
        });
        const json = await res.json();
        if (json.ok) {
            _colorEnEdicion = null;
            await _cargarVariantesProducto(id);
            mostrarToast(json.mensaje, 'success');
        } else {
            mostrarToast(json.mensaje, 'error');
        }
    } catch (e) { mostrarToast('Error al actualizar el color', 'error'); }
}

async function _confirmarEliminarColor(i) {
    const grupo = _gruposVariantesActuales[i];
    if (!grupo) return;
    if (!confirm(`¿Eliminar el color "${grupo.color}" y todas sus tallas?`)) return;

    const id = document.getElementById('producto-id').value;
    try {
        const res = await fetch(`/api/productos/${id}/variantes/${encodeURIComponent(grupo.color)}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            if (_colorEnEdicion === grupo.color) _colorEnEdicion = null;
            await _cargarVariantesProducto(id);
            mostrarToast(json.mensaje, 'success');
        } else {
            mostrarToast(json.mensaje, 'error');
        }
    } catch (e) { mostrarToast('Error al eliminar el color', 'error'); }
}

function _renderTallasChipsSelector() {
    const cont = document.getElementById('variante-tallas-chips');
    if (!cont) return;
    cont.innerHTML = _tallasDisponibles.map(t => `
        <button type="button" class="talla-chip-select" data-id-talla="${t.id_talla}" onclick="_toggleTallaChip(this)">
            ${_esc(t.nombre_talla)}
        </button>
    `).join('');
}

function _toggleTallaChip(btn) {
    btn.classList.toggle('active');
}

async function _agregarVariante() {
    const id = document.getElementById('producto-id').value;
    if (!id) { _mostrarAlertaProducto('Guarda el producto primero antes de agregar variantes'); return; }
    const color = document.getElementById('variante-color-input').value.trim();
    if (!color) { _mostrarAlertaProducto('Escribe el nombre del color'); return; }
    const idTallas = [...document.querySelectorAll('.talla-chip-select.active')].map(b => parseInt(b.dataset.idTalla));
    if (!idTallas.length) { _mostrarAlertaProducto('Elige al menos una talla para este color'); return; }
    try {
        const res = await fetch(`/api/productos/${id}/variantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color, id_tallas: idTallas })
        });
        const json = await res.json();
        if (json.ok) {
            document.getElementById('variante-color-input').value = '';
            document.querySelectorAll('.talla-chip-select.active').forEach(b => b.classList.remove('active'));
            await _cargarVariantesProducto(id);
            mostrarToast(json.mensaje, 'success');
        } else { _mostrarAlertaProducto(json.mensaje); }
    } catch (e) { _mostrarAlertaProducto('Error al agregar la variante'); }
}

async function _eliminarImagenProducto(idImagen) {
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
        const res = await fetch(`/api/imagenes/${idImagen}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            const id = document.getElementById('producto-id').value;
            await _cargarImagenesProducto(id);
            mostrarToast('Imagen eliminada', 'success');
        }
    } catch (e) { mostrarToast('Error al eliminar imagen', 'error'); }
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
    if (id === 'btn-agregar-url-imagen') _agregarImagenUrl();
    if (id === 'btn-subir-imagen-local') document.getElementById('imagen-file-input').click();
    if (id === 'btn-agregar-variante') _agregarVariante();
    if (id === 'btn-guardar-precio-talla') _guardarPrecioTalla();
});

document.addEventListener('change', function(e) {
    if (e.target.id === 'imagen-file-input' && e.target.files[0]) {
        _subirImagenLocal(e.target.files[0]);
        e.target.value = '';
    }
});

document.addEventListener('input', function(e) {
    if (e.target.id === 'filtro-nombre-producto') _aplicarFiltros();
});

document.addEventListener('change', function(e) {
    if (e.target.id === 'filtro-categoria-producto') _aplicarFiltros();
    if (e.target.id === 'precio-talla-select') _onSeleccionarTallaPrecio();
});

function cargar_productos() {
    cargarProductos();
}