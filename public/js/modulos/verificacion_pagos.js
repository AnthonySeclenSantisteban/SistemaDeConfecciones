let vpPagos = [];
let vpPagosFiltrados = [];
let vpPaginaActual = 1;
const vpPorPagina = 15;
let vpPagoActivo = null;

async function vpCargarDatos() {
  document.getElementById('vpSpinner').style.display = 'flex';
  document.getElementById('vpTablaWrap').style.display = 'none';
  document.getElementById('vpEmpty').style.display = 'none';
  try {
    const res = await fetch('/admin/pagos/verificacion'); 
    const data = await res.json();
    vpPagos = data.data || [];          
    vpActualizarStats(data.stats || {});
    vpPagosFiltrados = [...vpPagos];
    vpRenderizarTabla();
  } catch (e) {
    mostrarToast('Error al cargar pagos', 'error');
  } finally {
    document.getElementById('vpSpinner').style.display = 'none';
  }
}

function vpActualizarStats(stats) {
  document.getElementById('vpStatPendientes').textContent = stats.pendientes ?? 0;
  document.getElementById('vpStatVerificados').textContent = stats.verificados ?? 0;
  document.getElementById('vpStatRechazados').textContent = stats.rechazados ?? 0;
  document.getElementById('vpStatMonto').textContent = 'S/ ' + parseFloat(stats.monto_pendiente || 0).toFixed(2);
}

function vpAplicarFiltros() {
  const texto = document.getElementById('vpFiltroTexto').value.toLowerCase().trim();
  const estado = document.getElementById('vpFiltroEstado').value;
  const metodo = document.getElementById('vpFiltroMetodo').value;
  const fecha = document.getElementById('vpFiltroFecha').value;
  vpPagosFiltrados = vpPagos.filter(p => {
    const matchTexto = !texto || (p.orden_codigo || '').toLowerCase().includes(texto) ||
      (p.cliente_nombre || '').toLowerCase().includes(texto) ||
      (p.codigo_operacion || '').toLowerCase().includes(texto);
    const matchEstado = !estado || p.estado === estado;
    const matchMetodo = !metodo || p.metodo_pago === metodo;
    const matchFecha = !fecha || (p.fecha_pago || '').startsWith(fecha);
    return matchTexto && matchEstado && matchMetodo && matchFecha;
  });
  vpPaginaActual = 1;
  vpRenderizarTabla();
}

function vpLimpiarFiltros() {
  document.getElementById('vpFiltroTexto').value = '';
  document.getElementById('vpFiltroEstado').value = '';
  document.getElementById('vpFiltroMetodo').value = '';
  document.getElementById('vpFiltroFecha').value = '';
  vpPagosFiltrados = [...vpPagos];
  vpPaginaActual = 1;
  vpRenderizarTabla();
}

function vpRenderizarTabla() {
  const tbody = document.getElementById('vpTablaBody');
  const total = vpPagosFiltrados.length;
  document.getElementById('vpTotalRegistros').textContent = `${total} registro${total !== 1 ? 's' : ''}`;
  if (total === 0) {
    document.getElementById('vpTablaWrap').style.display = 'none';
    document.getElementById('vpEmpty').style.display = 'flex';
    document.getElementById('vpPaginacion').innerHTML = '';
    return;
  }
  document.getElementById('vpTablaWrap').style.display = 'block';
  document.getElementById('vpEmpty').style.display = 'none';
  const inicio = (vpPaginaActual - 1) * vpPorPagina;
  const pagina = vpPagosFiltrados.slice(inicio, inicio + vpPorPagina);
  tbody.innerHTML = pagina.map(p => vpFila(p)).join('');
  if (window.lucide) lucide.createIcons();
  vpRenderizarPaginacion(total);
}

