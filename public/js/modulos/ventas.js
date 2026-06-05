let _vPagActual    = 1;
const _vPorPagina  = 15;
let _vTotalPags    = 1;
let _vItems        = [];
let _vBusqTimer    = null;
let _vGuardando    = false;
let _vReniecFiltro = null;
let _vHistorialId  = null;

function cargar_ventas() {
    _vPagActual    = 1;
    _vItems        = [];
    _vReniecFiltro = null;
    cargarStatsVentas();
    cargarTablaVentas();
}

async function cargarStatsVentas() {
    try {
        const res  = await fetch('/api/ventas/stats');
        const json = await res.json();
        if (!json.ok) return;
        const d = json.data;
        _setText('statTotalVentas',     d.total_ventas);
        _setText('statVentasPagadas',   d.ventas_pagadas);
        _setText('statVentasPendientes',d.ventas_pendientes);
        _setText('statIngresosMes',     `S/ ${parseFloat(d.ingresos_mes).toFixed(2)}`);
        _setText('statMontoPagadas',    `S/ ${parseFloat(d.monto_pagadas).toFixed(2)} acumulado`);
        _setText('statMesNombre',       d.mes_nombre || 'mes actual');
    } catch (e) { console.error('cargarStatsVentas:', e); }
}

async function cargarTablaVentas(page = 1) {
    _vPagActual = page;
    _show('spinnerVentas');
    _hide('tablaVentasWrap');
    _hide('emptyVentas');

    const params = _construirParams(page);

    try {
        const res  = await fetch(`/api/ventas?${params}`);
        const json = await res.json();
        _hide('spinnerVentas');

        if (!json.ok || !json.data.length) {
            _show('emptyVentas');
            _setText('ventasTotalRegistros', '0 registros');
            return;
        }

        _vTotalPags = json.pages || 1;
        _setText('ventasTotalRegistros', `${json.total} registros`);
        _show('tablaVentasWrap');

        document.getElementById('tablaVentasBody').innerHTML =
            json.data.map(v => _filaVenta(v)).join('');

        _renderPaginacion('ventasPaginacion', json.page, json.pages, cargarTablaVentas);
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        _hide('spinnerVentas');
        _show('emptyVentas');
        console.error('cargarTablaVentas:', e);
    }
}

function _construirParams(page) {
    const p = new URLSearchParams({ page, limit: _vPorPagina });
    const dni     = _val('filtroDni').trim();
    const numV    = _val('filtroNumeroVenta').trim();
    const estado  = _val('filtroEstadoVenta');
    const tipoDoc = _val('filtroTipoDoc');
    const desde   = _val('filtroFechaDesde');
    const hasta   = _val('filtroFechaHasta');

    if (_vReniecFiltro?.dni || dni) p.set('dni', _vReniecFiltro?.dni || dni);
    if (numV)    p.set('numero_venta', numV);
    if (estado)  p.set('estado', estado);
    if (tipoDoc) p.set('tipo_documento', tipoDoc);
    if (desde)   p.set('fecha_desde', desde);
    if (hasta)   p.set('fecha_hasta', hasta);
    return p.toString();
}

function _filaVenta(v) {
    const nombre  = `${_esc(v.nombres || '')} ${_esc(v.apellidos || '')}`.trim() || '—';
    const fecha   = _fmtFecha(v.fecha_venta);
    const total   = parseFloat(v.total || 0);
    const deuda   = v.estado_pago === 'pagado' ? 0 : total;

    return `
    <tr>
        <td style="font-size:12px;color:var(--muted);">${v.id_venta}</td>
        <td style="font-family:var(--mono);font-size:12px;font-weight:600;">${_esc(v.numero_venta || '—')}</td>
        <td>${_badgeTipoDoc(v.tipo_documento)}</td>
        <td><strong>${nombre}</strong></td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--muted);">${v.dni || '—'}</td>
        <td style="font-size:12px;">${_esc(v.atendio || '—')}</td>
        <td style="font-size:12px;color:var(--muted);">${fecha}</td>
        <td style="font-weight:600;color:var(--accent);">S/ ${total.toFixed(2)}</td>
        <td>${_badgeMetodoPago(v.metodo_pago)}</td>
        <td style="font-weight:600;color:${deuda > 0 ? '#dc2626' : '#059669'};">S/ ${deuda.toFixed(2)}</td>
        <td>${_badgeEstadoVenta(v.estado)}</td>
        <td style="text-align:center;">
            <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                <button class="btn-icon" title="Ver detalle" onclick="abrirDetalleVenta(${v.id_venta})">
                    <i data-lucide="eye" style="width:13px;height:13px;"></i>
                </button>
                <button class="btn-icon" title="Historial de pagos" onclick="abrirHistorialPagos(${v.id_venta},'${_esc(v.numero_venta)}',${total},'${v.estado}','${v.estado_pago}')">
                    <i data-lucide="credit-card" style="width:13px;height:13px;"></i>
                </button>
                ${v.estado !== 'anulada' ? `
                <button class="btn-icon" title="Imprimir documento" onclick="abrirImprimirVenta(${v.id_venta})">
                    <i data-lucide="printer" style="width:13px;height:13px;"></i>
                </button>
                ${v.estado === 'pendiente' ? `
                <button class="btn-icon" title="Marcar como pagada" onclick="cambiarEstadoVenta(${v.id_venta},'pagada')">
                    <i data-lucide="check-circle" style="width:13px;height:13px;"></i>
                </button>` : `
                <button class="btn-icon" title="Revertir a pendiente" onclick="cambiarEstadoVenta(${v.id_venta},'pendiente')">
                    <i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i>
                </button>`}
                <button class="btn-icon btn-icon-danger" title="Anular venta" onclick="abrirAnularVenta(${v.id_venta})">
                    <i data-lucide="x-circle" style="width:13px;height:13px;"></i>
                </button>` : ''}
            </div>
        </td>
    </tr>`;
}

