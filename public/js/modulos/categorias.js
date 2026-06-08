let _categoriaGuardando = false;
let _categoriaEliminarId = null;

async function cargarCategorias() {
    const loading = document.getElementById('categorias-loading');
    const tabla   = document.getElementById('categorias-tabla');
    const empty   = document.getElementById('categorias-empty');
    const total   = document.getElementById('total-categorias');
    const tbody   = document.getElementById('categorias-tbody');

    loading.style.display = 'flex';
    tabla.style.display   = 'none';
    empty.style.display   = 'none';

    try {
        const res  = await fetch('/api/categorias');
        const json = await res.json();

        loading.style.display = 'none';

        if (!json.ok || !json.data.length) {
            empty.style.display = 'flex';
            return;
        }

        total.textContent = `${json.data.length} registro${json.data.length !== 1 ? 's' : ''}`;
        tabla.style.display = 'block';

        tbody.innerHTML = json.data.map((c, i) => `
            <tr>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">${i + 1}</td>
                <td><strong>${_esc(c.nombre)}</strong></td>
                <td style="color:var(--muted);font-size:13px;">${_esc(c.descripcion || '—')}</td>
                <td>${_badgeEstado(c.estado)}</td>
                <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${_fmtFecha(c.fecha_registro)}</td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <button class="btn-icon" title="Editar"
                            data-accion="editar"
                            data-id="${c.id_categoria}">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" title="Eliminar"
                            data-accion="eliminar"
                            data-id="${c.id_categoria}"
                            data-nombre="${_esc(c.nombre)}">
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

    } catch (err) {
        loading.style.display = 'none';
        empty.style.display   = 'flex';
        console.error('cargarCategorias:', err);
    }
}

function cargar_categorias() {
    cargarCategorias();
}

function abrirNuevaCategoria() {
    _limpiarModalCategoria();
    document.getElementById('modal-categoria-titulo').textContent     = 'Nueva categoría';
    document.getElementById('btn-guardar-categoria-text').textContent = 'Crear categoría';
    document.getElementById('modal-categoria').style.display = 'flex';
}

async function abrirEditarCategoria(id) {
    if (!document.getElementById('modal-categoria')) return;
    _limpiarModalCategoria();
    document.getElementById('modal-categoria-titulo').textContent     = 'Editar categoría';
    document.getElementById('btn-guardar-categoria-text').textContent = 'Guardar cambios';
    document.getElementById('categoria-id').value = id;

    try {
        const res  = await fetch(`/api/categorias/${id}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.mensaje);

        const c = json.data;
        document.getElementById('categoria-nombre').value      = c.nombre;
        document.getElementById('categoria-descripcion').value = c.descripcion || '';
        document.getElementById('categoria-estado').value      = c.estado;
    } catch (err) {
        _mostrarAlertaCategoria('No se pudo cargar la categoría');
    }

    document.getElementById('modal-categoria').style.display = 'flex';
}

async function guardarCategoria() {
    if (_categoriaGuardando) return;

    const id          = document.getElementById('categoria-id').value;
    const nombre      = document.getElementById('categoria-nombre').value.trim();
    const descripcion = document.getElementById('categoria-descripcion').value.trim();
    const estado      = document.getElementById('categoria-estado').value;

    if (!nombre) {
        _mostrarAlertaCategoria('El nombre es requerido');
        return;
    }

    const btn = document.getElementById('btn-guardar-categoria');
    if (btn.dataset.procesando) return;

    _categoriaGuardando  = true;
    btn.dataset.procesando = '1';
    btn.disabled = true;
    document.getElementById('btn-guardar-categoria-text').textContent = 'Guardando…';
    document.getElementById('btn-guardar-categoria-spinner').style.display = 'block';

    const url    = id ? `/api/categorias/${id}` : '/api/categorias';
    const method = id ? 'PUT' : 'POST';

    try {
        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, descripcion, estado: parseInt(estado) })
        });
        const json = await res.json();

        if (json.ok) {
            cerrarModalCategoria();
            cargarCategorias();
            mostrarToast(json.mensaje, 'success');
        } else {
            _mostrarAlertaCategoria(json.mensaje || 'Error al guardar');
        }
    } catch (err) {
        _mostrarAlertaCategoria('Error de conexión');
    } finally {
        _categoriaGuardando = false;
        delete btn.dataset.procesando;
        btn.disabled = false;
        document.getElementById('btn-guardar-categoria-text').textContent =
            document.getElementById('categoria-id').value ? 'Guardar cambios' : 'Crear categoría';
        document.getElementById('btn-guardar-categoria-spinner').style.display = 'none';
    }
}

