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

const unidadesPorCategoria = {
    'Tela':      ['metros','yardas','rollo'],
    'Hilo':      ['cono','rollo','kilos','unidad'],
    'Botón':     ['unidad','docena','paquete'],
    'Cierre':    ['unidad','docena','paquete'],
    'Elástico':  ['metros','yardas','rollo'],
    'Etiqueta':  ['unidad','docena','paquete','rollo'],
    'Entretela': ['metros','yardas','rollo'],
    'Accesorio': ['unidad','docena','paquete'],
    'Empaque':   ['unidad','docena','paquete','rollo'],
};

function validarCompra({ nombre_insumo, cantidad, costo, categoria_insumo, unidad_medida, lugar_compra }) {
    if (!nombre_insumo) return 'El nombre es requerido';
    if (!cantidad || cantidad < 1) return 'La cantidad debe ser mayor a 0';
    if (cantidad > 10000) return 'La cantidad parece demasiado alta';
    if (!costo || costo <= 0) return 'El costo debe ser mayor a 0';
    if (costo > 99999) return 'El costo parece demasiado alto';
    if (!lugar_compra || !lugar_compra.trim()) return 'El lugar de compra es requerido';
    if (categoria_insumo && unidadesPorCategoria[categoria_insumo]) {
        if (!unidadesPorCategoria[categoria_insumo].includes(unidad_medida)) {
            return `Para "${categoria_insumo}" las unidades válidas son: ${unidadesPorCategoria[categoria_insumo].join(', ')}`;
        }
    }
    return null;
}

async function obtenerOCrearInsumo(client, nombre, categoria, unidad) {
    const existente = await client.query(
        `SELECT * FROM insumos
         WHERE LOWER(TRIM(nombre_insumo)) = LOWER(TRIM($1))
           AND COALESCE(categoria_insumo, '') = COALESCE($2, '')`,
        [nombre, categoria || null]
    );

    if (existente.rows.length) {
        const insumo = existente.rows[0];
        if (insumo.unidad_medida !== unidad) {
            throw new Error(`"${nombre}" ya está registrado en "${insumo.unidad_medida}". Usa esa misma unidad, o cambia el nombre para diferenciarlo como otro insumo.`);
        }
        return insumo;
    }

    const creado = await client.query(
        `INSERT INTO insumos (nombre_insumo, categoria_insumo, unidad_medida, stock_actual, costo_promedio)
         VALUES ($1, $2, $3, 0, 0) RETURNING *`,
        [nombre.trim(), categoria || null, unidad]
    );
    return creado.rows[0];
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
        throw new Error('Esta operación dejaría el stock del insumo en negativo. Revisa las cantidades ya consumidas antes de continuar.');
    }
    stock = Math.max(0, stock);
    await client.query(
        `UPDATE insumos SET stock_actual = $1, costo_promedio = $2, fecha_actualizacion = NOW() WHERE id_insumo = $3`,
        [stock, costoPromedio, id_insumo]
    );
    return { stock, costoPromedio };
}

router.get('/api/compras', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_compra, nombre_insumo, categoria_insumo, observacion,
                cantidad, unidad_medida, costo, lugar_compra, fecha_compra, id_insumo
            FROM compras_insumos
            ORDER BY id_compra DESC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/compras', verificarSesion, async (req, res) => {
    const { nombre_insumo, categoria_insumo, observacion, cantidad, costo, unidad_medida, lugar_compra } = req.body;
    const errorValidacion = validarCompra(req.body);
    if (errorValidacion) return res.json({ ok: false, mensaje: errorValidacion });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insumo = await obtenerOCrearInsumo(client, nombre_insumo, categoria_insumo, unidad_medida || 'unidad');
        const costoUnitario = parseFloat(costo) / parseInt(cantidad);
        const compra = await client.query(`
            INSERT INTO compras_insumos
                (nombre_insumo, categoria_insumo, observacion, cantidad, unidad_medida, costo, lugar_compra, id_usuario, id_insumo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id_compra
        `, [
            nombre_insumo, categoria_insumo || null, observacion || null,
            parseInt(cantidad), unidad_medida || 'unidad', parseFloat(costo),
            lugar_compra || 'Sin especificar', idUsuarioDeSesion(req), insumo.id_insumo
        ]);

        await client.query(`
            INSERT INTO movimiento_insumo (id_insumo, tipo, cantidad, motivo, costo_unitario, id_compra, id_usuario)
            VALUES ($1, 'entrada', $2, 'compra', $3, $4, $5)
        `, [insumo.id_insumo, parseInt(cantidad), costoUnitario, compra.rows[0].id_compra, idUsuarioDeSesion(req)]);
        await recalcularInsumo(client, insumo.id_insumo);
        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Compra registrada correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

router.delete('/api/compras/:id', verificarSesion, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const compra = await client.query(`SELECT id_insumo FROM compras_insumos WHERE id_compra = $1`, [req.params.id]);
        if (!compra.rows.length) throw new Error('Compra no encontrada');
        const idInsumo = compra.rows[0].id_insumo;
        await client.query(`DELETE FROM movimiento_insumo WHERE id_compra = $1 AND motivo = 'compra'`, [req.params.id]);
        await client.query(`DELETE FROM compras_insumos WHERE id_compra = $1`, [req.params.id]);
        if (idInsumo) await recalcularInsumo(client, idInsumo);

        await client.query('COMMIT');
        res.json({ ok: true, mensaje: 'Compra eliminada correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});

router.get('/api/insumos', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_insumo, nombre_insumo, categoria_insumo, unidad_medida,
                   stock_actual, costo_promedio, stock_minimo
            FROM insumos
            ORDER BY nombre_insumo ASC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/insumos/:id/movimientos', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT tipo, cantidad, motivo, costo_unitario, observacion, fecha
            FROM movimiento_insumo
            WHERE id_insumo = $1
            ORDER BY fecha DESC, id_movimiento DESC
            LIMIT 100
        `, [req.params.id]);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

module.exports = router;