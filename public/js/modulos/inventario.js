let _inventarioData = [];
let _invFiltroNombre = '';
let _invFiltroEstado = '';
let _invFiltroCategoria = '';
let _invPaginaActual = 1;
let _invRegistrosPorPagina = 10;
let _invOrdenColumna = 'id';
let _invOrdenDireccion = 'asc';

let _invProductoSeleccionado = null;
let _invVarianteSeleccionada = null;
let _invGuardandoActualizacion = false;

function cargar_inventario() {
    cargarInventario();
}

async function cargarInventario() {
    const loading = document.getElementById('inv-loading');
    const empty = document.getElementById('inv-empty');
    const tablaWrap = document.getElementById('inv-tabla-wrap');
    const paginacion = document.getElementById('inv-paginacion');

    loading.style.display = 'flex';
    empty.style.display = 'none';
    tablaWrap.style.display = 'none';
    paginacion.style.display = 'none';

    try {
        const res = await fetch('/api/inventario');
        const json = await res.json();
        loading.style.display = 'none';

        if (!json.ok || !json.data || json.data.length === 0) {
            empty.style.display = 'flex';
            return;
        }

        _inventarioData = json.data;
        
        // 1. Calcular estadísticas
        _calcularEstadisticas(_inventarioData);

        // 2. Llenar filtro de categorías
        _cargarFiltroCategorias(_inventarioData);

        // 3. Renderizar tabla con filtros aplicados
        _aplicarFiltrosInventario();

    } catch (err) {
        loading.style.display = 'none';
        empty.style.display = 'flex';
        console.error('Error al cargar inventario:', err);
    }
}

