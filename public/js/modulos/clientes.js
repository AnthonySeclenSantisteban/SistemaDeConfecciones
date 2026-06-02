let _clienteGuardando = false;
let _clienteEliminarId = null;

function cargar_clientes() {
    cargarClientes();
}

async function cargarClientes() {
    const tbody = document.getElementById('clientes-tbody');
    const loading = document.getElementById('clientes-loading');
    const tabla = document.getElementById('clientes-tabla');
    const empty = document.getElementById('clientes-empty');
    const total = document.getElementById('total-clientes');

    loading.style.display = 'flex';
    tabla.style.display = 'none';
    empty.style.display = 'none';

    try {
        const res = await fetch('/api/clientes');
        const json = await res.json();
        
        loading.style.display = 'none';

        if (!json.ok || json.data.length === 0) {
            empty.style.display = 'flex';
            return;
        }

        total.textContent = `${json.data.length} registros`;
        tabla.style.display = 'block';

        tbody.innerHTML = json.data.map((c, i) => `
            <tr>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">${i + 1}</td>
                <td><strong>${_esc(c.nombres)} ${_esc(c.apellidos || '')}</strong></td>
                <td style="font-family:var(--mono);font-size:12px;">${c.dni || '—'}</td>
                <td>${c.telefono || '—'}</td>
                <td style="color:var(--muted);font-size:12px;">${c.correo || '—'}</td>
                <td>${_badgeEstado(c.estado)}</td>
                <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${_fmtFecha(c.fecha_registro)}</td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <button class="btn-icon" title="Ver historial" onclick="abrirHistorial(${c.id_cliente}, '${_esc(c.nombres)} ${_esc(c.apellidos || '')}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                        <button class="btn-icon" title="Editar" onclick="abrirEditarCliente(${c.id_cliente})">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" title="Eliminar" onclick="abrirEliminarCliente(${c.id_cliente}, '${_esc(c.nombres)}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

function abrirNuevoCliente() {
    document.getElementById('modal-cliente-titulo').textContent = 'Nuevo cliente';
    document.getElementById('cliente-id').value = '';
    document.getElementById('cliente-nombres').value = '';
    document.getElementById('cliente-apellidos').value = '';
    document.getElementById('cliente-dni').value = '';
    document.getElementById('cliente-telefono').value = '';
    document.getElementById('cliente-correo').value = '';
    document.getElementById('cliente-estado').value = '1';
    document.getElementById('modal-cliente-alert').style.display = 'none';
    document.getElementById('modal-cliente').style.display = 'flex';
}

async function abrirEditarCliente(id) {
    document.getElementById('modal-cliente-titulo').textContent = 'Editar cliente';
    document.getElementById('cliente-id').value = id;
    document.getElementById('modal-cliente-alert').style.display = 'none';

    try {
        const res = await fetch(`/api/clientes/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);
        const c = json.data;
        document.getElementById('cliente-nombres').value = c.nombres || '';
        document.getElementById('cliente-apellidos').value = c.apellidos || '';
        document.getElementById('cliente-dni').value = c.dni || '';
        document.getElementById('cliente-telefono').value = c.telefono || '';
        document.getElementById('cliente-correo').value = c.correo || '';
        document.getElementById('cliente-estado').value = c.estado;
    } catch (err) {
        document.getElementById('modal-cliente-alert-msg').textContent = 'No se pudo cargar el cliente';
        document.getElementById('modal-cliente-alert').style.display = 'flex';
    }

    document.getElementById('modal-cliente').style.display = 'flex';
}

async function guardarCliente() {
    if (_clienteGuardando) return;

    const id = document.getElementById('cliente-id').value;
    const nombres = document.getElementById('cliente-nombres').value.trim();
    const apellidos = document.getElementById('cliente-apellidos').value.trim();
    const dni = document.getElementById('cliente-dni').value.trim();
    const telefono = document.getElementById('cliente-telefono').value.trim();
    const correo = document.getElementById('cliente-correo').value.trim();
    const estado = document.getElementById('cliente-estado').value;

    if (!nombres) {
        document.getElementById('modal-cliente-alert-msg').textContent = 'El nombre es requerido';
        document.getElementById('modal-cliente-alert').style.display = 'flex';
        return;
    }

    _clienteGuardando = true;
    const btn = document.getElementById('btn-guardar-cliente');
    btn.disabled = true;
    document.getElementById('btn-guardar-cliente-text').textContent = 'Guardando...';

    const url = id ? `/api/clientes/${id}` : '/api/clientes';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombres, apellidos, dni, telefono, correo, estado: parseInt(estado) })
        });
        const json = await res.json();

        if (json.ok) {
            cerrarModalCliente();
            cargarClientes();
            mostrarToastCliente(json.mensaje, 'success');
        } else {
            document.getElementById('modal-cliente-alert-msg').textContent = json.mensaje;
            document.getElementById('modal-cliente-alert').style.display = 'flex';
        }
    } catch (err) {
        document.getElementById('modal-cliente-alert-msg').textContent = 'Error de conexión';
        document.getElementById('modal-cliente-alert').style.display = 'flex';
    } finally {
        _clienteGuardando = false;
        btn.disabled = false;
        document.getElementById('btn-guardar-cliente-text').textContent = 'Guardar cliente';
    }
}

