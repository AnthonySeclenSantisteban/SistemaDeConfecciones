let _enviosData = [];
let _envFiltroBusqueda = '';
let _envFiltroEstado = '';
let _envFiltroTipo = '';
let _envPaginaActual = 1;
let _envRegistrosPorPagina = 10;
let _envOrdenColumna = 'id_envio';
let _envOrdenDireccion = 'desc';

let _envioSeleccionado = null;
let _envioGuardando = false;


function cargar_envios() {
    cargarEnvios();
}

async function cargarEnvios() {
    const loading = document.getElementById('env-loading');
    const empty = document.getElementById('env-empty');
    const tablaWrap = document.getElementById('env-tabla-wrap');
    const paginacion = document.getElementById('env-paginacion');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tablaWrap.style.display = 'none';
    paginacion.style.display = 'none';

    try {
        const res = await fetch('/api/envios');
        const json = await res.json();
        loading.style.display = 'none';

        if (!json.ok || !json.data || json.data.length === 0) {
            empty.style.display = 'flex';
            _calcularEstadisticasEnvios([]);
            return;
        }

        _enviosData = json.data;
        _calcularEstadisticasEnvios(_enviosData);
        _aplicarFiltrosEnvios();

    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
        console.error('Error al cargar envíos:', err);
    }
}

function _calcularEstadisticasEnvios(data) {
    const totalEnvíos = data.length;
    let pendientes = 0;
    let enCamino = 0;
    let entregados = 0;
    let incidencias = 0; 

    data.forEach(e => {
        if (e.estado_entrega === 'pendiente') pendientes++;
        else if (e.estado_entrega === 'en_camino') enCamino++;
        else if (e.estado_entrega === 'entregado') entregados++;
        else if (e.estado_entrega === 'fallido' || e.estado_entrega === 'demora') incidencias++;
    });

    document.getElementById('env-stat-total').textContent = totalEnvíos;
    document.getElementById('env-stat-pendiente').textContent = pendientes;
    document.getElementById('env-stat-camino').textContent = enCamino;
    document.getElementById('env-stat-entregado').textContent = entregados;
    document.getElementById('env-stat-incidencias').textContent = incidencias;
}

function _aplicarFiltrosEnvios() {
    _envFiltroBusqueda = document.getElementById('env-filtro-busqueda').value.toLowerCase().trim();
    _envFiltroEstado = document.getElementById('env-filtro-estado').value;
    _envFiltroTipo = document.getElementById('env-filtro-tipo').value;
    _envRegistrosPorPagina = parseInt(document.getElementById('env-por-pagina').value) || 10;
    const filtrados = _enviosData.filter(e => {
        const busquedaStr = `${e.id_envio} ${e.cliente} ${e.telefono || ''} ${e.direccion || ''} ${e.codigo_venta || ''}`.toLowerCase();
        const matchBusqueda = !_envFiltroBusqueda || busquedaStr.includes(_envFiltroBusqueda);
        const matchEstado = !_envFiltroEstado || e.estado_entrega === _envFiltroEstado;
        const matchTipo = !_envFiltroTipo || e.tipo_entrega === _envFiltroTipo;

        return matchBusqueda && matchEstado && matchTipo;
    });

    // Ordenar data
    filtrados.sort((a, b) => {
        let valA, valB;
        if (_envOrdenColumna === 'id_envio') {
            valA = parseInt(a.id_envio);
            valB = parseInt(b.id_envio);
        } else if (_envOrdenColumna === 'fecha') {
            valA = a.fecha_estimada ? new Date(a.fecha_estimada).getTime() : 0;
            valB = b.fecha_estimada ? new Date(b.fecha_estimada).getTime() : 0;
        } else {
            valA = a.cliente.toLowerCase();
            valB = b.cliente.toLowerCase();
        }

        if (valA < valB) return _envOrdenDireccion === 'asc' ? -1 : 1;
        if (valA > valB) return _envOrdenDireccion === 'asc' ? 1 : -1;
        return 0;
    });

    _renderTablaEnvios(filtrados);
}

