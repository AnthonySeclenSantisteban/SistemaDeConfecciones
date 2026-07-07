let _usuarioGuardando = false;
let _usuarioEliminarId = null;

 
async function cargarUsuarios() {
    const loading = document.getElementById('usuarios-loading');
    const tabla   = document.getElementById('usuarios-tabla');
    const empty   = document.getElementById('usuarios-empty');
    const total   = document.getElementById('total-usuarios');
    const tbody   = document.getElementById('usuarios-tbody');
    loading.style.display = 'flex';
    tabla.style.display   = 'none';
    empty.style.display   = 'none';
 
    try {
        const [resU, resS] = await Promise.all([
            fetch('/api/usuarios'),
            fetch('/api/sesion')          
        ]);
        const jsonU = await resU.json();
        const jsonS = await resS.json();
 
        loading.style.display = 'none';
 
        if (!jsonU.ok || !jsonU.data.length) {
            empty.style.display = 'flex';
            return;
        }
        const miPerfil   = (jsonS.usuario?.perfil_nombre || '').toLowerCase();
        const miId       = jsonS.usuario?.id;
        const soyAdmin   = miPerfil === 'administrador';
 
        total.textContent = `${jsonU.data.length} registro${jsonU.data.length !== 1 ? 's' : ''}`;
        tabla.style.display = 'block';
 
        tbody.innerHTML = jsonU.data.map((u, i) => {
            const perfilNombre = (u.perfil_nombre || '').toLowerCase();
            const esAdmin      = perfilNombre === 'administrador';
            const puedeEditar   = soyAdmin;
            const puedeEliminar = soyAdmin && !esAdmin;
 
            const btnEditar = puedeEditar ? `
                <button class="btn-icon" title="Editar"
                    data-accion="editar"
                    data-id="${u.id_usuario}"
                    data-perfil="${u.id_perfil}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>` : '';
 
            const btnEliminar = puedeEliminar ? `
                <button class="btn-icon btn-icon-danger" title="Eliminar"
                    data-accion="eliminar"
                    data-id="${u.id_usuario}"
                    data-nombre="${_esc(u.nombre)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                </button>` : '';
 
            return `
            <tr>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">${i + 1}</td>
                <td><strong>${_esc(u.nombre)}</strong></td>
                <td style="color:var(--muted);font-size:13px;">${_esc(u.correo)}</td>
                <td>${_badgePerfil(u.perfil_nombre)}</td>
                <td>${_badgeEstado(u.estado)}</td>
                <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${_fmtFecha(u.fecha_registro)}</td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        ${btnEditar}
                        ${btnEliminar}
                    </div>
                </td>
            </tr>`;
        }).join('');
 
    } catch (err) {
        loading.style.display = 'none';
        empty.style.display   = 'flex';
        console.error('cargarUsuarios:', err);
    }
}
 
function cargar_usuarios(){
    cargarUsuarios();
}
function abrirNuevoUsuario() {
    _limpiarModalUsuario();
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo usuario';
    document.getElementById('btn-guardar-usuario-text').textContent = 'Crear usuario';
    document.getElementById('contrasena-hint').style.display = 'none';
    _cargarPerfilesSelect().then(() => {
        document.getElementById('modal-usuario').style.display = 'flex';
    });
    document.getElementById('field-confirmar').style.display = 'block';
}
 
async function abrirEditarUsuario(id) {
    if (!document.getElementById('modal-usuario')) return;
    _limpiarModalUsuario();
    document.getElementById('modal-usuario-titulo').textContent = 'Editar usuario';
    document.getElementById('btn-guardar-usuario-text').textContent = 'Guardar cambios';
    document.getElementById('contrasena-hint').style.display = 'inline';
    document.getElementById('usuario-id').value = id;
    document.getElementById('field-confirmar').style.display = 'block';
 
    try {
        const [resU] = await Promise.all([
            fetch(`/api/usuarios/${id}`),
            _cargarPerfilesSelect()
        ]);
        const json = await resU.json();
        if (!json.ok) throw new Error(json.mensaje);
 
        const u = json.data;
        document.getElementById('usuario-nombre').value  = u.nombre;
        document.getElementById('usuario-correo').value  = u.correo;
        document.getElementById('usuario-perfil').value  = u.id_perfil;
        document.getElementById('usuario-estado').value  = u.estado;
    } catch (err) {
        _mostrarAlertaUsuario('No se pudo cargar el usuario');
    }
 
    document.getElementById('modal-usuario').style.display = 'flex';
}
 