/* ── FILTROS ── */

function aplicarFiltrosVentas() {
    clearTimeout(_vBusqTimer);
    _vBusqTimer = setTimeout(() => cargarTablaVentas(1), 350);
}

function limpiarFiltrosVentas() {
    ['filtroDni','filtroNumeroVenta','filtroFechaDesde','filtroFechaHasta']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['filtroEstadoVenta','filtroTipoDoc']
        .forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
    limpiarReniecFiltro();
    cargarTablaVentas(1);
}

async function buscarReniecFiltro() {
    const dni = _val('filtroDni').trim();
    if (!/^\d{8}$/.test(dni)) { _mostrarToast('DNI debe tener 8 dígitos', 'error'); return; }
    const btn = document.getElementById('btnReniecFiltro');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" style="width:13px;height:13px;"></i>'; if (window.lucide) lucide.createIcons(); }
    try {
        const res  = await fetch(`/api/reniec/${dni}`);
        const json = await res.json();
        if (json.ok) {
            _vReniecFiltro = { dni, nombre: json.nombre };
            _show('reniecResultFiltro');
            _setText('reniecNombreFiltro', json.nombre);
            cargarTablaVentas(1);
        } else {
            _vReniecFiltro = { dni, nombre: null };
            _hide('reniecResultFiltro');
            cargarTablaVentas(1);
        }
    } catch (e) { console.error(e); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="user-search"></i> RENIEC'; if (window.lucide) lucide.createIcons(); }
    }
}

function limpiarReniecFiltro() {
    _vReniecFiltro = null;
    _hide('reniecResultFiltro');
    _setText('reniecNombreFiltro', '');
    const el = document.getElementById('filtroDni');
    if (el) el.value = '';
}


