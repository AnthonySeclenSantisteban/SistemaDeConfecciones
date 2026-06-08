const express = require('express');
const router = express.Router();
const pool = require('../config/bd');

function verificarSesion(req, res, next) {
    if (!req.session || !req.session.usuario)
        return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
    next();
}

router.get('/api/envios', verificarSesion, async (req, res) => {
    const { estado, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conds  = ["e.tipo_entrega = 'delivery'"];

    if (estado) {
        params.push(estado);
        conds.push(`e.estado_entrega = $${params.length}`);
    }

    const where = conds.join(' AND ');

    try {
        const countRes = await pool.query(
            `SELECT COUNT(*) AS total FROM envios e WHERE ${where}`, params
        );
        const total = parseInt(countRes.rows[0].total);

        params.push(parseInt(limit));
        params.push(offset);

        const result = await pool.query(`
                    SELECT
            e.id_envio,
            e.tipo_entrega,
            e.estado_entrega,
            e.fecha_estimada,
            e.fecha_entrega,
            e.observaciones,
            p.id_pedido,
            p.fecha_pedido,
            p.total AS total_pedido,
            CONCAT(c.nombres, ' ', c.apellidos) AS cliente,
            c.telefono,
            c.correo,
            d.direccion,
            d.distrito,
            d.referencia,
            v.numero_venta AS codigo_venta,
            pa.metodo_pago
        FROM envios e
        JOIN pedidos p ON p.id_pedido = e.id_pedido
        JOIN clientes c ON c.id_cliente = p.id_cliente
        LEFT JOIN direcciones_cliente d ON d.id_direccion = e.id_direccion
        LEFT JOIN ventas v ON v.id_pedido = p.id_pedido
        LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
        WHERE ${where}
        ORDER BY p.fecha_pedido DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            ok: true,
            data: result.rows,
            total,
            pages: Math.ceil(total / parseInt(limit)),
            page: parseInt(page)
        });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.patch('/api/envios/:id/estado', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { estado_entrega, fecha_estimada, observaciones } = req.body;
    const estados = ['pendiente', 'en_camino', 'entregado', 'demora', 'fallido'];

    if (!estados.includes(estado_entrega))
        return res.json({ ok: false, mensaje: 'Estado no válido' });

    try {
        await pool.query(`
            UPDATE envios
            SET estado_entrega = $1,
                fecha_estimada = $2,
                observaciones  = $3,
                fecha_entrega  = CASE WHEN $1 = 'entregado' THEN NOW() ELSE fecha_entrega END
            WHERE id_envio = $4`,
            [estado_entrega, fecha_estimada || null, observaciones || null, id]
        );
        res.json({ ok: true, mensaje: `Envío actualizado a ${estado_entrega}` });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.get('/api/envios/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const envioRes = await pool.query(`
            SELECT
                e.id_envio, e.tipo_entrega, e.estado_entrega,
                e.fecha_estimada, e.fecha_entrega, e.observaciones,
                p.id_pedido, p.fecha_pedido, p.total AS total_pedido,
                CONCAT(c.nombres, ' ', c.apellidos) AS cliente,
                c.telefono, c.correo,
                d.direccion, d.distrito, d.referencia,
                v.numero_venta AS codigo_venta,
                pa.metodo_pago
            FROM envios e
            JOIN pedidos p ON p.id_pedido = e.id_pedido
            JOIN clientes c ON c.id_cliente = p.id_cliente
            LEFT JOIN direcciones_cliente d ON d.id_direccion = e.id_direccion
            LEFT JOIN ventas v ON v.id_pedido = p.id_pedido
            LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
            WHERE e.id_envio = $1
        `, [id]);

        if (!envioRes.rows.length)
            return res.json({ ok: false, mensaje: 'Envío no encontrado' });

        const itemsRes = await pool.query(`
            SELECT dp.cantidad, dp.precio_unitario, dp.subtotal,
                   pr.nombre_producto, vp.color, t.nombre_talla
            FROM detalle_pedido dp
            LEFT JOIN productos pr ON pr.id_producto = dp.id_producto
            LEFT JOIN variantes_producto vp ON vp.id_variante = dp.id_variante
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            WHERE dp.id_pedido = $1
        `, [envioRes.rows[0].id_pedido]);

        res.json({ ok: true, envio: envioRes.rows[0], items: itemsRes.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});


router.put('/api/envios/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { estado_entrega, fecha_estimada, fecha_entrega, observaciones } = req.body;
    try {
        await pool.query(`
            UPDATE envios
            SET estado_entrega = $1,
                fecha_estimada = $2,
                fecha_entrega  = $3,
                observaciones  = $4
            WHERE id_envio = $5
        `, [
            estado_entrega,
            fecha_estimada || null,
            fecha_entrega  || null,   
            observaciones  || null,
            id
        ]);

        res.json({ ok: true, mensaje: 'Envío actualizado correctamente' });
    } catch (e) {
        console.error('PUT /api/envios/:id:', e.message); 
        res.json({ ok: false, mensaje: e.message });
    }
});

module.exports = router;