function _renderTablaEnvios(data) {
    const tbody = document.getElementById('env-tbody');
    const empty = document.getElementById('env-empty');
    const tablaWrap = document.getElementById('env-tabla-wrap');
    const paginacion = document.getElementById('env-paginacion');
    const totalLabel = document.getElementById('env-total-label');

    if (data.length === 0) {
        tablaWrap.style.display = 'none';
        paginacion.style.display = 'none';
        empty.style.display = 'flex';
        totalLabel.textContent = '0 registros';
        return;
    }
    empty.style.display = 'none';
    tablaWrap.style.display = 'block';
    paginacion.style.display = 'flex';
    totalLabel.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''}`;

    const totalRegistros = data.length;
    const totalPaginas = Math.ceil(totalRegistros / _envRegistrosPorPagina);
    if (_envPaginaActual > totalPaginas) _envPaginaActual = totalPaginas || 1;

    const inicioIdx = (_envPaginaActual - 1) * _envRegistrosPorPagina;
    const finIdx = Math.min(inicioIdx + _envRegistrosPorPagina, totalRegistros);
    const paginados = data.slice(inicioIdx, finIdx);

    // Pintar filas
    tbody.innerHTML = paginados.map(e => {
        let badgeClase = '';
        let badgeTxt = '';

        if (e.estado_entrega === 'pendiente') {
            badgeClase = 'badge-env-pendiente';
            badgeTxt = 'Pendiente';
        } else if (e.estado_entrega === 'en_camino') {
            badgeClase = 'badge-env-camino';
            badgeTxt = 'En Camino';
        } else if (e.estado_entrega === 'entregado') {
            badgeClase = 'badge-env-entregado';
            badgeTxt = 'Entregado';
        } else if (e.estado_entrega === 'demora') {
            badgeClase = 'badge-env-demora';
            badgeTxt = 'Demorado';
        } else if (e.estado_entrega === 'fallido') {
            badgeClase = 'badge-env-fallido';
            badgeTxt = 'Fallido';
        }

        const tipoTxt = e.tipo_entrega === 'delivery' ? '🚗 Delivery' : '🏪 Tienda';
        const fEstimada = e.fecha_estimada ? _envFmtFecha(e.fecha_estimada) : '—';
        const docTxt = e.codigo_venta 
            ? `<strong>${_envEsc(e.codigo_venta)}</strong>`
            : `<span style="font-family:var(--mono);font-size:12px;color:var(--muted);">Sin NV</span>`;
        const esEntregado = e.estado_entrega === 'entregado';
        const editDisabled = esEntregado 
            ? 'disabled style="opacity: 0.4; cursor: not-allowed;" title="Envío ya entregado (Finalizado)"' 
            : '';

        return `
            <tr>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12.5px;">#${e.id_envio}</td>
                <td>${docTxt}</td>
                <td><strong>${_envEsc(e.cliente)}</strong></td>
                <td>${e.telefono || '—'}</td>
                <td style="font-size:12.5px;">${tipoTxt}</td>
                <td style="font-family:var(--mono);font-size:12.5px;">${fEstimada}</td>
                <td><span class="badge ${badgeClase}" style="font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 8px;">${badgeTxt}</span></td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <button class="btn-icon" title="Ver Detalle" data-accion="ver" data-id="${e.id_envio}">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                        </button>
                        <button class="btn-icon btn-icon-accent" title="Editar Estado" data-accion="editar" data-id="${e.id_envio}" ${editDisabled}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    document.getElementById('env-pag-info').textContent = `Mostrando ${inicioIdx + 1}-${finIdx} de ${totalRegistros}`;

    const pagBotones = document.getElementById('env-pag-botones');
    pagBotones.innerHTML = '';

    if (totalPaginas > 1) {
        const btnAnt = document.createElement('button');
        btnAnt.className = 'btn-pag';
        btnAnt.disabled = _envPaginaActual === 1;
        btnAnt.textContent = '◀';
        btnAnt.onclick = () => {
            if (_envPaginaActual > 1) {
                _envPaginaActual--;
                _aplicarFiltrosEnvios();
            }
        };
        pagBotones.appendChild(btnAnt);
        for (let idx = 1; idx <= totalPaginas; idx++) {
            const btnPag = document.createElement('button');
            btnPag.className = `btn-pag ${idx === _envPaginaActual ? 'active' : ''}`;
            btnPag.textContent = idx;
            btnPag.onclick = () => {
                _envPaginaActual = idx;
                _aplicarFiltrosEnvios();
            };
            pagBotones.appendChild(btnPag);
        }

        // Botón Siguiente
        const btnSig = document.createElement('button');
        btnSig.className = 'btn-pag';
        btnSig.disabled = _envPaginaActual === totalPaginas;
        btnSig.textContent = '▶';
        btnSig.onclick = () => {
            if (_envPaginaActual < totalPaginas) {
                _envPaginaActual++;
                _aplicarFiltrosEnvios();
            }
        };
        pagBotones.appendChild(btnSig);
    }
}
async function abrirVerEnvio(id) {
    const modal = document.getElementById('modal-envio-ver');
    
    document.getElementById('ver-envio-cliente').textContent = 'Cargando…';
    document.getElementById('ver-envio-telefono').textContent = '—';
    document.getElementById('ver-envio-correo').textContent = '—';
    document.getElementById('ver-envio-tipo').textContent = '—';
    document.getElementById('ver-envio-departamento').textContent = 'Lambayeque';
    document.getElementById('ver-envio-provincia').textContent = 'Chiclayo';
    document.getElementById('ver-envio-distrito').textContent = '—';
    document.getElementById('ver-envio-direccion').textContent = '—';
    document.getElementById('ver-envio-referencia').textContent = '—';
    document.getElementById('ver-envio-codigo-venta').textContent = '—';
    document.getElementById('ver-envio-fecha-pedido').textContent = '—';
    document.getElementById('ver-envio-metodo-pago').textContent = '—';
    document.getElementById('ver-envio-total-venta').textContent = '—';
    document.getElementById('ver-envio-fecha-estimada').textContent = '—';
    document.getElementById('ver-envio-fecha-entrega').textContent = '—';
    document.getElementById('ver-envio-observaciones').textContent = '—';
    document.getElementById('ver-envio-badge').innerHTML = '';
    
    document.getElementById('ver-envio-items-tbody').innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center;padding:16px;">
                <div class="spinner" style="width:20px;height:20px;margin:0 auto;"></div>
            </td>
        </tr>
    `;
    document.getElementById('ver-envio-total-pedido').textContent = 'S/ 0.00';

    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/envios/${id}`);
        const json = await res.json();

        if (!json.ok) throw new Error(json.mensaje);

        const e = json.envio;
        const items = json.items;
        document.getElementById('ver-envio-cliente').textContent = e.cliente;
        document.getElementById('ver-envio-telefono').textContent = e.telefono || '—';
        document.getElementById('ver-envio-correo').textContent = e.correo || '—';
        document.getElementById('ver-envio-tipo').textContent = e.tipo_entrega === 'delivery' ? 'Delivery a Domicilio' : 'Recojo en Sucursal / Tienda';
        document.getElementById('ver-envio-provincia').textContent = e.provincia || '—';
        document.getElementById('ver-envio-distrito').textContent = e.distrito || '—';
        document.getElementById('ver-envio-direccion').textContent = e.direccion || '—';
        document.getElementById('ver-envio-referencia').textContent = e.referencia || '—';
        document.getElementById('ver-envio-codigo-venta').textContent = e.codigo_venta || 'Sin NV';
        document.getElementById('ver-envio-fecha-pedido').textContent = e.fecha_pedido ? new Date(e.fecha_pedido).toLocaleString('es-PE') : '—';
        document.getElementById('ver-envio-metodo-pago').textContent = e.metodo_pago ? e.metodo_pago.toUpperCase() : 'EFECTIVO';
        document.getElementById('ver-envio-total-venta').textContent = `S/ ${parseFloat(e.total_pedido).toFixed(2)}`;
        document.getElementById('ver-envio-fecha-estimada').textContent = e.fecha_estimada ? _envFmtFecha(e.fecha_estimada) : '—';
        document.getElementById('ver-envio-fecha-entrega').textContent = e.fecha_entrega ? new Date(e.fecha_entrega).toLocaleString('es-PE') : 'No entregado aún';
        document.getElementById('ver-envio-observaciones').textContent = e.observaciones || 'Sin comentarios adicionales.';

        let badgeClase = '';
        let badgeTxt = '';
        if (e.estado_entrega === 'pendiente') { badgeClase = 'badge-env-pendiente'; badgeTxt = 'Pendiente'; }
        else if (e.estado_entrega === 'en_camino') { badgeClase = 'badge-env-camino'; badgeTxt = 'En Camino'; }
        else if (e.estado_entrega === 'entregado') { badgeClase = 'badge-env-entregado'; badgeTxt = 'Entregado'; }
        else if (e.estado_entrega === 'demora') { badgeClase = 'badge-env-demora'; badgeTxt = 'Demorado'; }
        else if (e.estado_entrega === 'fallido') { badgeClase = 'badge-env-fallido'; badgeTxt = 'Fallido'; }

        document.getElementById('ver-envio-badge').innerHTML = `<span class="badge ${badgeClase}" style="font-size:11px;font-weight:600;padding:2px 8px;">${badgeTxt}</span>`;
        if (items.length === 0) {
            document.getElementById('ver-envio-items-tbody').innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;padding:12px;color:var(--muted);">
                        No hay productos registrados en este pedido.
                    </td>
                </tr>
            `;
            return;
        }

        document.getElementById('ver-envio-items-tbody').innerHTML = items.map(item => {
            const extra = item.color || item.nombre_talla ? `${item.color || ''} - Talla: ${item.nombre_talla || ''}` : 'Estándar';
            return `
                <tr>
                    <td><strong>${_envEsc(item.nombre_producto)}</strong></td>
                    <td style="color:var(--muted);">${extra}</td>
                    <td style="font-family:var(--mono);">${item.cantidad}</td>
                    <td style="text-align:right;font-family:var(--mono);">S/ ${parseFloat(item.precio_unitario).toFixed(2)}</td>
                    <td style="text-align:right;font-family:var(--mono);font-weight:500;">S/ ${parseFloat(item.subtotal).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('ver-envio-total-pedido').textContent = `S/ ${parseFloat(e.total_pedido).toFixed(2)}`;

    } catch (err) {
        document.getElementById('ver-envio-cliente').textContent = 'Error';
        document.getElementById('ver-envio-items-tbody').innerHTML = `
            <tr>
                <td colspan="5" style="color:var(--error);text-align:center;padding:12px;">
                    No se pudieron cargar los detalles: ${err.message}
                </td>
            </tr>
        `;
    }
}