async function abrirDetalleVenta(id) {
    _show('modalDetalleVenta');
    document.getElementById('modalDetalleBody').innerHTML =
        '<div class="spinner-wrap"><div class="spinner"></div></div>';

    document.getElementById('modalDetalleBotones').innerHTML = '';

    try {
        const res = await fetch(`/api/ventas/${id}`);
        const json = await res.json();

        if (!json.ok) throw new Error(json.mensaje);

        const { venta: v, items } = json.data;
        const deuda = v.estado_pago === 'pagado' ? 0 : parseFloat(v.total);

        _setText(
            'modalDetalleTitulo',
            `Detalle — ${v.numero_venta || `Venta #${id}`}`
        );

        _setText(
            'modalDetalleSubtitulo',
            `${v.tipo_documento === 'boleta' ? 'Boleta' : 'Nota de venta'} · ${_fmtFechaHora(v.fecha_venta)}`
        );

        document.getElementById('modalDetalleBody').innerHTML = `
        <div style="padding:20px 24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;">Cliente</p>
                <p style="font-weight:600;">${_esc(v.nombres)} ${_esc(v.apellidos || '')}</p>
                <p style="font-size:12px;color:var(--muted);">DNI: ${v.dni || '—'} · Tel: ${v.telefono || '—'}</p>
            </div>

            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;">Pago</p>
                <p style="font-size:13px;">${_capitalizarMetodo(v.metodo_pago)}</p>
                <p style="font-size:12px;margin-top:4px;">${_badgeEstadoVenta(v.estado)}</p>
            </div>

            <div>
                <p style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;">Deuda</p>
                <p style="font-size:18px;font-weight:700;color:${deuda > 0 ? '#dc2626' : '#059669'};">
                    S/ ${deuda.toFixed(2)}
                </p>
                <p style="font-size:11px;color:var(--muted);">
                    Atendió: ${_esc(v.atendio || '—')}
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
                        <td style="font-weight:600;">
                            S/ ${parseFloat(i.subtotal).toFixed(2)}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div style="padding:16px 24px 20px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <div style="display:flex;gap:32px;font-size:13px;">
                <span style="color:var(--muted);">Subtotal</span>
                <strong>S/ ${parseFloat(v.subtotal).toFixed(2)}</strong>
            </div>

            ${parseFloat(v.descuento) > 0 ? `
            <div style="display:flex;gap:32px;font-size:13px;">
                <span style="color:var(--muted);">Descuento</span>
                <strong style="color:var(--error);">
                    - S/ ${parseFloat(v.descuento).toFixed(2)}
                </strong>
            </div>
            ` : ''}

            <div style="display:flex;gap:32px;font-size:16px;font-weight:700;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
                <span>TOTAL</span>
                <span style="color:var(--accent);">
                    S/ ${parseFloat(v.total).toFixed(2)}
                </span>
            </div>
        </div>

        ${v.observaciones ? `
        <div style="padding:0 24px 16px;">
            <p style="font-size:11px;color:var(--muted);">
                OBSERVACIONES
            </p>
            <p style="font-size:13px;">
                ${_esc(v.observaciones)}
            </p>
        </div>
        ` : ''}`;

        // Sin botones en el footer
        document.getElementById('modalDetalleBotones').innerHTML = '';

        if (window.lucide) {
            lucide.createIcons();
        }

    } catch (e) {
        document.getElementById('modalDetalleBody').innerHTML =
            `<div class="alert alert-danger" style="margin:20px;">
                Error: ${_esc(e.message)}
            </div>`;
    }
}



async function abrirHistorialPagos(id, numeroVenta, total, estadoVenta, estadoPago) {
    _vHistorialId = id;
    _show('modalHistorialPagos');
    _setText('historialSubtitulo', `Venta N° ${numeroVenta}`);

    const pagado = estadoPago === 'pagado';
    const deuda  = pagado ? 0 : total;

    _setText('historialTotal',  `S/ ${parseFloat(total).toFixed(2)}`);
    _setText('historialPagado', `S/ ${pagado ? parseFloat(total).toFixed(2) : '0.00'}`);
    _setText('historialDeuda',  `S/ ${parseFloat(deuda).toFixed(2)}`);

    const btnMarcar = document.getElementById('historialBtnMarcar');
    if (btnMarcar) btnMarcar.style.display = (estadoVenta === 'pendiente' && !pagado) ? '' : 'none';

    const tbody = document.getElementById('historialBody');
    const vacio = document.getElementById('historialVacio');
    tbody.innerHTML = '';
    _hide('historialVacio');

    try {
        const res  = await fetch(`/api/ventas/${id}/pagos`);
        const json = await res.json();

        if (!json.ok || !json.data.length) {
            _show('historialVacio');
            _setText('historialFooterInfo', 'Sin pagos registrados');
            return;
        }

        tbody.innerHTML = json.data.map(p => `
            <tr>
                <td style="font-size:12px;">${_fmtFecha(p.fecha_pago)}</td>
                <td>${_badgeMetodoPago(p.metodo_pago)}</td>
                <td style="font-family:var(--mono);font-size:12px;">${p.numero_operacion || '—'}</td>
                <td>${p.estado === 'pagado'
                    ? '<span class="badge badge-green">✓ Pagado</span>'
                    : '<span class="badge badge-amber">Pendiente</span>'}</td>
                <td style="text-align:right;font-weight:600;">S/ ${parseFloat(p.monto).toFixed(2)}</td>
            </tr>`).join('');

        const metodos = [...new Set(json.data.map(p => _capitalizarMetodo(p.metodo_pago)))].join(', ');
        _setText('historialFooterInfo', `Formas de pago: ${metodos}`);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--error);text-align:center;padding:16px;">Error al cargar pagos</td></tr>`;
    }

    if (window.lucide) lucide.createIcons();
}