function _calcularEstadisticas(data) {
    const totalProductos = data.length;
    let stockCritico = 0;
    let stockOptimo = 0;
    let stockAgotado = 0;
    let valorTotal = 0.0;
    const nombresAgotados = [];

    data.forEach(p => {
        const stock = parseInt(p.stock_general);
        const minimo = parseInt(p.stock_minimo);
        valorTotal += parseFloat(p.valor);

        if (stock === 0) {
            stockAgotado++;
            nombresAgotados.push(p.nombre_producto);
        } else if (stock < minimo) {
            stockCritico++;
        } else {
            stockOptimo++;
        }
    });

    document.getElementById('inv-stat-total').textContent = totalProductos;
    document.getElementById('inv-stat-agotado').textContent = stockAgotado;
    document.getElementById('inv-stat-critico').textContent = stockCritico;
    document.getElementById('inv-stat-optimo').textContent = stockOptimo;
    document.getElementById('inv-stat-valor').textContent = `S/ ${valorTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const alerta = document.getElementById('inv-alerta-agotados');
    const alertaTexto = document.getElementById('inv-alerta-agotados-texto');
    if (stockAgotado > 0) {
        const listado = nombresAgotados.slice(0, 3).join(', ') + (nombresAgotados.length > 3 ? ` y ${nombresAgotados.length - 3} más` : '');
        alertaTexto.textContent = `Tienes ${stockAgotado} producto${stockAgotado !== 1 ? 's' : ''} sin ninguna unidad en stock: ${listado}.`;
        alerta.style.display = 'flex';
        if (window.lucide) lucide.createIcons();
    } else {
        alerta.style.display = 'none';
    }
}

function _cargarFiltroCategorias(data) {
    const select = document.getElementById('inv-filtro-categoria');
    const actuales = [...select.options].map(o => o.value);
    
    // Obtener lista única de categorías ordenadas
    const categorias = [...new Set(data.map(p => p.categoria_nombre).filter(Boolean))].sort();
    
    categorias.forEach(cat => {
        if (!actuales.includes(cat)) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        }
    });
}

function _aplicarFiltrosInventario() {
    _invFiltroNombre = document.getElementById('inv-filtro-nombre').value.toLowerCase().trim();
    _invFiltroEstado = document.getElementById('inv-filtro-estado').value;
    _invFiltroCategoria = document.getElementById('inv-filtro-categoria').value;
    _invRegistrosPorPagina = parseInt(document.getElementById('inv-por-pagina').value) || 10;

    // Filtrar data
    const filtrados = _inventarioData.filter(p => {
        const matchNombre = !_invFiltroNombre || p.nombre_producto.toLowerCase().includes(_invFiltroNombre);
        const matchCat = !_invFiltroCategoria || p.categoria_nombre === _invFiltroCategoria;
        
        let matchEstado = true;
        const stock = parseInt(p.stock_general);
        const minimo = parseInt(p.stock_minimo);
        
        if (_invFiltroEstado === 'critico') {
            matchEstado = stock > 0 && stock < minimo;
        } else if (_invFiltroEstado === 'optimo') {
            matchEstado = stock >= minimo;
        } else if (_invFiltroEstado === 'agotado') {
            matchEstado = stock === 0;
        }

        return matchNombre && matchCat && matchEstado;
    });

    // Ordenar data
    filtrados.sort((a, b) => {
        let valA, valB;
        if (_invOrdenColumna === 'id') {
            valA = parseInt(a.id_producto);
            valB = parseInt(b.id_producto);
        } else if (_invOrdenColumna === 'stock') {
            valA = parseInt(a.stock_general);
            valB = parseInt(b.stock_general);
        } else if (_invOrdenColumna === 'valor') {
            valA = parseFloat(a.valor);
            valB = parseFloat(b.valor);
        } else {
            valA = a.nombre_producto.toLowerCase();
            valB = b.nombre_producto.toLowerCase();
        }

        if (valA < valB) return _invOrdenDireccion === 'asc' ? -1 : 1;
        if (valA > valB) return _invOrdenDireccion === 'asc' ? 1 : -1;
        return 0;
    });

    _renderTablaInventario(filtrados);
}

function _renderTablaInventario(data) {
    const tbody = document.getElementById('inv-tbody');
    const empty = document.getElementById('inv-empty');
    const tablaWrap = document.getElementById('inv-tabla-wrap');
    const paginacion = document.getElementById('inv-paginacion');
    const totalLabel = document.getElementById('inv-total-label');

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

    // Paginación
    const totalRegistros = data.length;
    const totalPaginas = Math.ceil(totalRegistros / _invRegistrosPorPagina);
    if (_invPaginaActual > totalPaginas) _invPaginaActual = totalPaginas || 1;

    const inicioIdx = (_invPaginaActual - 1) * _invRegistrosPorPagina;
    const finIdx = Math.min(inicioIdx + _invRegistrosPorPagina, totalRegistros);
    const paginados = data.slice(inicioIdx, finIdx);

    // Pintar filas
    tbody.innerHTML = paginados.map(p => {
        const stock = parseInt(p.stock_general);
        const minimo = parseInt(p.stock_minimo);
        let filaClase = '';
        let badgeClase = '';
        let badgeTxt = '';
        let stockTxtClase = '';

        if (stock === 0) {
            filaClase = 'inv-fila-critica';
            badgeClase = 'badge-inv-agotado';
            badgeTxt = 'Agotado';
            stockTxtClase = 'stock-agotado-txt';
        } else if (stock < minimo) {
            filaClase = 'inv-fila-critica';
            badgeClase = 'badge-inv-critico';
            badgeTxt = 'Crítico';
            stockTxtClase = 'stock-critico-txt';
        } else {
            badgeClase = 'badge-inv-optimo';
            badgeTxt = 'Óptimo';
            stockTxtClase = 'stock-optimo-txt';
        }

        return `
            <tr class="${filaClase}">
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px;">#${p.id_producto}</td>
                <td><strong>${_invEsc(p.nombre_producto)}</strong></td>
                <td><span class="badge badge-blue" style="font-size:11.5px;">${_invEsc(p.categoria_nombre || 'Sin categoría')}</span></td>
                <td class="${stockTxtClase}">${stock}</td>
                <td style="color:var(--muted);font-family:var(--mono);">${minimo}</td>
                <td><span class="badge ${badgeClase}" style="font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 8px;">${badgeTxt}</span></td>
                <td style="font-family:var(--mono);font-weight:600;font-size:12.5px;color:var(--accent);">S/ ${parseFloat(p.valor).toFixed(2)}</td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end;">
                        <button class="btn-icon" title="Ver Detalle" data-accion="ver" data-id="${p.id_producto}">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </button>
                        <button class="btn-icon btn-icon-accent" title="Actualizar Stock" data-accion="actualizar" data-id="${p.id_producto}">
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

    // Pintar paginación
    document.getElementById('inv-pag-info').textContent = `Mostrando ${inicioIdx + 1}-${finIdx} de ${totalRegistros}`;

    const pagBotones = document.getElementById('inv-pag-botones');
    pagBotones.innerHTML = '';

    if (totalPaginas > 1) {
        // Botón Anterior
        const btnAnt = document.createElement('button');
        btnAnt.className = 'btn-pag';
        btnAnt.disabled = _invPaginaActual === 1;
        btnAnt.textContent = '◀';
        btnAnt.onclick = () => {
            if (_invPaginaActual > 1) {
                _invPaginaActual--;
                _aplicarFiltrosInventario();
            }
        };
        pagBotones.appendChild(btnAnt);

        // Botones de páginas
        for (let idx = 1; idx <= totalPaginas; idx++) {
            const btnPag = document.createElement('button');
            btnPag.className = `btn-pag ${idx === _invPaginaActual ? 'active' : ''}`;
            btnPag.textContent = idx;
            btnPag.onclick = () => {
                _invPaginaActual = idx;
                _aplicarFiltrosInventario();
            };
            pagBotones.appendChild(btnPag);
        }

        // Botón Siguiente
        const btnSig = document.createElement('button');
        btnSig.className = 'btn-pag';
        btnSig.disabled = _invPaginaActual === totalPaginas;
        btnSig.textContent = '▶';
        btnSig.onclick = () => {
            if (_invPaginaActual < totalPaginas) {
                _invPaginaActual++;
                _aplicarFiltrosInventario();
            }
        };
        pagBotones.appendChild(btnSig);
    }
}

