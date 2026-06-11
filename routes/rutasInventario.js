const express = require('express');
const router = express.Router();
const pool = require('../config/bd');

function verificarSesion(req, res, next) {
    if (!req.session || !req.session.usuario)
        return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
    next();
}

router.get('/api/inventario', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id_producto,
                p.nombre_producto,
                p.precio_venta,
                p.stock_minimo,
                c.nombre AS categoria_nombre,
                co.nombre_colegio,
                COALESCE(SUM(vp.stock), 0)::int AS stock_general,
                COALESCE(SUM(vp.stock * p.precio_venta), 0) AS valor
            FROM productos p
            LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
            LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
            LEFT JOIN variantes_producto vp ON vp.id_producto = p.id_producto
            WHERE p.estado != 2
            GROUP BY p.id_producto, p.nombre_producto, p.precio_venta,
                     p.stock_minimo, c.nombre, co.nombre_colegio
            ORDER BY p.nombre_producto
        `);
        res.json({ ok: true, data: result.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.get('/api/inventario/movimientos', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                m.id_movimiento,
                m.tipo_movimiento,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.boleta,
                m.stock_antes,
                m.stock_despues,
                m.fecha_movimiento,
                p.nombre_producto,
                t.nombre_talla,
                vp.color
            FROM movimiento_stock m
            JOIN productos p ON p.id_producto = m.id_producto
            JOIN variantes_producto vp ON vp.id_variante = m.id_variante
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            ORDER BY m.fecha_movimiento DESC
            LIMIT 200
        `);
        res.json({ ok: true, data: result.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.post('/api/inventario/movimiento', verificarSesion, async (req, res) => {
    const { id_variante, tipo_movimiento, cantidad, motivo, observacion, boleta } = req.body;
    if (!id_variante || !tipo_movimiento || !cantidad || cantidad < 1)
        return res.json({ ok: false, mensaje: 'Datos inválidos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const varRes = await client.query(
            'SELECT stock, id_producto FROM variantes_producto WHERE id_variante = $1',
            [id_variante]
        );
        if (!varRes.rows.length) throw new Error('Variante no encontrada');

        const stockActual = varRes.rows[0].stock;
        const id_producto = varRes.rows[0].id_producto;

        if (tipo_movimiento === 'salida' && stockActual < cantidad)
            throw new Error(`Stock insuficiente. Disponible: ${stockActual}`);

        const nuevoStock = tipo_movimiento === 'entrada'
            ? stockActual + parseInt(cantidad)
            : stockActual - parseInt(cantidad);

        await client.query(
            'UPDATE variantes_producto SET stock = $1 WHERE id_variante = $2',
            [nuevoStock, id_variante]
        );

        await client.query(`
            INSERT INTO movimiento_stock
            (id_producto, id_variante, tipo_movimiento, cantidad, motivo, observacion, boleta, stock_antes, stock_despues)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id_producto, id_variante, tipo_movimiento, parseInt(cantidad),
             motivo || 'Ajuste manual', observacion || null, boleta || null,
             stockActual, nuevoStock]
        );

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Movimiento registrado', stock_nuevo: nuevoStock });
    } catch (e) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: e.message });
    } finally {
        client.release();
    }
});
router.post('/api/inventario/actualizar', verificarSesion, async (req, res) => {
    const { id_variante, operacion, cantidad, boleta, observacion } = req.body;

    if (!id_variante || !operacion || cantidad === undefined)
        return res.json({ ok: false, mensaje: 'Datos inválidos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const varRes = await client.query(
            'SELECT stock, id_producto FROM variantes_producto WHERE id_variante = $1',
            [id_variante]
        );
        if (!varRes.rows.length) throw new Error('Variante no encontrada');

        const stockAntes = parseInt(varRes.rows[0].stock);
        const id_producto = varRes.rows[0].id_producto;
        let stockDespues;

        if (operacion === 'ingreso') {
            stockDespues = stockAntes + parseInt(cantidad);
        } else if (operacion === 'egreso') {
            stockDespues = stockAntes - parseInt(cantidad);
            if (stockDespues < 0) throw new Error(`Stock insuficiente. Disponible: ${stockAntes}`);
        } else if (operacion === 'ajuste') {
            stockDespues = parseInt(cantidad);
        } else {
            throw new Error('Operación no válida');
        }

        await client.query(
            'UPDATE variantes_producto SET stock = $1 WHERE id_variante = $2',
            [stockDespues, id_variante]
        );

        const tipoMovimiento = operacion === 'egreso' ? 'salida' : 'entrada';

        await client.query(`
            INSERT INTO movimiento_stock
            (id_producto, id_variante, tipo_movimiento, cantidad, motivo, observacion, boleta, stock_antes, stock_despues)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            id_producto, id_variante, tipoMovimiento,
            Math.abs(parseInt(cantidad)),
            observacion || `Ajuste manual - ${operacion}`,
            observacion || null,
            boleta || null,
            stockAntes, stockDespues
        ]);

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Stock actualizado correctamente', stock_despues: stockDespues });
    } catch (e) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: e.message });
    } finally {
        client.release();
    }
});


router.get('/api/inventario/variante/:id/historial', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT m.id_movimiento, m.tipo_movimiento, m.cantidad,
                   m.motivo, m.observacion, m.boleta,
                   m.stock_antes, m.stock_despues, m.fecha_movimiento,
                   vp.color, t.nombre_talla
            FROM movimiento_stock m
            JOIN variantes_producto vp ON vp.id_variante = m.id_variante
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            WHERE m.id_variante = $1
            ORDER BY m.fecha_movimiento DESC
            LIMIT 50
        `, [id]);

        res.json({ ok: true, data: result.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});
router.get('/api/inventario/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const prodRes = await pool.query(`
            SELECT p.id_producto, p.nombre_producto, p.precio_venta,
                   p.stock_minimo, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
            WHERE p.id_producto = $1 AND p.estado != 2
        `, [id]);

        if (!prodRes.rows.length)
            return res.json({ ok: false, mensaje: 'Producto no encontrado' });

        const varRes = await pool.query(`
            SELECT vp.id_variante, vp.color, vp.stock, vp.precio_extra,
                   t.nombre_talla, tu.nombre_tipo
            FROM variantes_producto vp
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            LEFT JOIN tipos_uniforme tu ON tu.id_tipo = vp.id_tipo
            WHERE vp.id_producto = $1
            ORDER BY t.nombre_talla, vp.color
        `, [id]);

        res.json({ ok: true, producto: prodRes.rows[0], variantes: varRes.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});



module.exports = router;