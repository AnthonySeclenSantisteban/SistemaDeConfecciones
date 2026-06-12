const express = require('express');
const router = express.Router();
const pool = require('../config/bd');
const { generarNumeroVenta } = require('../utils/GenerarNum');
const { enviarConfirmacionPedido } = require('../utils/remitente');

router.get('/catalogo/identificacion', (req, res) => {
    res.sendFile(require('path').join(__dirname, '../views/catalogo/identificacion.html'));
});

router.get('/catalogo/mis-datos', (req, res) => {
    if (!req.session.checkout_cliente) return res.redirect('/catalogo/identificacion');
    res.sendFile(require('path').join(__dirname, '../views/catalogo/mis-datos.html'));
});

router.get('/catalogo/pago', (req, res) => {
    if (!req.session.checkout_cliente) return res.redirect('/catalogo/identificacion');
    if (!req.session.checkout_datos) return res.redirect('/catalogo/mis-datos');
    res.sendFile(require('path').join(__dirname, '../views/catalogo/pago.html'));
});

router.post('/api/checkout/identificar', async (req, res) => {
    const { telefono, correo } = req.body;
    if (!telefono && !correo)
        return res.json({ ok: false, mensaje: 'Ingresa tu teléfono o correo' });

    try {
        let cliente = null;
        if (telefono) {
            const r = await pool.query(
                `SELECT id_cliente, nombres, apellidos, dni, telefono, correo
                 FROM clientes WHERE telefono = $1 AND estado != 2 LIMIT 1`,
                [telefono.trim()]
            );
            if (r.rows.length) cliente = r.rows[0];
        }
        if (!cliente && correo) {
            const r = await pool.query(
                `SELECT id_cliente, nombres, apellidos, dni, telefono, correo
                 FROM clientes WHERE LOWER(correo) = LOWER($1) AND estado != 2 LIMIT 1`,
                [correo.trim()]
            );
            if (r.rows.length) cliente = r.rows[0];
        }

        req.session.checkout_cliente = {
            id_cliente: cliente?.id_cliente || null,
            telefono:   telefono?.trim() || cliente?.telefono || '',
            correo:     correo?.trim()   || cliente?.correo   || '',
            nombres:    cliente?.nombres  || '',
            apellidos:  cliente?.apellidos || '',
            dni:        cliente?.dni       || '',
            es_nuevo:   !cliente
        };

        res.json({
            ok: true,
            es_nuevo: !cliente,
            datos: req.session.checkout_cliente
        });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.post('/api/checkout/guardar-datos', async (req, res) => {
    const { nombres, apellidos, dni, telefono, correo, tipo_entrega, direccion, distrito, referencia } = req.body;

    if (!nombres) return res.json({ ok: false, mensaje: 'El nombre es requerido' });
    if (!telefono) return res.json({ ok: false, mensaje: 'El teléfono es requerido' });
    if (tipo_entrega === 'delivery' && !direccion)
        return res.json({ ok: false, mensaje: 'La dirección es requerida para delivery' });

    req.session.checkout_cliente = {
        ...req.session.checkout_cliente,
        nombres: nombres.trim(),
        apellidos: apellidos?.trim() || '',
        dni: dni?.trim() || '',
        telefono: telefono.trim(),
        correo: correo?.trim() || ''
    };

    req.session.checkout_datos = {
        tipo_entrega: tipo_entrega || 'recojo_tienda',
        direccion: direccion?.trim() || '',
        distrito: distrito?.trim() || '',
        referencia: referencia?.trim() || ''
    };

    res.json({ ok: true });
});

router.get('/api/checkout/sesion', (req, res) => {
    res.json({
        ok: true,
        cliente: req.session.checkout_cliente || null,
        datos:   req.session.checkout_datos   || null,
        carrito: req.session.carrito          || []
    });
});

router.get('/api/metodos-pago-catalogo', async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT * FROM metodos_pago_empresa WHERE activo = true ORDER BY id_metodo'
        );
        res.json({ ok: true, data: r.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.post('/api/checkout/confirmar', async (req, res) => {
    const { metodo_pago, numero_operacion, tipo_documento, carrito: carritoBody } = req.body;
    const carrito = carritoBody || req.session.carrito || [];
    const cliente  = req.session.checkout_cliente;
    const datosEnv = req.session.checkout_datos;

    if (!carrito.length)
        return res.json({ ok: false, mensaje: 'El carrito está vacío' });
    if (!cliente)
        return res.json({ ok: false, mensaje: 'Faltan datos del cliente' });
    if (!datosEnv)
        return res.json({ ok: false, mensaje: 'Faltan datos de entrega' });
    if (!metodo_pago)
        return res.json({ ok: false, mensaje: 'Selecciona un método de pago' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let id_cliente = cliente.id_cliente;

        if (id_cliente) {
            await client.query(
                `UPDATE clientes SET nombres=$1, apellidos=$2, telefono=$3,
                 dni=COALESCE(NULLIF($4,''), dni),
                 correo=COALESCE(NULLIF($5,''), correo),
                 updated_at=NOW()
                 WHERE id_cliente=$6`,
                [cliente.nombres, cliente.apellidos, cliente.telefono,
                 cliente.dni, cliente.correo, id_cliente]
            );
        } else {
            const r = await client.query(
                `INSERT INTO clientes (nombres, apellidos, telefono, correo, dni, estado)
                 VALUES ($1, $2, $3, $4, $5, 1) RETURNING id_cliente`,
                [cliente.nombres, cliente.apellidos || '',
                 cliente.telefono, cliente.correo || null,
                 cliente.dni || null]
            );
            id_cliente = r.rows[0].id_cliente;
        }

        let id_direccion = null;
        if (datosEnv.tipo_entrega === 'delivery' && datosEnv.direccion) {
            const dir = await client.query(
                `INSERT INTO direcciones_cliente (id_cliente, direccion, distrito, referencia, direcc_principal)
                 VALUES ($1, $2, $3, $4, false) RETURNING id_direccion`,
                [id_cliente, datosEnv.direccion, datosEnv.distrito || '', datosEnv.referencia || '']
            );
            id_direccion = dir.rows[0].id_direccion;
        }

        const total = carrito.reduce((s, i) => s + (parseFloat(i.precio || i.precio_unitario || 0) * parseInt(i.cantidad || 1)), 0);
        const codigoSeg = `LIX-${Date.now()}`;

        const pedido = await client.query(
            `INSERT INTO pedidos (id_cliente, total, estado, id_direccion, codigo_seguimiento)
             VALUES ($1, $2, 'pendiente', $3, $4) RETURNING id_pedido`,
            [id_cliente, total.toFixed(2), id_direccion, codigoSeg]
        );
        const id_pedido = pedido.rows[0].id_pedido;

        for (const item of carrito) {
            const precioUnit = parseFloat(item.precio || item.precio_unitario || 0);
            const cant = parseInt(item.cantidad || 1);
            const subTotal = parseFloat((precioUnit * cant).toFixed(2));
            await client.query(
            `INSERT INTO detalle_pedido (id_pedido, id_producto, id_variante, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_pedido, item.id_producto, item.id_variante || null,
            cant, precioUnit, subTotal]
        );

            if (item.id_variante) {
                await client.query(
                    `UPDATE variantes_producto SET stock = stock - $1 WHERE id_variante = $2`,
                    [item.cantidad, item.id_variante]
                );
                await client.query(
                    `INSERT INTO movimiento_stock (id_producto, id_variante, tipo_movimiento, cantidad, motivo)
                     VALUES ($1, $2, 'salida', $3, $4)`,
                    [item.id_producto, item.id_variante, item.cantidad, `Venta catálogo pedido #${id_pedido}`]
                );
            }
        }

        await client.query(
            `INSERT INTO pagos (id_pedido, metodo_pago, monto, estado, numero_operacion)
             VALUES ($1, $2, $3, 'pendiente', $4)`,
            [id_pedido, metodo_pago, total.toFixed(2), numero_operacion || null]
        );

        await client.query(
            `INSERT INTO envios (id_pedido, tipo_entrega, id_direccion, estado_entrega)
             VALUES ($1, $2, $3, 'pendiente')`,
            [id_pedido, datosEnv.tipo_entrega, id_direccion]
        );

        const tipoDoc = tipo_documento || 'nota_venta';
        const numeroVenta = await generarNumeroVenta(tipoDoc);

        const ventaRes = await client.query(
            `INSERT INTO ventas (numero_venta, id_pedido, id_cliente, id_usuario, tipo_documento, subtotal, descuento, total, estado)
             VALUES ($1, $2, $3, 1, $4, $5, 0, $6, 'pendiente') RETURNING id_venta`,
            [numeroVenta, id_pedido, id_cliente, tipoDoc, total.toFixed(2), total.toFixed(2)]
        );
        const id_venta = ventaRes.rows[0].id_venta;

        for (const item of carrito) {
            const precioUnit2 = parseFloat(item.precio || item.precio_unitario || 0);
            const cant2 = parseInt(item.cantidad || 1);
            const subTotal2 = parseFloat((precioUnit2 * cant2).toFixed(2));
            await client.query(
            `INSERT INTO detalle_venta (id_venta, id_producto, id_variante, cantidad, precio_unitario, subtotal)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_venta, item.id_producto, item.id_variante || null,
            cant2, precioUnit2, subTotal2]
        );
        }

        await client.query('COMMIT');

        req.session.carrito = [];
        req.session.checkout_cliente = null;
        req.session.checkout_datos = null;

        if (cliente.correo) {
            enviarConfirmacionPedido({
                correo: cliente.correo,
                nombre: cliente.nombres,
                numeroVenta, tipoDoc,
                total, items: carrito,
                metodoPago: metodo_pago
            }).catch(e => console.error('Error correo:', e));
        }

        res.json({
            ok: true,
            numero_venta: numeroVenta,
            codigo_seguimiento: codigoSeg,
            total: total.toFixed(2)
        });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error checkout confirmar:', e);
        res.json({ ok: false, mensaje: e.message });
    } finally {
        client.release();
    }
});

module.exports = router;