function abrirEliminarCategoria(id, nombre) {
    _categoriaEliminarId = id;
    document.getElementById('eliminar-categoria-nombre').textContent = nombre;
    document.getElementById('modal-eliminar-categoria').style.display = 'flex';
}

async function confirmarEliminarCategoria() {
    if (!_categoriaEliminarId) return;

    const btn = document.getElementById('btn-confirmar-eliminar-categoria');
    if (btn.dataset.procesando) return;

    btn.dataset.procesando = '1';
    btn.disabled = true;
    document.getElementById('btn-eliminar-categoria-text').textContent = 'Eliminando…';

    try {
        const res  = await fetch(`/api/categorias/${_categoriaEliminarId}`, { method: 'DELETE' });
        const json = await res.json();

        if (json.ok) {
            cerrarModalEliminarCategoria();
            cargarCategorias();
            mostrarToast(json.mensaje, 'success');
        } else {
            mostrarToast(json.mensaje || 'No se pudo eliminar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        delete btn.dataset.procesando;
        btn.disabled = false;
        document.getElementById('btn-eliminar-categoria-text').textContent = 'Sí, eliminar';
        _categoriaEliminarId = null;
    }
}

function cerrarModalCategoria() {
    document.getElementById('modal-categoria').style.display = 'none';
}

function cerrarModalEliminarCategoria() {
    document.getElementById('modal-eliminar-categoria').style.display = 'none';
    _categoriaEliminarId = null;
}

document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.procesando) return;

    // Botones de acción en la tabla (editar/eliminar)
    const accionEl = e.target.closest('[data-accion]');
    if (accionEl?.dataset.accion === 'editar') {
        abrirEditarCategoria(accionEl.dataset.id);
        return;
    }
    if (accionEl?.dataset.accion === 'eliminar') {
        abrirEliminarCategoria(accionEl.dataset.id, accionEl.dataset.nombre);
        return;
    }
    const id = e.target.closest('button')?.id || e.target.id;
    if (id === 'btn-nueva-categoria')               abrirNuevaCategoria();
    if (id === 'btn-guardar-categoria')             guardarCategoria();
    if (id === 'btn-cerrar-modal-categoria')        cerrarModalCategoria();
    if (id === 'btn-cancelar-modal-categoria')      cerrarModalCategoria();
    if (id === 'btn-cerrar-eliminar-categoria')     cerrarModalEliminarCategoria();
    if (id === 'btn-cancelar-eliminar-categoria')   cerrarModalEliminarCategoria();
    if (id === 'btn-confirmar-eliminar-categoria')  confirmarEliminarCategoria();
    if (e.target.id === 'modal-categoria')          cerrarModalCategoria();
    if (e.target.id === 'modal-eliminar-categoria') cerrarModalEliminarCategoria();
});

function _limpiarModalCategoria() {
    if (!document.getElementById('categoria-id')) return;
    document.getElementById('categoria-id').value          = '';
    document.getElementById('categoria-nombre').value      = '';
    document.getElementById('categoria-descripcion').value = '';
    document.getElementById('categoria-estado').value      = '1';
    document.getElementById('modal-categoria-alert').style.display = 'none';
}

function _mostrarAlertaCategoria(msg) {
    const el = document.getElementById('modal-categoria-alert');
    document.getElementById('modal-categoria-alert-msg').textContent = msg;
    el.style.display = 'flex';
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
    setTimeout(() => {
        t.classList.add('saliendo');
        setTimeout(() => t.remove(), 300);
    }, 3500);
}