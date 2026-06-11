const express = require('express');
const router = express.Router();
const pool = require('../config/bd');
const { generarNumeroVenta } = require('../utils/GenerarNum');
const multer = require('multer');
const path   = require('path');
const { enviarConfirmacionPedido } = require('../utils/remitente');


const uploadComprobante = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'public/uploads/comprobantes/'),
        filename:    (req, file, cb) => cb(null, `comp-${Date.now()}${path.extname(file.originalname)}`)
    }),
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

function requireAuth(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
    }
    next();
}

router.get('/api/ventas', requireAuth, async (req, res) => {
    const {
        dni, numero_venta, estado, tipo_documento,
        fecha_desde, fecha_hasta,
        page = 1, limit = 15
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conds  = ['v.id_venta IS NOT NULL'];

    if (dni) {
        params.push(`%${dni}%`);
        conds.push(`c.dni ILIKE $${params.length}`);
    }
    if (numero_venta) {
        params.push(`%${numero_venta}%`);
        conds.push(`v.numero_venta ILIKE $${params.length}`);
    }
    if (estado) {
        params.push(estado);
        conds.push(`v.estado = $${params.length}`);
    }
    if (tipo_documento) {
        params.push(tipo_documento);
        conds.push(`v.tipo_documento = $${params.length}`);
    }
    if (fecha_desde) {
        params.push(fecha_desde);
        conds.push(`v.fecha_venta::date >= $${params.length}::date`);
    }
    if (fecha_hasta) {
        params.push(fecha_hasta);
        conds.push(`v.fecha_venta::date <= $${params.length}::date`);
    }

    const where = conds.join(' AND ');

    try {
        const countRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM ventas v
             LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
             WHERE ${where}`,
            params
        );
        const total = parseInt(countRes.rows[0].total);

        params.push(parseInt(limit));
        params.push(offset);

        const dataRes = await pool.query(
            `SELECT
                v.id_venta, v.numero_venta, v.tipo_documento,
                v.subtotal, v.descuento, v.total,
                v.estado, v.fecha_venta, v.observaciones,
                c.id_cliente, c.nombres, c.apellidos, c.dni, c.telefono,
                u.nombre AS atendio,
                (SELECT STRING_AGG(pa.metodo_pago, ' + ' ORDER BY pa.id_pago) 
                FROM pagos pa WHERE pa.id_pedido = p.id_pedido) AS metodo_pago,
                (SELECT CASE WHEN COUNT(*) FILTER (WHERE pa.estado='pendiente') > 0 
                        THEN 'pendiente' ELSE 'pagado' END
                FROM pagos pa WHERE pa.id_pedido = p.id_pedido) AS estado_pago,
                (SELECT COALESCE(SUM(pa.monto) FILTER (WHERE pa.estado='pendiente'), 0)
                FROM pagos pa WHERE pa.id_pedido = p.id_pedido) AS monto_pendiente
            FROM ventas v
            LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
            LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
            LEFT JOIN pedidos  p ON p.id_pedido  = v.id_pedido
            WHERE ${where}
            ORDER BY v.fecha_venta DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            ok: true,
            data:  dataRes.rows,
            total,
            pages: Math.ceil(total / parseInt(limit)),
            page:  parseInt(page)
        });
    } catch (error) {
        console.error('GET /api/ventas:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/ventas/stats', requireAuth, async (req, res) => {
    try {
        const ahora      = new Date();
        const mesActual  = ahora.getMonth() + 1;
        const anioActual = ahora.getFullYear();

        const result = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE TRUE)                             AS total_ventas,
                COUNT(*) FILTER (WHERE estado = 'pagada')               AS ventas_pagadas,
                COUNT(*) FILTER (WHERE estado = 'pendiente')            AS ventas_pendientes,
                COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0) AS monto_pagadas,
                COALESCE(SUM(total) FILTER (
                    WHERE estado = 'pagada'
                    AND EXTRACT(MONTH FROM fecha_venta) = $1
                    AND EXTRACT(YEAR  FROM fecha_venta) = $2
                ), 0) AS ingresos_mes
             FROM ventas`,
            [mesActual, anioActual]
        );

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        res.json({
            ok: true,
            data: { ...result.rows[0], mes_nombre: meses[mesActual - 1] }
        });
    } catch (error) {
        console.error('GET /api/ventas/stats:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/ventas/productos/buscar', requireAuth, async (req, res) => {
    const { q = '' } = req.query;
    if (q.trim().length < 2)
        return res.json({ ok: true, data: [] });

    try {
        const result = await pool.query(
            `SELECT
                p.id_producto, p.nombre_producto, p.precio_venta,
                co.nombre_colegio,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id_variante',  vp.id_variante,
                            'talla',        t.nombre_talla,
                            'color',        vp.color,
                            'stock',        vp.stock,
                            'precio_extra', vp.precio_extra
                        ) ORDER BY t.nombre_talla, vp.color
                    ) FILTER (WHERE vp.id_variante IS NOT NULL),
                    '[]'
                ) AS variantes
             FROM productos p
             LEFT JOIN colegios            co ON co.id_colegio = p.id_colegio
             LEFT JOIN variantes_producto  vp ON vp.id_producto = p.id_producto
             LEFT JOIN tallas              t  ON t.id_talla     = vp.id_talla
             WHERE p.estado = 1
               AND (p.nombre_producto ILIKE $1 OR co.nombre_colegio ILIKE $1)
             GROUP BY p.id_producto, p.nombre_producto, p.precio_venta, co.nombre_colegio
             ORDER BY p.nombre_producto
             LIMIT 12`,
            [`%${q.trim()}%`]
        );

        res.json({ ok: true, data: result.rows });
    } catch (error) {
        console.error('GET /api/ventas/productos/buscar:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/ventas/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const ventaRes = await pool.query(
            `SELECT
                v.id_venta, v.numero_venta, v.tipo_documento,
                v.subtotal, v.descuento, v.total,
                v.estado, v.fecha_venta, v.observaciones,
                c.id_cliente, c.nombres, c.apellidos, c.dni, c.telefono, c.correo,
                u.nombre AS atendio,
                (SELECT STRING_AGG(pa.metodo_pago, ' + ' ORDER BY pa.id_pago) 
                 FROM pagos pa WHERE pa.id_pedido = p.id_pedido) AS metodo_pago,
                (SELECT CASE WHEN COUNT(*) FILTER (WHERE pa.estado='pendiente') > 0 
                        THEN 'pendiente' ELSE 'pagado' END
                 FROM pagos pa WHERE pa.id_pedido = p.id_pedido) AS estado_pago,
                (SELECT COALESCE(SUM(pa.monto) FILTER (WHERE pa.estado='pendiente'), 0)
                 FROM pagos pa WHERE pa.id_pedido = p.id_pedido) AS monto_pendiente
             FROM ventas v
             LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
             LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
             LEFT JOIN pedidos  p ON p.id_pedido  = v.id_pedido
             WHERE v.id_venta = $1`,
            [id]
        );

        if (!ventaRes.rows.length)
            return res.json({ ok: false, mensaje: 'Venta no encontrada' });

        const itemsRes = await pool.query(
            `SELECT
                dv.id_detalle_venta,
                dv.cantidad, dv.precio_unitario, dv.subtotal,
                pr.nombre_producto,
                vp.color, t.nombre_talla
             FROM detalle_venta dv
             LEFT JOIN productos          pr ON pr.id_producto = dv.id_producto
             LEFT JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
             LEFT JOIN tallas             t  ON t.id_talla     = vp.id_talla
             WHERE dv.id_venta = $1
             ORDER BY dv.id_detalle_venta`,
            [id]
        );

        res.json({
            ok: true,
            data: { venta: ventaRes.rows[0], items: itemsRes.rows }
        });
    } catch (error) {
        console.error('GET /api/ventas/:id:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/ventas/:id/pagos', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        // Obtener el id_pedido asociado a la venta
        const ventaRes = await pool.query(
            'SELECT id_pedido FROM ventas WHERE id_venta = $1',
            [id]
        );

        if (!ventaRes.rows.length)
            return res.json({ ok: false, mensaje: 'Venta no encontrada' });

        const { id_pedido } = ventaRes.rows[0];

        const pagosRes = await pool.query(
            `SELECT
                pa.id_pago,
                pa.metodo_pago,
                pa.monto,
                pa.estado,
                pa.numero_operacion,
                pa.fecha_pago
             FROM pagos pa
             WHERE pa.id_pedido = $1
             ORDER BY pa.fecha_pago ASC`,
            [id_pedido]
        );

        res.json({ ok: true, data: pagosRes.rows });
    } catch (error) {
        console.error('GET /api/ventas/:id/pagos:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});


router.post('/api/ventas', requireAuth, uploadComprobante.array('capturas', 5), async (req, res) => {
    const body = req.body;
    const {
        dni, nombres, apellidos, telefono, correo,
        tipo_documento = 'nota_venta',
        descuento      = 0,
        observaciones  = '',
    } = body;

    // pagos: JSON string con array [{metodo_pago, monto, numero_operacion}]
    let pagos = [];
    try { pagos = JSON.parse(body.pagos || '[]'); } catch { pagos = []; }

    let items = [];
    try { items = JSON.parse(body.items || '[]'); } catch { items = []; }

    if (!nombres?.trim())  return res.json({ ok: false, mensaje: 'El nombre es requerido' });
    if (!telefono?.trim()) return res.json({ ok: false, mensaje: 'El teléfono es requerido' });
    if (!items.length)     return res.json({ ok: false, mensaje: 'Agrega al menos un producto' });
    if (!pagos.length)     return res.json({ ok: false, mensaje: 'Agrega al menos un método de pago' });
    for (const pago of pagos) {
        if (pago.numero_operacion && pago.numero_operacion.trim()) {
            const existe = await pool.query(
                `SELECT id_pago FROM pagos WHERE numero_operacion = $1 LIMIT 1`,
                [pago.numero_operacion.trim()]
            );
            if (existe.rows.length) {
                return res.json({ ok: false, mensaje: `El N° de operación ${pago.numero_operacion} ya fue registrado en otra venta` });
            }
        }
    }

    const id_usuario = req.session.usuario.id;
    const client     = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Cliente
        let id_cliente;
        const busq = await client.query(
            `SELECT id_cliente FROM clientes 
            WHERE estado != 2 AND (
                ($1::varchar IS NOT NULL AND dni = $1::varchar)
                OR (LOWER(telefono) = LOWER($2::varchar))
                OR ($3::varchar IS NOT NULL AND LOWER(correo) = LOWER($3::varchar))
            ) LIMIT 1`,
            [dni || null, telefono, correo || null]
        );

        if (busq.rows.length) {
            id_cliente = busq.rows[0].id_cliente;
            await client.query(
                `UPDATE clientes SET nombres=$1,apellidos=$2,telefono=$3,
                 dni=COALESCE($4,dni),correo=COALESCE($5,correo),
                 updated_at=NOW(),updated_by=$6 WHERE id_cliente=$7`,
                [nombres.trim(), apellidos?.trim()||'', telefono.trim(),
                 dni||null, correo||null, id_usuario, id_cliente]
            );
        } else {
            const r = await client.query(
                `INSERT INTO clientes (nombres,apellidos,telefono,correo,dni,estado,created_by)
                 VALUES ($1,$2,$3,$4,$5,1,$6) RETURNING id_cliente`,
                [nombres.trim(), apellidos?.trim()||'', telefono.trim(),
                 correo||null, dni||null, id_usuario]
            );
            id_cliente = r.rows[0].id_cliente;
        }

        // 2. Totales
        let subtotal = 0;
        for (const i of items) subtotal += parseFloat(i.precio_unitario) * parseInt(i.cantidad);
        subtotal = parseFloat(subtotal.toFixed(2));
        const desc  = parseFloat(parseFloat(descuento).toFixed(2));
        const total = parseFloat((subtotal - desc).toFixed(2));
        if (total < 0) throw new Error('Descuento mayor al subtotal');

        // Validar que suma de pagos = total
        const sumaPagos = pagos.reduce((s, p) => s + parseFloat(p.monto), 0);
        if (Math.abs(sumaPagos - total) > 0.01)
            throw new Error(`La suma de pagos (S/ ${sumaPagos.toFixed(2)}) no coincide con el total (S/ ${total.toFixed(2)})`);

        // 3. Stock
        for (const item of items) {
            if (item.id_variante) {
                const s = await client.query('SELECT stock FROM variantes_producto WHERE id_variante=$1', [item.id_variante]);
                if (!s.rows.length) throw new Error(`Variante ${item.id_variante} no encontrada`);
                if (s.rows[0].stock < parseInt(item.cantidad))
                    throw new Error(`Stock insuficiente. Disponible: ${s.rows[0].stock}`);
            }
        }

        // 4. Pedido
        const codigoSeg = `LIX-${Date.now()}`;
        const pedRes    = await client.query(
            `INSERT INTO pedidos (id_cliente,total,estado,codigo_seguimiento) VALUES ($1,$2,'pendiente',$3) RETURNING id_pedido`,
            [id_cliente, total, codigoSeg]
        );
        const id_pedido = pedRes.rows[0].id_pedido;

        // 5. Detalle pedido + stock
        for (const item of items) {
            const cant = parseInt(item.cantidad), pu = parseFloat(item.precio_unitario);
            await client.query(
                `INSERT INTO detalle_pedido (id_pedido,id_producto,id_variante,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
                [id_pedido, item.id_producto, item.id_variante||null, cant, pu, parseFloat((cant*pu).toFixed(2))]
            );
            if (item.id_variante) {
                await client.query('UPDATE variantes_producto SET stock=stock-$1 WHERE id_variante=$2', [cant, item.id_variante]);
                await client.query(
                    `INSERT INTO movimiento_stock (id_producto,id_variante,tipo_movimiento,cantidad,motivo) VALUES ($1,$2,'salida',$3,$4)`,
                    [item.id_producto, item.id_variante, cant, 'Venta manual dashboard']
                );
            }
        }

        // 6. Pagos múltiples
        const metodoPrincipal = pagos[0].metodo_pago;
        const archivos = req.files || [];
        for (let idx = 0; idx < pagos.length; idx++) {
            const pago    = pagos[idx];
            const archivo = archivos[idx];
            const urlCaptura = archivo ? `/uploads/comprobantes/${archivo.filename}` : null;

            await client.query(
                `INSERT INTO pagos (id_pedido,metodo_pago,monto,estado,numero_operacion,evidencia)
                 VALUES ($1,$2,$3,'pendiente',$4,$5)`,
                [id_pedido, pago.metodo_pago, parseFloat(pago.monto),
                 pago.numero_operacion||null, urlCaptura]
            );
        }

        // 7. Venta
        const numeroVenta = await generarNumeroVenta(tipo_documento);
        const ventaRes    = await client.query(
            `INSERT INTO ventas (numero_venta,id_pedido,id_cliente,id_usuario,tipo_documento,subtotal,descuento,total,estado,observaciones)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente',$9) RETURNING id_venta`,
            [numeroVenta, id_pedido, id_cliente, id_usuario, tipo_documento, subtotal, desc, total, observaciones.trim()||null]
        );
        const id_venta = ventaRes.rows[0].id_venta;

        // 8. Detalle venta
        for (const item of items) {
            const cant = parseInt(item.cantidad), pu = parseFloat(item.precio_unitario);
            await client.query(
                `INSERT INTO detalle_venta (id_venta,id_producto,id_variante,cantidad,precio_unitario,subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
                [id_venta, item.id_producto, item.id_variante||null, cant, pu, parseFloat((cant*pu).toFixed(2))]
            );
        }
        
        for (const pago of pagos) {
                if (pago.metodo_pago === 'efectivo') {
                    await client.query(
                        `UPDATE pagos SET estado='pagado' WHERE id_pedido=$1 AND metodo_pago='efectivo'`,
                        [id_pedido]
                    );
                }
            }
            const todoEfectivo = pagos.every(p => p.metodo_pago === 'efectivo');
            if (todoEfectivo) {
                await client.query('UPDATE ventas SET estado=$1 WHERE id_venta=$2', ['pagada', id_venta]);
            }
            await client.query('COMMIT');

        // 9. Correo (no bloquea la respuesta)
        if (correo) {
            const metodosLabel = pagos.map(p => `${p.metodo_pago} S/${parseFloat(p.monto).toFixed(2)}`).join(' + ');
            enviarConfirmacionPedido({
                correo, nombre: `${nombres} ${apellidos||''}`.trim(),
                numeroVenta, tipoDoc: tipo_documento, total, esEfectivo: todoEfectivo,
                items: items.map(i => ({
                    nombre: i.nombre || i.id_producto,
                    cantidad: i.cantidad,
                    precio_unitario: i.precio_unitario,
                    subtotal: i.cantidad * i.precio_unitario
                })),
                metodoPago: metodosLabel
            }).catch(e => console.error('Error enviando correo:', e));
        }

        res.json({
            ok: true,
            mensaje: 'Venta registrada correctamente',
            data: { id_venta, numero_venta: numeroVenta, total, codigo_seguimiento: codigoSeg }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

router.patch('/api/ventas/:id/estado', requireAuth, async (req, res) => {
    const { id }     = req.params;
    const { estado } = req.body;

    if (!['pagada', 'pendiente'].includes(estado))
        return res.json({ ok: false, mensaje: 'Estado no válido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ventaRes = await client.query(
            'SELECT estado, id_pedido FROM ventas WHERE id_venta = $1',
            [id]
        );
        if (!ventaRes.rows.length)
            throw new Error('Venta no encontrada');  // ← throw en vez de return

        if (ventaRes.rows[0].estado === 'anulada')
            throw new Error('No se puede cambiar el estado de una venta anulada');

        const { id_pedido } = ventaRes.rows[0];
        const estadoPago    = estado === 'pagada' ? 'pagado' : 'pendiente';

        await client.query('UPDATE ventas SET estado=$1 WHERE id_venta=$2', [estado, id]);
        await client.query('UPDATE pagos  SET estado=$1 WHERE id_pedido=$2', [estadoPago, id_pedido]);

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: `Venta marcada como ${estado}` });

    } catch (error) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

router.delete('/api/ventas/:id', requireAuth, async (req, res) => {
    const { id }     = req.params;
    const { motivo } = req.body;

    if (!motivo || !motivo.trim())
        return res.json({ ok: false, mensaje: 'El motivo de anulación es requerido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ventaRes = await client.query(
            'SELECT id_venta, estado, id_pedido FROM ventas WHERE id_venta = $1',
            [id]
        );
         if (!ventaRes.rows.length)
            throw new Error('Venta no encontrada');

        const venta = ventaRes.rows[0];
        if (venta.estado === 'anulada')
            throw new Error('Esta venta ya está anulada');

        // Restaurar stock de variantes
        const itemsRes = await client.query(
            `SELECT id_producto, id_variante, cantidad
             FROM detalle_venta
             WHERE id_venta = $1 AND id_variante IS NOT NULL`,
            [id]
        );

        for (const item of itemsRes.rows) {
            await client.query(
                `UPDATE variantes_producto SET stock = stock + $1 WHERE id_variante = $2`,
                [item.cantidad, item.id_variante]
            );
            await client.query(
                `INSERT INTO movimiento_stock
                 (id_producto, id_variante, tipo_movimiento, cantidad, motivo)
                 VALUES ($1, $2, 'entrada', $3, $4)`,
                [item.id_producto, item.id_variante, item.cantidad,
                 `Anulación venta #${id}: ${motivo.trim()}`]
            );
        }

        await client.query(
            `UPDATE ventas
             SET estado = 'anulada',
                 observaciones = CONCAT(COALESCE(observaciones,''), ' | ANULADA: ', $1)
             WHERE id_venta = $2`,
            [motivo.trim(), id]
        );
        await client.query(
            `UPDATE pedidos SET estado = 'cancelado' WHERE id_pedido = $1`,
            [venta.id_pedido]
        );

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Venta anulada y stock restaurado' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DELETE /api/ventas/:id:', error);
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});


