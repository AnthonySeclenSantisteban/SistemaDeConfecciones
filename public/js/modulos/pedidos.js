let _pPagActual = 1;
const _pPorPagina = 15;
let _pBusqTimer = null;
let _pCambiandoEstado = false;
let _pListenerActivo = false;

function cargar_pedidos() {
    _pPagActual = 1;
    _pListenerActivo = false;
    _iniciarListenersPedidos();
    cargarStatsPedidos();
    cargarTablaPedidos();
}

async function cargarStatsPedidos() {
    try {
        const res = await fetch('/api/pedidos?limit=9999&page=1');
        const json = await res.json();
        if (!json.ok) return;
        const data = json.data;

        const total = json.total || 0;
        const pendientes = data.filter(p => p.estado === 'pendiente').length;
        const enProceso = data.filter(p => ['procesando', 'enviado'].includes(p.estado)).length;
        const entregados = data.filter(p => p.estado === 'entregado').length;
        const cancelados = data.filter(p => p.estado === 'cancelado').length;

        _setText('statTotalPedidos', total);
        _setText('statPendientes', pendientes);
        _setText('statEnProceso', enProceso);
        _setText('statEntregados', entregados);
        _setText('statCancelados', cancelados);
    } catch (e) {
        console.error('cargarStatsPedidos:', e);
    }
}

async function cargarTablaPedidos(page = 1) {
    _pPagActual = page;
    _show('spinnerPedidos');
    _hide('tablaPedidosWrap');
    _hide('emptyPedidos');

    const params = _construirParamsPedidos(page);

    try {
        const res = await fetch(`/api/pedidos?${params}`);
        const json = await res.json();
        _hide('spinnerPedidos');

        if (!json.ok || !json.data.length) {
            _show('emptyPedidos');
            _setText('pedidosTotalRegistros', '0 registros');
            return;
        }

        _setText('pedidosTotalRegistros', `${json.total} registros`);
        _show('tablaPedidosWrap');

        document.getElementById('tablaPedidosBody').innerHTML =
            json.data.map(p => _filaPedido(p)).join('');

        _renderPaginacionPedidos('pedidosPaginacion', json.page, json.pages);

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        _hide('spinnerPedidos');
        _show('emptyPedidos');
    }
}

function _construirParamsPedidos(page) {
    const p = new URLSearchParams({ page, limit: _pPorPagina });
    const cliente = _val('filtroCliente').trim();
    const codigo = _val('filtroCodigo').trim();
    const estado = _val('filtroEstadoPedido');
    const desde = _val('filtroFechaDesde');
    const hasta = _val('filtroFechaHasta');
    if (cliente) p.set('cliente', cliente);
    if (codigo) p.set('codigo', codigo);
    if (estado) p.set('estado', estado);
    if (desde) p.set('fecha_desde', desde);
    if (hasta) p.set('fecha_hasta', hasta);
    return p.toString();
}

function _filaPedido(p) {
    const cliente = `${_esc(p.nombres || '')} ${_esc(p.apellidos || '')}`.trim() || '—';
    const fecha = _fmtFecha(p.fecha_pedido);
    const total = `S/ ${parseFloat(p.total).toFixed(2)}`;
    const entrega = p.tipo_entrega === 'delivery'
        ? '<span class="badge badge-blue">Delivery</span>'
        : '<span class="badge badge-accent">Recojo</span>';

    return `
    <tr>
        <td style="font-family:var(--mono);font-size:11px;">${_esc(p.codigo_seguimiento || '—')}</td>
        <td><strong>${cliente}</strong>
            ${p.telefono ? `<div style="font-size:11px;color:var(--muted);">${p.telefono}</div>` : ''}
        </td>
        <td style="font-size:12px;color:var(--muted);">${fecha}</td>
        <td style="font-weight:600;color:var(--accent);">${total}</td>
        <td>${entrega}</td>
        <td>${_badgeEstadoPedido(p.estado)}</td>
        <td style="text-align:center;">
            <div style="display:flex;gap:6px;justify-content:center;">
                <button class="btn-icon" title="Ver detalle"
                    onclick="abrirDetallePedido(${p.id_pedido})">
                    <i data-lucide="eye" style="width:13px;height:13px;"></i>
                </button>
                ${p.estado !== 'cancelado' && p.estado !== 'entregado' ? `
                <button class="btn-icon" title="Cambiar estado"
                    onclick="abrirCambiarEstado(${p.id_pedido}, '${_esc(p.codigo_seguimiento)}', '${p.estado}', '${p.tipo_entrega || ''}')">
                    <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i>
                </button>` : ''}
            </div>
        </td>
    </tr>`;
}