function abrirEliminarCliente(id, nombre) {
    _clienteEliminarId = id;
    document.getElementById('eliminar-cliente-nombre').textContent = nombre;
    document.getElementById('modal-eliminar-cliente').style.display = 'flex';
}

async function confirmarEliminarCliente() {
    if (!_clienteEliminarId) return;
    const btn = document.getElementById('btn-confirmar-eliminar-cliente');
    btn.disabled = true;
    btn.textContent = 'Eliminando...';

    try {
        const res = await fetch(`/api/clientes/${_clienteEliminarId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            cerrarModalEliminarCliente();
            cargarClientes();
            mostrarToastCliente(json.mensaje, 'success');
        } else {
            mostrarToastCliente(json.mensaje, 'error');
        }
    } catch (err) {
        mostrarToastCliente('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sí, eliminar';
        _clienteEliminarId = null;
    }
}

async function abrirHistorial(id, nombre) {
    document.getElementById('historial-cliente-nombre').textContent = `Historial — ${nombre}`;
    document.getElementById('historial-loading').style.display = 'flex';
    document.getElementById('historial-content').style.display = 'none';
    document.getElementById('modal-historial-cliente').style.display = 'flex';

    try {
        const res = await fetch(`/api/clientes/${id}/historial`);
        const json = await res.json();

        document.getElementById('historial-loading').style.display = 'none';
        document.getElementById('historial-content').style.display = 'block';

        if (!json.ok || json.data.length === 0) {
            document.getElementById('historial-tbody').innerHTML = '';
            document.getElementById('historial-empty').style.display = 'flex';
            document.getElementById('historial-total').textContent = 'S/ 0.00';
            return;
        }

        document.getElementById('historial-empty').style.display = 'none';

        let totalPagado = 0;
        document.getElementById('historial-tbody').innerHTML = json.data.map(v => {
            totalPagado += parseFloat(v.total || 0);
            return `
            <tr>
                <td style="font-family:var(--mono);font-size:12px;">${v.numero_venta || '—'}</td>
                <td style="font-size:12px;">${_fmtFechaHora(v.fecha_venta)}</td>
                <td><span class="badge badge-blue">${v.tipo_documento || '—'}</span></td>
                <td>${v.metodo_pago || '—'}</td>
                <td>${_badgePago(v.estado_pago)}</td>
                <td style="font-weight:600;color:var(--accent);">S/ ${parseFloat(v.total).toFixed(2)}</td>
            </tr>`;
        }).join('');

        document.getElementById('historial-total').textContent = `S/ ${totalPagado.toFixed(2)}`;

    } catch (err) {
        document.getElementById('historial-loading').style.display = 'none';
        document.getElementById('historial-content').style.display = 'block';
        document.getElementById('historial-empty').style.display = 'flex';
    }
}

function cerrarModalCliente() {
    document.getElementById('modal-cliente').style.display = 'none';
    document.getElementById('modal-cliente-alert').style.display = 'none';
}

function cerrarModalEliminarCliente() {
    document.getElementById('modal-eliminar-cliente').style.display = 'none';
    _clienteEliminarId = null;
}

function cerrarHistorialCliente() {
    document.getElementById('modal-historial-cliente').style.display = 'none';
}

function mostrarToastCliente(msg, tipo = 'success') {
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
    setTimeout(() => {
        t.classList.add('saliendo');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

function _badgeEstado(estado) {
    if (estado === 1) return '<span class="badge badge-green">Activo</span>';
    if (estado === 0) return '<span class="badge badge-amber">Inactivo</span>';
    return '<span class="badge badge-red">Eliminado</span>';
}

function _badgePago(estado) {
    if (estado === 'pagado') return '<span class="badge badge-green">Pagado</span>';
    if (estado === 'pendiente') return '<span class="badge badge-amber">Pendiente</span>';
    return '<span class="badge badge-red">—</span>';
}

function _fmtFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _fmtFechaHora(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

document.addEventListener('click', function(e) {
    const id = e.target.id;
    if (id === 'btn-nuevo-cliente') abrirNuevoCliente();
    if (id === 'btn-guardar-cliente') guardarCliente();
    if (id === 'btn-cerrar-modal-cliente' || id === 'btn-cancelar-modal-cliente') cerrarModalCliente();
    if (id === 'btn-cerrar-eliminar-cliente' || id === 'btn-cancelar-eliminar-cliente') cerrarModalEliminarCliente();
    if (id === 'btn-confirmar-eliminar-cliente') confirmarEliminarCliente();
    if (id === 'btn-cerrar-historial-cliente') cerrarHistorialCliente();
});