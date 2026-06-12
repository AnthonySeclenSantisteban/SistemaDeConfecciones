const express = require('express');
const router = express.Router();
const controladorAuth = require('../controllers/controladorAuth');
const path = require('path'); 
const pool = require('../config/bd');
const { uploadLogo, uploadSlider } = require('../utils/uploadTienda');

const verificarSesion = (req, res, next) => {
    if (!req.session.usuario) {
        return res.redirect('/login');
    }
    next();
};

router.get('/login', controladorAuth.mostrarLogin);
router.post('/login', controladorAuth.procesarLogin);
router.get('/logout', controladorAuth.cerrarSesion);
router.get('/api/mis-opciones', verificarSesion, (req, res) => {
    res.json({ ok: true, opciones: req.session.usuario.opciones || [] });
});

router.get('/dashboard', verificarSesion, (req, res) => {
    res.sendFile(require('path').join(__dirname, '../views/dashboard.html'));
});



router.get('/vistas/modulos/:modulo', verificarSesion, (req, res) => {
    const modulo = req.params.modulo;
    const archivo = path.join(__dirname, `../views/modulos/${modulo}`);
    res.sendFile(archivo);
});

router.get('/', (req, res) => {
    res.redirect('/login');
});

router.get('/api/perfiles', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM perfiles WHERE estado != 2 ORDER BY id_perfil'
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});


router.post('/api/perfiles', verificarSesion, async (req, res) => {
    const { nombre, descripcion } = req.body;
    const id_usuario = req.session.usuario.id;
    try {
        const existeActivo = await pool.query(
            'SELECT id_perfil FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND estado != 2',
            [nombre]
        );
        if (existeActivo.rows.length > 0)
            return res.json({ ok: false, mensaje: `Ya existe un perfil activo con el nombre "${nombre}"` });
        const eliminado = await pool.query(
            'SELECT id_perfil FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND estado = 2',
            [nombre]
        );
        if (eliminado.rows.length > 0) {
            await pool.query(
                `UPDATE perfiles
                 SET descripcion=$1, estado=1,
                     updated_at=NOW(), updated_by=$2,
                     deleted_at=NULL, deleted_by=NULL
                 WHERE id_perfil=$3`,
                [descripcion, id_usuario, eliminado.rows[0].id_perfil]
            );
            return res.json({ ok: true, mensaje: 'Perfil reactivado correctamente' });
        }
        await pool.query(
            'INSERT INTO perfiles (nombre, descripcion, estado, created_by) VALUES ($1, $2, 1, $3)',
            [nombre, descripcion, id_usuario]
        );
        res.json({ ok: true, mensaje: 'Perfil creado correctamente' });
    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: `Ya existe un perfil con el nombre "${nombre}"` });
        res.json({ ok: false, mensaje: error.message });
    }
});


