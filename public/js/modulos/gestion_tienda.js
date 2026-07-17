let _slidersData = [];
let _redesData = [];
let _logoFile = null;
let _sliderFile = null;
let _dropzonesIniciados = false;

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, function (e) { e.preventDefault(); }, false);
    document.addEventListener(eventName, function (e) { e.preventDefault(); }, false);
});

function cargar_gestion_tienda() {
    _dropzonesIniciados = false;

    document.querySelectorAll('.gt-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const target = this.dataset.tab;
            document.querySelectorAll('.gt-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.gt-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('panel-' + target).classList.add('active');

            document.getElementById('btn-nuevo-logo').style.display = target === 'logos' ? 'flex' : 'none';
            document.getElementById('btn-nuevo-slider').style.display = target === 'sliders' ? 'flex' : 'none';
            document.getElementById('btn-nueva-red').style.display = target === 'redes' ? 'flex' : 'none';
        });
    });

    const headerBtn = document.getElementById('gt-header-btn');
    if (headerBtn) {
        headerBtn.style.display = 'block';
        document.getElementById('btn-nuevo-logo').style.display = 'flex';
        document.getElementById('btn-nuevo-slider').style.display = 'none';
        document.getElementById('btn-nueva-red').style.display = 'none';
    }

    cargarLogos();
    cargarSliders();
    cargarRedes();

    setTimeout(() => { inicializarDropzonesGestion(); }, 100);
}

function _redIcono(tipo) {
    const iconos = {
        facebook:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
        instagram: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
        tiktok:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12a4 4 0 104 4V4a5 5 0 005 5"/></svg>',
        whatsapp:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.5 2C6.253 2 2 6.253 2 11.5c0 1.83.519 3.54 1.412 4.99L2 22l5.677-1.384A9.459 9.459 0 0011.5 21C16.747 21 21 16.747 21 11.5S16.747 2 11.5 2z"/></svg>',
        youtube:   '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon fill="#fff" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>',
        telegram:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>',
        otro:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
    };
    return iconos[tipo] || iconos.otro;
}

function inicializarDropzonesGestion() {
    const dropLogo = document.getElementById('drop-logo');
    const logoInput = document.getElementById('logo-file');
    const logoPreview = document.getElementById('logo-preview');
    const logoText = document.getElementById('logo-drop-text');
    const dropSlider = document.getElementById('drop-slider');
    const sliderInput = document.getElementById('slider-file');
    const sliderPreview = document.getElementById('slider-preview');
    const sliderText = document.getElementById('slider-drop-text');

    if (!dropLogo || !logoInput || !logoPreview || !logoText || !dropSlider || !sliderInput || !sliderPreview || !sliderText) return;
    if (_dropzonesIniciados) return;
    _dropzonesIniciados = true;

    logoInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (file) asignarLogo(file);
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropLogo.addEventListener(evt, function (e) {
            e.preventDefault(); e.stopPropagation();
            dropLogo.style.borderColor = 'var(--accent)';
            dropLogo.style.background = 'rgba(255,255,255,.04)';
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropLogo.addEventListener(evt, function (e) {
            e.preventDefault(); e.stopPropagation();
            dropLogo.style.borderColor = 'var(--border)';
            dropLogo.style.background = 'rgba(255,255,255,.02)';
        });
    });
    dropLogo.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation();
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) { const dt = new DataTransfer(); dt.items.add(file); logoInput.files = dt.files; asignarLogo(file); }
    });

    sliderInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (file) asignarSlider(file);
    });
    ['dragenter', 'dragover'].forEach(evt => {
        dropSlider.addEventListener(evt, function (e) {
            e.preventDefault(); e.stopPropagation();
            dropSlider.style.borderColor = 'var(--accent)';
            dropSlider.style.background = 'rgba(255,255,255,.04)';
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropSlider.addEventListener(evt, function (e) {
            e.preventDefault(); e.stopPropagation();
            dropSlider.style.borderColor = 'var(--border)';
            dropSlider.style.background = 'rgba(255,255,255,.02)';
        });
    });
    dropSlider.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation();
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) { const dt = new DataTransfer(); dt.items.add(file); sliderInput.files = dt.files; asignarSlider(file); }
    });

    function asignarLogo(file) {
        if (!file.type.startsWith('image/')) return mostrarToastGestion('El archivo debe ser una imagen', 'error');
        _logoFile = file;
        logoPreview.src = URL.createObjectURL(file);
        logoPreview.style.display = 'block';
        logoText.style.display = 'none';
    }
    function asignarSlider(file) {
        if (!file.type.startsWith('image/')) return mostrarToastGestion('El archivo debe ser una imagen', 'error');
        _sliderFile = file;
        sliderPreview.src = URL.createObjectURL(file);
        sliderPreview.style.display = 'block';
        sliderText.style.display = 'none';
    }
}

