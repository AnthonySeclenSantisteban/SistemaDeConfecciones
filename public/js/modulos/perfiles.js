let modoModal = 'perfil';
let perfilPermisoActual = null;


function abrirNuevo() {
    modoModal = 'perfil';
    document.getElementById('modal-titulo').textContent = 'Nuevo perfil';
    document.getElementById('perfil-id').value = '';
    document.getElementById('perfil-nombre').value = '';
    document.getElementById('perfil-descripcion').value = '';
    document.getElementById('perfil-estado').value = '1';
    document.getElementById('modal-alert').style.display = 'none';
    document.getElementById('opciones-loading').style.display = 'none';
    document.getElementById('opciones-lista').style.display = 'none';
    document.getElementById('perfil-nombre').closest('.field').style.display = 'block';
    document.getElementById('perfil-descripcion').closest('.field').style.display = 'block';
    document.getElementById('perfil-estado').closest('.field').style.display = 'block';
    document.getElementById('modal-perfil').style.display = 'flex';
}

function abrirEditar(id, nombre, descripcion, estado) {
    modoModal = 'perfil';
    document.getElementById('modal-titulo').textContent = 'Editar perfil';
    document.getElementById('perfil-id').value = id;
    document.getElementById('perfil-nombre').value = nombre;
    document.getElementById('perfil-descripcion').value = descripcion;
    document.getElementById('perfil-estado').value = estado;
    document.getElementById('modal-alert').style.display = 'none';
    document.getElementById('opciones-loading').style.display = 'none';
    document.getElementById('opciones-lista').style.display = 'none';
    document.getElementById('perfil-nombre').closest('.field').style.display = 'block';
    document.getElementById('perfil-descripcion').closest('.field').style.display = 'block';
    document.getElementById('perfil-estado').closest('.field').style.display = 'block';
    document.getElementById('modal-perfil').style.display = 'flex';
}

async function abrirPermisos(id_perfil, nombre) {
    modoModal = 'permisos';
    perfilPermisoActual = id_perfil;
    document.getElementById('modal-titulo').textContent = `Permisos — ${nombre}`;
    document.getElementById('perfil-id').value = id_perfil;
    document.getElementById('perfil-nombre').closest('.field').style.display = 'none';
    document.getElementById('perfil-descripcion').closest('.field').style.display = 'none';
    document.getElementById('perfil-estado').closest('.field').style.display = 'none';
    document.getElementById('modal-alert').style.display = 'none';
    document.getElementById('opciones-loading').style.display = 'flex';
    document.getElementById('opciones-lista').style.display = 'none';
    document.getElementById('modal-perfil').style.display = 'flex';

    const [resOpciones, resAsignadas] = await Promise.all([
        fetch('/api/opciones').then(r => r.json()),
        fetch(`/api/perfiles/${id_perfil}/opciones`).then(r => r.json())
    ]);

    const asignadas = resAsignadas.data || [];
    const lista = document.getElementById('opciones-lista');

    lista.innerHTML = resOpciones.data.map(op => `
        <label class="opcion-item ${asignadas.includes(op.id_opcion) ? 'checked' : ''}">
            <input type="checkbox" value="${op.id_opcion}" ${asignadas.includes(op.id_opcion) ? 'checked' : ''}>
            ${op.nombre}
        </label>
    `).join('');

    document.getElementById('opciones-loading').style.display = 'none';
    lista.style.display = 'grid';

    lista.querySelectorAll('.opcion-item').forEach(item => {
        item.addEventListener('click', function() {
            this.classList.toggle('checked');
        });
    });
}

async function guardarPermisos() {
    const btn = document.getElementById('btn-guardar');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const lista = document.getElementById('opciones-lista');
        const opciones = [...lista.querySelectorAll('input:checked')].map(i => parseInt(i.value));

        const res = await fetch(`/api/perfiles/${perfilPermisoActual}/opciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opciones })
        });
        const json = await res.json();

        if (json.ok) {
            cerrarModal();
            mostrarToast('Permisos guardados correctamente', 'success');
            await fetch('/api/refrescar-sesion', { method: 'POST' });
            cargarMisOpciones();
        }
    } catch (error) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar perfil';
    }
}

function confirmarEliminar(id, nombre) {
    document.getElementById('eliminar-nombre').textContent = nombre;
    document.getElementById('modal-eliminar').style.display = 'flex';
    document.getElementById('btn-confirmar-eliminar').onclick = async () => {
        const res = await fetch(`/api/perfiles/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            cerrarModalEliminar();
            cargar_perfiles();
            mostrarToast(json.mensaje, 'success');
        }
    };
}