async function _marcarPagadoDesdeHistorial() {
    if (!_vHistorialId) return;
    await cambiarEstadoVenta(_vHistorialId, 'pagada');
    cerrarModalVentas('modalHistorialPagos');
}

/* ── NUEVA VENTA ── */

function abrirModalNuevaVenta() {
    _vItems = [];
    _hide('nvTablaItems'); _show('nvSinItems'); _hide('nvTotalesWrap');
    _hide('alertaNuevaVenta'); _hide('reniecNVResult');
    ['nvDni','nvNombres','nvApellidos','nvTelefono','nvCorreo','nvBuscarProducto']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const desc = document.getElementById('nvDescuento'); if (desc) desc.value = '0';
    const tipo = document.getElementById('nvTipoDoc');   if (tipo) tipo.selectedIndex = 0;
    const met  = document.getElementById('nvMetodoPago');if (met)  met.selectedIndex = 0;
    _show('modalNuevaVenta');
    if (window.lucide) lucide.createIcons();
}

async function buscarReniecNV() {
    const dni = _val('nvDni').trim();
    if (!/^\d{8}$/.test(dni)) { mostrarAlertaNV('warning', 'DNI debe tener exactamente 8 dígitos'); return; }
    const btn = document.getElementById('btnReniecNV');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" style="width:13px;height:13px;"></i>'; if (window.lucide) lucide.createIcons(); }
    try {
        const res  = await fetch(`/api/reniec/${dni}`);
        const json = await res.json();
        if (json.ok && json.nombre) {
            const partes    = json.nombre.trim().split(' ');
            const apellidos = partes.slice(-2).join(' ');
            const nombres   = partes.slice(0, -2).join(' ') || partes[0];
            const elN = document.getElementById('nvNombres');   if (elN) elN.value   = nombres;
            const elA = document.getElementById('nvApellidos'); if (elA) elA.value   = apellidos;
            _show('reniecNVResult');
            _setText('reniecNVNombre', json.nombre);
            _hide('alertaNuevaVenta');
        } else {
            mostrarAlertaNV('warning', json.mensaje || 'DNI no encontrado. Ingresa los datos manualmente.');
        }
    } catch (e) { mostrarAlertaNV('danger', 'Error de conexión al consultar RENIEC'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="user-search"></i>'; if (window.lucide) lucide.createIcons(); }
    }
}

async function buscarProductoNV() {
    const q        = _val('nvBuscarProducto').trim();
    const dropdown = document.getElementById('nvDropdownProductos');
    clearTimeout(_vBusqTimer);
    if (q.length < 2) { _hide('nvDropdownProductos'); return; }
    _vBusqTimer = setTimeout(async () => {
        try {
            const res  = await fetch(`/api/ventas/productos/buscar?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            if (!json.ok || !json.data.length) {
                dropdown.innerHTML = '<div class="dropdown-item-empty">Sin resultados</div>';
                _show('nvDropdownProductos');
                return;
            }
            dropdown.innerHTML = json.data.map(p => `
                <div class="dropdown-item">
                    <strong>${_esc(p.nombre_producto)}</strong>
                    ${p.nombre_colegio ? `<span style="color:var(--muted);font-size:11px;"> — ${_esc(p.nombre_colegio)}</span>` : ''}
                    <span style="float:right;font-weight:600;color:var(--accent);">S/ ${parseFloat(p.precio_venta).toFixed(2)}</span>
                </div>`).join('');
            dropdown.querySelectorAll('.dropdown-item').forEach((el, idx) => {
                el.onclick = () => seleccionarProductoNV(json.data[idx]);
            });
            _show('nvDropdownProductos');
        } catch (e) { console.error('buscarProductoNV:', e); }
    }, 300);
}

function seleccionarProductoNV(producto) {
    _hide('nvDropdownProductos');
    const variantes = producto.variantes || [];
    if (!variantes.length) {
        _agregarItemNV({
            id_producto: producto.id_producto, id_variante: null,
            nombre: producto.nombre_producto, talla: '', color: '',
            precio_unitario: parseFloat(producto.precio_venta), stock: null
        });
        return;
    }
    const conStock = variantes.filter(v => v.stock > 0);
    if (!conStock.length) { mostrarAlertaNV('warning', `${producto.nombre_producto} sin stock disponible`); return; }
    _mostrarSelectorVariante(producto, conStock);
}

function _mostrarSelectorVariante(producto, variantes) {
    let modal = document.getElementById('_modalVarianteNV');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = '_modalVarianteNV';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
    <div class="modal" style="max-width:480px;">
        <div class="modal-header">
            <div class="modal-title">Seleccionar variante</div>
            <button class="modal-close" onclick="document.getElementById('_modalVarianteNV').style.display='none'">
                <i data-lucide="x" style="width:14px;height:14px;"></i>
            </button>
        </div>
        <div style="padding:16px 20px;">
            <p style="font-size:13px;margin-bottom:12px;font-weight:600;">${_esc(producto.nombre_producto)}</p>
            <div style="display:grid;gap:8px;">
                ${variantes.map(v => `
                <button class="btn-secondary" style="justify-content:space-between;width:100%;padding:10px 14px;"
                    onclick="_selVarianteElegida(${producto.id_producto},'${_esc(producto.nombre_producto)}',${v.id_variante},'${_esc(v.talla||'')}','${_esc(v.color)}',${parseFloat(producto.precio_venta)+parseFloat(v.precio_extra||0)},${v.stock})">
                    <span>Talla <strong>${_esc(v.talla||'—')}</strong> · Color <strong>${_esc(v.color)}</strong></span>
                    <span style="color:var(--muted);font-size:12px;">Stock: ${v.stock}</span>
                </button>`).join('')}
            </div>
        </div>
    </div>`;
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function _selVarianteElegida(id_producto, nombre, id_variante, talla, color, precio, stock) {
    const modal = document.getElementById('_modalVarianteNV');
    if (modal) modal.style.display = 'none';
    _agregarItemNV({ id_producto, id_variante, nombre, talla, color, precio_unitario: precio, stock });
}

function _agregarItemNV(item) {
    const idx = _vItems.findIndex(i => i.id_producto === item.id_producto && i.id_variante === item.id_variante);
    if (idx >= 0) {
        if (item.stock !== null && _vItems[idx].cantidad >= item.stock) {
            mostrarAlertaNV('warning', `Stock máximo alcanzado (${item.stock})`); return;
        }
        _vItems[idx].cantidad++;
    } else {
        _vItems.push({ ...item, cantidad: 1 });
    }
    _renderItemsNV();
    const el = document.getElementById('nvBuscarProducto'); if (el) el.value = '';
}

function _renderItemsNV() {
    if (!_vItems.length) {
        _show('nvSinItems'); _hide('nvTablaItems'); _hide('nvTotalesWrap'); return;
    }
    _hide('nvSinItems'); _show('nvTablaItems'); _show('nvTotalesWrap');
    document.getElementById('nvItemsBody').innerHTML = _vItems.map((item, i) => `
    <tr>
        <td>${_esc(item.nombre)}</td>
        <td style="font-size:12px;color:var(--muted);">${[item.talla,item.color].filter(Boolean).join(' / ')||'—'}</td>
        <td>S/ ${parseFloat(item.precio_unitario).toFixed(2)}</td>
        <td>
            <input type="number" min="1" max="${item.stock||999}" value="${item.cantidad}"
                style="width:60px;" onchange="_cambiarCantidadNV(${i},this.value)">
        </td>
        <td style="font-weight:600;">S/ ${(item.cantidad*item.precio_unitario).toFixed(2)}</td>
        <td>
            <button class="btn-icon btn-icon-danger" onclick="_eliminarItemNV(${i})">
                <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
            </button>
        </td>
    </tr>`).join('');
    calcularTotalNV();
    if (window.lucide) lucide.createIcons();
}

function _cambiarCantidadNV(idx, valor) {
    const cant = parseInt(valor);
    if (isNaN(cant) || cant < 1) { _renderItemsNV(); return; }
    const item = _vItems[idx];
    if (item.stock !== null && cant > item.stock) {
        mostrarAlertaNV('warning', `Stock disponible: ${item.stock}`);
        _vItems[idx].cantidad = item.stock;
    } else {
        _vItems[idx].cantidad = cant;
    }
    _renderItemsNV();
}

function _eliminarItemNV(idx) { _vItems.splice(idx, 1); _renderItemsNV(); }

function calcularTotalNV() {
    const subtotal  = _vItems.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
    const descuento = parseFloat(_val('nvDescuento') || 0) || 0;
    const total     = Math.max(0, subtotal - descuento);
    _setText('nvLabelSubtotal',  `S/ ${subtotal.toFixed(2)}`);
    _setText('nvLabelDescuento', `- S/ ${descuento.toFixed(2)}`);
    _setText('nvLabelTotal',     `S/ ${total.toFixed(2)}`);
}

async function guardarNuevaVenta() {
    if (_vGuardando) return;
    const nombres   = _val('nvNombres').trim();
    const apellidos = _val('nvApellidos').trim();
    const dni       = _val('nvDni').trim();
    const telefono  = _val('nvTelefono').trim();
    const correo    = _val('nvCorreo').trim();
    const tipoDoc   = _val('nvTipoDoc');
    const metodo    = _val('nvMetodoPago');
    const descuento = parseFloat(_val('nvDescuento') || 0) || 0;

    if (!nombres)        { mostrarAlertaNV('danger', 'El nombre del cliente es requerido'); return; }
    if (!telefono)       { mostrarAlertaNV('danger', 'El teléfono del cliente es requerido'); return; }
    if (!_vItems.length) { mostrarAlertaNV('danger', 'Agrega al menos un producto'); return; }

    const items = _vItems.map(i => ({
        id_producto: i.id_producto,
        id_variante: i.id_variante || null,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario
    }));

    _vGuardando = true;
    const btn = document.getElementById('btnGuardarNV');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2"></i> Registrando...'; if (window.lucide) lucide.createIcons(); }

    try {
        const res  = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, nombres, apellidos, telefono, correo,
                tipo_documento: tipoDoc, metodo_pago: metodo, descuento, items })
        });
        const json = await res.json();
        if (json.ok) {
            cerrarModalVentas('modalNuevaVenta');
            _mostrarToast(`✓ ${json.mensaje} — ${json.data.numero_venta}`, 'success');
            cargarStatsVentas();
            cargarTablaVentas(1);
        } else {
            mostrarAlertaNV('danger', json.mensaje);
        }
    } catch (e) { mostrarAlertaNV('danger', 'Error de conexión'); }
    finally {
        _vGuardando = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Registrar venta'; if (window.lucide) lucide.createIcons(); }
    }
}

/* ── CAMBIAR ESTADO ── */

async function cambiarEstadoVenta(id, estado) {
    try {
        const res  = await fetch(`/api/ventas/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        const json = await res.json();
        if (json.ok) {
            _mostrarToast(json.mensaje, 'success');
            cargarStatsVentas();
            cargarTablaVentas(_vPagActual);
        } else { _mostrarToast(json.mensaje, 'error'); }
    } catch (e) { _mostrarToast('Error de conexión', 'error'); }
}

/* ── ANULAR VENTA ── */

function abrirAnularVenta(id) {
    document.getElementById('anularIdVenta').value = id;
    const ta = document.getElementById('motivoAnulacion'); if (ta) ta.value = '';
    _show('modalAnularVenta');
}

async function confirmarAnulacion() {
    const id     = document.getElementById('anularIdVenta').value;
    const motivo = (_val('motivoAnulacion') || '').trim();
    if (!motivo) { _mostrarToast('Ingresa el motivo de anulación', 'error'); return; }

    const btn = document.querySelector('#modalAnularVenta .btn-danger');
    if (btn) { btn.disabled = true; btn.textContent = 'Anulando...'; }

    try {
        const res  = await fetch(`/api/ventas/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo })
        });
        const json = await res.json();
        if (json.ok) {
            cerrarModalVentas('modalAnularVenta');
            _mostrarToast(json.mensaje, 'success');
            cargarStatsVentas();
            cargarTablaVentas(_vPagActual);
        } else { _mostrarToast(json.mensaje, 'error'); }
    } catch (e) { _mostrarToast('Error de conexión', 'error'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="x-circle"></i> Confirmar anulación'; if (window.lucide) lucide.createIcons(); }
    }
}

