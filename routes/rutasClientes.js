const express = require('express');
const router = express.Router();
const pool = require('../config/bd');
const { generarNumeroVenta } = require('../utils/GenerarNum');
const { enviarConfirmacionPedido } = require('../utils/remitente');


router.get('/api/carrito', (req, res) => {
    const carrito = req.session.carrito || [];
    const total = carrito.reduce((sum, i) => sum + Number(i.subtotal), 0);
    res.json({ ok: true, data: carrito, total: total.toFixed(2) });
});

router.post('/api/carrito', async (req, res) => {
    const { id_producto, id_variante, cantidad } = req.body;
    if (!id_producto || !cantidad || cantidad < 1)
        return res.json({ ok: false, mensaje: 'Datos inválidos' });

    try {
        const result = await pool.query(
            `SELECT p.id_producto, p.nombre_producto, p.precio_venta,
                    v.id_variante, v.stock, v.color, t.nombre_talla,
                    co.nombre_colegio
             FROM productos p
             LEFT JOIN variantes_producto v ON v.id_variante = $2
             LEFT JOIN tallas t ON t.id_talla = v.id_talla
             LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
             WHERE p.id_producto = $1 AND p.estado = 1`,
            [id_producto, id_variante || null]
        );

        if (!result.rows.length)
            return res.json({ ok: false, mensaje: 'Producto no encontrado' });

        const prod = result.rows[0];

        if (id_variante && prod.stock < cantidad)
            return res.json({ ok: false, mensaje: `Stock insuficiente. Disponible: ${prod.stock}` });

        if (!req.session.carrito) req.session.carrito = [];

        const idx = req.session.carrito.findIndex(
            i => i.id_producto === id_producto && i.id_variante === (id_variante || null)
        );

        if (idx >= 0) {
            const nuevaCant = req.session.carrito[idx].cantidad + parseInt(cantidad);
            if (id_variante && prod.stock < nuevaCant)
                return res.json({ ok: false, mensaje: `Stock insuficiente. Disponible: ${prod.stock}` });
            req.session.carrito[idx].cantidad = nuevaCant;
            req.session.carrito[idx].subtotal = (nuevaCant * Number(prod.precio_venta)).toFixed(2);
        } else {
            req.session.carrito.push({
                id_producto,
                id_variante: id_variante || null,
                nombre: prod.nombre_producto,
                colegio: prod.nombre_colegio || '',
                talla: prod.nombre_talla || '',
                color: prod.color || '',
                precio_unitario: Number(prod.precio_venta).toFixed(2),
                cantidad: parseInt(cantidad),
                subtotal: (parseInt(cantidad) * Number(prod.precio_venta)).toFixed(2)
            });
        }

        const total = req.session.carrito.reduce((s, i) => s + Number(i.subtotal), 0);
        res.json({ ok: true, mensaje: 'Agregado al carrito', total: total.toFixed(2), cantidad_items: req.session.carrito.length });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});
router.put('/api/carrito/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    const { cantidad } = req.body;
    const carrito = req.session.carrito || [];

    if (!carrito[idx]) return res.json({ ok: false, mensaje: 'Item no encontrado' });
    if (cantidad < 1) return res.json({ ok: false, mensaje: 'Cantidad mínima: 1' });

    carrito[idx].cantidad = parseInt(cantidad);
    carrito[idx].subtotal = (parseInt(cantidad) * Number(carrito[idx].precio_unitario)).toFixed(2);
    req.session.carrito = carrito;

    const total = carrito.reduce((s, i) => s + Number(i.subtotal), 0);
    res.json({ ok: true, total: total.toFixed(2) });
});

router.delete('/api/carrito/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    const carrito = req.session.carrito || [];
    if (!carrito[idx]) return res.json({ ok: false, mensaje: 'Item no encontrado' });

    carrito.splice(idx, 1);
    req.session.carrito = carrito;
    const total = carrito.reduce((s, i) => s + Number(i.subtotal), 0);
    res.json({ ok: true, total: total.toFixed(2), cantidad_items: carrito.length });
});

router.delete('/api/carrito', (req, res) => {
    req.session.carrito = [];
    res.json({ ok: true });
});


