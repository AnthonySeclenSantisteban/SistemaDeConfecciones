let _productosCompras = [];
let _variantesCompras = [];

async function cargarCompras() {
    const loading = document.getElementById('compras-loading');
    const tabla = document.getElementById('compras-tabla');
    const empty = document.getElementById('compras-empty');
    const total = document.getElementById('total-compras');
    const tbody = document.getElementById('compras-tbody');

    loading.style.display = 'flex';
    tabla.style.display = 'none';
    empty.style.display = 'none';

    try {
        const res = await fetch('/api/compras');
        const json = await res.json();

        loading.style.display = 'none';

        if (!json.ok || !json.data || !json.data.length) {
            empty.style.display = 'flex';
            total.textContent = '';
            return;
        }

        tabla.style.display = 'block';
        total.textContent = `${json.data.length} registros`;

        tbody.innerHTML = json.data.map((c, i) => `
            <tr>
                <td style="font-family:var(--mono);font-size:12px;">${i + 1}</td>
                <td><strong>${_esc(c.nombre_insumo)}</strong></td>
                <td>${c.cantidad}</td>
                <td>${_esc(c.unidad_medida)}</td>
                <td style="font-family:var(--mono);">S/ ${parseFloat(c.costo).toFixed(2)}</td>
                <td>${_esc(c.lugar_compra || '—')}</td>
                <td style="font-size:12px;color:var(--muted);font-family:var(--mono);">${_fmtFecha(c.fecha_compra)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error cargando compras:', error);
        loading.style.display = 'none';
        empty.style.display = 'flex';
    }
}

async function cargarProductosCompras() {
    const select = document.getElementById('compra-producto');
    select.innerHTML = '<option value="">Seleccione producto</option>';

    try {
        const res = await fetch('/api/productos');
        const json = await res.json();

        console.log('PRODUCTOS COMPRAS =>', json);

        if (!json.ok || !json.data || !json.data.length) {
            select.innerHTML = '<option value="">No hay productos</option>';
            return;
        }

        _productosCompras = json.data.filter(p => Number(p.estado) === 1);

        if (!_productosCompras.length) {
            select.innerHTML = '<option value="">No hay productos activos</option>';
            return;
        }

        _productosCompras.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_producto;
            opt.textContent = p.nombre_producto;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando productos:', error);
        select.innerHTML = '<option value="">Error al cargar productos</option>';
    }
}

async function cargarVariantesCompra(idProducto) {
    const select = document.getElementById('compra-variante');
    select.innerHTML = '<option value="">Seleccione variante</option>';

    if (!idProducto) return;

    try {
        const res = await fetch(`/api/productos/${idProducto}/variantes`);
        const json = await res.json();

        console.log('VARIANTES COMPRA =>', json);

        if (!json.ok || !json.data) {
            select.innerHTML = '<option value="">No hay variantes</option>';
            return;
        }

        _variantesCompras = json.data;

        if (!_variantesCompras.length) {
            select.innerHTML = '<option value="">Sin variantes</option>';
            return;
        }

        json.data.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id_variante;
            opt.textContent = `${v.nombre_talla || '—'} / ${v.color || '—'} / Stock: ${v.stock}`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error cargando variantes:', error);
        select.innerHTML = '<option value="">Error al cargar variantes</option>';
    }
}

function abrirNuevaCompra() {
    document.getElementById('compra-producto').innerHTML = '<option value="">Seleccione producto</option>';
    document.getElementById('compra-variante').innerHTML = '<option value="">Seleccione variante</option>';
    document.getElementById('compra-cantidad').value = 1;
    document.getElementById('compra-costo').value = '';
    document.getElementById('compra-unidad').value = 'unidad';
    document.getElementById('compra-lugar').value = '';
    document.getElementById('modal-compra').style.display = 'flex';
    cargarProductosCompras();
}

function cerrarModalCompra() {
    document.getElementById('modal-compra').style.display = 'none';
}

async function guardarCompra() {
    const id_producto = document.getElementById('compra-producto').value;
    const id_variante = document.getElementById('compra-variante').value;
    const cantidad = document.getElementById('compra-cantidad').value;
    const costo = document.getElementById('compra-costo').value;
    const unidad_medida = document.getElementById('compra-unidad').value.trim();
    const lugar_compra = document.getElementById('compra-lugar').value.trim();

    if (!id_producto || !id_variante || !cantidad || !costo) {
        alert('Completa todos los campos requeridos');
        return;
    }

    try {
        const res = await fetch('/api/compras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_producto: parseInt(id_producto),
                id_variante: parseInt(id_variante),
                cantidad: parseInt(cantidad),
                costo: parseFloat(costo),
                unidad_medida,
                lugar_compra
            })
        });

        const json = await res.json();

        if (json.ok) {
            cerrarModalCompra();
            cargarCompras();
            alert(json.mensaje || 'Compra registrada correctamente');
        } else {
            alert(json.mensaje || 'No se pudo registrar la compra');
        }
    } catch (error) {
        console.error('Error guardando compra:', error);
        alert('Error de conexión');
    }
}

function _fmtFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('click', function (e) {
    const id = e.target.closest('button')?.id || e.target.id;

    if (id === 'btn-nueva-compra') abrirNuevaCompra();
    if (id === 'btn-cerrar-modal-compra' || id === 'btn-cancelar-compra') cerrarModalCompra();
    if (id === 'btn-guardar-compra') guardarCompra();
});

document.addEventListener('change', function (e) {
    if (e.target.id === 'compra-producto') {
        cargarVariantesCompra(e.target.value);
    }
});

function cargar_compras() {
    cargarCompras();
}