function cerrarModal() {
    document.getElementById('modal-perfil').style.display = 'none';
    document.getElementById('perfil-nombre').closest('.field').style.display = 'block';
    document.getElementById('perfil-descripcion').closest('.field').style.display = 'block';
    document.getElementById('perfil-estado').closest('.field').style.display = 'block';
    document.getElementById('opciones-lista').innerHTML = '';
    document.getElementById('opciones-lista').style.display = 'none';
    document.getElementById('opciones-loading').style.display = 'none';
    document.getElementById('modal-alert').style.display = 'none';
}

function cerrarModalEliminar() {
    document.getElementById('modal-eliminar').style.display = 'none';
}

function mostrarToast(msg, tipo = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<span>${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
        t.classList.add('saliendo');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}


async function guardarPerfil() {
    const btn = document.getElementById('btn-guardar');
    const id = document.getElementById('perfil-id').value;
    const nombre = document.getElementById('perfil-nombre').value.trim();
    const descripcion = document.getElementById('perfil-descripcion').value.trim();
    const estado = document.getElementById('perfil-estado').value;

    if (!nombre || !descripcion) {
        document.getElementById('modal-alert-msg').textContent = 'Todos los campos son requeridos';
        document.getElementById('modal-alert').style.display = 'flex';
        return;
    }
     btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const url = id ? `/api/perfiles/${id}` : '/api/perfiles';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, descripcion, estado: parseInt(estado) })
        });
        const json = await res.json();

        if (json.ok) {
            cerrarModal();
            cargar_perfiles();
            mostrarToast(json.mensaje, 'success');
        } else {
            document.getElementById('modal-alert-msg').textContent = json.mensaje;
            document.getElementById('modal-alert').style.display = 'flex';
        }
    } catch (error) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar perfil';
    }
}

document.addEventListener('click', function(e) {
    const id = e.target.closest('[id]')?.id || e.target.id;

    if (id === 'btn-nuevo-perfil') abrirNuevo();

    if (id === 'btn-guardar' || e.target.closest('#btn-guardar')) {
        const btn = document.getElementById('btn-guardar');
        if (btn.disabled) return; // bloquea doble click
        if (modoModal === 'perfil') guardarPerfil();
        if (modoModal === 'permisos') guardarPermisos();
    }

    if (id === 'btn-cerrar-modal' || id === 'btn-cancelar-modal') cerrarModal();
    if (id === 'btn-cerrar-eliminar' || id === 'btn-cancelar-eliminar') cerrarModalEliminar();
});

async function cargarPerfiles() {
    const loading = document.getElementById('perfiles-loading');
    const tabla   = document.getElementById('perfiles-tabla');
    const empty   = document.getElementById('perfiles-empty');
    const total   = document.getElementById('total-perfiles');
    const tbody   = document.getElementById('perfiles-tbody');

    loading.style.display = 'flex';
    tabla.style.display   = 'none';
    empty.style.display   = 'none';

    try {
        const res  = await fetch('/api/perfiles');
        const json = await res.json();

        loading.style.display = 'none';

        if (!json.ok || !json.data.length) {
            empty.style.display = 'flex';
            return;
        }

        total.textContent = `${json.data.length} registro${json.data.length !== 1 ? 's' : ''}`;
        tabla.style.display = 'block';

        tbody.innerHTML = json.data.map((p, i) => `
            <tr>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">${i + 1}</td>
                <td><strong>${p.nombre}</strong></td>
                <td style="color:var(--muted);font-size:13px;">${p.descripcion || '—'}</td>
                <td>
                    <button onclick="abrirPermisos(${p.id_perfil},'${p.nombre}')"
                        style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;font-size:12px;background:transparent;border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font);">
                        🔑 Permisos
                    </button>
                </td>
                <td>${p.estado === 1 ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-amber">Inactivo</span>'}</td>
                <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE', {day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
                <td>
            <div style="display:flex;gap:6px;justify-content:flex-end;">
                <button class="btn-icon" title="Editar"
                    onclick="abrirEditar(${p.id_perfil},'${p.nombre}','${p.descripcion || ''}',${p.estado})">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn-icon btn-icon-danger" title="Eliminar"
                    onclick="confirmarEliminar(${p.id_perfil},'${p.nombre}')">
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
        console.error('cargarPerfiles:', err);
    }
}
function cargar_perfiles() {
    cargarPerfiles();
}