function _limpiarErroresUsuario() {
    document.querySelectorAll('#modal-usuario .campo-error').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('#modal-usuario .input-wrap').forEach(el => el.classList.remove('campo-invalido'));
}

function _marcarErrorUsuario(idCampo, mensaje) {
    const errorEl = document.getElementById(`error-usuario-${idCampo}`);
    const wrap = document.getElementById(`usuario-${idCampo}`)?.closest('.input-wrap');
    if (errorEl) {
        if (mensaje) errorEl.textContent = mensaje;
        errorEl.classList.add('show');
    }
    if (wrap) wrap.classList.add('campo-invalido');
}

async function guardarUsuario() {
    if (_usuarioGuardando) return;  
 
    const id         = document.getElementById('usuario-id').value;
    const nombre     = document.getElementById('usuario-nombre').value.trim();
    const correo     = document.getElementById('usuario-correo').value.trim();
    const contrasena = document.getElementById('usuario-contrasena').value;
    const id_perfil  = document.getElementById('usuario-perfil').value;
    const estado     = document.getElementById('usuario-estado').value;

    _limpiarErroresUsuario();
    let hayError = false;

    if (!nombre) {
        _marcarErrorUsuario('nombre', 'Campo obligatorio');
        hayError = true;
    }
    if (!correo) {
        _marcarErrorUsuario('correo', 'Campo obligatorio');
        hayError = true;
    } else {
        const validarCorreo = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        if (!validarCorreo.test(correo)) {
            _marcarErrorUsuario('correo', 'Ingresa un correo válido (ejemplo: usuario@gmail.com)');
            hayError = true;
        }
    }
    if (!id_perfil) {
        _marcarErrorUsuario('perfil', 'Campo obligatorio');
        hayError = true;
    }
    if (!id && !contrasena) {
        _marcarErrorUsuario('contrasena', 'Campo obligatorio');
        hayError = true;
    }
    if (contrasena && contrasena !== document.getElementById('usuario-confirmar').value) {
        _marcarErrorUsuario('confirmar', 'Las contraseñas no coinciden');
        hayError = true;
    }

    if (hayError) {
        _mostrarAlertaUsuario('Por favor completa los campos obligatorios marcados en rojo');
        return;
    }

    _usuarioGuardando = true;
    const btn = document.getElementById('btn-guardar-usuario');
    if (btn.dataset.procesando) return;  
    btn.dataset.procesando = '1';
    btn.disabled = true;
    document.getElementById('btn-guardar-usuario-text').textContent = 'Guardando…';
    document.getElementById('btn-guardar-usuario-spinner').style.display = 'block';
 
    const url    = id ? `/api/usuarios/${id}` : '/api/usuarios';
    const method = id ? 'PUT' : 'POST';
 
    try {
        const res  = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, contrasena, id_perfil, estado: parseInt(estado) })
        });
        const json = await res.json();
 
        if (json.ok) {
            cerrarModalUsuario();
            cargarUsuarios();
            mostrarToast(json.mensaje, 'success');
        } else {
            _mostrarAlertaUsuario(json.mensaje || 'Error al guardar');
        }
    } catch (err) {
        _mostrarAlertaUsuario('Error de conexión');
    } finally {
        
        _usuarioGuardando = false;
        delete btn.dataset.procesando; 
        btn.disabled = false;
        document.getElementById('btn-guardar-usuario-text').textContent =
            document.getElementById('usuario-id').value ? 'Guardar cambios' : 'Crear usuario';
        document.getElementById('btn-guardar-usuario-spinner').style.display = 'none';
    }
}
 