async function cargarLogos() {
    const loading = document.getElementById('logos-loading');
    const empty = document.getElementById('logos-empty');
    const lista = document.getElementById('logos-lista');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    lista.style.display = 'none';

    try {
        const res = await fetch('/api/gestion-tienda/logos');
        const json = await res.json();
        loading.style.display = 'none';

        if (!json.ok || !json.data.length) { empty.style.display = 'flex'; return; }

        lista.innerHTML = json.data.map(item => `
            <div class="logo-card">
                <img src="${_esc(item.url)}" alt="logo" class="logo-card-img" onerror="this.style.background='var(--surface)'">
                <div class="logo-card-body">
                    <div class="logo-card-name">${_esc(item.nombre_archivo || 'Logo')}</div>
                    <div class="logo-card-actions">
                        <button class="logo-btn-toggle ${item.activo ? 'activo' : 'inactivo'}" onclick="cambiarEstadoLogo(${item.id_recurso}, ${item.activo ? 'false' : 'true'})">
                            ${item.activo
                                ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Activo'
                                : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Inactivo'}
                        </button>
                        <button class="logo-btn-del" onclick="eliminarLogo(${item.id_recurso})" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        lista.style.display = 'grid';
        lista.style.gridTemplateColumns = 'repeat(auto-fill,minmax(200px,1fr))';
        lista.style.gap = '14px';
    } catch (error) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

async function guardarLogo() {
    try {
        let url = document.getElementById('logo-url').value.trim();
        let nombre_archivo = document.getElementById('logo-nombre').value.trim();

        if (_logoFile) {
            const fd = new FormData();
            fd.append('imagen', _logoFile);
            const up = await fetch('/api/upload/logo', { method: 'POST', body: fd });
            const upJson = await up.json();
            if (!upJson.ok) return mostrarToastGestion(upJson.mensaje, 'error');
            url = upJson.data.url;
            nombre_archivo = nombre_archivo || upJson.data.nombre_archivo;
            document.getElementById('logo-url').value = url;
            document.getElementById('logo-nombre').value = nombre_archivo;
        }

        if (!url) return mostrarToastGestion('Debes arrastrar o seleccionar una imagen', 'error');

        const res = await fetch('/api/gestion-tienda/logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'logo', nombre_archivo, url, activo: document.getElementById('logo-activo').value === 'true' })
        });
        const json = await res.json();
        if (json.ok) { cerrarModalLogo(); cargarLogos(); }
        mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
    } catch (error) {
        mostrarToastGestion('Error al guardar logo', 'error');
    }
}

async function cambiarEstadoLogo(idRecurso, nuevoEstado) {
    try {
        const res = await fetch(`/api/gestion-tienda/logos/${idRecurso}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstado })
        });
        const json = await res.json();
        if (!json.ok) { mostrarToastGestion(json.msg || json.mensaje || 'No se pudo cambiar el estado', 'error'); return; }
        await cargarLogos();
        if (typeof cargarLogoSidebar === 'function') await cargarLogoSidebar();
        mostrarToastGestion(json.msg || json.mensaje || 'Estado actualizado', 'success');
    } catch (error) {
        mostrarToastGestion('Error al cambiar estado del logo', 'error');
    }
}