function vpFila(p) {
  const estadoBadge = {
    pendiente: '<span class="badge badge-yellow"><i data-lucide="clock" style="width:11px;height:11px;"></i> Pendiente</span>',
    verificado: '<span class="badge badge-green"><i data-lucide="check-circle" style="width:11px;height:11px;"></i> Verificado</span>',
    rechazado: '<span class="badge badge-red"><i data-lucide="x-circle" style="width:11px;height:11px;"></i> Rechazado</span>'
  }[p.estado] || `<span class="badge">${p.estado}</span>`;

  const metodoBadge = vpMetodoBadge(p.metodo_pago);

  const coincide = p.monto_coincide
    ? '<div style="font-size:11px;color:var(--success);margin-top:2px;">✓ Coincide</div>'
    : '<div style="font-size:11px;color:var(--danger);margin-top:2px;">✗ No coincide</div>';

  const comprobante = p.comprobante_url
    ? `<button class="btn-icon" onclick="vpVerImagen('${p.comprobante_url}')" title="Ver comprobante">
         <i data-lucide="image" style="width:14px;height:14px;"></i> Ver
       </button>`
    : '<span style="font-size:11px;color:var(--muted);">Sin imagen</span>';

  const nota = p.nota_venta_numero
    ? `<span class="badge badge-green" style="cursor:pointer;" onclick="vpVerNota(${p.id_pedido})">${p.nota_venta_numero}</span>`
    : '<span style="font-size:11px;color:var(--muted);">—</span>';

  const fecha = p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-PE') : '—';

  let acciones = `<button class="btn-icon" onclick="vpVerDetalle(${p.id_pago})" title="Ver detalle">
    <i data-lucide="eye" style="width:14px;height:14px;"></i>
  </button>`;

  if (p.estado === 'pendiente') {
    acciones += `
      <button class="btn-icon btn-icon-success" onclick="vpVerificar(${p.id_pago})" title="Verificar pago">
        <i data-lucide="check-circle" style="width:14px;height:14px;"></i>
      </button>
      <button class="btn-icon btn-icon-danger" onclick="vpAbrirRechazar(${p.id_pago})" title="Rechazar pago">
        <i data-lucide="x-circle" style="width:14px;height:14px;"></i>
      </button>`;
  }

  if (p.estado === 'verificado' && !p.nota_venta_numero) {
    acciones += `
      <button class="btn-secondary btn-sm" onclick="vpAbrirGenerarVenta(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Crear nota de venta">
        <i data-lucide="file-text" style="width:13px;height:13px;"></i> Nota
      </button>`;
  }

  return `<tr>
    <td><a href="#" onclick="vpVerDetalle(${p.id_pago});return false;" class="link-orden" style="font-family:var(--mono);font-size:12px;color:var(--accent);">ORD-${p.orden_codigo}</a></td>
    <td style="font-size:13px;">${p.cliente_nombre || '—'}<br><span style="font-size:11px;color:var(--muted);">${p.cliente_dni || ''}</span></td>
    <td><strong>S/ ${parseFloat(p.monto || 0).toFixed(2)}</strong><br><span style="font-size:11px;color:var(--muted);">Total: S/ ${parseFloat(p.total_orden || 0).toFixed(2)}</span>${coincide}</td>
    <td><code style="font-size:12px;background:var(--bg-alt);padding:2px 7px;border-radius:5px;border:1px solid var(--border);">${p.codigo_operacion || '—'}</code></td>
    <td>${metodoBadge}</td>
    <td>${estadoBadge}${p.estado === 'rechazado' && p.motivo_rechazo ? `<div style="font-size:10px;color:var(--muted);margin-top:2px;">${p.motivo_rechazo.substring(0, 30)}...</div>` : ''}</td>
    <td>${comprobante}</td>
    <td style="font-size:12px;white-space:nowrap;">${fecha}</td>
    <td>${nota}</td>
    <td style="text-align:center;">
      <div style="display:flex;gap:5px;justify-content:center;flex-wrap:wrap;">${acciones}</div>
    </td>
  </tr>`;
}

function vpMetodoBadge(metodo) {
  const map = {
    yape: '<span class="badge" style="background:#7c3aed22;color:#7c3aed;border:1px solid #7c3aed44;">Yape</span>',
    plin: '<span class="badge" style="background:#16a34a22;color:#16a34a;border:1px solid #16a34a44;">Plin</span>',
    transferencia: '<span class="badge" style="background:#0369a122;color:#0369a1;border:1px solid #0369a144;">Transferencia BCP</span>',
    efectivo: '<span class="badge" style="background:#ca8a0422;color:#ca8a04;border:1px solid #ca8a0444;">Efectivo</span>',
    visa: '<span class="badge" style="background:#1d4ed822;color:#1d4ed8;border:1px solid #1d4ed844;">Tarjeta Visa</span>'
  };
  return map[metodo] || `<span class="badge">${metodo || '—'}</span>`;
}

function vpRenderizarPaginacion(total) {
  const totalPags = Math.ceil(total / vpPorPagina);
  const wrap = document.getElementById('vpPaginacion');
  if (totalPags <= 1) { wrap.innerHTML = ''; return; }
  let html = '';
  if (vpPaginaActual > 1) html += `<button onclick="vpIrPagina(${vpPaginaActual - 1})">‹</button>`;
  for (let i = 1; i <= totalPags; i++) {
    if (i === vpPaginaActual) html += `<button class="active">${i}</button>`;
    else if (i === 1 || i === totalPags || Math.abs(i - vpPaginaActual) <= 2) html += `<button onclick="vpIrPagina(${i})">${i}</button>`;
    else if (Math.abs(i - vpPaginaActual) === 3) html += `<span>…</span>`;
  }
  if (vpPaginaActual < totalPags) html += `<button onclick="vpIrPagina(${vpPaginaActual + 1})">›</button>`;
  wrap.innerHTML = html;
}