async function abrirDetallePedido(id) {
    _show('modalDetallePedido');
    document.getElementById('modalPedidoBody').innerHTML =
        '<div class="spinner-wrap"><div class="spinner"></div></div>';
    document.getElementById('modalPedidoBotones').innerHTML = '';

    try {
        const res = await fetch(`/api/pedidos/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);

        const { pedido: p, items } = json.data;

        _setText('modalPedidoTitulo', `Pedido — ${p.codigo_seguimiento || '#' + id}`);
        _setText('modalPedidoSubtitulo', _fmtFechaHora(p.fecha_pedido));

        document.getElementById('modalPedidoBody').innerHTML = `
        <div style="padding:16px 24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;">CLIENTE</p>
                <p style="font-weight:600;">${_esc(p.nombres)} ${_esc(p.apellidos || '')}</p>
                <p style="font-size:12px;color:var(--muted);">
                    ${p.dni ? `DNI: ${p.dni} · ` : ''}Tel: ${p.telefono || '—'}
                </p>
                ${p.correo ? `<p style="font-size:12px;color:var(--muted);">${_esc(p.correo)}</p>` : ''}
            </div>
            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;">ENTREGA</p>
                <p style="font-size:13px;font-weight:600;">
                    ${p.tipo_entrega === 'delivery' ? '🚚 Delivery' : '🏪 Recojo en tienda'}
                </p>
                ${p.direccion ? `<p style="font-size:12px;color:var(--muted);">${_esc(p.direccion)}${p.distrito ? ', ' + _esc(p.distrito) : ''}</p>` : ''}
                ${p.referencia ? `<p style="font-size:11px;color:var(--muted);">Ref: ${_esc(p.referencia)}</p>` : ''}
            </div>
            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;">PAGO</p>
                <p style="font-size:13px;">${_capitalizarMetodo(p.metodo_pago)}</p>
                <p style="font-size:12px;">${_badgePagoPedido(p.estado_pago)}</p>
            </div>
            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;">ESTADO PEDIDO</p>
                ${_badgeEstadoPedido(p.estado)}
                <p style="font-size:11px;color:var(--muted);margin-top:4px;">
                    Envío: ${_badgeEstadoEntrega(p.estado_entrega)}
                </p>
            </div>
        </div>

        <div style="overflow-x:auto;padding:0 24px;">
            <table class="tabla">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Talla / Color</th>
                        <th>P. Unit.</th>
                        <th>Cant.</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(i => `
                    <tr>
                        <td>${_esc(i.nombre_producto)}</td>
                        <td style="font-size:12px;color:var(--muted);">
                            ${[i.nombre_talla, i.color].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td>S/ ${parseFloat(i.precio_unitario).toFixed(2)}</td>
                        <td>${i.cantidad}</td>
                        <td style="font-weight:600;">S/ ${parseFloat(i.subtotal).toFixed(2)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>

        <div style="padding:14px 24px 20px;display:flex;justify-content:flex-end;">
            <div style="font-size:16px;font-weight:700;border-top:1px solid var(--border);padding-top:10px;">
                TOTAL: <span style="color:var(--accent);">S/ ${parseFloat(p.total).toFixed(2)}</span>
            </div>
        </div>`;

        let botones = `<button class="btn-secondary" id="btnCerrarDetallePedidoFooter">Cerrar</button>`;
        if (p.estado !== 'cancelado' && p.estado !== 'entregado') {
            botones += `
            <button class="btn-primary" onclick="cerrarModalPedido('modalDetallePedido');
                abrirCambiarEstado(${id}, '${_esc(p.codigo_seguimiento)}', '${p.estado}')">
                <i data-lucide="refresh-cw"></i> Cambiar estado
            </button>`;
        }
        document.getElementById('modalPedidoBotones').innerHTML = botones;

        document.getElementById('btnCerrarDetallePedidoFooter')?.addEventListener('click', () => {
            cerrarModalPedido('modalDetallePedido');
        });

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        document.getElementById('modalPedidoBody').innerHTML =
            `<div class="alert alert-error" style="margin:20px;">Error: ${_esc(e.message)}</div>`;
    }
}

function abrirCambiarEstado(id, codigo, estadoActual, tipoEntrega) {
    document.getElementById('cambiarEstadoIdPedido').value = id;
    _setText('cambiarEstadoCodigo', codigo);

    const esRecojo = (tipoEntrega || '').toLowerCase().includes('recojo');
    const sel = document.getElementById('selectNuevoEstado');

    sel.innerHTML = esRecojo ? `
        <option value="pendiente">Pendiente</option>
        <option value="listo_recoger">Listo para recoger</option>
        <option value="entregado">Entregado</option>
        <option value="cancelado">Cancelado</option>
    ` : `
        <option value="pendiente">Pendiente</option>
        <option value="procesando">Procesando</option>
        <option value="enviado">Enviado</option>
        <option value="entregado">Entregado</option>
        <option value="cancelado">Cancelado</option>
    `;

    sel.value = estadoActual;
    _hide('alertaCambioEstado');
    _show('modalCambiarEstado');
}

async function confirmarCambiarEstado() {
    if (_pCambiandoEstado) return;

    const id = document.getElementById('cambiarEstadoIdPedido').value;
    const estado = _val('selectNuevoEstado');

    if (!estado) {
        _setText('alertaCambioEstadoMsg', 'Selecciona un estado');
        _show('alertaCambioEstado');
        return;
    }

    _pCambiandoEstado = true;
    const btn = document.getElementById('btnConfirmarCambiarEstado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const res = await fetch(`/api/pedidos/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        const json = await res.json();

        if (json.ok) {
            cerrarModalPedido('modalCambiarEstado');
            _mostrarToastPedido(json.mensaje, 'success');
            cargarStatsPedidos();
            cargarTablaPedidos(_pPagActual);
        } else {
            _setText('alertaCambioEstadoMsg', json.mensaje);
            _show('alertaCambioEstado');
        }
    } catch (e) {
        _setText('alertaCambioEstadoMsg', 'Error de conexión');
        _show('alertaCambioEstado');
    } finally {
        _pCambiandoEstado = false;
        btn.disabled = false;
        btn.textContent = 'Confirmar cambio';
    }
}

function cerrarModalPedido(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function aplicarFiltrosPedidos() {
    clearTimeout(_pBusqTimer);
    _pBusqTimer = setTimeout(() => cargarTablaPedidos(1), 350);
}

function limpiarFiltrosPedidos() {
    ['filtroCliente', 'filtroCodigo', 'filtroFechaDesde', 'filtroFechaHasta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const sel = document.getElementById('filtroEstadoPedido');
    if (sel) sel.selectedIndex = 0;
    cargarTablaPedidos(1);
}

function _iniciarListenersPedidos() {
    if (_pListenerActivo) return;
    _pListenerActivo = true;

    document.addEventListener('click', function _handler(e) {
        if (!document.getElementById('modalDetallePedido')) {
            document.removeEventListener('click', _handler);
            _pListenerActivo = false;
            return;
        }
        const id = e.target.id;
        if (id === 'btnCerrarDetallePedido') cerrarModalPedido('modalDetallePedido');
        if (id === 'btnCerrarCambiarEstado' || id === 'btnCancelarCambiarEstado') cerrarModalPedido('modalCambiarEstado');
        if (id === 'btnConfirmarCambiarEstado') confirmarCambiarEstado();
        if (e.target === document.getElementById('modalDetallePedido')) cerrarModalPedido('modalDetallePedido');
        if (e.target === document.getElementById('modalCambiarEstado')) cerrarModalPedido('modalCambiarEstado');
    });
}

function _renderPaginacionPedidos(containerId, paginaActual, totalPaginas) {
    const el = document.getElementById(containerId);
    if (!el || totalPaginas <= 1) { if (el) el.innerHTML = ''; return; }

    let html = '';
    const delta = 2;
    const rango = [];
    for (let i = Math.max(2, paginaActual - delta); i <= Math.min(totalPaginas - 1, paginaActual + delta); i++) {
        rango.push(i);
    }
    const mostrar = [1, ...rango, totalPaginas];
    let prev = null;
    mostrar.forEach(p => {
        if (prev !== null && p - prev > 1) html += `<span style="padding:0 4px;color:var(--muted);">…</span>`;
        html += `<button class="page-btn ${p === paginaActual ? 'active' : ''}"
            onclick="cargarTablaPedidos(${p})">${p}</button>`;
        prev = p;
    });

    const btnPrev = paginaActual > 1
        ? `<button class="page-btn" onclick="cargarTablaPedidos(${paginaActual - 1})">‹</button>` : '';
    const btnNext = paginaActual < totalPaginas
        ? `<button class="page-btn" onclick="cargarTablaPedidos(${paginaActual + 1})">›</button>` : '';

    el.innerHTML = btnPrev + html + btnNext;
}

function _badgeEstadoPedido(estado) {
    const map = {
        pendiente: 'badge-amber', procesando: 'badge-blue',
        enviado: 'badge-accent', entregado: 'badge-green', cancelado: 'badge-red'
    };
    const labels = {
        pendiente: 'Pendiente', procesando: 'Procesando',
        enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado'
    };
    return `<span class="badge ${map[estado] || 'badge-blue'}">${labels[estado] || estado}</span>`;
}

function _badgeEstadoEntrega(estado) {
    const map = {
        pendiente: 'badge-amber', en_camino: 'badge-blue',
        entregado: 'badge-green', demora: 'badge-red', fallido: 'badge-red'
    };
    const labels = {
        pendiente: 'Pendiente', en_camino: 'En camino',
        entregado: 'Entregado', demora: 'Demora', fallido: 'Fallido'
    };
    return `<span class="badge ${map[estado] || 'badge-blue'}">${labels[estado] || estado || '—'}</span>`;
}

function _badgePagoPedido(estado) {
    if (estado === 'pagado') return '<span class="badge badge-green">Pagado</span>';
    return '<span class="badge badge-amber">Pendiente</span>';
}

function _mostrarToastPedido(msg, tipo = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<span>${_esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, 3000);
}

function _val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function _setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function _show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function _hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _fmtFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _fmtFechaHora(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _capitalizarMetodo(m) {
    const map = { yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia BCP', efectivo: 'Efectivo', visa: 'Tarjeta Visa' };
    return map[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : '—');
}