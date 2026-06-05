const express = require('express');
const router = express.Router();
const pool = require('../config/bd');

router.get('/api/compras', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_compra,
                nombre_insumo,
                categoria_insumo,
                observacion,
                cantidad,
                unidad_medida,
                costo,
                lugar_compra,
                fecha_compra
            FROM compras_insumos
            ORDER BY id_compra DESC
        `);

        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/compras', async (req, res) => {
    const {
        nombre_insumo,
        categoria_insumo,
        observacion,
        cantidad,
        costo,
        unidad_medida,
        lugar_compra
    } = req.body;

    if (!nombre_insumo || !cantidad || cantidad < 1 || !costo || costo <= 0) {
        return res.json({ ok: false, mensaje: 'Datos inválidos' });
    }

    try {
        await pool.query(`
            INSERT INTO compras_insumos
                (nombre_insumo, categoria_insumo, observacion, cantidad, unidad_medida, costo, lugar_compra, id_usuario)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            nombre_insumo,
            categoria_insumo || null,
            observacion || null,
            parseInt(cantidad),
            unidad_medida || 'unidad',
            parseFloat(costo),
            lugar_compra || 'Sin especificar',
            1
        ]);

        res.json({ ok: true, mensaje: 'Compra registrada correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/compras/:id', async (req, res) => {
    const {
        nombre_insumo,
        categoria_insumo,
        observacion,
        cantidad,
        costo,
        unidad_medida,
        lugar_compra
    } = req.body;

    if (!nombre_insumo || !cantidad || cantidad < 1 || !costo || costo <= 0) {
        return res.json({ ok: false, mensaje: 'Datos inválidos' });
    }

    try {
        const result = await pool.query(`
            UPDATE compras_insumos
            SET nombre_insumo = $1,
                categoria_insumo = $2,
                observacion = $3,
                cantidad = $4,
                unidad_medida = $5,
                costo = $6,
                lugar_compra = $7
            WHERE id_compra = $8
        `, [
            nombre_insumo,
            categoria_insumo || null,
            observacion || null,
            parseInt(cantidad),
            unidad_medida || 'unidad',
            parseFloat(costo),
            lugar_compra || 'Sin especificar',
            req.params.id
        ]);

        if (!result.rowCount) {
            return res.json({ ok: false, mensaje: 'Compra no encontrada' });
        }

        res.json({ ok: true, mensaje: 'Compra actualizada correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/compras/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            DELETE FROM compras_insumos
            WHERE id_compra = $1
        `, [req.params.id]);

        if (!result.rowCount) {
            return res.json({ ok: false, mensaje: 'Compra no encontrada' });
        }

        res.json({ ok: true, mensaje: 'Compra eliminada correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

module.exports = router;