function vpIrPagina(n) {
  vpPaginaActual = n;
  vpRenderizarTabla();
}

async function vpVerDetalle(idPago) {
  vpPagoActivo = idPago;
  document.getElementById('vpModalDetalle').style.display = 'flex';
  document.getElementById('vpModalBody').innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  document.getElementById('vpModalBotones').innerHTML = '';
  try {
    const res = await fetch(`/admin/pagos/${idPago}`);
    const d = await res.json();
    const p = d.pago;
    document.getElementById('vpModalTitulo').textContent = `Pago de ORD-${p.orden_codigo}`;
    document.getElementById('vpModalSubtitulo').textContent = `ID Pago: #${p.id_pago}`;

    const items = (p.items || []).map(i =>
      `<tr><td>${i.producto}</td><td style="text-align:center;">${i.cantidad}</td><td style="text-align:right;">S/ ${parseFloat(i.precio).toFixed(2)}</td><td style="text-align:right;">S/ ${parseFloat(i.subtotal).toFixed(2)}</td></tr>`
    ).join('');

    document.getElementById('vpModalBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px 24px;">
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Datos del pago</div>
          <div class="detail-row"><span>Cliente</span><strong>${p.cliente_nombre}</strong></div>
          <div class="detail-row"><span>DNI/RUC</span><span>${p.cliente_dni || '—'}</span></div>
          <div class="detail-row"><span>Teléfono</span><span>${p.cliente_telefono || '—'}</span></div>
          <div class="detail-row"><span>Email</span><span>${p.cliente_email || '—'}</span></div>
          <div class="detail-row"><span>Método</span>${vpMetodoBadge(p.metodo_pago)}</div>
          <div class="detail-row"><span>Código Op.</span><code style="font-size:12px;background:var(--bg-alt);padding:2px 8px;border-radius:5px;">${p.codigo_operacion || '—'}</code></div>
          <div class="detail-row"><span>Monto pagado</span><strong style="color:var(--accent);">S/ ${parseFloat(p.monto).toFixed(2)}</strong></div>
          <div class="detail-row"><span>Total orden</span><span>S/ ${parseFloat(p.total_orden).toFixed(2)}</span></div>
          <div class="detail-row"><span>Coincide</span>${p.monto_coincide ? '<span style="color:var(--success);">✓ Sí</span>' : '<span style="color:var(--danger);">✗ No</span>'}</div>
          <div class="detail-row"><span>Fecha pago</span><span>${p.fecha_pago ? new Date(p.fecha_pago).toLocaleString('es-PE') : '—'}</span></div>
          ${p.nota_operador ? `<div class="detail-row"><span>Nota operador</span><span>${p.nota_operador}</span></div>` : ''}
          ${p.motivo_rechazo ? `<div class="detail-row"><span>Motivo rechazo</span><span style="color:var(--danger);">${p.motivo_rechazo}</span></div>` : ''}
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Comprobante</div>
          ${p.comprobante_url
            ? `<img src="${p.comprobante_url}" alt="Comprobante" style="width:100%;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="vpVerImagen('${p.comprobante_url}')">`
            : '<div style="width:100%;height:160px;background:var(--bg-alt);border-radius:8px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">Sin comprobante</div>'}
          ${p.nota_venta_numero ? `<div style="margin-top:12px;padding:10px 14px;background:var(--success-bg,#16a34a11);border:1px solid var(--success-border,#16a34a44);border-radius:8px;font-size:13px;"><strong>Nota de Venta:</strong> ${p.nota_venta_numero}</div>` : ''}
        </div>
      </div>
      ${items ? `<div style="padding:0 24px 20px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Productos del pedido</div>
        <table class="tabla" style="font-size:12.5px;">
          <thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">Subtotal</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
      </div>` : ''}`;

    let botones = `<button class="btn-secondary" onclick="vpCerrarModal('vpModalDetalle')">Cerrar</button>`;
    if (p.estado === 'pendiente') {
      botones = `<button class="btn-secondary" onclick="vpCerrarModal('vpModalDetalle')">Cancelar</button>
        <button class="btn-danger" onclick="vpCerrarModal('vpModalDetalle');vpAbrirRechazar(${p.id_pago})">
          <i data-lucide="x-circle"></i> Rechazar
        </button>
        <button class="btn-primary" onclick="vpCerrarModal('vpModalDetalle');vpVerificar(${p.id_pago})">
          <i data-lucide="check-circle"></i> Verificar pago
        </button>`;
    }
    document.getElementById('vpModalBotones').innerHTML = botones;
    if (window.lucide) lucide.createIcons();
  } catch {
    document.getElementById('vpModalBody').innerHTML = '<div class="empty-state"><p>Error al cargar detalle</p></div>';
  }
}

async function vpVerificar(idPago) {
  if (!confirm('¿Confirmar verificación de este pago?')) return;
  try {
    const res = await fetch(`/admin/pagos/${idPago}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Error');
    mostrarToast('Pago verificado correctamente', 'success');
    await vpCargarDatos();
    if (d.id_pedido && !d.nota_venta_numero) {
      const pago = vpPagos.find(p => p.id_pago === idPago);
      if (pago) vpAbrirGenerarVenta(pago);
    }
  } catch (e) {
    mostrarToast(e.message, 'error');
  }
}

function vpVerImagen(url) {
  document.getElementById('vpImagenComprobante').src = url;
  document.getElementById('vpDescargarImagen').href = url;
  document.getElementById('vpModalImagen').style.display = 'flex';
}

function vpAbrirRechazar(idPago) {
  document.getElementById('vpRechazarIdPago').value = idPago;
  document.getElementById('vpMotivoRechazo').value = '';
  document.getElementById('vpModalRechazar').style.display = 'flex';
}

async function vpConfirmarRechazo() {
  const idPago = document.getElementById('vpRechazarIdPago').value;
  const motivo = document.getElementById('vpMotivoRechazo').value.trim();
  if (!motivo) { mostrarToast('Ingresa el motivo del rechazo', 'warning'); return; }
  try {
    const res = await fetch(`/admin/pagos/${idPago}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Error');
    mostrarToast('Pago rechazado', 'warning');
    vpCerrarModal('vpModalRechazar');
    await vpCargarDatos();
  } catch (e) {
    mostrarToast(e.message, 'error');
  }
}

function vpAbrirGenerarVenta(pago) {
  document.getElementById('vpGVOrden').textContent = `ORD-${pago.orden_codigo}`;
  document.getElementById('vpGVCliente').textContent = pago.cliente_nombre;
  document.getElementById('vpGVTotal').textContent = `S/ ${parseFloat(pago.total_orden || pago.monto).toFixed(2)}`;
  document.getElementById('vpGVIdPedido').value = pago.id_pedido;
  document.getElementById('vpGVIdPago').value = pago.id_pago;
  document.getElementById('vpGVTipoDoc').value = 'nota_venta';
  document.getElementById('vpModalGenerarVenta').style.display = 'flex';
}

async function vpConfirmarGenerarVenta() {
  const idPedido = document.getElementById('vpGVIdPedido').value;
  const idPago = document.getElementById('vpGVIdPago').value;
  const tipoDoc = document.getElementById('vpGVTipoDoc').value;
  const btn = document.getElementById('vpBtnCrearVenta');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Creando...';
  try {
    const res = await fetch(`/admin/ventas/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_pedido: idPedido, id_pago: idPago, tipo_comprobante: tipoDoc })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Error');
    mostrarToast(`${tipoDoc === 'boleta' ? 'Boleta' : 'Nota de Venta'} creada: ${d.numero}`, 'success');
    vpCerrarModal('vpModalGenerarVenta');
    await vpCargarDatos();
  } catch (e) {
    mostrarToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="file-text"></i> Crear Venta';
    if (window.lucide) lucide.createIcons();
  }
}

function vpVerNota(idPedido) {
  if (typeof navegarA === 'function') navegarA('ventas', { pedido: idPedido });
}

function vpCerrarModal(id) {
  document.getElementById(id).style.display = 'none';
}

function vpExportarCSV() {
  const cols = ['Orden', 'Cliente', 'DNI', 'Monto', 'Total Orden', 'Código Op.', 'Método', 'Estado', 'Fecha', 'Nota Venta'];
  const filas = vpPagosFiltrados.map(p => [
    `ORD-${p.orden_codigo}`, p.cliente_nombre, p.cliente_dni,
    p.monto, p.total_orden, p.codigo_operacion,
    p.metodo_pago, p.estado,
    p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-PE') : '',
    p.nota_venta_numero || ''
  ]);
  const csv = [cols, ...filas].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `verificacion_pagos_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['vpModalDetalle', 'vpModalImagen', 'vpModalRechazar', 'vpModalGenerarVenta'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') vpCerrarModal(id);
    });
  }
});

function cargar_verificacion_pagos() {
    vpCargarDatos();
    ['vpModalDetalle', 'vpModalImagen', 'vpModalRechazar', 'vpModalGenerarVenta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', function(e) {
            if (e.target === this) vpCerrarModal(id);
        });
    });
}
 