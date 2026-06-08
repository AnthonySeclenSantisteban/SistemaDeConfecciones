const express = require('express');
const router = express.Router();
const pool = require('../config/bd');

function requireAuth(req, res, next) {
    if (!req.session || !req.session.usuario)
        return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
    next();
}

router.get('/api/pedidos', requireAuth, async (req, res) => {
    const { codigo, estado, fecha_desde, fecha_hasta, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conds  = ['p.id_pedido IS NOT NULL'];

    if (codigo) { params.push(`%${codigo}%`); conds.push(`p.codigo_seguimiento ILIKE $${params.length}`); }
    if (estado) { params.push(estado); conds.push(`p.estado = $${params.length}`); }
    if (fecha_desde) { params.push(fecha_desde); conds.push(`p.fecha_pedido::date >= $${params.length}::date`); }
    if (fecha_hasta) { params.push(fecha_hasta); conds.push(`p.fecha_pedido::date <= $${params.length}::date`); }

    const where = conds.join(' AND ');
    try {
        const countRes = await pool.query(
            `SELECT COUNT(*) AS total FROM pedidos p WHERE ${where}`, params
        );
        const total = parseInt(countRes.rows[0].total);
        params.push(parseInt(limit));
        params.push(offset);

        const data = await pool.query(`
            SELECT
                p.id_pedido,
                p.codigo_seguimiento,
                p.total,
                p.estado,
                p.fecha_pedido,
                c.nombres, c.apellidos, c.telefono, c.dni,
                pa.metodo_pago,
                pa.estado AS estado_pago,
                e.tipo_entrega,
                e.estado_entrega
            FROM pedidos p
            LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
            LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
            LEFT JOIN envios e ON e.id_pedido = p.id_pedido
            WHERE ${where}
            ORDER BY p.fecha_pedido DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({ ok: true, data: data.rows, total,
            pages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
    } catch (e) {
        console.error('GET /api/pedidos:', e);
        res.json({ ok: false, mensaje: e.message });
    }
});

router.get('/api/pedidos/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const pedidoRes = await pool.query(`
            SELECT
                p.id_pedido, p.codigo_seguimiento, p.fecha_pedido,
                p.total, p.estado,
                c.id_cliente, c.nombres, c.apellidos, c.telefono, c.dni, c.correo,
                pa.metodo_pago, pa.estado AS estado_pago, pa.monto,
                e.tipo_entrega, e.estado_entrega, e.fecha_estimada, e.observaciones,
                d.direccion, d.distrito, d.referencia
            FROM pedidos p
            LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
            LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
            LEFT JOIN envios e ON e.id_pedido = p.id_pedido
            LEFT JOIN direcciones_cliente d ON d.id_direccion = p.id_direccion
            WHERE p.id_pedido = $1
        `, [id]);

        if (!pedidoRes.rows.length)
            return res.json({ ok: false, mensaje: 'Pedido no encontrado' });

        const itemsRes = await pool.query(`
            SELECT dp.cantidad, dp.precio_unitario, dp.subtotal,
                   pr.nombre_producto, vp.color, t.nombre_talla
            FROM detalle_pedido dp
            LEFT JOIN productos pr ON pr.id_producto = dp.id_producto
            LEFT JOIN variantes_producto vp ON vp.id_variante = dp.id_variante
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            WHERE dp.id_pedido = $1
        `, [id]);

        res.json({ ok: true, data: { pedido: pedidoRes.rows[0], items: itemsRes.rows } });
    } catch (e) {
        console.error('GET /api/pedidos/:id:', e);
        res.json({ ok: false, mensaje: e.message });
    }
});

router.patch('/api/pedidos/:id/estado', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estados = ['pendiente','procesando','enviado','entregado','cancelado'];
    if (!estados.includes(estado))
        return res.json({ ok: false, mensaje: 'Estado no válido' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE pedidos SET estado=$1 WHERE id_pedido=$2', [estado, id]);

        if (estado === 'entregado') {
            await client.query(`UPDATE ventas SET estado='pagada' WHERE id_pedido=$1`, [id]);
            await client.query(`UPDATE pagos SET estado='pagado' WHERE id_pedido=$1`, [id]);
        }

        const estadoEnvio = estado === 'enviado' ? 'en_camino'
            : estado === 'entregado' ? 'entregado' : 'pendiente';
        if (estado !== 'cancelado') {
            await client.query(
                `UPDATE envios SET estado_entrega=$1 WHERE id_pedido=$2`,
                [estadoEnvio, id]
            );
        }
        await client.query('COMMIT');
        res.json({ ok: true, mensaje: `Pedido actualizado a "${estado}"` });
    } catch (e) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: e.message });
    } finally {
        client.release();
    }
});

module.exports = router;