/* ── IMPRIMIR / DOCUMENTO ── */

async function abrirImprimirVenta(id) {
    _show('modalImprimirVenta');
    document.getElementById('ventaDocumentoPreview').innerHTML =
        '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
        const res  = await fetch(`/api/ventas/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);
        const { venta: v, items } = json.data;
        _setText('modalImprimirTitulo',
            `${v.tipo_documento === 'boleta' ? 'Boleta' : 'Nota de Venta'} — ${v.numero_venta}`);
        document.getElementById('ventaDocumentoPreview').innerHTML = _generarHTMLDocumento(v, items);
    } catch (e) {
        document.getElementById('ventaDocumentoPreview').innerHTML =
            `<div class="alert alert-danger" style="margin:20px;">Error: ${_esc(e.message)}</div>`;
    }
}

function _generarHTMLDocumento(v, items) {
    const esB = v.tipo_documento === 'boleta';
    return `
    <div style="max-width:420px;margin:0 auto;font-family:monospace;font-size:13px;background:#fff;color:#000;padding:24px;">
        <div style="text-align:center;margin-bottom:16px;">
            <h2 style="font-size:16px;letter-spacing:2px;margin:0;">CONFECCIONES LIX</h2>
            <p style="font-size:11px;color:#666;margin:4px 0;">Confecciones escolares · Chiclayo</p>
            <div style="border-top:2px solid #000;border-bottom:2px solid #000;padding:6px 0;margin:8px 0;">
                <strong style="font-size:14px;">${esB ? 'BOLETA DE VENTA' : 'NOTA DE VENTA'}</strong><br>
                <span style="font-size:12px;">${v.numero_venta}</span>
            </div>
        </div>
        <table style="width:100%;margin-bottom:10px;font-size:12px;">
            <tr><td style="color:#666;">Fecha:</td><td style="text-align:right;">${_fmtFechaHora(v.fecha_venta)}</td></tr>
            <tr><td style="color:#666;">Cliente:</td><td style="text-align:right;">${_esc(v.nombres)} ${_esc(v.apellidos||'')}</td></tr>
            ${v.dni ? `<tr><td style="color:#666;">DNI:</td><td style="text-align:right;">${v.dni}</td></tr>` : ''}
            <tr><td style="color:#666;">Método pago:</td><td style="text-align:right;">${_capitalizarMetodo(v.metodo_pago)}</td></tr>
            <tr><td style="color:#666;">Atendió:</td><td style="text-align:right;">${_esc(v.atendio||'')}</td></tr>
        </table>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0;margin-bottom:8px;">
            <table style="width:100%;font-size:12px;">
                <thead>
                    <tr style="border-bottom:1px solid #ccc;">
                        <th style="text-align:left;padding-bottom:4px;">Producto</th>
                        <th style="text-align:center;">Cant</th>
                        <th style="text-align:right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(i => `
                    <tr>
                        <td style="padding:3px 0;">
                            ${_esc(i.nombre_producto)}<br>
                            <span style="font-size:11px;color:#666;">${[i.nombre_talla,i.color].filter(Boolean).join(' / ')}</span>
                        </td>
                        <td style="text-align:center;">${i.cantidad}</td>
                        <td style="text-align:right;">S/ ${parseFloat(i.subtotal).toFixed(2)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <table style="width:100%;font-size:12px;margin-bottom:12px;">
            <tr><td>Subtotal</td><td style="text-align:right;">S/ ${parseFloat(v.subtotal).toFixed(2)}</td></tr>
            ${parseFloat(v.descuento)>0 ? `<tr><td>Descuento</td><td style="text-align:right;color:red;">- S/ ${parseFloat(v.descuento).toFixed(2)}</td></tr>` : ''}
            <tr style="font-weight:bold;font-size:14px;border-top:1px solid #000;">
                <td style="padding-top:6px;">TOTAL</td>
                <td style="text-align:right;padding-top:6px;">S/ ${parseFloat(v.total).toFixed(2)}</td>
            </tr>
        </table>
        <div style="text-align:center;font-size:11px;color:#666;border-top:1px dashed #000;padding-top:8px;">
            ¡Gracias por su compra!<br>
            Confecciones Lix · Chiclayo · 945 952 450
        </div>
    </div>`;
}

function imprimirDocumentoVenta() {
    const contenido = document.getElementById('ventaDocumentoPreview').innerHTML;
    const ventana   = window.open('', '_blank', 'width=500,height=700');
    ventana.document.write(`<!DOCTYPE html><html><head><title>Documento</title>
        <style>body{margin:0;padding:0;background:#fff;} @media print{body{margin:0;}}</style>
        </head><body>${contenido}</body></html>`);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}

/* ── EXPORTAR CSV ── */

async function exportarVentasCSV() {
    try {
        const params = _construirParams(1);
        const res    = await fetch(`/api/ventas?${params}&limit=9999`);
        const json   = await res.json();
        if (!json.ok || !json.data.length) { _mostrarToast('Sin datos para exportar', 'error'); return; }

        const encabezado = ['ID','N° Venta','Tipo Doc.','Cliente','DNI','Vendedor','Fecha','Total','Forma Pago','Deuda','Estado'];
        const filas = json.data.map(v => {
            const deuda = v.estado_pago === 'pagado' ? 0 : parseFloat(v.total || 0);
            return [
                v.id_venta, v.numero_venta||'',
                v.tipo_documento||'',
                `${v.nombres||''} ${v.apellidos||''}`.trim(),
                v.dni||'', v.atendio||'',
                _fmtFecha(v.fecha_venta),
                parseFloat(v.total).toFixed(2),
                v.metodo_pago||'',
                deuda.toFixed(2),
                v.estado
            ];
        });

        const csv = [encabezado, ...filas]
            .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
            .join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href     = URL.createObjectURL(blob);
        link.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        _mostrarToast('CSV exportado correctamente', 'success');
    } catch (e) { _mostrarToast('Error al exportar', 'error'); }
}

/* ── CERRAR MODALES ── */

function cerrarModalVentas(id) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
}

document.addEventListener('click', function(e) {
    ['modalDetalleVenta','modalNuevaVenta','modalAnularVenta',
     'modalImprimirVenta','modalHistorialPagos'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && e.target === modal) cerrarModalVentas(id);
    });
});

/* ── ALERTAS Y TOASTS ── */

function mostrarAlertaNV(tipo, msg) {
    const el = document.getElementById('alertaNuevaVenta'); if (!el) return;
    el.className = `alert alert-${tipo}`;
    el.innerHTML = `<i data-lucide="alert-circle" style="width:15px;height:15px;"></i> <span>${_esc(msg)}</span>`;
    _show('alertaNuevaVenta');
    if (window.lucide) lucide.createIcons();
}

function _mostrarToast(msg, tipo = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<span>${_esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, 3500);
}

/* ── PAGINACIÓN ── */

function _renderPaginacion(containerId, paginaActual, totalPaginas, callback) {
    const el = document.getElementById(containerId); if (!el) return;
    if (totalPaginas <= 1) { el.innerHTML = ''; return; }
    let html = ''; const delta = 2; const rango = [];
    for (let i = Math.max(2, paginaActual-delta); i <= Math.min(totalPaginas-1, paginaActual+delta); i++) rango.push(i);
    const mostrar = [1, ...rango, totalPaginas]; let prev = null;
    mostrar.forEach(p => {
        if (prev !== null && p-prev > 1) html += `<span class="pag-dots">…</span>`;
        html += `<button class="pag-btn ${p===paginaActual?'active':''}" onclick="${callback.name}(${p})">${p}</button>`;
        prev = p;
    });
    const btnPrev = paginaActual > 1
        ? `<button class="pag-btn" onclick="${callback.name}(${paginaActual-1})"><i data-lucide="chevron-left" style="width:13px;height:13px;"></i></button>` : '';
    const btnNext = paginaActual < totalPaginas
        ? `<button class="pag-btn" onclick="${callback.name}(${paginaActual+1})"><i data-lucide="chevron-right" style="width:13px;height:13px;"></i></button>` : '';
    el.innerHTML = btnPrev + html + btnNext;
    if (window.lucide) lucide.createIcons();
}

/* ── BADGES ── */

function _badgeEstadoVenta(estado) {
    const map    = { pendiente:'badge-amber', pagada:'badge-green', anulada:'badge-red' };
    const labels = { pendiente:'Pendiente',   pagada:'Pagada',      anulada:'Anulada'   };
    return `<span class="badge ${map[estado]||'badge-blue'}">${labels[estado]||estado}</span>`;
}

function _badgeTipoDoc(tipo) {
    const map    = { nota_venta:'badge-blue', boleta:'badge-green' };
    const labels = { nota_venta:'Nota Venta', boleta:'Boleta'      };
    return `<span class="badge ${map[tipo]||'badge-blue'}">${labels[tipo]||tipo}</span>`;
}

function _badgeMetodoPago(metodo) {
    const map = { yape:'badge-purple', plin:'badge-blue', transferencia:'badge-amber', efectivo:'badge-green', visa:'badge-blue' };
    return `<span class="badge ${map[metodo]||'badge-blue'}">${_capitalizarMetodo(metodo)}</span>`;
}

/* ── UTILIDADES ── */

function _val(id)         { const el = document.getElementById(id); return el ? el.value : ''; }
function _setText(id, t)  { const el = document.getElementById(id); if (el) el.textContent = t; }
function _show(id)        { const el = document.getElementById(id); if (el) el.style.display = ''; }
function _hide(id)        { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function _esc(str)        { return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _fmtFecha(ts)    { if (!ts) return '—'; return new Date(ts).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'}); }
function _fmtFechaHora(ts){ if (!ts) return '—'; return new Date(ts).toLocaleString('es-PE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function _capitalizarMetodo(m) {
    const map = { yape:'Yape', plin:'Plin', transferencia:'Transferencia BCP', efectivo:'Efectivo', visa:'Tarjeta Visa' };
    return map[m] || (m ? m.charAt(0).toUpperCase()+m.slice(1) : '—');
}