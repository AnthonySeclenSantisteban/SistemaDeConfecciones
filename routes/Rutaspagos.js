const express = require('express');
const router = express.Router();
const pool = require('../config/bd');
 
function verificarSesion(req, res, next) {
    if (!req.session || !req.session.usuario) return res.status(401).json({ error: 'No autorizado' });
    next();
}
 
router.get('/admin/pagos/verificacion', verificarSesion, async (req, res) => {
    try {
        const pagos = await pool.query(`
            SELECT
                p.id_pago,
                p.id_pedido,
                ped.codigo_seguimiento AS orden_codigo,
                CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
                c.dni AS cliente_dni,
                c.telefono AS cliente_telefono,
                c.correo AS cliente_email,
                p.monto,
                ped.total AS total_orden,
                cp.numero_operacion AS codigo_operacion,
                p.metodo_pago,
                p.estado,
                p.fecha_pago,
                ABS(p.monto - ped.total) < 0.01 AS monto_coincide,
                v.numero_venta AS nota_venta_numero
            FROM pagos p
            JOIN pedidos ped ON ped.id_pedido = p.id_pedido
            JOIN clientes c ON c.id_cliente = ped.id_cliente
            LEFT JOIN ventas v ON v.id_pedido = p.id_pedido
            LEFT JOIN comprobantes_pago cp ON cp.id_pago = p.id_pago
            ORDER BY
                CASE p.estado WHEN 'pendiente' THEN 0 ELSE 1 END,
                p.fecha_pago DESC
        `);
 
       const stats = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendientes,
                COUNT(*) FILTER (WHERE estado = 'pagado')     AS verificados,
                COUNT(*) FILTER (WHERE estado = 'rechazado')  AS rechazados,
                COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'), 0) AS monto_pendiente
            FROM pagos `
        );
 
        res.json({ ok: true, data: pagos.rows, stats: stats.rows[0] });
    } catch (e) {
        console.error('GET /admin/pagos/verificacion:', e);
        res.status(500).json({ error: 'Error al obtener pagos', detalle: e.message });
    }
});
 
router.get('/admin/pagos/:id', verificarSesion, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT
                p.*,
                ped.codigo_seguimiento AS orden_codigo,
                ped.total AS total_orden,
                CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
                c.dni AS cliente_dni,
                c.telefono AS cliente_telefono,
                c.correo AS cliente_email,
                ABS(p.monto - ped.total) < 0.01 AS monto_coincide,
                cp.numero_operacion AS codigo_operacion,   
                v.numero_venta AS nota_venta_numero
            FROM pagos p
            JOIN pedidos ped ON ped.id_pedido = p.id_pedido
            JOIN clientes c ON c.id_cliente = ped.id_cliente
            LEFT JOIN ventas v ON v.id_pedido = p.id_pedido
            LEFT JOIN comprobantes_pago cp ON cp.id_pago = p.id_pago 
            WHERE p.id_pago = $1
        `, [id]);
 
        if (!result.rows.length) return res.status(404).json({ error: 'Pago no encontrado' });
 
        const items = await pool.query(`
            SELECT
                pr.nombre_producto AS producto,
                dp.cantidad,
                dp.precio_unitario AS precio,
                (dp.cantidad * dp.precio_unitario) AS subtotal
            FROM detalle_pedido dp
            JOIN productos pr ON pr.id_producto = dp.id_producto
            WHERE dp.id_pedido = $1
        `, [result.rows[0].id_pedido]);
 
        res.json({ pago: { ...result.rows[0], items: items.rows } });
    } catch (e) {
        console.error('GET /admin/pagos/:id:', e);
        res.status(500).json({ error: 'Error al obtener detalle', detalle: e.message });
    }
});
 
router.post('/admin/pagos/:id/verificar', verificarSesion, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        // Soporta tanto .id como .id_usuario en la sesión
        const id_usuario = req.session.usuario.id || req.session.usuario.id_usuario;
        await client.query('BEGIN');
 
        const pago = await client.query(
            `UPDATE pagos SET estado = 'pagado', fecha_pago = NOW()
             WHERE id_pago = $1 AND estado = 'pendiente' RETURNING *`,
            [id]
        );
        if (!pago.rows.length) throw new Error('Pago no encontrado o ya procesado');
 
        await client.query(
            `UPDATE pedidos SET estado = 'pagado' WHERE id_pedido = $1`,
            [pago.rows[0].id_pedido]
        );
 
        await client.query('COMMIT');
        res.json({ ok: true, id_pedido: pago.rows[0].id_pedido });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /admin/pagos/:id/verificar:', e);
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});
 
router.post('/admin/pagos/:id/rechazar', verificarSesion, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        if (!motivo) return res.status(400).json({ error: 'Motivo requerido' });
 
        await client.query('BEGIN');
 
        const pago = await client.query(
            `UPDATE pagos SET estado = 'rechazado', fecha_pago = NOW()
            WHERE id_pago = $1 AND estado = 'pendiente' RETURNING *`,
            [id]
        );
        if (!pago.rows.length) throw new Error('Pago no encontrado o ya procesado');
 
        await client.query(
            `UPDATE pedidos SET estado = 'pendiente' WHERE id_pedido = $1`,
            [pago.rows[0].id_pedido]
        );
 
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /admin/pagos/:id/rechazar:', e);
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});
 
router.post('/admin/ventas/generar', verificarSesion, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id_pedido, id_pago, tipo_comprobante } = req.body;
        const id_usuario = req.session.usuario.id || req.session.usuario.id_usuario;
        await client.query('BEGIN');
 
        const existe = await client.query(
            `SELECT id_venta FROM ventas WHERE id_pedido = $1`, [id_pedido]
        );
        if (existe.rows.length) throw new Error('Ya existe una venta para este pedido');
 
        const pedido = await client.query(
            `SELECT ped.*, CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre
             FROM pedidos ped JOIN clientes c ON c.id_cliente = ped.id_cliente
             WHERE ped.id_pedido = $1`, [id_pedido]
        );
        if (!pedido.rows.length) throw new Error('Pedido no encontrado');
 
        const prefijo = tipo_comprobante === 'boleta' ? 'B001' : 'N001';
        const ultimo = await client.query(
            `SELECT numero_venta FROM ventas WHERE numero_venta LIKE $1 ORDER BY id_venta DESC LIMIT 1`,
            [`${prefijo}-%`]
        );
        let secuencia = 1;
        if (ultimo.rows.length) {
            secuencia = parseInt(ultimo.rows[0].numero_venta.split('-')[1]) + 1;
        }
        const numero = `${prefijo}-${String(secuencia).padStart(6, '0')}`;
 
        const venta = await client.query(`
            INSERT INTO ventas (id_pedido, numero_venta, tipo_documento, total, id_usuario, fecha_venta, estado)
            VALUES ($1, $2, $3, (SELECT total FROM pedidos WHERE id_pedido = $1), $4, NOW(), 'pendiente')
            RETURNING *`,
            [id_pedido, numero, tipo_comprobante, id_usuario]
        );
 
        await client.query(
            `UPDATE pedidos SET estado = 'completado' WHERE id_pedido = $1`, [id_pedido]
        );
 
        await client.query('COMMIT');
        res.json({ ok: true, numero, id_venta: venta.rows[0].id_venta });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('POST /admin/ventas/generar:', e);
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});
 
module.exports = router;