async function abrirVerDetalle(id) {
    if (!document.getElementById('modal-inv-ver')) return;
    const modal = document.getElementById('modal-inv-ver');
    
    document.getElementById('ver-producto-nombre').textContent = 'Cargando…';
    document.getElementById('ver-producto-categoria').textContent = '—';
    document.getElementById('ver-stock-general').textContent = '—';
    document.getElementById('ver-estado-badge').innerHTML = '';
    document.getElementById('ver-presentaciones-lista').innerHTML = `
        <div class="spinner-wrap" style="padding:20px 0;">
            <div class="spinner" style="width:20px;height:20px;"></div>
        </div>
    `;

    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/inventario/${id}`);
        const json = await res.json();

        if (!json.ok) throw new Error(json.mensaje);

        const prod = json.producto;
        const variantes = json.variantes;

        // Calcular stock general de los cargados
        const stockGeneral = variantes.reduce((sum, v) => sum + parseInt(v.stock), 0);
        const minimo = parseInt(prod.stock_minimo);

        document.getElementById('ver-producto-nombre').textContent = prod.nombre_producto;
        document.getElementById('ver-producto-categoria').textContent = prod.categoria_nombre || 'Sin categoría';
        document.getElementById('ver-stock-general').textContent = stockGeneral;

        let badgeHtml = '';
        if (stockGeneral === 0) {
            badgeHtml = '<span class="badge badge-inv-agotado" style="font-size:11px;padding:2px 8px;">AGOTADO</span>';
        } else if (stockGeneral < minimo) {
            badgeHtml = '<span class="badge badge-inv-critico" style="font-size:11px;padding:2px 8px;">CRÍTICO</span>';
        } else {
            badgeHtml = '<span class="badge badge-inv-optimo" style="font-size:11px;padding:2px 8px;">ÓPTIMO</span>';
        }
        document.getElementById('ver-estado-badge').innerHTML = badgeHtml;
        if (variantes.length === 0) {
            document.getElementById('ver-presentaciones-lista').innerHTML = `
                <div style="text-align:center;padding:12px;color:var(--muted);font-size:13px;">
                    No tiene presentaciones registradas.
                </div>
            `;
            return;
        }

        document.getElementById('ver-presentaciones-lista').innerHTML = variantes.map(v => {
            const stock = parseInt(v.stock);
            let claseStock = 'optimo';
            let txtStock = 'Stock Suficiente';
            let claseCard = '';

            if (stock === 0) {
                claseStock = 'agotado';
                txtStock = 'Sin Stock';
                claseCard = 'pres-agotada';
            } else if (stock < 3) { // Umbral interno crítico
                claseStock = 'critico';
                txtStock = 'Stock Muy Bajo';
            }

            const tipoUniforme = v.nombre_tipo ? ` (${v.nombre_tipo})` : '';

            return `
                <div class="pres-card ${claseCard}">
                    <div style="flex:1;">
                        <div class="pres-card-nombre">Color: ${v.color} - Talla: ${v.nombre_talla}${tipoUniforme}</div>
                        <div class="pres-card-precio">Precio extra: S/ ${parseFloat(v.precio_extra).toFixed(2)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="pres-card-stock ${claseStock}">${stock}</div>
                        <div class="${stock === 0 ? 'pres-agotado-txt' : 'pres-disponible'}">${txtStock}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        document.getElementById('ver-producto-nombre').textContent = 'Error';
        document.getElementById('ver-presentaciones-lista').innerHTML = `
            <div style="color:var(--error);text-align:center;padding:12px;">
                No se pudieron cargar los detalles: ${err.message}
            </div>
        `;
    }
}