router.put('/api/perfiles/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    try {
        const existe = await pool.query(
            'SELECT id_perfil FROM perfiles WHERE LOWER(nombre) = LOWER($1) AND id_perfil != $2',
            [nombre, id]
        );
        if (existe.rows.length > 0)
            return res.json({ ok: false, mensaje: `Ya existe un perfil con el nombre "${nombre}"` });

        await pool.query(
            'UPDATE perfiles SET nombre=$1, descripcion=$2, estado=$3 WHERE id_perfil=$4',
            [nombre, descripcion, estado, id]
        );
        res.json({ ok: true, mensaje: 'Perfil actualizado' });
    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: `Ya existe un perfil con el nombre "${nombre}"` });
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/perfiles/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const id_usuario = req.session.usuario.id;
    try {
        await pool.query(
            'UPDATE perfiles SET estado=2, deleted_at=NOW(), deleted_by=$1 WHERE id_perfil=$2',
            [id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Perfil eliminado' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/opciones', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM opciones WHERE deleted_at IS NULL ORDER BY nombre'
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/perfiles/:id/opciones', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(
            'SELECT id_opcion FROM perfiles_opciones WHERE id_perfil=$1 AND deleted_at IS NULL',
            [id]
        );
        res.json({ ok: true, data: resultado.rows.map(r => r.id_opcion) });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/perfiles/:id/opciones', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { opciones } = req.body;
    const id_usuario = req.session.usuario.id;
    try {
        await pool.query(
            'UPDATE perfiles_opciones SET deleted_at=NOW(), deleted_by=$1 WHERE id_perfil=$2',
            [id_usuario, id]
        );
        for (const id_opcion of opciones) {
            await pool.query(
                `INSERT INTO perfiles_opciones (id_perfil, id_opcion, created_by)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id_perfil, id_opcion) DO UPDATE
                 SET deleted_at=NULL, deleted_by=NULL, created_by=$3`,
                [id, id_opcion, id_usuario]
            );
        }
        res.json({ ok: true, mensaje: 'Permisos guardados' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/usuarios', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.fecha_registro,
             p.nombre AS perfil_nombre, p.id_perfil
             FROM usuarios u
             LEFT JOIN perfiles p ON p.id_perfil = u.id_perfil
             WHERE u.estado != 2
             ORDER BY u.id_usuario`
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});
router.post('/api/usuarios', verificarSesion, async (req, res) => {
    const { nombre, correo, contrasena, id_perfil, estado } = req.body;
    const id_usuario_sesion = req.session.usuario.id;
    try {
        const existeActivo = await pool.query(
            `SELECT id_usuario FROM usuarios 
             WHERE (LOWER(correo) = LOWER($1) OR LOWER(nombre) = LOWER($2)) AND estado != 2`,
            [correo, nombre]
        );
        if (existeActivo.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe un usuario activo con ese nombre o correo' });

        const { encriptar } = require('../utils/encriptar');
        const hash = await encriptar(contrasena);
        const eliminado = await pool.query(
            `SELECT id_usuario FROM usuarios 
             WHERE (LOWER(nombre) = LOWER($1) OR LOWER(correo) = LOWER($2)) AND estado = 2`,
            [nombre, correo]
        );
        if (eliminado.rows.length > 0) {
            await pool.query(
                `UPDATE usuarios
                 SET nombre=$1, correo=$2, contrasena=$3, id_perfil=$4, estado=$5,
                     updated_at=NOW(), updated_by=$6,
                     deleted_at=NULL, deleted_by=NULL
                 WHERE id_usuario=$7`,
                [nombre, correo, hash, id_perfil, estado ?? 1, id_usuario_sesion, eliminado.rows[0].id_usuario]
            );
            return res.json({ ok: true, mensaje: 'Usuario reactivado correctamente' });
        }
        await pool.query(
            `INSERT INTO usuarios (nombre, correo, contrasena, id_perfil, estado, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [nombre, correo, hash, id_perfil, estado ?? 1, id_usuario_sesion]
        );
        res.json({ ok: true, mensaje: 'Usuario creado correctamente' });

    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: 'El correo o nombre de usuario ya está en uso' });
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/usuarios/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, contrasena, id_perfil, estado } = req.body;
    const id_usuario_sesion = req.session.usuario.id; 
    try {
        const existe = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER($1) AND id_usuario != $2 AND estado != 2',
            [correo, id]
        );
        if (existe.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe un usuario con ese correo' });

        const existeNombre = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE LOWER(nombre) = LOWER($1) AND id_usuario != $2',
            [nombre, id]
        );
        if (existeNombre.rows.length > 0)
            return res.json({ ok: false, mensaje: `El nombre de usuario "${nombre}" ya está en uso` });

        if (contrasena && contrasena.trim() !== '') {
            const { encriptar } = require('../utils/encriptar');
            const hash = await encriptar(contrasena);
            await pool.query(
                `UPDATE usuarios
                 SET nombre=$1, correo=$2, contrasena=$3, id_perfil=$4, estado=$5,
                     updated_at=NOW(), updated_by=$6        
                 WHERE id_usuario=$7`,
                [nombre, correo, hash, id_perfil, estado, id_usuario_sesion, id]
            );
        } else {
            await pool.query(
                `UPDATE usuarios
                 SET nombre=$1, correo=$2, id_perfil=$3, estado=$4,
                     updated_at=NOW(), updated_by=$5        
                 WHERE id_usuario=$6`,
                [nombre, correo, id_perfil, estado, id_usuario_sesion, id]
            );
        }
        res.json({ ok: true, mensaje: 'Usuario actualizado correctamente' });
    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: 'El correo o nombre de usuario ya está en uso' });
        res.json({ ok: false, mensaje: error.message });
    }
});