router.get('/api/reniec/:dni', requireAuth, async (req, res) => {
    const { dni } = req.params;
    if (!/^\d{8}$/.test(dni))
        return res.json({ ok: false, mensaje: 'DNI debe tener 8 dígitos' });

    try {
        // Primero buscar en BD local
        const local = await pool.query(
            `SELECT nombres, apellidos FROM clientes
             WHERE dni = $1 AND estado != 2 LIMIT 1`,
            [dni]
        );

        if (local.rows.length) {
            const c = local.rows[0];
            return res.json({
                ok: true,
                nombre:    `${c.nombres} ${c.apellidos || ''}`.trim(),
                nombres:   c.nombres,
                apellidos: c.apellidos || '',
                fuente:    'local'
            });
        }

        // Si no está en BD, consultar API externa
        const respuesta = await fetch(
            `https://api.decolecta.com/v1/reniec/dni?numero=${dni}`,
            {
                headers: {
                    Authorization:  `Bearer ${process.env.API_RENIEC}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await respuesta.json();
        console.log('RENIEC response:', data);

        if (!respuesta.ok)
            return res.json({ ok: false, mensaje: 'DNI no encontrado' });

        return res.json({
            ok: true,
            nombre:    `${data.first_name} ${data.first_last_name} ${data.second_last_name}`.trim(),
            nombres:   data.first_name,
            apellidos: `${data.first_last_name} ${data.second_last_name}`.trim(),
            fuente:    'reniec'
        });

    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/ventas/:id/enviar-correo', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { correo } = req.body;
    if (!correo) return res.json({ ok: false, mensaje: 'Correo requerido' });

    try {
        const ventaRes = await pool.query(
            `SELECT v.numero_venta, v.tipo_documento, v.total,
                    c.nombres, c.apellidos,
                    pa.metodo_pago
             FROM ventas v
             LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
             LEFT JOIN pedidos p ON p.id_pedido = v.id_pedido
             LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
             WHERE v.id_venta = $1 LIMIT 1`, [id]
        );
        if (!ventaRes.rows.length) return res.json({ ok: false, mensaje: 'Venta no encontrada' });

        const itemsRes = await pool.query(
            `SELECT pr.nombre_producto AS nombre, dv.cantidad,
                    dv.precio_unitario, dv.subtotal
             FROM detalle_venta dv
             JOIN productos pr ON pr.id_producto = dv.id_producto
             WHERE dv.id_venta = $1`, [id]
        );

        const v = ventaRes.rows[0];
        await enviarConfirmacionPedido({
            correo,
            nombre: `${v.nombres} ${v.apellidos||''}`.trim(),
            numeroVenta: v.numero_venta,
            tipoDoc: v.tipo_documento,
            total: v.total,
            items: itemsRes.rows,
            metodoPago: v.metodo_pago || 'efectivo'
        });

        res.json({ ok: true, mensaje: 'Correo enviado' });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

module.exports = router;