async function abrirActualizarStock(id) {
    if (!document.getElementById('modal-inv-actualizar')) return;
    const modal = document.getElementById('modal-inv-actualizar');
    _invProductoSeleccionado = null;
    _invVarianteSeleccionada = null;

    document.getElementById('act-producto-nombre').textContent = 'Cargando…';
    document.getElementById('act-stock-actual').textContent = '—';
    document.getElementById('act-stock-minimo').textContent = '—';
    document.getElementById('act-presentaciones-lista').innerHTML = `
        <div class="spinner-wrap" style="padding:20px 0;">
            <div class="spinner" style="width:20px;height:20px;"></div>
        </div>
    `;

    // Reset formulario e historial
    document.getElementById('act-form-movimiento').style.display = 'none';
    document.getElementById('act-historial-tbody').innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">
                Selecciona una presentación para ver su historial
            </td>
        </tr>
    `;
    document.getElementById('btn-guardar-inv-actualizar').style.display = 'none';

    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/inventario/${id}`);
        const json = await res.json();

        if (!json.ok) throw new Error(json.mensaje);

        _invProductoSeleccionado = json.producto;
        const variantes = json.variantes;

        const stockGeneral = variantes.reduce((sum, v) => sum + parseInt(v.stock), 0);
        document.getElementById('act-producto-nombre').textContent = _invProductoSeleccionado.nombre_producto;
        document.getElementById('act-stock-actual').textContent = stockGeneral;
        document.getElementById('act-stock-minimo').textContent = _invProductoSeleccionado.stock_minimo;

        if (variantes.length === 0) {
            document.getElementById('act-presentaciones-lista').innerHTML = `
                <div style="text-align:center;padding:12px;color:var(--muted);font-size:13px;">
                    Este producto no cuenta con variantes activas. Crea variantes primero.
                </div>
            `;
            return;
        }

        _pintarPresentacionesDeActualizacion(variantes);

    } catch (err) {
        document.getElementById('act-producto-nombre').textContent = 'Error';
        document.getElementById('act-presentaciones-lista').innerHTML = `
            <div style="color:var(--error);text-align:center;padding:12px;">
                No se pudo cargar el producto: ${err.message}
            </div>
        `;
    }
}