function abrirEliminarUsuario(id, nombre) {
    _usuarioEliminarId = id;
    document.getElementById('eliminar-usuario-nombre').textContent = nombre;
    document.getElementById('modal-eliminar-usuario').style.display = 'flex';
}
 
async function confirmarEliminarUsuario() {
    if (!_usuarioEliminarId) return;
 
    const btn = document.getElementById('btn-confirmar-eliminar-usuario');
    if (btn.dataset.procesando) return;  
    btn.dataset.procesando = '1';
    btn.disabled = true;
    btn.textContent = 'Eliminando…';
 
    try {
        const res  = await fetch(`/api/usuarios/${_usuarioEliminarId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.ok) {
            cerrarModalEliminarUsuario();
            cargarUsuarios();
            mostrarToast(json.mensaje, 'success');
        } else {
            mostrarToast(json.mensaje || 'No se pudo eliminar', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión', 'error');
    } finally {
        delete btn.dataset.procesando;
        btn.disabled = false;
        btn.textContent = 'Sí, eliminar';
        _usuarioEliminarId = null;
    }
}
 
function cerrarModalUsuario() {
    document.getElementById('modal-usuario').style.display = 'none';
}
 
function cerrarModalEliminarUsuario() {
    document.getElementById('modal-eliminar-usuario').style.display = 'none';
    _usuarioEliminarId = null;
}

document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.procesando) return;

    const accionEl = e.target.closest('[data-accion]');
    if (accionEl?.dataset.accion === 'editar') {
        abrirEditarUsuario(accionEl.dataset.id);
        return;
    }
    if (accionEl?.dataset.accion === 'eliminar') {
        abrirEliminarUsuario(accionEl.dataset.id, accionEl.dataset.nombre);
        return;
    }
    const id = e.target.closest('button')?.id || e.target.id;
    if (id === 'btn-nuevo-usuario')              abrirNuevoUsuario();
    if (id === 'btn-guardar-usuario')            guardarUsuario();
    if (id === 'btn-cerrar-modal-usuario')       cerrarModalUsuario();
    if (id === 'btn-cancelar-modal-usuario')     cerrarModalUsuario();
    if (id === 'btn-cerrar-eliminar-usuario')    cerrarModalEliminarUsuario();
    if (id === 'btn-cancelar-eliminar-usuario')  cerrarModalEliminarUsuario();
    if (id === 'btn-confirmar-eliminar-usuario') confirmarEliminarUsuario();
    
});
        
 
async function _cargarPerfilesSelect() {
    const select = document.getElementById('usuario-perfil');
    select.innerHTML = '<option value="">Selecciona un perfil</option>';
    try {
        const res  = await fetch('/api/perfiles');
        const json = await res.json();
        if (!json.ok) return;
        json.data.forEach(p => {
            const opt = document.createElement('option');
            opt.value       = p.id_perfil;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('_cargarPerfilesSelect:', err);
    }
}
 
function _limpiarModalUsuario() {
    if (!document.getElementById('usuario-id')) return;
    document.getElementById('usuario-id').value          = '';
    document.getElementById('usuario-nombre').value      = '';
    document.getElementById('usuario-correo').value      = '';
    document.getElementById('usuario-contrasena').value  = '';
    document.getElementById('usuario-estado').value      = '1';
    document.getElementById('modal-usuario-alert').style.display = 'none';
    document.getElementById('usuario-confirmar').value = '';
    _limpiarErroresUsuario();
}    
 
function _mostrarAlertaUsuario(msg) {
    const el = document.getElementById('modal-usuario-alert');
    document.getElementById('modal-usuario-alert-msg').textContent = msg;
    el.style.display = 'flex';
}
 
function _badgePerfil(nombre) {
    return `<span class="badge badge-blue" style="font-size:11px;">${_esc(nombre || '—')}</span>`;
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

const _inputCorreoUsuario = document.getElementById('usuario-correo');
if (_inputCorreoUsuario) {
    _inputCorreoUsuario.addEventListener('input', function () {
        const validarCorreo = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        const valido = validarCorreo.test(this.value.trim());
        this.style.borderColor = this.value && !valido ? 'var(--danger, #e24b4a)' : '';
    });
}