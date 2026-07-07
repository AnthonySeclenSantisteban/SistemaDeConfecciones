const express = require('express');
const router = express.Router();
const pool = require('../config/bd');

function verificarSesion(req, res, next) {
    if (!req.session || !req.session.usuario) return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
    next();
}

function idUsuarioDeSesion(req) {
    return req.session.usuario.id || req.session.usuario.id_usuario;
}

async function recalcularInsumo(client, id_insumo) {
    const movs = await client.query(
        `SELECT tipo, cantidad, costo_unitario
         FROM movimiento_insumo
         WHERE id_insumo = $1
         ORDER BY fecha ASC, id_movimiento ASC`,
        [id_insumo]
    );

    let stock = 0;
    let costoPromedio = 0;

    for (const m of movs.rows) {
        const cantidad = parseFloat(m.cantidad);
        if (m.tipo === 'entrada') {
            const nuevoStock = stock + cantidad;
            costoPromedio = nuevoStock > 0
                ? ((stock * costoPromedio) + (cantidad * parseFloat(m.costo_unitario))) / nuevoStock
                : 0;
            stock = nuevoStock;
        } else {
            stock -= cantidad;
        }
    }

    if (stock < -0.001) {
        throw new Error('Esta operación dejaría el stock de un insumo en negativo.');
    }
    stock = Math.max(0, stock);

    await client.query(
        `UPDATE insumos SET stock_actual = $1, costo_promedio = $2, fecha_actualizacion = NOW() WHERE id_insumo = $3`,
        [stock, costoPromedio, id_insumo]
    );

    return { stock, costoPromedio };
}


