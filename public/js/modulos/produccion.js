let _prodProductos = [];
let _prodInsumosLista = [];
let _prodRecetaActual = [];
let _prodVariantesActual = [];
let _prodProductoId = null;

function cargar_produccion() {
    _cargarProductosProduccion();
    _cargarInsumosProduccion();
    _cargarHistorialProduccion();
}

async function _cargarProductosProduccion() {
    try {
        const res = await fetch('/api/productos');
        const json = await res.json();
        if (!json.ok || !json.data) return;

        _prodProductos = json.data;
        const select = document.getElementById('prod-producto-select');
        select.innerHTML = '<option value="">Selecciona un producto...</option>' +
            _prodProductos.map(p => `<option value="${p.id_producto}">${_prodEsc(p.nombre_producto)}</option>`).join('');
    } catch (e) {
        console.error('Error cargando productos:', e);
    }
}

async function _cargarInsumosProduccion() {
    try {
        const res = await fetch('/api/insumos');
        const json = await res.json();
        if (!json.ok || !json.data) return;

        _prodInsumosLista = json.data;
        const select = document.getElementById('prod-receta-insumo');
        select.innerHTML = '<option value="">Selecciona un insumo...</option>' +
            _prodInsumosLista.map(i => `<option value="${i.id_insumo}">${_prodEsc(i.nombre_insumo)} (${_prodEsc(i.unidad_medida)})</option>`).join('');
    } catch (e) {
        console.error('Error cargando insumos:', e);
    }
}

async function _prodSeleccionarProducto() {
    const id = document.getElementById('prod-producto-select').value;
    _prodProductoId = id || null;

    document.getElementById('prod-seccion-receta').style.display = 'none';
    document.getElementById('prod-seccion-producir').style.display = 'none';
    document.getElementById('prod-preview').style.display = 'none';
    document.getElementById('prod-alerta-faltante').style.display = 'none';

    if (!_prodProductoId) return;

    document.getElementById('prod-seccion-receta').style.display = 'block';
    document.getElementById('prod-seccion-producir').style.display = 'block';

    await Promise.all([_cargarRecetaProducto(), _cargarVariantesProducto()]);
}

async function _cargarRecetaProducto() {
    if (!_prodProductoId) return;
    try {
        const res = await fetch(`/api/productos/${_prodProductoId}/receta`);
        const json = await res.json();
        _prodRecetaActual = (json.ok && json.data) ? json.data : [];
        _prodRenderReceta();
        _prodActualizarPreview();
    } catch (e) {
        console.error('Error cargando receta:', e);
    }
}

function _prodRenderReceta() {
    const empty = document.getElementById('prod-receta-empty');
    const wrap = document.getElementById('prod-receta-tabla-wrap');
    const tbody = document.getElementById('prod-receta-tbody');
    const total = document.getElementById('prod-receta-total');
    const sinRecetaAlert = document.getElementById('prod-sin-receta-alert');
    const formProducir = document.getElementById('prod-form-producir');

    if (!_prodRecetaActual.length) {
        empty.style.display = 'flex';
        wrap.style.display = 'none';
        total.textContent = '';
        sinRecetaAlert.style.display = 'flex';
        formProducir.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    wrap.style.display = 'block';
    total.textContent = `${_prodRecetaActual.length} insumo${_prodRecetaActual.length !== 1 ? 's' : ''}`;
    sinRecetaAlert.style.display = 'none';
    formProducir.style.display = 'block';

    tbody.innerHTML = _prodRecetaActual.map(r => {
        const costoUnidad = parseFloat(r.cantidad_por_unidad) * parseFloat(r.costo_promedio);
        return `
        <tr>
            <td><strong>${_prodEsc(r.nombre_insumo)}</strong></td>
            <td style="font-family:var(--mono);">${parseFloat(r.cantidad_por_unidad).toLocaleString('es-PE', { maximumFractionDigits: 4 })} ${_prodEsc(r.unidad_medida)}</td>
            <td style="font-family:var(--mono);">S/ ${costoUnidad.toFixed(2)}</td>
            <td style="text-align:right;">
                <button class="btn-icon btn-icon-danger" title="Quitar de la receta" data-accion="quitar-receta" data-id="${r.id_receta}">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

async function _prodAgregarReceta() {
    const id_insumo = document.getElementById('prod-receta-insumo').value;
    const cantidad_por_unidad = parseFloat(document.getElementById('prod-receta-cantidad').value);

    if (!id_insumo) return mostrarToast('Selecciona un insumo', 'warning');
    if (!cantidad_por_unidad || cantidad_por_unidad <= 0) return mostrarToast('Ingresa una cantidad válida', 'warning');

    try {
        const res = await fetch(`/api/productos/${_prodProductoId}/receta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_insumo, cantidad_por_unidad })
        });
        const json = await res.json();
        if (!json.ok) return mostrarToast(json.mensaje || 'No se pudo agregar', 'error');

        document.getElementById('prod-receta-insumo').value = '';
        document.getElementById('prod-receta-cantidad').value = '';
        mostrarToast('Insumo agregado a la receta', 'success');
        await _cargarRecetaProducto();
    } catch (e) {
        console.error('Error agregando a receta:', e);
        mostrarToast('Error de conexión', 'error');
    }
}