function _pintarPresentacionesDeActualizacion(variantes) {
    const lista = document.getElementById('act-presentaciones-lista');
    window._invVariantesTemp = variantes;

    // Agrupar por color
    const colores = [...new Set(variantes.map(v => v.color))];

    lista.innerHTML = `
        <div style="margin-bottom:12px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-family:var(--mono);margin-bottom:8px;">Color</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;" id="color-chips">
                ${colores.map(c => `
                    <button class="color-chip" data-color="${c}"
                        style="padding:5px 14px;border:2px solid var(--border);border-radius:20px;
                               font-size:12px;font-weight:600;cursor:pointer;background:#fff;
                               font-family:var(--font);transition:all .15s;">
                        ${c}
                    </button>`).join('')}
            </div>
        </div>
        <div id="tallas-wrap" style="display:none;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-family:var(--mono);margin-bottom:8px;">Talla</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;" id="talla-chips"></div>
        </div>`;

    // Click en color
    lista.querySelectorAll('.color-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            lista.querySelectorAll('.color-chip').forEach(b => {
                b.style.borderColor = 'var(--border)';
                b.style.background = '#fff';
                b.style.color = 'var(--text)';
            });
            btn.style.borderColor = 'var(--accent)';
            btn.style.background = '#fff5f0';
            btn.style.color = 'var(--accent)';

            const colorSeleccionado = btn.dataset.color;
            const variantesColor = variantes.filter(v => v.color === colorSeleccionado);

            const tallasWrap = document.getElementById('tallas-wrap');
            const tallaChips = document.getElementById('talla-chips');
            tallasWrap.style.display = 'block';

            tallaChips.innerHTML = variantesColor.map((v, idx) => {
                const stock = parseInt(v.stock);
                const colorStock = stock === 0 ? '#aaa' : stock < 3 ? 'var(--error)' : '#276936';
                const borderColor = stock === 0 ? '#ddd' : stock < 3 ? '#f5c6c2' : '#b6ddbf';
                const bgColor = stock === 0 ? '#f5f5f5' : stock < 3 ? '#fdf5f5' : '#eaf4ec';
                return `
                    <button class="talla-chip" data-idx="${window._invVariantesTemp.indexOf(v)}"
                        style="padding:8px 16px;border:2px solid ${borderColor};border-radius:8px;
                               font-size:13px;font-weight:700;cursor:pointer;background:${bgColor};
                               font-family:var(--font);transition:all .15s;min-width:52px;text-align:center;">
                        <span style="display:block;font-size:13px;font-weight:700;color:var(--text);line-height:1.2;">${v.nombre_talla}</span>
                        <span style="display:block;width:100%;height:1px;background:${borderColor};margin:4px 0;"></span>
                        <span style="display:block;font-size:11px;font-weight:700;color:${colorStock};font-family:var(--mono);line-height:1.2;">${stock}</span>
                    </button>`;
            }).join('');

            // Click en talla
            tallaChips.querySelectorAll('.talla-chip').forEach(t => {
                t.addEventListener('click', () => {
                    tallaChips.querySelectorAll('.talla-chip').forEach(b => {
                        b.style.borderColor = 'var(--border)';
                        b.style.background = '#fff';
                    });
                    t.style.borderColor = 'var(--accent)';
                    t.style.background = '#fff5f0';

                    const idx = parseInt(t.dataset.idx);
                    _seleccionarVarianteParaStock(window._invVariantesTemp[idx]);
                });
            });
        });
    });
}

function _seleccionarVarianteParaStock(variante) {
    console.log('variante recibida:', variante);
    _invVarianteSeleccionada = variante;
    const cards = document.querySelectorAll('#act-presentaciones-lista .pres-card');
    cards.forEach(card => {
        card.classList.remove('pres-activa');
        if (card.innerHTML.includes(`ID Variante: #${variante.id_variante}`)) {
            card.classList.add('pres-activa');
        }
    });

    document.getElementById('act-form-presentacion-nombre').textContent = `Color: ${variante.color} - Talla: ${variante.nombre_talla}`;
    document.getElementById('act-form-stock-antes').textContent = variante.stock;
    document.getElementById('act-form-stock-despues').textContent = variante.stock;
    document.getElementById('act-operacion').value = 'ingreso';
    document.getElementById('act-cantidad').value = '';
    document.getElementById('act-boleta').value = '';
    document.getElementById('act-observacion').value = '';
    document.getElementById('act-form-movimiento').style.display = 'block';
    document.getElementById('btn-guardar-inv-actualizar').style.display = 'inline-flex';
    _cargarHistorialVariante(variante.id_variante);
}

