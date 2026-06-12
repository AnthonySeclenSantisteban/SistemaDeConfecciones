let _comprasData = [];
let _compraEliminarId = null;

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
                        <button class="btn-icon" title="Editar" data-accion="editar" data-id="${c.id_compra}">✏️</button>
                        <button class="btn-icon btn-icon-danger" title="Eliminar" data-accion="eliminar" data-id="${c.id_compra}" data-nombre="${_esc(c.nombre_insumo)}">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error cargando compras:', e);
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
    document.getElementById('compra-unidad').value = 'metros';
    document.getElementById('compra-lugar').value = '';
    document.getElementById('compra-observacion').value = '';
    document.getElementById('modal-compra').style.display = 'flex';
}

function abrirEditarCompra(id) {
    const c = _comprasData.find(x => String(x.id_compra) === String(id));
    if (!c) return;

    document.getElementById('compra-id').value = c.id_compra;
    document.getElementById('modal-compra-titulo').textContent = 'Editar compra de insumo';
    document.getElementById('compra-categoria-insumo').value = c.categoria_insumo || '';
    document.getElementById('compra-nombre').value = c.nombre_insumo || '';
    document.getElementById('compra-cantidad').value = c.cantidad || 1;
    document.getElementById('compra-costo').value = c.costo || '';
    const catEditar = c.categoria_insumo || '';
    const selectUnidad = document.getElementById('compra-unidad');
    const permitidasEditar = _unidadesPorCat[catEditar] || Object.keys(_todasUnidades);
    selectUnidad.innerHTML = permitidasEditar.map(u =>
        `<option value="${u}">${_todasUnidades[u]}</option>`
    ).join('');
    selectUnidad.value = c.unidad_medida || permitidasEditar[0];
    document.getElementById('compra-lugar').value = c.lugar_compra || '';
    document.getElementById('compra-observacion').value = c.observacion || '';
    document.getElementById('modal-compra').style.display = 'flex';
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

    if (accion === 'editar') abrirEditarCompra(btn.dataset.id);
    if (accion === 'eliminar') abrirEliminarCompra(btn.dataset.id, btn.dataset.nombre);

    if (id === 'btn-nueva-compra') abrirNuevaCompra();
    if (id === 'btn-cerrar-modal-compra' || id === 'btn-cancelar-compra') cerrarModalCompra();
    if (id === 'btn-guardar-compra') guardarCompra();
    if (id === 'btn-cerrar-eliminar-compra' || id === 'btn-cancelar-eliminar-compra') cerrarModalEliminarCompra();
    if (id === 'btn-confirmar-eliminar-compra') confirmarEliminarCompra();

    if (e.target.id === 'modal-compra') cerrarModalCompra();
    if (e.target.id === 'modal-eliminar-compra') cerrarModalEliminarCompra();
});

function cargar_compras() {
    cargarCompras();
}