router.get('/api/productos/:id/receta', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.id_receta, r.id_insumo, r.cantidad_por_unidad,
                   i.nombre_insumo, i.unidad_medida, i.costo_promedio, i.stock_actual
            FROM receta_producto r
            JOIN insumos i ON i.id_insumo = r.id_insumo
            WHERE r.id_producto = $1
            ORDER BY i.nombre_insumo ASC
        `, [req.params.id]);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/productos/:id/receta', verificarSesion, async (req, res) => {
    const { id_insumo, cantidad_por_unidad } = req.body;

    if (!id_insumo) return res.json({ ok: false, mensaje: 'Selecciona un insumo' });
    if (!cantidad_por_unidad || cantidad_por_unidad <= 0) {
        return res.json({ ok: false, mensaje: 'La cantidad por unidad debe ser mayor a 0' });
    }

    try {
        const existe = await pool.query(
            `SELECT id_receta FROM receta_producto WHERE id_producto = $1 AND id_insumo = $2`,
            [req.params.id, id_insumo]
        );
        if (existe.rows.length) {
            return res.json({ ok: false, mensaje: 'Este insumo ya está en la receta. Edítalo en vez de agregarlo de nuevo.' });
        }

        await pool.query(
            `INSERT INTO receta_producto (id_producto, id_insumo, cantidad_por_unidad) VALUES ($1, $2, $3)`,
            [req.params.id, id_insumo, parseFloat(cantidad_por_unidad)]
        );
        res.json({ ok: true, mensaje: 'Insumo agregado a la receta' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/receta/:id_receta', verificarSesion, async (req, res) => {
    const { cantidad_por_unidad } = req.body;
    if (!cantidad_por_unidad || cantidad_por_unidad <= 0) {
        return res.json({ ok: false, mensaje: 'La cantidad por unidad debe ser mayor a 0' });
    }
    try {
        const result = await pool.query(
            `UPDATE receta_producto SET cantidad_por_unidad = $1 WHERE id_receta = $2`,
            [parseFloat(cantidad_por_unidad), req.params.id_receta]
        );
        if (!result.rowCount) return res.json({ ok: false, mensaje: 'Receta no encontrada' });
        res.json({ ok: true, mensaje: 'Receta actualizada' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/receta/:id_receta', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`DELETE FROM receta_producto WHERE id_receta = $1`, [req.params.id_receta]);
        if (!result.rowCount) return res.json({ ok: false, mensaje: 'Receta no encontrada' });
        res.json({ ok: true, mensaje: 'Insumo quitado de la receta' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/productos/:id/variantes', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT vp.id_variante, vp.color, vp.stock, t.nombre_talla
            FROM variantes_producto vp
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            WHERE vp.id_producto = $1
            ORDER BY t.nombre_talla ASC, vp.color ASC
        `, [req.params.id]);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/produccion/ordenes', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                o.id_orden, o.cantidad_producida, o.costo_total_insumos, o.fecha,
                p.nombre_producto,
                vp.color, t.nombre_talla
            FROM ordenes_produccion o
            JOIN productos p ON p.id_producto = o.id_producto
            JOIN variantes_producto vp ON vp.id_variante = o.id_variante
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            ORDER BY o.id_orden DESC
            LIMIT 100
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/produccion/ordenes', verificarSesion, async (req, res) => {
    const { id_producto, id_variante, cantidad_producida } = req.body;

    if (!id_producto) return res.json({ ok: false, mensaje: 'Selecciona un producto' });
    if (!id_variante) return res.json({ ok: false, mensaje: 'Selecciona la talla/color a producir' });
    if (!cantidad_producida || cantidad_producida <= 0) {
        return res.json({ ok: false, mensaje: 'La cantidad a producir debe ser mayor a 0' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const variante = await client.query(
            `SELECT id_variante, id_producto, stock FROM variantes_producto WHERE id_variante = $1 FOR UPDATE`,
            [id_variante]
        );
        if (!variante.rows.length) throw new Error('La variante seleccionada no existe');
        if (String(variante.rows[0].id_producto) !== String(id_producto)) {
            throw new Error('Esa talla/color no pertenece al producto seleccionado');
        }

        const receta = await client.query(
            `SELECT r.id_insumo, r.cantidad_por_unidad, i.nombre_insumo, i.unidad_medida, i.stock_actual, i.costo_promedio
             FROM receta_producto r
             JOIN insumos i ON i.id_insumo = r.id_insumo
             WHERE r.id_producto = $1
             FOR UPDATE OF i`,
            [id_producto]
        );
        if (!receta.rows.length) {
            throw new Error('Este producto no tiene una receta definida. Defínela primero en la sección "Receta".');
        }
        const faltantes = [];
        let costoTotal = 0;
        const necesidades = receta.rows.map(r => {
            const necesario = parseFloat(r.cantidad_por_unidad) * parseInt(cantidad_producida);
            if (necesario > parseFloat(r.stock_actual)) {
                faltantes.push(`${r.nombre_insumo} (necesitas ${necesario.toFixed(2)} ${r.unidad_medida}, tienes ${parseFloat(r.stock_actual).toFixed(2)})`);
            }
            costoTotal += necesario * parseFloat(r.costo_promedio);
            return { id_insumo: r.id_insumo, necesario, costo_unitario: r.costo_promedio };
        });

        if (faltantes.length) {
            throw new Error(`No hay stock suficiente para producir ${cantidad_producida} unidad(es). Falta: ${faltantes.join('; ')}`);
        }

        const orden = await client.query(`
            INSERT INTO ordenes_produccion (id_producto, id_variante, cantidad_producida, costo_total_insumos, id_usuario)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_orden
        `, [id_producto, id_variante, parseInt(cantidad_producida), costoTotal, idUsuarioDeSesion(req)]);
        const idOrden = orden.rows[0].id_orden;

        for (const n of necesidades) {
            await client.query(`
                INSERT INTO movimiento_insumo (id_insumo, tipo, cantidad, motivo, costo_unitario, id_usuario, id_producto, cantidad_producida, id_orden)
                VALUES ($1, 'salida', $2, 'consumo_produccion', $3, $4, $5, $6, $7)
            `, [n.id_insumo, n.necesario, n.costo_unitario, idUsuarioDeSesion(req), id_producto, parseInt(cantidad_producida), idOrden]);

            await recalcularInsumo(client, n.id_insumo);
        }

        const stockAntes = parseInt(variante.rows[0].stock);
        const stockDespues = stockAntes + parseInt(cantidad_producida);

        await client.query(
            `UPDATE variantes_producto SET stock = $1 WHERE id_variante = $2`,
            [stockDespues, id_variante]
        );

        await client.query(`
            INSERT INTO movimiento_stock (id_producto, id_variante, tipo_movimiento, cantidad, motivo, stock_antes, stock_despues, id_orden)
            VALUES ($1, $2, 'entrada', $3, 'Producción interna', $4, $5, $6)
        `, [id_producto, id_variante, parseInt(cantidad_producida), stockAntes, stockDespues, idOrden]);
        const costoPorUnidad = costoTotal / parseInt(cantidad_producida);
        await client.query(
            `UPDATE productos SET precio_costo = $1 WHERE id_producto = $2`,
            [costoPorUnidad.toFixed(2), id_producto]
        );

        await client.query('COMMIT');
        res.json({
            ok: true,
            mensaje: 'Producción registrada correctamente',
            id_orden: idOrden,
            costo_total_insumos: costoTotal.toFixed(2),
            costo_por_unidad: costoPorUnidad.toFixed(2)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;