async function _cargarHistorialVariante(idVariante) {
    const tbody = document.getElementById('act-historial-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center;padding:12px;">
                <div class="spinner" style="width:16px;height:16px;margin:0 auto;"></div>
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`/api/inventario/variante/${idVariante}/historial`);
        const json = await res.json();

        if (!json.ok) throw new Error(json.mensaje);

        const data = json.data;
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;color:var(--muted);padding:14px;">
                        No se registran movimientos para esta presentación.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(m => {
            const fechaStr = new Date(m.fecha_movimiento).toLocaleString('es-PE', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const tipoClase = m.tipo_movimiento === 'entrada' ? 'stock-optimo-txt' : 'stock-critico-txt';
            const cantidadSigno = m.tipo_movimiento === 'entrada' ? `+${m.cantidad}` : `-${m.cantidad}`;
            const antes = m.stock_antes !== null ? m.stock_antes : '—';
            const despues = m.stock_despues !== null ? m.stock_despues : '—';

            return `
                <tr>
                    <td style="font-family:var(--mono);font-size:11.5px;color:var(--muted);">${fechaStr}</td>
                    <td><strong>Color: ${m.color} - Talla: ${m.nombre_talla}</strong></td>
                    <td style="font-family:var(--mono);">${antes}</td>
                    <td style="font-family:var(--mono);" class="${tipoClase}">${despues} (${cantidadSigno})</td>
                    <td style="color:var(--muted);font-size:11.5px;">${_invEsc(m.boleta || '—')}</td>
                    <td style="color:var(--muted);font-size:11.5px;" title="${_invEsc(m.observacion || m.motivo)}">${_invEsc(m.observacion || m.motivo)}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;color:var(--error);padding:14px;">
                    Error al cargar historial: ${err.message}
                </td>
            </tr>
        `;
    }
}
function _actualizarCalculoStockPrevisto() {
    if (!_invVarianteSeleccionada) return;

    const operacion = document.getElementById('act-operacion').value;
    const cantVal = parseInt(document.getElementById('act-cantidad').value) || 0;
    const stockAntes = parseInt(_invVarianteSeleccionada.stock);

    let stockDespues = stockAntes;
    if (operacion === 'ingreso') {
        stockDespues = stockAntes + cantVal;
    } else if (operacion === 'egreso') {
        stockDespues = stockAntes - cantVal;
    } else if (operacion === 'ajuste') {
        stockDespues = cantVal;
    }

    const despuesEl = document.getElementById('act-form-stock-despues');
    despuesEl.textContent = stockDespues;
    
    if (stockDespues < 0) {
        despuesEl.style.color = 'var(--error)';
    } else {
        despuesEl.style.color = 'var(--accent)';
    }
}

async function guardarActualizacionStock() {
    if (_invGuardandoActualizacion || !_invVarianteSeleccionada) return;

    const operacion = document.getElementById('act-operacion').value;
    const cantidadStr = document.getElementById('act-cantidad').value.trim();
    const boleta = document.getElementById('act-boleta').value.trim();
    const observacion = document.getElementById('act-observacion').value.trim();

    if (!cantidadStr) {
        _invToast('Ingresa una cantidad', 'error');
        return;
    }

    const cantidad = parseInt(cantidadStr);
    if (isNaN(cantidad) || cantidad < 0) {
        _invToast('La cantidad debe ser mayor o igual a 0', 'error');
        return;
    }

    const stockAntes = parseInt(_invVarianteSeleccionada.stock);
    if (operacion === 'egreso' && stockAntes < cantidad) {
        _invToast(`Stock insuficiente. Disponible: ${stockAntes}`, 'error');
        return;
    }

    const btn = document.getElementById('btn-guardar-inv-actualizar');
    const btnText = document.getElementById('btn-guardar-inv-text');
    const spinner = document.getElementById('btn-guardar-inv-spinner');

    _invGuardandoActualizacion = true;
    btn.disabled = true;
    btnText.textContent = 'Guardando…';
    spinner.style.display = 'block';

    try {
        const res = await fetch('/api/inventario/actualizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_variante: _invVarianteSeleccionada.id_variante,
                operacion,
                cantidad,
                boleta,
                observacion
            })
        });
        const json = await res.json();

        if (json.ok) {
            _invToast(json.mensaje, 'success');
            _invVarianteSeleccionada.stock = json.stock_despues;
            cargarInventario();
            const idProd = _invProductoSeleccionado.id_producto;
            const resProd = await fetch(`/api/inventario/${idProd}`);
            const jsonProd = await resProd.rows ? { ok: false } : await resProd.json();
            if (jsonProd.ok) {
                const variantes = jsonProd.variantes;
                const stockGeneral = variantes.reduce((sum, v) => sum + parseInt(v.stock), 0);
                document.getElementById('act-stock-actual').textContent = stockGeneral;
                _pintarPresentacionesDeActualizacion(variantes);
                const nuevaVar = variantes.find(v => v.id_variante === _invVarianteSeleccionada.id_variante);
                if (nuevaVar) {
                    _seleccionarVarianteParaStock(nuevaVar);
                }
            } else {
                cerrarModalActualizarStock();
            }

        } else {
            _invToast(json.mensaje || 'Error al actualizar stock', 'error');
        }
    } catch (err) {
        _invToast('Error de conexión con el servidor', 'error');
    } finally {
        _invGuardandoActualizacion = false;
        btn.disabled = false;
        btnText.textContent = 'Guardar Cambios';
        spinner.style.display = 'none';
    }
}

