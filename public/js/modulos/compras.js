let _comprasData = [];
let _compraEliminarId = null;
let _insumosData = [];

async function cargarCompras() {
    const loading = document.getElementById('compras-loading');
    const tabla = document.getElementById('compras-tabla');
    const empty = document.getElementById('compras-empty');
    const total = document.getElementById('total-compras');
    const tbody = document.getElementById('compras-tbody');

    loading.style.display = 'flex';
    tabla.style.display = 'none';
    empty.style.display = 'none';

    try {
        const res = await fetch('/api/compras');
        const json = await res.json();

        loading.style.display = 'none';

        if (!json.ok || !json.data || !json.data.length) {
            empty.style.display = 'flex';
            total.textContent = '';
            return;
        }

        _comprasData = json.data;
        tabla.style.display = 'block';
        total.textContent = `${json.data.length} registros`;

        tbody.innerHTML = json.data.map((c, i) => `
            <tr>
                <td style="font-family:var(--mono);font-size:12px;">${i + 1}</td>
                <td>
                    <strong>${_esc(c.nombre_insumo)}</strong>
                    ${c.observacion ? `<div style="font-size:11px;color:var(--muted);">${_esc(c.observacion)}</div>` : ''}
                </td>
                <td>
                    ${c.categoria_insumo
                        ? `<span class="badge badge-blue" style="font-size:11px;">${_esc(c.categoria_insumo)}</span>`
                        : '<span style="color:var(--muted)">—</span>'}
                </td>
                <td style="font-family:var(--mono);">${parseInt(c.cantidad) || 0}</td>
                <td>${_esc(c.unidad_medida || '—')}</td>
                <td style="font-family:var(--mono);">S/ ${parseFloat(c.costo || 0).toFixed(2)}</td>
                <td>${_esc(c.lugar_compra || '—')}</td>
                <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${_fmtFecha(c.fecha_compra)}</td>
                <td style="text-align:right;">
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <button class="btn-icon" title="Ver detalle" data-accion="ver" data-id="${c.id_compra}">
                            <i data-lucide="eye" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn-icon btn-icon-danger" title="Eliminar" data-accion="eliminar" data-id="${c.id_compra}" data-nombre="${_esc(c.nombre_insumo)}">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error('Error cargando compras:', e);
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

async function cargarInsumos() {
    const loading = document.getElementById('insumos-loading');
    const tabla = document.getElementById('insumos-tabla');
    const empty = document.getElementById('insumos-empty');
    const total = document.getElementById('total-insumos');
    const tbody = document.getElementById('insumos-tbody');

    loading.style.display = 'flex';
    tabla.style.display = 'none';
    empty.style.display = 'none';

    try {
        const res = await fetch('/api/insumos');
        const json = await res.json();

        loading.style.display = 'none';

        if (!json.ok || !json.data || !json.data.length) {
            empty.style.display = 'flex';
            total.textContent = '';
            return;
        }

        _insumosData = json.data;
        tabla.style.display = 'block';
        const insumosSinStock = json.data.filter(i => (parseFloat(i.stock_actual) || 0) <= 0);
        const sinStockCount = insumosSinStock.length;
        total.textContent = `${json.data.length} insumos` + (sinStockCount ? ` · ${sinStockCount} sin stock` : '');

        const alertaCompras = document.getElementById('compras-alerta-agotados');
        const alertaComprasTexto = document.getElementById('compras-alerta-agotados-texto');
        if (sinStockCount > 0) {
            const nombresSinStock = insumosSinStock.map(i => i.nombre_insumo);
            const listado = nombresSinStock.slice(0, 3).join(', ') + (nombresSinStock.length > 3 ? ` y ${nombresSinStock.length - 3} más` : '');
            alertaComprasTexto.textContent = `Tienes ${sinStockCount} insumo${sinStockCount !== 1 ? 's' : ''} sin ninguna unidad en stock: ${listado}.`;
            alertaCompras.style.display = 'flex';
            if (window.lucide) lucide.createIcons();
        } else {
            alertaCompras.style.display = 'none';
        }

        tbody.innerHTML = json.data.map(i => {
            const stock = parseFloat(i.stock_actual) || 0;
            const costoProm = parseFloat(i.costo_promedio) || 0;
            const valorStock = stock * costoProm;
            const bajoMinimo = parseFloat(i.stock_minimo) > 0 && stock <= parseFloat(i.stock_minimo);
            const sinStock = stock <= 0;
            return `
            <tr${sinStock ? ' style="opacity:.6;"' : ''}>
                <td><strong>${_esc(i.nombre_insumo)}</strong></td>
                <td>
                    ${i.categoria_insumo
                        ? `<span class="badge badge-blue" style="font-size:11px;">${_esc(i.categoria_insumo)}</span>`
                        : '<span style="color:var(--muted)">—</span>'}
                </td>
                <td style="font-family:var(--mono);">
                    ${stock.toLocaleString('es-PE', { maximumFractionDigits: 2 })} ${_esc(i.unidad_medida)}
                    ${sinStock
                        ? '<span class="badge badge-red" style="font-size:10px;margin-left:6px;">Sin stock</span>'
                        : (bajoMinimo ? '<span class="badge badge-red" style="font-size:10px;margin-left:6px;">Stock bajo</span>' : '')}
                </td>
                <td style="font-family:var(--mono);">S/ ${costoProm.toFixed(2)}</td>
                <td style="font-family:var(--mono);">S/ ${valorStock.toFixed(2)}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('Error cargando insumos:', e);
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

function abrirNuevaCompra() {
    document.getElementById('compra-id').value = '';
    document.getElementById('modal-compra-titulo').textContent = 'Nueva compra de insumo';
    document.getElementById('compra-categoria-insumo').value = '';
    document.getElementById('compra-nombre').value = '';
    document.getElementById('compra-cantidad').value = 1;
    document.getElementById('compra-costo').value = '';
    const selectUnidadNueva = document.getElementById('compra-unidad');
    selectUnidadNueva.innerHTML = Object.keys(_todasUnidades).map(u =>
        `<option value="${u}">${_todasUnidades[u]}</option>`
    ).join('');
    selectUnidadNueva.value = 'metros';
    document.getElementById('compra-lugar').value = '';
    document.getElementById('compra-observacion').value = '';
    document.getElementById('modal-compra').style.display = 'flex';
}

function abrirVerCompra(id) {
    const c = _comprasData.find(x => String(x.id_compra) === String(id));
    if (!c) return;

    const fecha = c.fecha_compra ? new Date(c.fecha_compra) : null;
    const fechaCompleta = fecha
        ? fecha.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : '—';
    const horaCompleta = fecha
        ? fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';
    const costoUnitario = (parseFloat(c.costo) || 0) / (parseInt(c.cantidad) || 1);

    document.getElementById('ver-compra-cuerpo').innerHTML = `
        <div class="cv-hero">
            <div class="cv-hero-icon"><i data-lucide="package"></i></div>
            <div class="cv-hero-info">
                <div class="nombre">${_esc(c.nombre_insumo)}</div>
                <div class="cat-row">${c.categoria_insumo ? `<span class="badge badge-blue" style="font-size:11px;">${_esc(c.categoria_insumo)}</span>` : ''}</div>
            </div>
        </div>

        <div class="cv-ticket">
            <div class="cv-row">
                <span class="cv-row-label"><i data-lucide="hash"></i> Cantidad</span>
                <span class="cv-row-value">${parseInt(c.cantidad) || 0} ${_esc(c.unidad_medida || '')}</span>
            </div>
            <div class="cv-row">
                <span class="cv-row-label"><i data-lucide="calculator"></i> Costo por ${_esc(c.unidad_medida || 'unidad')}</span>
                <span class="cv-row-value">S/ ${costoUnitario.toFixed(4)}</span>
            </div>
            <div class="cv-total-row">
                <span class="cv-row-label"><i data-lucide="wallet"></i> Costo total</span>
                <span class="cv-total-value">S/ ${parseFloat(c.costo || 0).toFixed(2)}</span>
            </div>
        </div>

        <div class="cv-meta">
            <div class="cv-meta-row"><i data-lucide="map-pin"></i> <strong>${_esc(c.lugar_compra || '—')}</strong></div>
            <div class="cv-meta-row"><i data-lucide="calendar"></i> <strong style="text-transform:capitalize;">${fechaCompleta}</strong></div>
            <div class="cv-meta-row"><i data-lucide="clock"></i> <strong style="font-family:var(--mono);">${horaCompleta}</strong></div>
        </div>

        ${c.observacion ? `
        <div class="cv-obs">
            <span class="lbl">Observación</span>
            ${_esc(c.observacion)}
        </div>` : ''}
    `;
    document.getElementById('modal-ver-compra').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}
function cerrarModalVerCompra() {
    document.getElementById('modal-ver-compra').style.display = 'none';
}

function cerrarModalCompra() {
    document.getElementById('modal-compra').style.display = 'none';
}

function abrirEliminarCompra(id, nombre) {
    _compraEliminarId = id;
    document.getElementById('eliminar-compra-nombre').textContent = nombre || 'esta compra';
    document.getElementById('modal-eliminar-compra').style.display = 'flex';
}

function cerrarModalEliminarCompra() {
    _compraEliminarId = null;
    document.getElementById('modal-eliminar-compra').style.display = 'none';
}

async function guardarCompra() {
    const id = document.getElementById('compra-id').value;
    const categoria = document.getElementById('compra-categoria-insumo').value.trim();
    const nombre = document.getElementById('compra-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('compra-cantidad').value);
    const costo = parseFloat(document.getElementById('compra-costo').value);
    const unidad = document.getElementById('compra-unidad').value.trim();
    const lugar = document.getElementById('compra-lugar').value.trim();
    const observacion = document.getElementById('compra-observacion').value.trim();

    if (!categoria) return mostrarMensaje('Selecciona una categoría de insumo', 'warn');
    if (!nombre) return mostrarMensaje('Ingresa el nombre del insumo', 'warn');
    if (!lugar) return mostrarMensaje('Ingresa el lugar de compra', 'warn');
    if (!cantidad || cantidad < 1) return mostrarMensaje('La cantidad debe ser mayor a 0', 'warn');
    if (cantidad > 10000) return mostrarMensaje('La cantidad parece demasiado alta, verifica', 'warn');
    if (!costo || costo <= 0) return mostrarMensaje('Ingresa un costo válido', 'warn');
    if (costo > 99999) return mostrarMensaje('El costo parece demasiado alto, verifica', 'warn');
    const unidadesPorCategoria = {
        'Tela':       ['metros', 'yardas', 'rollo'],
        'Hilo':       ['cono', 'rollo', 'kilos', 'unidad'],
        'Botón':      ['unidad', 'docena', 'paquete'],
        'Cierre':     ['unidad', 'docena', 'paquete'],
        'Elástico':   ['metros', 'yardas', 'rollo'],
        'Etiqueta':   ['unidad', 'docena', 'paquete', 'rollo'],
        'Entretela':  ['metros', 'yardas', 'rollo'],
        'Accesorio':  ['unidad', 'docena', 'paquete'],
        'Empaque':    ['unidad', 'docena', 'paquete', 'rollo'],
        'Otro':       ['metros', 'yardas', 'kilos', 'unidad', 'docena', 'cono', 'rollo', 'paquete']
    };
    const unidadesPermitidas = unidadesPorCategoria[categoria];
    if (unidadesPermitidas && !unidadesPermitidas.includes(unidad)) {
        return mostrarMensaje(`Para "${categoria}" las unidades válidas son: ${unidadesPermitidas.join(', ')}`, 'warn');
    }

    const btn = document.getElementById('btn-guardar-compra');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const res = await fetch(id ? `/api/compras/${id}` : '/api/compras', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_insumo: nombre,
                categoria_insumo: categoria || null,
                observacion: observacion || null,
                cantidad,
                costo,
                unidad_medida: unidad,
                lugar_compra: lugar || 'Sin especificar'
            })
        });

        const json = await res.json();

        if (json.ok) {
            cerrarModalCompra();
            cargarCompras();
            cargarInsumos();
            mostrarMensaje(json.mensaje || 'Compra guardada correctamente', 'ok');
        } else {
            mostrarMensaje(json.mensaje || 'No se pudo guardar', 'error');
        }
    } catch (e) {
        console.error('Error guardando compra:', e);
        mostrarMensaje('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar compra';
    }
}

async function confirmarEliminarCompra() {
    if (!_compraEliminarId) return;

    const btn = document.getElementById('btn-confirmar-eliminar-compra');
    const txt = document.getElementById('btn-eliminar-compra-text');

    btn.disabled = true;
    txt.textContent = 'Eliminando...';

    try {
        const res = await fetch(`/api/compras/${_compraEliminarId}`, {
            method: 'DELETE'
        });
        const json = await res.json();

        if (json.ok) {
            cerrarModalEliminarCompra();
            cargarCompras();
            cargarInsumos();
            mostrarMensaje(json.mensaje || 'Compra eliminada correctamente', 'ok');
        } else {
            mostrarMensaje(json.mensaje || 'No se pudo eliminar', 'error');
        }
    } catch (e) {
        console.error('Error eliminando compra:', e);
        mostrarMensaje('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        txt.textContent = 'Sí, eliminar';
    }
}

function mostrarMensaje(msg, tipo = 'ok') {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg ${tipo}`;
    toast.textContent = msg;

    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

function _fmtFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const accion = btn.dataset.accion;
    const id = btn.id;

    if (accion === 'ver') abrirVerCompra(btn.dataset.id);
    if (accion === 'eliminar') abrirEliminarCompra(btn.dataset.id, btn.dataset.nombre);

    if (id === 'btn-nueva-compra') abrirNuevaCompra();
    if (id === 'btn-cancelar-compra') cerrarModalCompra();
    if (id === 'btn-guardar-compra') guardarCompra();
    if (id === 'btn-cancelar-eliminar-compra') cerrarModalEliminarCompra();
    if (id === 'btn-confirmar-eliminar-compra') confirmarEliminarCompra();
    if (id === 'btn-cerrar-ver-compra') cerrarModalVerCompra();
});

function cargar_compras() {
    cargarCompras();
    cargarInsumos();
}

document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const modalCompra = document.getElementById('modal-compra');
    const modalEliminar = document.getElementById('modal-eliminar-compra');
    const modalVer = document.getElementById('modal-ver-compra');
    if (modalCompra && modalCompra.style.display !== 'none') cerrarModalCompra();
    if (modalEliminar && modalEliminar.style.display !== 'none') cerrarModalEliminarCompra();
    if (modalVer && modalVer.style.display !== 'none') cerrarModalVerCompra();
});