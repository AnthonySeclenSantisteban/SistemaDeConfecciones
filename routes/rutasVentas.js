const express = require('express');
const router = express.Router();
const pool = require('../config/bd');
const { generarNumeroVenta } = require('../utils/GenerarNum');



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
    const conds = ['v.id_venta IS NOT NULL'];

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
                u.nombre AS atendio
             FROM ventas v
             LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
             LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
             WHERE ${where}
             ORDER BY v.fecha_venta DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            ok: true,
            data: dataRes.rows,
            total,
            pages: Math.ceil(total / parseInt(limit)),
            page: parseInt(page)
        });
    } catch (error) {
        console.error('GET /api/ventas:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/ventas/stats', requireAuth, async (req, res) => {
    try {
        const ahora = new Date();
        const mesActual = ahora.getMonth() + 1;
        const anioActual = ahora.getFullYear();

        const result = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE TRUE)                                    AS total_ventas,
                COUNT(*) FILTER (WHERE estado = 'pagada')                       AS ventas_pagadas,
                COUNT(*) FILTER (WHERE estado = 'pendiente')                    AS ventas_pendientes,
                COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0)        AS monto_pagadas,
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
            data: {
                ...result.rows[0],
                mes_nombre: meses[mesActual - 1]
            }
        });
    } catch (error) {
        console.error('GET /api/ventas/stats:', error);
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
                pa.metodo_pago, pa.estado AS estado_pago
             FROM ventas v
             LEFT JOIN clientes  c  ON c.id_cliente  = v.id_cliente
             LEFT JOIN usuarios  u  ON u.id_usuario  = v.id_usuario
             LEFT JOIN pedidos   p  ON p.id_pedido   = v.id_pedido
             LEFT JOIN pagos     pa ON pa.id_pedido  = p.id_pedido
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
             LEFT JOIN productos pr ON pr.id_producto = dv.id_producto
             LEFT JOIN variantes_producto vp ON vp.id_variante = dv.id_variante
             LEFT JOIN tallas t ON t.id_talla = vp.id_talla
             WHERE dv.id_venta = $1
             ORDER BY dv.id_detalle_venta`,
            [id]
        );

        res.json({
            ok: true,
            data: {
                venta: ventaRes.rows[0],
                items: itemsRes.rows
            }
        });
    } catch (error) {
        console.error('GET /api/ventas/:id:', error);
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/ventas', requireAuth, async (req, res) => {
    const {
        dni, nombres, apellidos, telefono, correo,
        tipo_documento = 'nota_venta',
        metodo_pago = 'efectivo',
        descuento = 0,
        observaciones = '',
        items = []
    } = req.body;

    if (!nombres || !nombres.trim())
        return res.json({ ok: false, mensaje: 'El nombre del cliente es requerido' });
    if (!telefono || !telefono.trim())
        return res.json({ ok: false, mensaje: 'El teléfono del cliente es requerido' });
    if (!items.length)
        return res.json({ ok: false, mensaje: 'Agrega al menos un producto' });

    const id_usuario = req.session.usuario.id_usuario;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ── 1. Cliente: buscar por DNI o correo
        let id_cliente;

        const buscarCliente = dni
            ? await client.query(
                'SELECT id_cliente FROM clientes WHERE dni = $1 AND estado != 2 LIMIT 1',
                [dni]
              )
            : correo
                ? await client.query(
                    'SELECT id_cliente FROM clientes WHERE correo = $1 AND estado != 2 LIMIT 1',
                    [correo]
                  )
                : { rows: [] };

        if (buscarCliente.rows.length) {
            id_cliente = buscarCliente.rows[0].id_cliente;
            await client.query(
                `UPDATE clientes
                 SET nombres=$1, apellidos=$2, telefono=$3,
                     dni=COALESCE($4, dni), correo=COALESCE($5, correo),
                     updated_at=NOW(), updated_by=$6
                 WHERE id_cliente=$7`,
                [nombres.trim(), apellidos?.trim() || '', telefono.trim(),
                 dni || null, correo || null, id_usuario, id_cliente]
            );
        } else {
            const nuevoCliente = await client.query(
                `INSERT INTO clientes
                 (nombres, apellidos, telefono, correo, dni, estado, created_by)
                 VALUES ($1, $2, $3, $4, $5, 1, $6)
                 RETURNING id_cliente`,
                [nombres.trim(), apellidos?.trim() || '', telefono.trim(),
                 correo || null, dni || null, id_usuario]
            );
            id_cliente = nuevoCliente.rows[0].id_cliente;
        }

        // ── 2. Calcular totales 
        let subtotal = 0;
        for (const item of items) {
            subtotal += parseFloat(item.precio_unitario) * parseInt(item.cantidad);
        }
        subtotal = parseFloat(subtotal.toFixed(2));
        const descuentoNum = parseFloat(parseFloat(descuento).toFixed(2));
        const total = parseFloat((subtotal - descuentoNum).toFixed(2));

        if (total < 0)
            throw new Error('El descuento no puede ser mayor al subtotal');

        // ── 3. Validar stock de cada ítem 
        for (const item of items) {
            if (item.id_variante) {
                const stockRes = await client.query(
                    'SELECT stock FROM variantes_producto WHERE id_variante = $1',
                    [item.id_variante]
                );
                if (!stockRes.rows.length)
                    throw new Error(`Variante ${item.id_variante} no encontrada`);
                if (stockRes.rows[0].stock < parseInt(item.cantidad))
                    throw new Error(`Stock insuficiente para el producto (variante ${item.id_variante}). Disponible: ${stockRes.rows[0].stock}`);
            }
        }

        // ── 4. Crear pedido
        const codigoSeg = `LIX-${Date.now()}`;
        const pedidoRes = await client.query(
            `INSERT INTO pedidos (id_cliente, total, estado, codigo_seguimiento)
             VALUES ($1, $2, 'pendiente', $3)
             RETURNING id_pedido`,
            [id_cliente, total, codigoSeg]
        );
        const id_pedido = pedidoRes.rows[0].id_pedido;

        // ── 5. Detalle del pedido
        for (const item of items) {
            const cant = parseInt(item.cantidad);
            const precioU = parseFloat(item.precio_unitario);
            const subItem = parseFloat((cant * precioU).toFixed(2));

            await client.query(
                `INSERT INTO detalle_pedido
                 (id_pedido, id_producto, id_variante, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [id_pedido, item.id_producto, item.id_variante || null,
                 cant, precioU, subItem]
            );

            if (item.id_variante) {
                await client.query(
                    `UPDATE variantes_producto SET stock = stock - $1 WHERE id_variante = $2`,
                    [cant, item.id_variante]
                );
                await client.query(
                    `INSERT INTO movimiento_stock
                     (id_producto, id_variante, tipo_movimiento, cantidad, motivo)
                     VALUES ($1, $2, 'salida', $3, $4)`,
                    [item.id_producto, item.id_variante, cant,
                     `Venta manual desde dashboard`]
                );
            }
        }

        // ── 6. Pago
        await client.query(
            `INSERT INTO pagos (id_pedido, metodo_pago, monto, estado)
             VALUES ($1, $2, $3, 'pendiente')`,
            [id_pedido, metodo_pago, total]
        );

        // ── 7. Venta
        const numeroVenta = await generarNumeroVenta(tipo_documento);

        const ventaRes = await client.query(
            `INSERT INTO ventas
             (numero_venta, id_pedido, id_cliente, id_usuario,
              tipo_documento, subtotal, descuento, total, estado, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9)
             RETURNING id_venta`,
            [numeroVenta, id_pedido, id_cliente, id_usuario,
             tipo_documento, subtotal, descuentoNum, total,
             observaciones.trim() || null]
        );
        const id_venta = ventaRes.rows[0].id_venta;

        //  8. Detalle de venta 
        for (const item of items) {
            const cant = parseInt(item.cantidad);
            const precioU = parseFloat(item.precio_unitario);
            const subItem = parseFloat((cant * precioU).toFixed(2));

            await client.query(
                `INSERT INTO detalle_venta
                 (id_venta, id_producto, id_variante, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [id_venta, item.id_producto, item.id_variante || null,
                 cant, precioU, subItem]
            );
        }

        await client.query('COMMIT');

        res.json({
            ok: true,
            mensaje: 'Venta registrada correctamente',
            data: { id_venta, numero_venta: numeroVenta, total }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('POST /api/ventas:', error);
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

router.patch('/api/ventas/:id/estado', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // 'pagada' | 'pendiente'

    const estadosValidos = ['pagada', 'pendiente'];
    if (!estadosValidos.includes(estado))
        return res.json({ ok: false, mensaje: 'Estado no válido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ventaRes = await client.query(
            'SELECT estado, id_pedido FROM ventas WHERE id_venta = $1',
            [id]
        );
        if (!ventaRes.rows.length) {
            await client.query('ROLLBACK');
            return res.json({ ok: false, mensaje: 'Venta no encontrada' });
        }

        const estadoActual = ventaRes.rows[0].estado;
        if (estadoActual === 'anulada')
            throw new Error('No se puede cambiar el estado de una venta anulada');

        await client.query(
            'UPDATE ventas SET estado = $1 WHERE id_venta = $2',
            [estado, id]
        );
        if (estado === 'pagada') {
            await client.query(
                `UPDATE pagos SET estado = 'pagado'
                 WHERE id_pedido = $1`,
                [ventaRes.rows[0].id_pedido]
            );
        } else if (estado === 'pendiente') {
            await client.query(
                `UPDATE pagos SET estado = 'pendiente'
                 WHERE id_pedido = $1`,
                [ventaRes.rows[0].id_pedido]
            );
        }

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: `Venta marcada como ${estado}` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('PATCH /api/ventas/:id/estado:', error);
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

router.delete('/api/ventas/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
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
        if (!ventaRes.rows.length) {
            await client.query('ROLLBACK');
            return res.json({ ok: false, mensaje: 'Venta no encontrada' });
        }

        const venta = ventaRes.rows[0];
        if (venta.estado === 'anulada')
            throw new Error('Esta venta ya está anulada');

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
                            'id_variante', vp.id_variante,
                            'talla', t.nombre_talla,
                            'color', vp.color,
                            'stock', vp.stock,
                            'precio_extra', vp.precio_extra
                        ) ORDER BY t.nombre_talla, vp.color
                    ) FILTER (WHERE vp.id_variante IS NOT NULL),
                    '[]'
                ) AS variantes
             FROM productos p
             LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
             LEFT JOIN variantes_producto vp ON vp.id_producto = p.id_producto
             LEFT JOIN tallas t ON t.id_talla = vp.id_talla
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
                nombre: `${c.nombres} ${c.apellidos || ''}`.trim(),
                nombres: c.nombres,
                apellidos: c.apellidos || '',
                fuente: 'local'
            });
        }
     
    const respuesta = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
        headers: {
            Authorization: `Bearer ${process.env.API_RENIEC}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await respuesta.json();
    console.log('RENIEC response:', data);

    if (!respuesta.ok) {
        return res.json({ ok: false, mensaje: 'DNI no encontrado' });
    }

    return res.json({
        ok: true,
        nombre: `${data.first_name} ${data.first_last_name} ${data.second_last_name}`.trim(),
        nombres: data.first_name,
        apellidos: `${data.first_last_name} ${data.second_last_name}`.trim(),
        fuente: 'reniec'
    });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

module.exports = router;