function cerrarModalVerDetalle() {
    document.getElementById('modal-inv-ver').style.display = 'none';
}

function cerrarModalActualizarStock() {
    document.getElementById('modal-inv-actualizar').style.display = 'none';
    _invProductoSeleccionado = null;
    _invVarianteSeleccionada = null;
}

document.addEventListener('click', function (e) {
    const btnAccion = e.target.closest('[data-accion]');
    if (btnAccion && btnAccion.closest('#inv-tabla-wrap')) { 
        const accion = btnAccion.dataset.accion;
        const id = btnAccion.dataset.id;
        if (accion === 'ver') {
            abrirVerDetalle(id);
            return;
        }
        if (accion === 'actualizar') {
            abrirActualizarStock(id);
            return;
        }
    }

    const clickId = e.target.closest('button')?.id || e.target.id;
    if (clickId === 'btn-cerrar-inv-ver' || clickId === 'btn-cerrar-inv-ver2') {
        cerrarModalVerDetalle();
        return;
    }
    if (clickId === 'btn-cerrar-inv-actualizar' || clickId === 'btn-cancelar-inv-actualizar') {
        cerrarModalActualizarStock();
        return;
    }
    if (clickId === 'btn-guardar-inv-actualizar') {
        guardarActualizacionStock();
        return;
    }

    if (e.target.id === 'modal-inv-ver') {
        cerrarModalVerDetalle();
        return;
    }
    if (e.target.id === 'modal-inv-actualizar') {
        cerrarModalActualizarStock();
        return;
    }

    const thSort = e.target.closest('[data-col]');
    if (thSort && thSort.closest('#inv-tabla-wrap')) {
        const col = thSort.dataset.col;
        if (_invOrdenColumna === col) {
            _invOrdenDireccion = _invOrdenDireccion === 'asc' ? 'desc' : 'asc';
        } else {
            _invOrdenColumna = col;
            _invOrdenDireccion = 'asc';
        }

        const headers = thSort.closest('tr').querySelectorAll('[data-col]');
        headers.forEach(h => {
            const cleanColName = h.textContent.replace(' ▲', '').replace(' ▼', '').replace(' ↕', '');
            if (h.dataset.col === _invOrdenColumna) {
                h.textContent = `${cleanColName} ${_invOrdenDireccion === 'asc' ? '▲' : '▼'}`;
            } else {
                h.textContent = `${cleanColName} ↕`;
            }
        });

        _aplicarFiltrosInventario();
    }
});

document.addEventListener('input', function(e) {
    if (e.target.id === 'inv-filtro-nombre') {
        _invPaginaActual = 1;
        _aplicarFiltrosInventario();
        return;
    }
    if (e.target.id === 'act-cantidad') {
        _actualizarCalculoStockPrevisto();
        return;
    }
});

document.addEventListener('change', function(e) {
    if (e.target.id === 'inv-filtro-estado' || e.target.id === 'inv-filtro-categoria') {
        _invPaginaActual = 1;
        _aplicarFiltrosInventario();
        return;
    }
    if (e.target.id === 'inv-por-pagina') {
        _invPaginaActual = 1;
        _aplicarFiltrosInventario();
        return;
    }
    if (e.target.id === 'act-operacion') {
        _actualizarCalculoStockPrevisto();
        return;
    }
});

function _invEsc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _invToast(msg, tipo = 'success') {
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
    t.innerHTML = `${iconos[tipo] || ''}<span>${_invEsc(msg)}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
        t.classList.add('saliendo');
        setTimeout(() => t.remove(), 300);
    }, 3500);
}
