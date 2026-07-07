let _colegiosData = [];
let _colegioEliminarId = null;

function cargar_colegios() { cargarColegios(); }

async function cargarColegios() {
    const loading = document.getElementById('colegios-loading');
    const tabla   = document.getElementById('colegios-tabla');
    const empty   = document.getElementById('colegios-empty');
    const total   = document.getElementById('total-colegios');
    const tbody   = document.getElementById('colegios-tbody');
    if (!loading) return;

    loading.style.display = 'flex';
    tabla.style.display = 'none';
    empty.style.display = 'none';

    try {
        const res  = await fetch('/api/colegios');
        const json = await res.json();
        loading.style.display = 'none';

        if (!json.ok || !json.data.length) { empty.style.display = 'flex'; return; }

        _colegiosData = json.data;
        total.textContent = `${json.data.length} registro${json.data.length !== 1 ? 's' : ''}`;
        tabla.style.display = 'block';
        _renderColegios(_colegiosData);
    } catch (e) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

function _renderColegios(data) {
    const tbody = document.getElementById('colegios-tbody');
    const total = document.getElementById('total-colegios');
    total.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''}`;

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);">Sin resultados</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map((c, i) => `
        <tr>
            <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">${i+1}</td>
            <td><strong>${_escCol(c.nombre_colegio)}</strong></td>
            <td style="color:var(--muted);">${c.distrito || '—'}</td>
            <td style="color:var(--muted);">${c.provincia || '—'}</td>
            <td>${c.estado === 1 ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-amber">Inactivo</span>'}</td>
            <td>
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button class="btn-icon" data-accion="editar" data-id="${c.id_colegio}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-icon btn-icon-danger" data-accion="eliminar" data-id="${c.id_colegio}" data-nombre="${_escCol(c.nombre_colegio)}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

function _aplicarFiltrosColegios() {
    const nombre = document.getElementById('col-filtro-nombre')?.value.toLowerCase().trim() || '';
    const estado = document.getElementById('col-filtro-estado')?.value || '';
    const filtrados = _colegiosData.filter(c => {
        const matchNombre = !nombre || c.nombre_colegio.toLowerCase().includes(nombre);
        const matchEstado = estado === '' || String(c.estado) === estado;
        return matchNombre && matchEstado;
    });
    _renderColegios(filtrados);
}

async function guardarColegio() {
    const id       = document.getElementById('colegio-id').value;
    const nombre   = document.getElementById('colegio-nombre').value.trim();
    const distrito = document.getElementById('colegio-distrito').value.trim();
    const provincia= document.getElementById('colegio-provincia').value.trim();
    const estado   = document.getElementById('colegio-estado').value;

    if (!nombre) { _alertaColegio('El nombre es requerido'); return; }

    const url    = id ? `/api/colegios/${id}` : '/api/colegios';
    const method = id ? 'PUT' : 'POST';
    try {
        const res  = await fetch(url, {
            method,
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ nombre_colegio: nombre, distrito, provincia, estado: parseInt(estado) })
        });
        const json = await res.json();
        if (json.ok) {
            cerrarModalColegio();
            cargarColegios();
            _toastColegio(json.mensaje, 'success');
        } else _alertaColegio(json.mensaje);
    } catch (e) { _alertaColegio('Error de conexión'); }
}

async function confirmarEliminarColegio() {
    if (!_colegioEliminarId) return;
    const btn = document.getElementById('btn-confirmar-eliminar-colegio');
    btn.disabled = true;
    btn.textContent = 'Eliminando…';
    try {
        const res  = await fetch(`/api/colegios/${_colegioEliminarId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            cerrarModalEliminarColegio();
            cargarColegios();
            _toastColegio(json.mensaje, 'success');
        } else {
            cerrarModalEliminarColegio();
            _toastColegio(json.mensaje, 'error');
        }
    } catch (e) { _toastColegio('Error de conexión', 'error'); }
    finally {
        btn.disabled = false;
        btn.textContent = 'Sí, eliminar';
    }
}

function cerrarModalColegio() { document.getElementById('modal-colegio').style.display = 'none'; }
function cerrarModalEliminarColegio() {
    document.getElementById('modal-eliminar-colegio').style.display = 'none';
    _colegioEliminarId = null;
}

function _alertaColegio(msg) {
    const el = document.getElementById('modal-colegio-alert');
    document.getElementById('modal-colegio-alert-msg').textContent = msg;
    el.style.display = 'flex';
}

function _toastColegio(msg, tipo) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<span>${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, 3000);
}

function _escCol(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

document.addEventListener('click', function(e) {
    const accionEl = e.target.closest('[data-accion]');
    if (accionEl?.dataset.accion === 'editar') {
        const c = _colegiosData.find(x => x.id_colegio == accionEl.dataset.id);
        if (!c) return;
        document.getElementById('modal-colegio-titulo').textContent = 'Editar colegio';
        document.getElementById('btn-guardar-colegio-text').textContent = 'Guardar cambios';
        document.getElementById('colegio-id').value = c.id_colegio;
        document.getElementById('colegio-nombre').value = c.nombre_colegio;
        document.getElementById('colegio-distrito').value = c.distrito || '';
        document.getElementById('colegio-provincia').value = c.provincia || '';
        document.getElementById('colegio-estado').value = c.estado ?? 1;
        document.getElementById('modal-colegio-alert').style.display = 'none';
        document.getElementById('modal-colegio').style.display = 'flex';
        return;
    }
    if (accionEl?.dataset.accion === 'eliminar') {
        _colegioEliminarId = accionEl.dataset.id;
        document.getElementById('eliminar-colegio-nombre').textContent = accionEl.dataset.nombre;
        document.getElementById('modal-eliminar-colegio').style.display = 'flex';
        return;
    }

    const id = e.target.closest('button')?.id || e.target.id;
    if (id === 'btn-nuevo-colegio') {
        document.getElementById('modal-colegio-titulo').textContent = 'Nuevo colegio';
        document.getElementById('btn-guardar-colegio-text').textContent = 'Crear colegio';
        document.getElementById('colegio-id').value = '';
        document.getElementById('colegio-nombre').value = '';
        document.getElementById('colegio-distrito').value = 'Chiclayo';
        document.getElementById('colegio-provincia').value = 'Chiclayo';
        document.getElementById('colegio-estado').value = '1';
        document.getElementById('modal-colegio-alert').style.display = 'none';
        document.getElementById('modal-colegio').style.display = 'flex';
    }
    if (id === 'btn-guardar-colegio') guardarColegio();
    if (id === 'btn-cancelar-modal-colegio') cerrarModalColegio();
    if (id === 'btn-cancelar-eliminar-colegio') cerrarModalEliminarColegio();
    if (id === 'btn-confirmar-eliminar-colegio') confirmarEliminarColegio();
});

document.addEventListener('input', function(e) {
    if (e.target.id === 'col-filtro-nombre') _aplicarFiltrosColegios();
});
document.addEventListener('change', function(e) {
    if (e.target.id === 'col-filtro-estado') _aplicarFiltrosColegios();
    if (e.target.id === 'col-btn-limpiar') _aplicarFiltrosColegios();
});
document.addEventListener('click', function(e) {
    if (e.target.id === 'col-btn-limpiar' || e.target.closest('#col-btn-limpiar')) {
        document.getElementById('col-filtro-nombre').value = '';
        document.getElementById('col-filtro-estado').value = '';
        _aplicarFiltrosColegios();
    }
});