router.delete('/api/usuarios/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const id_usuario_sesion = req.session.usuario.id; 
    try {
        await pool.query(
            `UPDATE usuarios
             SET estado=2, deleted_at=NOW(), deleted_by=$1
             WHERE id_usuario=$2`,
            [id_usuario_sesion, id]
        );
        res.json({ ok: true, mensaje: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/sesion', verificarSesion, (req, res) => {
    const u = req.session.usuario;
    res.json({
        ok: true,
        usuario: {
            id:            u.id,
            nombre:        u.nombre,
            perfil:        u.id_perfil,
            perfil_nombre: u.perfil_nombre  
        }
    });
});
router.get('/api/usuarios/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(
            `SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.id_perfil, u.fecha_registro,
                    p.nombre AS perfil_nombre
             FROM usuarios u
             LEFT JOIN perfiles p ON p.id_perfil = u.id_perfil
             WHERE u.id_usuario = $1 AND u.estado != 2`,
            [id]
        );
        if (!resultado.rows.length) return res.json({ ok: false, mensaje: 'Usuario no encontrado' });
        res.json({ ok: true, data: resultado.rows[0] });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/categorias', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id_categoria, nombre, descripcion, estado, fecha_registro
             FROM categorias
             WHERE estado != 2
             ORDER BY id_categoria`
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/categorias/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(
            `SELECT id_categoria, nombre, descripcion, estado, fecha_registro
             FROM categorias
             WHERE id_categoria = $1 AND estado != 2`,
            [id]
        );
        if (!resultado.rows.length)
            return res.json({ ok: false, mensaje: 'Categoría no encontrada' });
        res.json({ ok: true, data: resultado.rows[0] });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});


router.post('/api/categorias', verificarSesion, async (req, res) => {
    const { nombre, descripcion, estado } = req.body;
    const id_usuario = req.session.usuario.id;
    if (!nombre)
        return res.json({ ok: false, mensaje: 'El nombre es requerido' });
    try {
        const existeActivo = await pool.query(
            'SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER($1) AND estado != 2',
            [nombre]
        );
        if (existeActivo.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe una categoría activa con ese nombre' });
        const eliminado = await pool.query(
            'SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER($1) AND estado = 2',
            [nombre]
        );
        if (eliminado.rows.length > 0) {
            await pool.query(
                `UPDATE categorias
                 SET descripcion=$1, estado=$2,
                     updated_at=NOW(), updated_by=$3,
                     deleted_at=NULL, deleted_by=NULL
                 WHERE id_categoria=$4`,
                [descripcion || null, estado ?? 1, id_usuario, eliminado.rows[0].id_categoria]
            );
            return res.json({ ok: true, mensaje: 'Categoría reactivada correctamente' });
        }
        await pool.query(
            `INSERT INTO categorias (nombre, descripcion, estado, created_by)
             VALUES ($1, $2, $3, $4)`,
            [nombre, descripcion || null, estado ?? 1, id_usuario]
        );
        res.json({ ok: true, mensaje: 'Categoría creada correctamente' });
    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: `Ya existe una categoría con el nombre "${nombre}"` });
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/categorias/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    const id_usuario = req.session.usuario.id;
    if (!nombre)
        return res.json({ ok: false, mensaje: 'El nombre es requerido' });
    try {
        const existe = await pool.query(
        'SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER($1) AND id_categoria != $2',
        [nombre, id]
        );
        if (existe.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe una categoría con ese nombre' });
        await pool.query(
            `UPDATE categorias
             SET nombre = $1, descripcion = $2, estado = $3,
                 updated_at = NOW(), updated_by = $4
             WHERE id_categoria = $5`,
            [nombre, descripcion || null, estado ?? 1, id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Categoría actualizada correctamente' });
    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: 'Ya existe una categoría con ese nombre' });
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/categorias/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const id_usuario = req.session.usuario.id;
    try {
        await pool.query(
            `UPDATE categorias
             SET estado = 2, deleted_at = NOW(), deleted_by = $1
             WHERE id_categoria = $2`,
            [id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Categoría eliminada correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/productos', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT p.id_producto, p.nombre_producto, p.descripcion, p.precio_costo, p.precio_venta,
                    p.genero, p.estado, p.created_at,
                    c.nombre AS categoria_nombre,
                    co.nombre_colegio
             FROM productos p
             LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
             LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
             WHERE p.estado != 2
             ORDER BY p.id_producto`
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});