router.get('/api/metodos-pago', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM metodos_pago_empresa WHERE activo = true ORDER BY id_metodo'
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/checkout', async (req, res) => {
    const {
        nombres, apellidos, telefono, correo, direccion, distrito, referencia,
        tipo_entrega,         
        tipo_documento,      
        metodo_pago,          
        numero_operacion,     
        fecha_operacion,      
        monto_confirmado
    } = req.body;

    const carrito = req.session.carrito || [];
    if (!carrito.length)
        return res.json({ ok: false, mensaje: 'El carrito está vacío' });
    if (!nombres || !telefono)
        return res.json({ ok: false, mensaje: 'Nombre y teléfono son requeridos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let id_cliente;
        const clienteExiste = correo
            ? await client.query('SELECT id_cliente FROM clientes WHERE correo = $1', [correo])
            : { rows: [] };

        if (clienteExiste.rows.length) {
            id_cliente = clienteExiste.rows[0].id_cliente;
            await client.query(
                `UPDATE clientes SET nombres=$1, apellidos=$2, telefono=$3 WHERE id_cliente=$4`,
                [nombres, apellidos || '', telefono, id_cliente]
            );
        } else {
            const nuevoCliente = await client.query(
                `INSERT INTO clientes (nombres, apellidos, telefono, correo)
                 VALUES ($1, $2, $3, $4) RETURNING id_cliente`,
                [nombres, apellidos || '', telefono, correo || null]
            );
            id_cliente = nuevoCliente.rows[0].id_cliente;
        }

        let id_direccion = null;
        if (tipo_entrega === 'delivery' && direccion) {
            const dir = await client.query(
                `INSERT INTO direcciones_cliente (id_cliente, direccion, distrito, referencia, direcc_principal)
                 VALUES ($1, $2, $3, $4, false) RETURNING id_direccion`,
                [id_cliente, direccion, distrito || '', referencia || '']
            );
            id_direccion = dir.rows[0].id_direccion;
        }

        const total = carrito.reduce((s, i) => s + Number(i.subtotal), 0);

        const codigoSeg = `LIX-${Date.now()}`;
        const pedido = await client.query(
            `INSERT INTO pedidos (id_cliente, total, estado, id_direccion, codigo_seguimiento)
             VALUES ($1, $2, 'pendiente', $3, $4) RETURNING id_pedido`,
            [id_cliente, total.toFixed(2), id_direccion, codigoSeg]
        );
        const id_pedido = pedido.rows[0].id_pedido;

        for (const item of carrito) {
            await client.query(
                `INSERT INTO detalle_pedido (id_pedido, id_producto, id_variante, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [id_pedido, item.id_producto, item.id_variante || null,
                 item.cantidad, item.precio_unitario, item.subtotal]
            );

            if (item.id_variante) {
                await client.query(
                    `UPDATE variantes_producto SET stock = stock - $1 WHERE id_variante = $2`,
                    [item.cantidad, item.id_variante]
                );
                await client.query(
                    `INSERT INTO movimiento_stock (id_producto, id_variante, tipo_movimiento, cantidad, motivo)
                     VALUES ($1, $2, 'salida', $3, 'Venta pedido #' || $4)`,
                    [item.id_producto, item.id_variante, item.cantidad, id_pedido]
                );
            }
        }

        const pago = await client.query(
            `INSERT INTO pagos (id_pedido, metodo_pago, monto, estado)
             VALUES ($1, $2, $3, 'pendiente') RETURNING id_pago`,
            [id_pedido, metodo_pago, total.toFixed(2)]
        );
        const id_pago = pago.rows[0].id_pago;

        const evidencia = metodo_pago === 'visa'
            ? 'simulacion_visa'
            : (numero_operacion || 'pendiente_envio');

        await client.query(
            `INSERT INTO comprobantes_pago
             (id_pago, tipo_comprobante, numero_operacion, evidencia, fecha_operacion, monto_confirmado)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_pago, metodo_pago, numero_operacion || null,
             evidencia, fecha_operacion ? new Date(fecha_operacion) : new Date(),
             monto_confirmado || total.toFixed(2)]
        );

        await client.query(
            `INSERT INTO envios (id_pedido, tipo_entrega, id_direccion, estado_entrega)
             VALUES ($1, $2, $3, 'pendiente')`,
            [id_pedido, tipo_entrega || 'recojo_tienda', id_direccion]
        );
        const numeroVenta = await generarNumeroVenta(tipo_documento || 'nota_venta');
        await client.query(
            `INSERT INTO ventas (numero_venta, id_pedido, id_cliente, id_usuario, tipo_documento, subtotal, total, estado)
             VALUES ($1, $2, $3, 1, $4, $5, $6, 'pendiente')`,
            [numeroVenta, id_pedido, id_cliente, tipo_documento || 'nota_venta',
             total.toFixed(2), total.toFixed(2)]
        );
        for (const item of carrito) {
            const ventaRes = await client.query(
                'SELECT id_venta FROM ventas WHERE numero_venta = $1', [numeroVenta]
            );
            await client.query(
                `INSERT INTO detalle_venta (id_venta, id_producto, id_variante, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [ventaRes.rows[0].id_venta, item.id_producto, item.id_variante || null,
                 item.cantidad, item.precio_unitario, item.subtotal]
            );
        }

        await client.query('COMMIT');
        req.session.carrito = [];

        if (correo) {
            enviarConfirmacionPedido({
                correo, nombre: nombres,
                numeroVenta, tipoDoc: tipo_documento || 'nota_venta',
                total, items: carrito, metodoPago: metodo_pago
            }).catch(err => console.error('Error enviando correo:', err.message));
        }

        res.json({
            ok: true,
            mensaje: 'Pedido registrado correctamente',
            numero_venta: numeroVenta,
            codigo_seguimiento: codigoSeg,
            total: total.toFixed(2),
            id_pedido
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error checkout:', error);
        res.json({ ok: false, mensaje: error.message });
    } finally {
        client.release();
    }
});


router.get('/api/seguimiento/:codigo', async (req, res) => {
    const { codigo } = req.params;
    try {
        const resultado = await pool.query(
            `SELECT p.id_pedido, p.codigo_seguimiento, p.estado, p.fecha_pedido, p.total,
                    c.nombres, c.apellidos,
                    v.numero_venta, v.tipo_documento,
                    pa.estado AS estado_pago, pa.metodo_pago,
                    e.tipo_entrega, e.estado_entrega, e.fecha_estimada,
                    d.direccion, d.distrito
             FROM pedidos p
             LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
             LEFT JOIN ventas v ON v.id_pedido = p.id_pedido
             LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
             LEFT JOIN envios e ON e.id_pedido = p.id_pedido
             LEFT JOIN direcciones_cliente d ON d.id_direccion = p.id_direccion
             WHERE p.codigo_seguimiento = $1`,
            [codigo]
        );
        if (!resultado.rows.length)
            return res.json({ ok: false, mensaje: 'Pedido no encontrado' });
        res.json({ ok: true, data: resultado.rows[0] });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/catalogo/colegios', async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT DISTINCT co.id_colegio, co.nombre_colegio
             FROM colegios co
             INNER JOIN productos p ON p.id_colegio = co.id_colegio
             WHERE p.estado = 1
             ORDER BY co.nombre_colegio`
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});



module.exports = router;