async function abrirEditarEnvio(id) {
    const modal = document.getElementById('modal-envio-editar');
    document.getElementById('modal-envio-alert').style.display = 'none';

    document.getElementById('edit-envio-id').value = id;
    document.getElementById('edit-envio-cliente-nombre').textContent = 'Cargando…';
    document.getElementById('edit-envio-estado').value = 'pendiente';
    document.getElementById('edit-envio-fecha-estimada').value = '';
    document.getElementById('edit-envio-fecha-entrega').value = '';
    document.getElementById('edit-envio-observaciones').value = '';

    modal.style.display = 'flex';

    const hoyStr = new Date().toISOString().split('T')[0];
    document.getElementById('edit-envio-fecha-estimada').min = hoyStr;

    try {
        const res = await fetch(`/api/envios/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);
        _envioSeleccionado = json.envio;
        document.getElementById('edit-envio-cliente-nombre').textContent = _envioSeleccionado.cliente;
        document.getElementById('edit-envio-estado').value = _envioSeleccionado.estado_entrega;
        document.getElementById('edit-envio-observaciones').value = _envioSeleccionado.observaciones || '';
        if (_envioSeleccionado.fecha_estimada) {
            document.getElementById('edit-envio-fecha-estimada').value = _envioSeleccionado.fecha_estimada.split('T')[0];
        } else {
            const hoy  = new Date();
            const tipo = (_envioSeleccionado.tipo_entrega || '').toLowerCase();
            const dias = (tipo === 'recojo' || tipo === 'recojo_tienda') ? 2 : 5;
            hoy.setDate(hoy.getDate() + dias);
            const yyyy = hoy.getFullYear();
            const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd   = String(hoy.getDate()).padStart(2, '0');
            document.getElementById('edit-envio-fecha-estimada').value = `${yyyy}-${mm}-${dd}`;
        }
        if (_envioSeleccionado.fecha_entrega) {
            document.getElementById('edit-envio-fecha-entrega').value = _envioSeleccionado.fecha_entrega.split('T')[0];
        }

        _evaluarVisibilidadFechaEntrega();

    } catch (err) {
        document.getElementById('edit-envio-cliente-nombre').textContent = 'Error';
        _mostrarAlertaEnvio(`No se pudo cargar el envío: ${err.message}`);
    }
}

function _evaluarVisibilidadFechaEntrega() {
    const estado = document.getElementById('edit-envio-estado').value;
    const fieldFecha = document.getElementById('field-fecha-entrega');
    const reqObs = document.querySelector('.req-obs');
    const reqEstimada = document.querySelector('.req-estimada');
    reqObs.style.display = 'none';
    reqEstimada.style.display = 'none';

    if (estado === 'entregado') {
        fieldFecha.style.display = 'block';
    } else {
        fieldFecha.style.display = 'none';
    }

    if (estado === 'fallido') {
        reqObs.style.display = 'inline';
    } else if (estado === 'demora') {
        reqObs.style.display = 'inline';
        reqEstimada.style.display = 'inline';
    }
}

async function guardarEdicionEnvio() {
    if (_envioGuardando || !_envioSeleccionado) return;

    const id = document.getElementById('edit-envio-id').value;
    const estado_entrega = document.getElementById('edit-envio-estado').value;
    const fecha_estimada = document.getElementById('edit-envio-fecha-estimada').value;
    const fecha_entrega = document.getElementById('edit-envio-fecha-entrega').value;
    const observaciones = document.getElementById('edit-envio-observaciones').value.trim();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fecha_estimada) {
        const fechaEst = new Date(fecha_estimada + 'T00:00:00');
        const anio = fechaEst.getFullYear();
        if (anio < 2024 || anio > 2100) {
            _mostrarAlertaEnvio('La fecha ingresada no es válida. Verifica el año.');
            return;
        }
        if (fechaEst < hoy) {
            _mostrarAlertaEnvio('La fecha estimada de entrega no puede ser anterior a hoy.');
            return;
        }
    }

    if (estado_entrega === 'entregado' && !fecha_entrega) {
        _mostrarAlertaEnvio('Es obligatorio ingresar la fecha real de entrega.');
        return;
    }
    if (estado_entrega === 'fallido' && (!observaciones || observaciones === '')) {
        _mostrarAlertaEnvio('Es obligatorio ingresar observaciones especificando el motivo del fallo (ej. Cliente ausente, dirección incorrecta).');
        return;
    }
    if (estado_entrega === 'demora') {
        if (!observaciones || observaciones === '') {
            _mostrarAlertaEnvio('Es obligatorio ingresar observaciones especificando el motivo de la demora.');
            return;
        }
        if (!fecha_estimada) {
            _mostrarAlertaEnvio('Es obligatorio ingresar la nueva fecha estimada de entrega.');
            return;
        }
    }

    const btn = document.getElementById('btn-guardar-envio-editar');
    const btnText = document.getElementById('btn-guardar-envio-text');
    const spinner = document.getElementById('btn-guardar-envio-spinner');

    _envioGuardando = true;
    btn.disabled = true;
    btnText.textContent = 'Guardando…';
    spinner.style.display = 'block';

        try {
        const res = await fetch(`/api/envios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado_entrega,
                fecha_estimada: fecha_estimada || null,
                fecha_entrega: fecha_entrega || null,
                observaciones
            })
        });
        const json = await res.json();

        if (json.ok) {
            _envToast(json.mensaje, 'success');
            cerrarModalEditarEnvio();
            cargarEnvios();
        } else {
            _mostrarAlertaEnvio(json.mensaje || 'Error al actualizar envío');
        }
    } catch (err) {
        console.error('Error guardar envio:', err); 
        _mostrarAlertaEnvio(`Error: ${err.message}`); 

    } finally {
        _envioGuardando = false;
        btn.disabled = false;
        btnText.textContent = 'Guardar Cambios';
        spinner.style.display = 'none';
    }
}

