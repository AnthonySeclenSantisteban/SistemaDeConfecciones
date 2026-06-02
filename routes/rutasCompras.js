const express = require('express');
const router = express.Router();
const pool = require('../config/bd');

router.get('/api/compras', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ci.id_compra, ci.nombre_insumo, ci.cantidad, ci.unidad_medida,
                   ci.costo, ci.lugar_compra, ci.fecha_compra,
                   u.nombre AS usuario_nombre
            FROM compras_insumos ci
            LEFT JOIN usuarios u ON u.id_usuario = ci.id_usuario
            ORDER BY ci.id_compra DESC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/productos/activos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id_producto, p.nombre_producto, p.precio_costo, p.precio_venta
            FROM productos p
            WHERE p.estado = 1
            ORDER BY p.nombre_producto
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/productos/:id/variantes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT v.id_variante, v.color, v.stock, t.nombre_talla
            FROM variantes_producto v
            LEFT JOIN tallas t ON t.id_talla = v.id_talla
            WHERE v.id_producto = $1
            ORDER BY v.id_variante
        `, [req.params.id]);

        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/compras', async (req, res) => {
    const {
        id_producto,
        id_variante,
        cantidad,
        costo,
        lugar_compra,
        unidad_medida,
        nombre_insumo
    } = req.body;

    if (!id_producto || !id_variante || !cantidad || cantidad < 1 || !costo || costo <= 0) {
        return res.json({ ok: false, mensaje: 'Datos inválidos' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const prod = await client.query(`
            SELECT p.id_producto, p.nombre_producto, v.id_variante, v.stock, v.color, t.nombre_talla
            FROM productos p
            INNER JOIN variantes_producto v ON v.id_producto = p.id_producto
            LEFT JOIN tallas t ON t.id_talla = v.id_talla
            WHERE p.id_producto = $1 AND v.id_variante = $2
        `, [id_producto, id_variante]);

        if (!prod.rows.length) {
            await client.query('ROLLBACK');
            return res.json({ ok: false, mensaje: 'Producto o variante no encontrado' });
        }

        const item = prod.rows[0];
        const nombreRegistro = nombre_insumo || `${item.nombre_producto} ${item.nombre_talla || ''} ${item.color || ''}`.trim();

        await client.query(`
            INSERT INTO compras_insumos (nombre_insumo, cantidad, unidad_medida, costo, lugar_compra, id_usuario)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            nombreRegistro,
            parseInt(cantidad),
            unidad_medida || 'unidad',
            parseFloat(costo),
            lugar_compra || 'Sin especificar',
            1
        ]);

        await client.query(`
            UPDATE variantes_producto
            SET stock = stock + $1
            WHERE id_variante = $2
        `, [parseInt(cantidad), id_variante]);

        await client.query(`
            INSERT INTO movimiento_stock (id_producto, id_variante, tipo_movimiento, cantidad, motivo)
            VALUES ($1, $2, 'entrada', $3, $4)
        `, [
            id_producto,
            id_variante,
            parseInt(cantidad),
            'Ingreso por compra de insumo'
        ]);

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Compra registrada correctamente' });

    } catch (error) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;