async function _prodQuitarReceta(idReceta) {
    try {
        const res = await fetch(`/api/receta/${idReceta}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.ok) return mostrarToast(json.mensaje || 'No se pudo quitar', 'error');
        mostrarToast('Insumo quitado de la receta', 'success');
        await _cargarRecetaProducto();
    } catch (e) {
        console.error('Error quitando de receta:', e);
        mostrarToast('Error de conexión', 'error');
    }
}

async function _cargarVariantesProducto() {
    if (!_prodProductoId) return;
    try {
        const res = await fetch(`/api/productos/${_prodProductoId}/variantes`);
        const json = await res.json();
        _prodVariantesActual = (json.ok && json.data) ? json.data : [];

        const select = document.getElementById('prod-variante-select');
        if (!_prodVariantesActual.length) {
            select.innerHTML = '<option value="">Este producto no tiene tallas/colores creados</option>';
            return;
        }
        select.innerHTML = '<option value="">Selecciona...</option>' +
            _prodVariantesActual.map(v =>
                `<option value="${v.id_variante}">${_prodEsc(v.nombre_talla || '—')} / ${_prodEsc(v.color)} (stock actual: ${v.stock})</option>`
            ).join('');
    } catch (e) {
        console.error('Error cargando variantes:', e);
    }
}

function _prodActualizarPreview() {
    const cantidad = parseInt(document.getElementById('prod-cantidad-producir').value);
    const preview = document.getElementById('prod-preview');
    const alertaFaltante = document.getElementById('prod-alerta-faltante');
    const lista = document.getElementById('prod-preview-lista');

    if (!cantidad || cantidad <= 0 || !_prodRecetaActual.length) {
        preview.style.display = 'none';
        alertaFaltante.style.display = 'none';
        return;
    }

    let costoTotal = 0;
    const faltantes = [];

    lista.innerHTML = _prodRecetaActual.map(r => {
        const necesario = parseFloat(r.cantidad_por_unidad) * cantidad;
        const disponible = parseFloat(r.stock_actual);
        const alcanza = necesario <= disponible;
        costoTotal += necesario * parseFloat(r.costo_promedio);
        if (!alcanza) faltantes.push(`${r.nombre_insumo} (necesitas ${necesario.toFixed(2)}, tienes ${disponible.toFixed(2)} ${r.unidad_medida})`);

        return `<div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span>${_prodEsc(r.nombre_insumo)}</span>
            <span style="font-family:var(--mono);${alcanza ? '' : 'color:var(--error);font-weight:600;'}">${necesario.toFixed(2)} ${_prodEsc(r.unidad_medida)}</span>
        </div>`;
    }).join('');

    document.getElementById('prod-preview-costo-total').textContent = `S/ ${costoTotal.toFixed(2)}`;
    document.getElementById('prod-preview-costo-unidad').textContent = `S/ ${(costoTotal / cantidad).toFixed(2)}`;
    preview.style.display = 'block';

    if (faltantes.length) {
        alertaFaltante.style.display = 'flex';
        alertaFaltante.innerHTML = `<i data-lucide="alert-triangle" style="width:16px;height:16px;"></i><span>No hay stock suficiente: ${faltantes.join('; ')}</span>`;
        if (window.lucide) lucide.createIcons();
    } else {
        alertaFaltante.style.display = 'none';
    }
}

async function _prodConfirmarProduccion() {
    const id_variante = document.getElementById('prod-variante-select').value;
    const cantidad_producida = parseInt(document.getElementById('prod-cantidad-producir').value);

    if (!_prodProductoId) return mostrarToast('Selecciona un producto', 'warning');
    if (!id_variante) return mostrarToast('Selecciona la talla/color a producir', 'warning');
    if (!cantidad_producida || cantidad_producida <= 0) return mostrarToast('Ingresa una cantidad válida', 'warning');

    const btn = document.getElementById('btn-confirmar-produccion');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Registrando...';

    try {
        const res = await fetch('/api/produccion/ordenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_producto: _prodProductoId, id_variante, cantidad_producida })
        });
        const json = await res.json();

        if (!json.ok) {
            mostrarToast(json.mensaje || 'No se pudo registrar la producción', 'error');
            return;
        }

        mostrarToast(`Producción registrada (costo: S/ ${json.costo_total_insumos}, S/ ${json.costo_por_unidad} por unidad)`, 'success');
        document.getElementById('prod-cantidad-producir').value = '';
        document.getElementById('prod-variante-select').value = '';
        document.getElementById('prod-preview').style.display = 'none';
        document.getElementById('prod-alerta-faltante').style.display = 'none';

        await Promise.all([_cargarRecetaProducto(), _cargarVariantesProducto(), _cargarHistorialProduccion()]);
    } catch (e) {
        console.error('Error registrando producción:', e);
        mostrarToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle"></i> Confirmar producción';
        if (window.lucide) lucide.createIcons();
    }
}

async function _cargarHistorialProduccion() {
    const loading = document.getElementById('prod-historial-loading');
    const tabla = document.getElementById('prod-historial-tabla');
    const empty = document.getElementById('prod-historial-empty');
    const total = document.getElementById('prod-historial-total');
    const tbody = document.getElementById('prod-historial-tbody');

    loading.style.display = 'flex';
    tabla.style.display = 'none';
    empty.style.display = 'none';

    try {
        const res = await fetch('/api/produccion/ordenes');
        const json = await res.json();
        loading.style.display = 'none';

        if (!json.ok || !json.data || !json.data.length) {
            empty.style.display = 'flex';
            total.textContent = '';
            return;
        }

        tabla.style.display = 'block';
        total.textContent = `${json.data.length} órdenes`;

        tbody.innerHTML = json.data.map(o => {
            const costoUnidad = parseFloat(o.costo_total_insumos) / parseInt(o.cantidad_producida);
            const fecha = o.fecha ? new Date(o.fecha).toLocaleDateString('es-PE') : '—';
            return `<tr>
                <td style="font-family:var(--mono);">#${o.id_orden}</td>
                <td><strong>${_prodEsc(o.nombre_producto)}</strong></td>
                <td>${_prodEsc(o.nombre_talla || '—')} / ${_prodEsc(o.color || '—')}</td>
                <td style="font-family:var(--mono);">${o.cantidad_producida}</td>
                <td style="font-family:var(--mono);">S/ ${parseFloat(o.costo_total_insumos).toFixed(2)}</td>
                <td style="font-family:var(--mono);">S/ ${costoUnidad.toFixed(2)}</td>
                <td style="font-size:12px;color:var(--muted);">${fecha}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('Error cargando historial de producción:', e);
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

function _prodEsc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('change', function (e) {
    if (e.target.id === 'prod-producto-select') _prodSeleccionarProducto();
    if (e.target.id === 'prod-variante-select') _prodActualizarPreview();
});

document.addEventListener('input', function (e) {
    if (e.target.id === 'prod-cantidad-producir') _prodActualizarPreview();
});

document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.id === 'btn-agregar-receta') _prodAgregarReceta();
    if (btn.id === 'btn-confirmar-produccion') _prodConfirmarProduccion();
    if (btn.dataset.accion === 'quitar-receta') _prodQuitarReceta(btn.dataset.id);
});