router.delete('/api/productos/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const id_usuario = req.session.usuario.id;
    try {
        await pool.query(
            `UPDATE productos
             SET estado=2, deleted_at=NOW(), deleted_by=$1
             WHERE id_producto=$2`,
            [id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});


router.post('/api/productos', verificarSesion, async (req, res) => {
    const { nombre_producto, descripcion, precio_costo, precio_venta, id_categoria, genero, id_colegio } = req.body;
    const id_usuario = req.session.usuario.id;
    if (!nombre_producto || !precio_costo || !precio_venta)
        return res.json({ ok: false, mensaje: 'Nombre y precios son requeridos' });
    try {
        const existeActivo = await pool.query(
            'SELECT id_producto FROM productos WHERE LOWER(nombre_producto) = LOWER($1) AND estado != 2',
            [nombre_producto]
        );
        if (existeActivo.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe un producto activo con ese nombre' });
        const eliminado = await pool.query(
            'SELECT id_producto FROM productos WHERE LOWER(nombre_producto) = LOWER($1) AND estado = 2',
            [nombre_producto]
        );
        if (eliminado.rows.length > 0) {
            await pool.query(
                `UPDATE productos
                 SET descripcion=$1, precio_costo=$2, precio_venta=$3, id_categoria=$4,
                     genero=$5, id_colegio=$6, estado=1,
                     updated_at=NOW(), updated_by=$7,
                     deleted_at=NULL, deleted_by=NULL
                 WHERE id_producto=$8`,
                [descripcion || null, precio_costo, precio_venta, id_categoria || null,
                 genero || null, id_colegio || null, id_usuario, eliminado.rows[0].id_producto]
            );
            return res.json({ ok: true, mensaje: 'Producto reactivado correctamente' });
        }
        await pool.query(
            `INSERT INTO productos
             (nombre_producto, descripcion, precio_costo, precio_venta, id_categoria, genero, id_colegio, estado, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
            [nombre_producto, descripcion || null, precio_costo, precio_venta,
             id_categoria || null, genero || null, id_colegio || null, id_usuario]
        );
        res.json({ ok: true, mensaje: 'Producto creado correctamente' });
    } catch (error) {
        if (error.code === '23505')
            return res.json({ ok: false, mensaje: 'Ya existe un producto con ese nombre' });
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/productos/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { nombre_producto, descripcion, precio_costo, precio_venta, id_categoria, genero, id_colegio, estado } = req.body;
    const id_usuario = req.session.usuario.id;
    if (!nombre_producto || !precio_costo || !precio_venta)
        return res.json({ ok: false, mensaje: 'Nombre y precio son requeridos' });
    try {
        const existe = await pool.query(
            'SELECT id_producto FROM productos WHERE LOWER(nombre_producto) = LOWER($1) AND id_producto != $2 AND estado != 2',
            [nombre_producto, id]
        );
        if (existe.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe un producto con ese nombre' });

      
    await pool.query(
        `UPDATE productos
        SET nombre_producto=$1, descripcion=$2, precio_costo=$3, precio_venta=$4, id_categoria=$5,
            genero=$6, id_colegio=$7, estado=$8,
            updated_at=NOW(), updated_by=$9
        WHERE id_producto=$10`,
        [nombre_producto, descripcion || null, precio_costo, precio_venta, id_categoria || null,
        genero || null, id_colegio || null, estado ?? 1, id_usuario, id]
    );
        res.json({ ok: true, mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
    if (error.code === '23505') {
        return res.json({ ok: false, mensaje: 'Ya existe un producto con ese nombre' });
    }
    res.json({ ok: false, mensaje: error.message });
}
});

router.get('/catalogo', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/modulos/catalogo.html')); 
});

router.get('/api/catalogo/productos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id_producto,
                p.nombre_producto,
                p.descripcion,
                p.precio_venta,
                p.precio_costo,
                p.genero,
                p.stock_minimo,
                p.estado,
                c.nombre AS categoria_nombre,
                co.nombre_colegio,
                -- Imágenes como array
                COALESCE(
                    (SELECT json_agg(ip.url_imagen ORDER BY ip.id_imagen)
                     FROM imagenes_producto ip
                     WHERE ip.id_producto = p.id_producto),
                    '[]'
                ) AS imagenes,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'id_variante', vp.id_variante,
                        'color', vp.color,
                        'stock', vp.stock,
                        'precio_extra', vp.precio_extra,
                        'talla', t.nombre_talla
                    ) ORDER BY vp.id_variante)
                     FROM variantes_producto vp
                     LEFT JOIN tallas t ON t.id_talla = vp.id_talla
                     WHERE vp.id_producto = p.id_producto),
                    '[]'
                ) AS variantes
            FROM productos p
            LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
            LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
            WHERE p.estado = 1
            ORDER BY co.nombre_colegio, p.nombre_producto
        `);
        res.json({ ok: true, data: result.rows });
    } catch (e) {
        res.json({ ok: false, mensaje: e.message });
    }
});

router.get('/api/productos/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(
            `SELECT p.*, c.nombre AS categoria_nombre
             FROM productos p
             LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
             WHERE p.id_producto = $1 AND p.estado != 2`,
            [id]
        );
        if (!resultado.rows.length)
            return res.json({ ok: false, mensaje: 'Producto no encontrado' });
        res.json({ ok: true, data: resultado.rows[0] });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/catalogo/categorias', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT id_categoria, nombre FROM categorias WHERE estado = 1 ORDER BY nombre'
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/catalogo/slider', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT imagen_url AS url_imagen, titulo
            FROM sliders
            WHERE activo = true
            ORDER BY orden ASC, id_slider DESC
            LIMIT 10
        `);
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: true, data: [] });
    }
});

router.get('/api/reniec/:dni', verificarSesion, async (req, res) => {
    const { dni } = req.params;
    if (!/^\d{8}$/.test(dni))
        return res.json({ ok: false, mensaje: 'DNI debe tener 8 dígitos' });
    try {
        const resp = await fetch(`https://api.apis.net.pe/v2/reniec/dni?numero=${dni}`, {
            headers: { Authorization: `Bearer ${process.env.API_RENIEC}` }
        });
        const data = await resp.json();
        if (!data.nombreCompleto)
            return res.json({ ok: false, mensaje: 'DNI no encontrado en RENIEC' });
        res.json({
            ok: true,
            nombres: data.nombres,
            apellidos: `${data.apellidoPaterno} ${data.apellidoMaterno}`.trim()
        });
    } catch (e) {
        res.json({ ok: false, mensaje: 'Error consultando RENIEC' });
    }
});