function eliminarLogo(id) {
    abrirEliminarGT({
        titulo: '¿Eliminar logo?',
        descripcion: 'El logo será eliminado permanentemente.',
        onConfirmar: async () => {
            const res = await fetch(`/api/gestion-tienda/logo/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) cargarLogos();
            mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
            return json.ok;
        }
    });
}

async function cargarSliders() {
    const loading = document.getElementById('sliders-loading');
    const empty = document.getElementById('sliders-empty');
    const lista = document.getElementById('sliders-lista');
    const tbody = document.getElementById('sliders-tbody');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    lista.style.display = 'none';

    try {
        const res = await fetch('/api/gestion-tienda/sliders');
        const json = await res.json();
        loading.style.display = 'none';
        _slidersData = json.data || [];

        if (!json.ok || !_slidersData.length) { empty.style.display = 'flex'; return; }

        tbody.innerHTML = _slidersData.map(item => `
            <tr>
                <td style="color:var(--muted);font-weight:600;">${item.orden ?? 0}</td>
                <td>
                    <img src="${_esc(item.imagen_url)}" alt="slider" class="slider-thumb" onerror="this.style.display='none'">
                </td>
                <td style="font-weight:600;">${_esc(item.titulo || item.nombre_archivo || 'Sin título')}</td>
                <td>
                    <span class="badge-activo ${item.activo ? 'on' : 'off'}">
                        ${item.activo
                            ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ACTIVO'
                            : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg> INACTIVO'}
                    </span>
                </td>
                <td>
                    <div class="gt-table-actions">
                        <button class="btn-icon" onclick="abrirEditarSlider(${item.id_slider})" title="Editar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon" onclick="toggleSlider(${item.id_slider}, ${item.activo ? 'false' : 'true'})" title="${item.activo ? 'Desactivar' : 'Activar'}">
                            ${item.activo
                                ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
                                : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'}
                        </button>
                        <button class="btn-icon btn-icon-danger" onclick="eliminarSlider(${item.id_slider})" title="Eliminar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        lista.style.display = 'block';
    } catch (error) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

function abrirNuevoSlider() {
    document.getElementById('modal-slider-titulo').textContent = 'Nuevo slider';
    document.getElementById('slider-id').value = '';
    document.getElementById('slider-titulo').value = '';
    document.getElementById('slider-nombre').value = '';
    document.getElementById('slider-url').value = '';
    document.getElementById('slider-orden').value = '0';
    document.getElementById('slider-activo').value = 'true';
    document.getElementById('modal-slider').style.display = 'flex';
    const preview = document.getElementById('slider-preview');
    const text = document.getElementById('slider-drop-text');
    const input = document.getElementById('slider-file');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (text) text.style.display = 'block';
    if (input) input.value = '';
    _sliderFile = null;
    setTimeout(() => inicializarDropzonesGestion(), 50);
}

function abrirEditarSlider(id) {
    const item = _slidersData.find(x => x.id_slider == id);
    if (!item) return;
    document.getElementById('modal-slider-titulo').textContent = 'Editar slider';
    document.getElementById('slider-id').value = item.id_slider;
    document.getElementById('slider-titulo').value = item.titulo || '';
    document.getElementById('slider-nombre').value = item.nombre_archivo || '';
    document.getElementById('slider-url').value = item.imagen_url || '';
    document.getElementById('slider-orden').value = item.orden ?? 0;
    document.getElementById('slider-activo').value = item.activo ? 'true' : 'false';
    document.getElementById('modal-slider').style.display = 'flex';
    const preview = document.getElementById('slider-preview');
    const text = document.getElementById('slider-drop-text');
    const input = document.getElementById('slider-file');
    if (preview && item.imagen_url) { preview.src = item.imagen_url; preview.style.display = 'block'; }
    if (text) text.style.display = 'none';
    if (input) input.value = '';
    _sliderFile = null;
    setTimeout(() => inicializarDropzonesGestion(), 50);
}

async function guardarSlider() {
    const id = document.getElementById('slider-id').value;
    try {
        let imagen_url = document.getElementById('slider-url').value.trim();
        let nombre_archivo = document.getElementById('slider-nombre').value.trim();
        if (_sliderFile) {
            const fd = new FormData();
            fd.append('imagen', _sliderFile);
            const up = await fetch('/api/upload/slider', { method: 'POST', body: fd });
            const upJson = await up.json();
            if (!upJson.ok) return mostrarToastGestion(upJson.mensaje, 'error');
            imagen_url = upJson.data.url;
            nombre_archivo = nombre_archivo || upJson.data.nombre_archivo;
            document.getElementById('slider-url').value = imagen_url;
            document.getElementById('slider-nombre').value = nombre_archivo;
        }
        if (!imagen_url) return mostrarToastGestion('Debes arrastrar o seleccionar una imagen', 'error');
        const payload = {
            titulo: document.getElementById('slider-titulo').value.trim(),
            nombre_archivo, imagen_url,
            orden: parseInt(document.getElementById('slider-orden').value || '0'),
            activo: document.getElementById('slider-activo').value === 'true'
        };
        const res = await fetch(id ? `/api/gestion-tienda/sliders/${id}` : '/api/gestion-tienda/sliders', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.ok) { cerrarModalSlider(); cargarSliders(); }
        mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
    } catch (error) {
        mostrarToastGestion('Error al guardar slider', 'error');
    }
}

async function toggleSlider(id, activo) {
    try {
        const res = await fetch(`/api/gestion-tienda/sliders/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo })
        });
        const json = await res.json();
        if (json.ok) cargarSliders();
        mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
    } catch (error) { mostrarToastGestion('Error al actualizar slider', 'error'); }
}

function eliminarSlider(id) {
    abrirEliminarGT({
        titulo: '¿Eliminar slider?',
        descripcion: 'El slider será eliminado permanentemente.',
        onConfirmar: async () => {
            const res = await fetch(`/api/gestion-tienda/sliders/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) cargarSliders();
            mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
            return json.ok;
        }
    });
}

async function cargarRedes() {
    const loading = document.getElementById('redes-loading');
    const empty = document.getElementById('redes-empty');
    const lista = document.getElementById('redes-lista');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    lista.style.display = 'none';

    try {
        const res = await fetch('/api/gestion-tienda/redes');
        const json = await res.json();
        loading.style.display = 'none';
        _redesData = json.data || [];

        if (!json.ok || !_redesData.length) { empty.style.display = 'flex'; return; }

        lista.innerHTML = json.data.map(item => `
            <div class="red-card red-${_esc(item.tipo)}">
                <div class="red-card-header">
                    <div class="red-card-icon">${_redIcono(item.tipo)}</div>
                    <div>
                        <div class="red-card-name" style="text-transform:capitalize;">${_esc(item.tipo)}</div>
                        <div class="red-card-sub">Activos en la red</div>
                    </div>
                </div>
                <div class="red-card-actions">
                    <button class="red-card-btn estado-${item.activo ? 'on' : 'off'}" onclick="toggleRed(${item.id_recurso}, ${item.activo ? 'false' : 'true'})">
                        ${item.activo
                            ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Activo'
                            : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Inactivo'}
                    </button>
                    <button class="red-card-btn" onclick="abrirEditarRed(${item.id_recurso})">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
                    </button>
                    <button class="red-card-btn" onclick="eliminarRed(${item.id_recurso})" style="background:rgba(0,0,0,0.25);">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Eliminar
                    </button>
                </div>
            </div>
        `).join('');

        lista.style.display = 'grid';
        lista.style.gridTemplateColumns = 'repeat(auto-fill,minmax(260px,1fr))';
        lista.style.gap = '14px';
    } catch (error) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

function abrirNuevaRed() {
    document.getElementById('modal-red-titulo').textContent = 'Nueva red social';
    document.getElementById('red-id').value = '';
    document.getElementById('red-tipo').value = 'facebook';
    document.getElementById('red-nombre').value = '';
    document.getElementById('red-url').value = '';
    document.getElementById('red-activo').value = 'true';
    document.getElementById('modal-red').style.display = 'flex';
}

function abrirEditarRed(id) {
    const item = _redesData.find(x => x.id_recurso == id);
    if (!item) return;
    document.getElementById('modal-red-titulo').textContent = 'Editar red social';
    document.getElementById('red-id').value = item.id_recurso;
    document.getElementById('red-tipo').value = item.tipo || 'otro';
    document.getElementById('red-nombre').value = item.nombre_archivo || '';
    document.getElementById('red-url').value = item.url || '';
    document.getElementById('red-activo').value = item.activo ? 'true' : 'false';
    document.getElementById('modal-red').style.display = 'flex';
}

async function guardarRed() {
    const id = document.getElementById('red-id').value;
    const payload = {
        tipo: document.getElementById('red-tipo').value,
        nombre_archivo: document.getElementById('red-nombre').value.trim(),
        url: document.getElementById('red-url').value.trim(),
        activo: document.getElementById('red-activo').value === 'true'
    };
    if (!payload.tipo || !payload.url) return mostrarToastGestion('Tipo y URL son requeridos', 'error');
    try {
        const res = await fetch(id ? `/api/gestion-tienda/redes/${id}` : '/api/gestion-tienda/redes', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.ok) { cerrarModalRed(); cargarRedes(); }
        mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
    } catch (error) { mostrarToastGestion('Error al guardar red social', 'error'); }
}

async function toggleRed(id, activo) {
    try {
        const res = await fetch(`/api/gestion-tienda/redes/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo })
        });
        const json = await res.json();
        if (json.ok) cargarRedes();
        mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
    } catch (error) { mostrarToastGestion('Error al actualizar red', 'error'); }
}

function eliminarRed(id) {
    abrirEliminarGT({
        titulo: '¿Eliminar red social?',
        descripcion: 'La red social será eliminada permanentemente.',
        onConfirmar: async () => {
            const res = await fetch(`/api/gestion-tienda/redes/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.ok) cargarRedes();
            mostrarToastGestion(json.mensaje, json.ok ? 'success' : 'error');
            return json.ok;
        }
    });
}

function cerrarModalLogo() {
    document.getElementById('modal-logo').style.display = 'none';
    document.getElementById('logo-nombre').value = '';
    document.getElementById('logo-url').value = '';
    document.getElementById('logo-activo').value = 'true';
    document.getElementById('logo-file').value = '';
    document.getElementById('logo-preview').src = '';
    document.getElementById('logo-preview').style.display = 'none';
    document.getElementById('logo-drop-text').style.display = 'block';
    _logoFile = null;
}

function cerrarModalSlider() {
    document.getElementById('modal-slider').style.display = 'none';
    document.getElementById('slider-id').value = '';
    document.getElementById('slider-titulo').value = '';
    document.getElementById('slider-nombre').value = '';
    document.getElementById('slider-url').value = '';
    document.getElementById('slider-orden').value = '0';
    document.getElementById('slider-activo').value = 'true';
    document.getElementById('slider-file').value = '';
    document.getElementById('slider-preview').src = '';
    document.getElementById('slider-preview').style.display = 'none';
    document.getElementById('slider-drop-text').style.display = 'block';
    _sliderFile = null;
}

function cerrarModalRed() {
    document.getElementById('modal-red').style.display = 'none';
}

let _gtEliminarAccion = null;

function abrirEliminarGT({ titulo, descripcion, onConfirmar }) {
    document.getElementById('eliminar-gt-titulo').textContent = titulo;
    document.getElementById('eliminar-gt-desc').textContent = descripcion;
    _gtEliminarAccion = onConfirmar;
    document.getElementById('modal-eliminar-gt').style.display = 'flex';
}

function cerrarModalEliminarGT() {
    document.getElementById('modal-eliminar-gt').style.display = 'none';
    _gtEliminarAccion = null;
}

async function confirmarEliminarGT() {
    if (!_gtEliminarAccion) return;
    const btn = document.getElementById('btn-confirmar-eliminar-gt');
    btn.disabled = true;
    btn.textContent = 'Eliminando...';
    try {
        await _gtEliminarAccion();
    } catch (error) {
        mostrarToastGestion('Error al eliminar', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sí, eliminar';
        cerrarModalEliminarGT();
    }
}

function mostrarToastGestion(msg, tipo = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.innerHTML = `<span>${_esc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, 3000);
}

function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/\'/g,'&#39;');
}

document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.id;
    if (id === 'btn-nuevo-logo') { document.getElementById('modal-logo').style.display = 'flex'; setTimeout(() => inicializarDropzonesGestion(), 50); }
    if (id === 'btn-cerrar-modal-logo' || id === 'btn-cancelar-modal-logo') cerrarModalLogo();
    if (id === 'btn-guardar-logo') guardarLogo();
    if (id === 'btn-nuevo-slider') abrirNuevoSlider();
    if (id === 'btn-cerrar-modal-slider' || id === 'btn-cancelar-modal-slider') cerrarModalSlider();
    if (id === 'btn-guardar-slider') guardarSlider();
    if (id === 'btn-nueva-red') abrirNuevaRed();
    if (id === 'btn-cerrar-modal-red' || id === 'btn-cancelar-modal-red') cerrarModalRed();
    if (id === 'btn-guardar-red') guardarRed();
    if (id === 'btn-cancelar-eliminar-gt') cerrarModalEliminarGT();
    if (id === 'btn-confirmar-eliminar-gt') confirmarEliminarGT();
});