function cerrarModalVerEnvio() {
    document.getElementById('modal-envio-ver').style.display = 'none';
}

function cerrarModalEditarEnvio() {
    document.getElementById('modal-envio-editar').style.display = 'none';
    _envioSeleccionado = null;
}

function _mostrarAlertaEnvio(msg) {
    const el = document.getElementById('modal-envio-alert');
    document.getElementById('modal-envio-alert-msg').textContent = msg;
    el.style.display = 'flex';
}

document.addEventListener('click', function(e) {
    const btnAccion = e.target.closest('[data-accion]');
    if (btnAccion && btnAccion.closest('#env-tabla-wrap')) {
        const id = btnAccion.dataset.id;
        if (btnAccion.dataset.accion === 'ver') {
            abrirVerEnvio(id);
            return;
        }
        if (btnAccion.dataset.accion === 'editar') {
            if (btnAccion.disabled) return;
            abrirEditarEnvio(id);
            return;
        }
    }
    const clickId = e.target.closest('button')?.id || e.target.id;
    if (clickId === 'btn-cerrar-envio-ver' || clickId === 'btn-cerrar-envio-ver2') {
        cerrarModalVerEnvio();
        return;
    }
    if (clickId === 'btn-cerrar-envio-editar' || clickId === 'btn-cancelar-envio-editar') {
        cerrarModalEditarEnvio();
        return;
    }
    if (clickId === 'btn-guardar-envio-editar') {
        guardarEdicionEnvio();
        return;
    }

    // Cierre al hacer click afuera
    if (e.target.id === 'modal-envio-ver') {
        cerrarModalVerEnvio();
        return;
    }
    if (e.target.id === 'modal-envio-editar') {
        cerrarModalEditarEnvio();
        return;
    }

    // 3. Ordenación por cabeceras
    const thSort = e.target.closest('[data-col]');
    if (thSort && thSort.closest('#env-tabla-wrap')) {
        const col = thSort.dataset.col;
        if (_envOrdenColumna === col) {
            _envOrdenDireccion = _envOrdenDireccion === 'asc' ? 'desc' : 'asc';
        } else {
            _envOrdenColumna = col;
            _envOrdenDireccion = 'desc'; // Default desc para ID o Fechas
        }

        const headers = thSort.closest('tr').querySelectorAll('[data-col]');
        headers.forEach(h => {
            const cleanColName = h.textContent.replace(' ▲', '').replace(' ▼', '').replace(' ↕', '');
            if (h.dataset.col === _envOrdenColumna) {
                h.textContent = `${cleanColName} ${_envOrdenDireccion === 'asc' ? '▲' : '▼'}`;
            } else {
                h.textContent = `${cleanColName} ↕`;
            }
        });

        _aplicarFiltrosEnvios();
    }
});

document.addEventListener('input', function(e) {
    if (e.target.id === 'env-filtro-busqueda') {
        _envPaginaActual = 1;
        _aplicarFiltrosEnvios();
        return;
    }
});

document.addEventListener('change', function(e) {
    if (e.target.id === 'env-filtro-estado' || e.target.id === 'env-filtro-tipo' || e.target.id === 'env-por-pagina') {
        _envPaginaActual = 1;
        _aplicarFiltrosEnvios();
        return;
    }
    if (e.target.id === 'edit-envio-estado') {
        _evaluarVisibilidadFechaEntrega();
        return;
    }
});
function _envEsc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _envFmtFecha(ts) {
    if (!ts) return '—';
    const dateObj = new Date(ts);
    // Add timezone offset to display exact date in Local time
    const localTime = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
    return localTime.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _envToast(msg, tipo = 'success') {
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
    t.innerHTML = `${iconos[tipo] || ''}<span>${_envEsc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
        t.classList.add('saliendo');
        setTimeout(() => t.remove(), 300);
    }, 3500);
}