router.get('/api/clientes', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id_cliente, nombres, apellidos, dni, telefono, correo, estado, fecha_registro
             FROM clientes
             WHERE estado != 2
             ORDER BY id_cliente`
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/clientes/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(
            `SELECT id_cliente, nombres, apellidos, dni, telefono, correo, estado, fecha_registro
             FROM clientes WHERE id_cliente = $1 AND estado != 2`,
            [id]
        );
        if (!resultado.rows.length) return res.json({ ok: false, mensaje: 'Cliente no encontrado' });
        res.json({ ok: true, data: resultado.rows[0] });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/clientes/:id/historial', verificarSesion, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query(
            `SELECT v.numero_venta, v.fecha_venta, v.tipo_documento, v.total,
                    pa.metodo_pago, pa.estado AS estado_pago,
                    p.estado AS estado_pedido, p.codigo_seguimiento
             FROM ventas v
             INNER JOIN pedidos p ON p.id_pedido = v.id_pedido
             LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido
             WHERE v.id_cliente = $1
             ORDER BY v.fecha_venta DESC`,
            [id]
        );
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/clientes', verificarSesion, async (req, res) => {
    const { nombres, apellidos, dni, telefono, correo } = req.body;
    const id_usuario = req.session.usuario.id;
    if (!nombres) return res.json({ ok: false, mensaje: 'El nombre es requerido' });
    try {
        const eliminadoQuery = dni ? await pool.query(
            `SELECT id_cliente FROM clientes 
             WHERE (dni = $1 OR (LOWER(nombres) = LOWER($2) AND LOWER(apellidos) = LOWER($3)))
             AND estado = 2 LIMIT 1`,
            [dni, nombres, apellidos || '']
        ) : await pool.query(
            `SELECT id_cliente FROM clientes 
             WHERE LOWER(nombres) = LOWER($1) AND LOWER(apellidos) = LOWER($2)
             AND estado = 2 LIMIT 1`,
            [nombres, apellidos || '']
        );
        
        if (eliminadoQuery.rows.length > 0) {
            await pool.query(
                `UPDATE clientes SET nombres=$1, apellidos=$2, dni=$3, telefono=$4, correo=$5, estado=1,
                 updated_at=NOW(), updated_by=$6, deleted_at=NULL, deleted_by=NULL
                 WHERE id_cliente=$7`,
                [nombres, apellidos || null, dni || null, telefono || null, correo || null, id_usuario, eliminadoQuery.rows[0].id_cliente]
            );
            return res.json({ ok: true, mensaje: 'Cliente reactivado correctamente' });
        }
        if (dni) {
            const dniActivo = await pool.query(
                `SELECT id_cliente FROM clientes WHERE dni = $1 AND estado != 2`, [dni]
            );
            if (dniActivo.rows.length > 0)
                return res.json({ ok: false, mensaje: 'Ya existe un cliente activo con ese DNI' });
        }
        const nombreActivo = await pool.query(
            `SELECT id_cliente FROM clientes 
             WHERE LOWER(nombres) = LOWER($1) AND LOWER(apellidos) = LOWER($2) AND estado != 2`,
            [nombres, apellidos || '']
        );
        if (nombreActivo.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe un cliente activo con ese nombre y apellidos' });

        if (telefono) {
            const telActivo = await pool.query(
                'SELECT id_cliente FROM clientes WHERE telefono = $1 AND estado != 2', [telefono]
            );
            if (telActivo.rows.length > 0)
                return res.json({ ok: false, mensaje: 'Ya existe un cliente activo con ese teléfono' });
        }
        if (correo) {
            const correoActivo = await pool.query(
                'SELECT id_cliente FROM clientes WHERE LOWER(correo) = LOWER($1) AND estado != 2', [correo]
            );
            if (correoActivo.rows.length > 0)
                return res.json({ ok: false, mensaje: 'Ya existe un cliente activo con ese correo' });
        }

        await pool.query(
            `INSERT INTO clientes (nombres, apellidos, dni, telefono, correo, estado, created_by)
             VALUES ($1, $2, $3, $4, $5, 1, $6)`,
            [nombres, apellidos || null, dni || null, telefono || null, correo || null, id_usuario]
        );
        res.json({ ok: true, mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/clientes/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, dni, telefono, correo, estado } = req.body;
    const id_usuario = req.session.usuario.id;
    if (!nombres) return res.json({ ok: false, mensaje: 'El nombre es requerido' });
    try {
        if (dni) {
            const dniExiste = await pool.query(
                'SELECT id_cliente FROM clientes WHERE dni = $1 AND estado != 2 AND id_cliente != $2', [dni, id]
            );
            if (dniExiste.rows.length > 0)
                return res.json({ ok: false, mensaje: 'Ya existe otro cliente con ese DNI' });
        }
        if (telefono) {
            const telExiste = await pool.query(
                'SELECT id_cliente FROM clientes WHERE telefono = $1 AND estado != 2 AND id_cliente != $2', [telefono, id]
            );
            if (telExiste.rows.length > 0)
                return res.json({ ok: false, mensaje: 'Ya existe otro cliente con ese teléfono' });
        }
        if (correo) {
            const correoExiste = await pool.query(
                'SELECT id_cliente FROM clientes WHERE LOWER(correo) = LOWER($1) AND estado != 2 AND id_cliente != $2', [correo, id]
            );
            if (correoExiste.rows.length > 0)
                return res.json({ ok: false, mensaje: 'Ya existe otro cliente con ese correo' });
        }
        await pool.query(
            `UPDATE clientes SET nombres=$1, apellidos=$2, dni=$3, telefono=$4, correo=$5,
             estado=$6, updated_at=NOW(), updated_by=$7 WHERE id_cliente=$8`,
            [nombres, apellidos || null, dni || null, telefono || null, correo || null, estado ?? 1, id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/clientes/:id/direcciones', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id_direccion, direccion, distrito, referencia, direcc_principal
             FROM direcciones_cliente WHERE id_cliente = $1 ORDER BY direcc_principal DESC, id_direccion`,
            [req.params.id]
        );
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.post('/api/clientes/:id/direcciones', verificarSesion, async (req, res) => {
    const { direccion, distrito, referencia, direcc_principal } = req.body;
    if (!direccion) return res.json({ ok: false, mensaje: 'La dirección es requerida' });
    try {
        if (direcc_principal) {
            await pool.query(
                'UPDATE direcciones_cliente SET direcc_principal=false WHERE id_cliente=$1',
                [req.params.id]
            );
        }
        await pool.query(
            `INSERT INTO direcciones_cliente (id_cliente, direccion, distrito, referencia, direcc_principal)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.params.id, direccion, distrito || '', referencia || '', direcc_principal || false]
        );
        res.json({ ok: true, mensaje: 'Dirección agregada correctamente' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.delete('/api/clientes/:id/direcciones/:idDir', verificarSesion, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM direcciones_cliente WHERE id_direccion=$1 AND id_cliente=$2',
            [req.params.idDir, req.params.id]
        );
        res.json({ ok: true, mensaje: 'Dirección eliminada' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.delete('/api/clientes/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const id_usuario = req.session.usuario.id;
    try {
        await pool.query(
            `UPDATE clientes SET estado=2, deleted_at=NOW(), deleted_by=$1 WHERE id_cliente=$2`,
            [id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/gestion-tienda/logos', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT id_recurso, tipo, nombre_archivo, url, activo, creado_en
            FROM recursos_tienda
            WHERE tipo = 'logo'
            ORDER BY id_recurso DESC
        `);

        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/gestion-tienda/logo', verificarSesion, async (req, res) => {
    const { tipo, nombre_archivo, url, activo } = req.body;

    try {
        if (!url) {
            return res.json({ ok: false, mensaje: 'La URL es requerida' });
        }

        const resultado = await pool.query(`
            INSERT INTO recursos_tienda (tipo, nombre_archivo, url, activo)
            VALUES ($1, $2, $3, $4)
            RETURNING id_recurso, tipo, nombre_archivo, url, activo, creado_en
        `, [
            tipo || 'logo',
            nombre_archivo || null,
            url,
            activo ?? true
        ]);

        res.json({
            ok: true,
            mensaje: 'Logo guardado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.patch('/api/gestion-tienda/logo/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;

    try {
        await pool.query(`
            UPDATE recursos_tienda
            SET activo = $1
            WHERE id_recurso = $2 AND tipo = 'logo'
        `, [activo, id]);

        res.json({ ok: true, mensaje: 'Estado del logo actualizado' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/gestion-tienda/logo/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(`
            DELETE FROM recursos_tienda
            WHERE id_recurso = $1 AND tipo = 'logo'
        `, [id]);

        res.json({ ok: true, mensaje: 'Logo eliminado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});


router.get('/api/gestion-tienda/sliders', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT id_slider, imagen_url, nombre_archivo, titulo, orden, activo, creado_en
            FROM sliders
            ORDER BY orden ASC, id_slider DESC
        `);

        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/gestion-tienda/sliders', verificarSesion, async (req, res) => {
    const { imagen_url, nombre_archivo, titulo, orden, activo } = req.body;

    try {
        if (!imagen_url) {
            return res.json({ ok: false, mensaje: 'La imagen es requerida' });
        }

        const resultado = await pool.query(`
            INSERT INTO sliders (imagen_url, nombre_archivo, titulo, orden, activo)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_slider, imagen_url, nombre_archivo, titulo, orden, activo, creado_en
        `, [
            imagen_url,
            nombre_archivo || null,
            titulo || null,
            orden ?? 0,
            activo ?? true
        ]);

        res.json({
            ok: true,
            mensaje: 'Slider guardado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/gestion-tienda/sliders/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { imagen_url, nombre_archivo, titulo, orden, activo } = req.body;

    try {
        const resultado = await pool.query(`
            UPDATE sliders
            SET imagen_url = $1,
                nombre_archivo = $2,
                titulo = $3,
                orden = $4,
                activo = $5
            WHERE id_slider = $6
            RETURNING id_slider, imagen_url, nombre_archivo, titulo, orden, activo, creado_en
        `, [
            imagen_url,
            nombre_archivo || null,
            titulo || null,
            orden ?? 0,
            activo ?? true,
            id
        ]);

        res.json({
            ok: true,
            mensaje: 'Slider actualizado correctamente',
            data: resultado.rows[0] || null
        });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.patch('/api/gestion-tienda/sliders/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;

    try {
        await pool.query(`
            UPDATE sliders
            SET activo = $1
            WHERE id_slider = $2
        `, [activo, id]);

        res.json({ ok: true, mensaje: 'Estado del slider actualizado' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/gestion-tienda/sliders/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(`
            DELETE FROM sliders
            WHERE id_slider = $1
        `, [id]);

        res.json({ ok: true, mensaje: 'Slider eliminado correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.get('/api/gestion-tienda/redes', verificarSesion, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT id_recurso, tipo, nombre_archivo, url, activo, creado_en
            FROM recursos_tienda
            WHERE tipo IN ('facebook', 'instagram', 'tiktok', 'whatsapp', 'youtube', 'telegram', 'otro')
            ORDER BY id_recurso DESC
        `);

        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.post('/api/gestion-tienda/redes', verificarSesion, async (req, res) => {
    const { tipo, nombre_archivo, url, activo } = req.body;

    try {
        if (!tipo || !url) {
            return res.json({ ok: false, mensaje: 'Tipo y URL son requeridos' });
        }

        const resultado = await pool.query(`
            INSERT INTO recursos_tienda (tipo, nombre_archivo, url, activo)
            VALUES ($1, $2, $3, $4)
            RETURNING id_recurso, tipo, nombre_archivo, url, activo, creado_en
        `, [
            tipo,
            nombre_archivo || null,
            url,
            activo ?? true
        ]);

        res.json({
            ok: true,
            mensaje: 'Red social guardada correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.put('/api/gestion-tienda/redes/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { tipo, nombre_archivo, url, activo } = req.body;

    try {
        const resultado = await pool.query(`
            UPDATE recursos_tienda
            SET tipo = $1,
                nombre_archivo = $2,
                url = $3,
                activo = $4
            WHERE id_recurso = $5
            RETURNING id_recurso, tipo, nombre_archivo, url, activo, creado_en
        `, [
            tipo,
            nombre_archivo || null,
            url,
            activo ?? true,
            id
        ]);

        res.json({
            ok: true,
            mensaje: 'Red social actualizada correctamente',
            data: resultado.rows[0] || null
        });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.patch('/api/gestion-tienda/redes/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;

    try {
        await pool.query(`
            UPDATE recursos_tienda
            SET activo = $1
            WHERE id_recurso = $2
        `, [activo, id]);

        res.json({ ok: true, mensaje: 'Estado de la red actualizado' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

router.delete('/api/gestion-tienda/redes/:id', verificarSesion, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(`
            DELETE FROM recursos_tienda
            WHERE id_recurso = $1
        `, [id]);

        res.json({ ok: true, mensaje: 'Red social eliminada correctamente' });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});


router.post('/api/upload/logo', verificarSesion, (req, res) => {
    uploadLogo.single('imagen')(req, res, function (error) {
        if (error) {
            return res.json({ ok: false, mensaje: error.message });
        }

        if (!req.file) {
            return res.json({ ok: false, mensaje: 'No se recibió ninguna imagen' });
        }

        return res.json({
            ok: true,
            mensaje: 'Logo subido correctamente',
            data: {
                nombre_archivo: req.file.filename,
                url: `/uploads/logos/${req.file.filename}`
            }
        });
    });
});

router.post('/api/upload/slider', verificarSesion, (req, res) => {
    uploadSlider.single('imagen')(req, res, function (error) {
        if (error) {
            return res.json({ ok: false, mensaje: error.message });
        }

        if (!req.file) {
            return res.json({ ok: false, mensaje: 'No se recibió ninguna imagen' });
        }

        return res.json({
            ok: true,
            mensaje: 'Slider subido correctamente',
            data: {
                nombre_archivo: req.file.filename,
                url: `/uploads/sliders/${req.file.filename}`
            }
        });
    });

});


router.put('/api/gestion-tienda/logos/:id/estado', async (req, res) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);
        const { activo } = req.body;

        await client.query('BEGIN');

        if (activo === true) {
            await client.query(`
                UPDATE recursos_tienda
                SET activo = false
                WHERE tipo = 'logo'
            `);

            await client.query(`
                UPDATE recursos_tienda
                SET activo = true
                WHERE id_recurso = $1 AND tipo = 'logo'
            `, [id]);
        } else {
            await client.query(`
                UPDATE recursos_tienda
                SET activo = false
                WHERE id_recurso = $1 AND tipo = 'logo'
            `, [id]);
        }

        await client.query('COMMIT');
        res.json({ ok: true, msg: 'Estado actualizado' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ ok: false, msg: 'Error al actualizar estado' });
    } finally {
        client.release();
    }
});

router.get('/api/productos/:id/imagenes', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM imagenes_producto WHERE id_producto = $1 ORDER BY id_imagen',
            [req.params.id]
        );
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.post('/api/productos/:id/imagenes', verificarSesion, async (req, res) => {
    const { url_imagen } = req.body;
    if (!url_imagen) return res.json({ ok: false, mensaje: 'URL requerida' });
    try {
        await pool.query(
            'INSERT INTO imagenes_producto (id_producto, url_imagen) VALUES ($1, $2)',
            [req.params.id, url_imagen]
        );
        res.json({ ok: true, mensaje: 'Imagen agregada' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.delete('/api/imagenes/:id', verificarSesion, async (req, res) => {
    try {
        await pool.query('DELETE FROM imagenes_producto WHERE id_imagen = $1', [req.params.id]);
        res.json({ ok: true, mensaje: 'Imagen eliminada' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/dashboard/stats', verificarSesion, async (req, res) => {
    try {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        const [diaRes, mesRes, cobrarRes, pedidosRes, pagosRes] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(total),0) AS total FROM ventas WHERE DATE(fecha_venta) = CURRENT_DATE`),
            pool.query(`SELECT COALESCE(SUM(total),0) AS total FROM ventas WHERE fecha_venta >= $1`, [inicioMes]),
            pool.query(`SELECT COALESCE(SUM(p.total),0) AS total FROM pedidos p LEFT JOIN pagos pa ON pa.id_pedido = p.id_pedido WHERE pa.estado = 'pendiente' OR pa.id_pago IS NULL`),
            pool.query(`SELECT COUNT(*) AS total FROM pedidos WHERE estado IN ('pendiente','procesando')`),
            pool.query(`SELECT
                COUNT(*) FILTER (WHERE pa.estado='pendiente') AS pendientes,
                COUNT(*) FILTER (WHERE pa.estado='pagado') AS verificados,
                COUNT(*) FILTER (WHERE pa.estado='rechazado') AS rechazados,
                COALESCE(SUM(pa.monto) FILTER (WHERE pa.estado='pendiente'),0) AS monto_pend
                FROM pagos pa`)
        ]);

        const pag = pagosRes.rows[0];
        res.json({
            ok: true,
            venta_dia: diaRes.rows[0].total,
            venta_mes: mesRes.rows[0].total,
            por_cobrar: cobrarRes.rows[0].total,
            pedidos_activos: pedidosRes.rows[0].total,
            pagos_pendientes: pag.pendientes,
            pagos_verificados: pag.verificados,
            pagos_rechazados: pag.rechazados,
            monto_pendiente: pag.monto_pend
        });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/dashboard/grafico', verificarSesion, async (req, res) => {
    const { anio = new Date().getFullYear(), periodo = 'mensual' } = req.query;
    try {
        const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        if (periodo === 'mensual') {
            const result = await pool.query(`
                SELECT
                    EXTRACT(MONTH FROM fecha_venta)::int AS mes,
                    COALESCE(SUM(total),0) AS vendido,
                    COALESCE(SUM(CASE WHEN tipo_documento='credito' THEN total ELSE 0 END),0) AS credito
                FROM ventas
                WHERE EXTRACT(YEAR FROM fecha_venta) = $1
                GROUP BY mes ORDER BY mes`, [anio]);

            const cobradoRes = await pool.query(`
                SELECT EXTRACT(MONTH FROM pa.fecha_pago)::int AS mes, COALESCE(SUM(pa.monto),0) AS cobrado
                FROM pagos pa WHERE pa.estado='pagado' AND EXTRACT(YEAR FROM pa.fecha_pago) = $1
                GROUP BY mes ORDER BY mes`, [anio]);

            const vendido = Array(12).fill(0);
            const credito = Array(12).fill(0);
            const cobrado = Array(12).fill(0);
            result.rows.forEach(r => { vendido[r.mes-1] = parseFloat(r.vendido); credito[r.mes-1] = parseFloat(r.credito); });
            cobradoRes.rows.forEach(r => { cobrado[r.mes-1] = parseFloat(r.cobrado); });

            res.json({ ok: true, labels: MESES, vendido, credito, cobrado });
        } else {
            const result = await pool.query(`
                SELECT
                    EXTRACT(DOW FROM fecha_venta)::int AS dia,
                    COALESCE(SUM(total),0) AS vendido
                FROM ventas
                WHERE fecha_venta >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY dia ORDER BY dia`);

            const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            const vendido = Array(7).fill(0);
            result.rows.forEach(r => { vendido[r.dia] = parseFloat(r.vendido); });
            res.json({ ok: true, labels: dias, vendido, credito: Array(7).fill(0), cobrado: Array(7).fill(0) });
        }
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/dashboard/stock-critico', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.nombre_producto, p.stock_minimo,
                   COALESCE(SUM(vp.stock),0)::int AS stock
            FROM productos p
            LEFT JOIN variantes_producto vp ON vp.id_producto = p.id_producto
            WHERE p.estado = 1
            GROUP BY p.id_producto, p.nombre_producto, p.stock_minimo
            HAVING COALESCE(SUM(vp.stock),0) < p.stock_minimo
            ORDER BY stock ASC LIMIT 8`);
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/dashboard/pedidos-recientes', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id_pedido, p.codigo_seguimiento, p.estado, p.total, p.fecha_pedido,
                   CONCAT(c.nombres,' ',c.apellidos) AS cliente
            FROM pedidos p
            JOIN clientes c ON c.id_cliente = p.id_cliente
            ORDER BY p.fecha_pedido DESC LIMIT 10`);
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/dashboard/top-productos', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.nombre_producto, co.nombre_colegio,
                   COALESCE(SUM(dp.subtotal),0) AS total_vendido
            FROM detalle_pedido dp
            JOIN productos p ON p.id_producto = dp.id_producto
            LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
            GROUP BY p.id_producto, p.nombre_producto, co.nombre_colegio
            ORDER BY total_vendido DESC LIMIT 5`);
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/colegios', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM colegios ORDER BY id_colegio');
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.post('/api/colegios', verificarSesion, async (req, res) => {
    const { nombre_colegio, distrito, provincia } = req.body;
    if (!nombre_colegio) return res.json({ ok: false, mensaje: 'Nombre requerido' });
    try {
        await pool.query(
            'INSERT INTO colegios (nombre_colegio, distrito, provincia) VALUES ($1, $2, $3)',
            [nombre_colegio, distrito || 'Chiclayo', provincia || 'Chiclayo']
        );
        res.json({ ok: true, mensaje: 'Colegio creado correctamente' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.put('/api/colegios/:id', verificarSesion, async (req, res) => {
    const { nombre_colegio, distrito, provincia } = req.body;
    try {
        await pool.query(
            'UPDATE colegios SET nombre_colegio=$1, distrito=$2, provincia=$3, fecha_actualizacion=NOW() WHERE id_colegio=$4',
            [nombre_colegio, distrito, provincia, req.params.id]
        );
        res.json({ ok: true, mensaje: 'Colegio actualizado correctamente' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.delete('/api/colegios/:id', verificarSesion, async (req, res) => {
    try {
        await pool.query('DELETE FROM colegios WHERE id_colegio=$1', [req.params.id]);
        res.json({ ok: true, mensaje: 'Colegio eliminado correctamente' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/gestion-tienda/logo-publico', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT url FROM recursos_tienda
            WHERE tipo = 'logo' AND activo = true
            ORDER BY id_recurso DESC LIMIT 1
        `);
        if (resultado.rows.length) {
            res.json({ ok: true, url: resultado.rows[0].url });
        } else {
            res.json({ ok: false });
        }
    } catch (error) {
        res.json({ ok: false });
    }
});

router.get('/api/gestion-tienda/redes-publicas', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT tipo, url, activo FROM recursos_tienda
            WHERE tipo IN ('facebook','instagram','tiktok','whatsapp','youtube','telegram','otro')
            AND activo = true
            ORDER BY id_recurso
        `);
        res.json({ ok: true, data: resultado.rows });
    } catch (error) {
        res.json({ ok: false, mensaje: error.message });
    }
});

module.exports = router;