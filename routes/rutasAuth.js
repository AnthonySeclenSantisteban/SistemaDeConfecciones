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
router.get('/api/mis-opciones', verificarSesion, async (req, res) => {
    try {
        const opcionesRes = await pool.query(
            `SELECT o.ruta FROM opciones o
             INNER JOIN perfiles_opciones po ON po.id_opcion = o.id_opcion
             WHERE po.id_perfil = $1 AND po.deleted_at IS NULL`,
            [req.session.usuario.id_perfil]
        );
        res.json({ ok: true, opciones: opcionesRes.rows.map(o => o.ruta) });
    } catch (error) {
        console.error('GET /api/mis-opciones:', error);
        res.json({ ok: true, opciones: req.session.usuario.opciones || [] });
    }
});

router.get('/dashboard', verificarSesion, (req, res) => {
    res.sendFile(require('path').join(__dirname, '../views/dashboard.html'));
});



router.get('/vistas/modulos/:modulo', verificarSesion, (req, res) => {
    const nombreModulo = path.basename(req.params.modulo);
    const carpetaBase = path.join(__dirname, '../views/modulos');
    const archivo = path.join(carpetaBase, nombreModulo);

    if (!archivo.startsWith(carpetaBase + path.sep)) {
        return res.status(400).send('Ruta inválida');
    }

    res.sendFile(archivo, (err) => {
        if (err) res.status(404).send('Módulo no encontrado');
    });
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
                    deleted_at=NULL, deleted_by=NULL
                WHERE id_perfil=$2`,
                [descripcion, eliminado.rows[0].id_perfil]
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
        const perfilRes = await pool.query(
            'SELECT nombre FROM perfiles WHERE id_perfil = $1', [id]
        );
        if (!perfilRes.rows.length)
            return res.json({ ok: false, mensaje: 'Perfil no encontrado' });

        if (perfilRes.rows[0].nombre.toLowerCase() === 'administrador')
            return res.json({ ok: false, mensaje: 'No se puede eliminar el perfil Administrador' });

        const usuariosVinculados = await pool.query(
            'SELECT COUNT(*) FROM usuarios WHERE id_perfil = $1 AND estado != 2', [id]
        );
        if (parseInt(usuariosVinculados.rows[0].count) > 0)
            return res.json({ ok: false, mensaje: `Este perfil tiene ${usuariosVinculados.rows[0].count} usuario(s) activo(s) vinculado(s). Primero desvincula o elimina esos usuarios.` });

        await pool.query(
            'UPDATE perfiles SET estado=2, deleted_at=NOW(), deleted_by=$1 WHERE id_perfil=$2',
            [id_usuario, id]
        );
        res.json({ ok: true, mensaje: 'Perfil eliminado correctamente' });
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
        const categoriaRes = await pool.query(
            'SELECT nombre, estado FROM categorias WHERE id_categoria = $1', [id]
        );
        if (!categoriaRes.rows.length)
            return res.json({ ok: false, mensaje: 'Categoría no encontrada' });

        if (categoriaRes.rows[0].estado === 1)
            return res.json({ ok: false, mensaje: 'Debes desactivar la categoría antes de eliminarla' });

        const productosVinculados = await pool.query(
            'SELECT COUNT(*) FROM productos WHERE id_categoria = $1 AND estado != 2', [id]
        );
        if (parseInt(productosVinculados.rows[0].count) > 0)
            return res.json({ ok: false, mensaje: `Esta categoría tiene ${productosVinculados.rows[0].count} producto(s) vinculado(s). Primero elimina o reasigna esos productos.` });

        await pool.query(
            `UPDATE categorias SET estado = 2, deleted_at = NOW(), deleted_by = $1 WHERE id_categoria = $2`,
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
                    co.nombre_colegio,
                    LEAST(p.precio_venta, COALESCE(MIN(ptc.precio_venta), p.precio_venta)) AS precio_venta_min,
                    GREATEST(p.precio_venta, COALESCE(MAX(ptc.precio_venta), p.precio_venta)) AS precio_venta_max,
                    LEAST(p.precio_costo, COALESCE(MIN(ptc.precio_costo), p.precio_costo)) AS precio_costo_min,
                    GREATEST(p.precio_costo, COALESCE(MAX(ptc.precio_costo), p.precio_costo)) AS precio_costo_max,
                    (COUNT(ptc.id_producto_talla_costo) > 0) AS tiene_precios_por_talla
             FROM productos p
             LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
             LEFT JOIN colegios co ON co.id_colegio = p.id_colegio
             LEFT JOIN producto_talla_costo ptc ON ptc.id_producto = p.id_producto
             WHERE p.estado != 2
             GROUP BY p.id_producto, c.nombre, co.nombre_colegio
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
                COALESCE(
                    (SELECT json_agg(ip.url_imagen ORDER BY ip.id_imagen)
                     FROM imagenes_producto ip
                     WHERE ip.id_producto = p.id_producto),
                    '[]'
                ) AS imagenes,
                COALESCE(
                    (SELECT json_object_agg(sub.color_key, sub.urls)
                     FROM (
                        SELECT LOWER(TRIM(ip.color)) AS color_key, json_agg(ip.url_imagen ORDER BY ip.id_imagen) AS urls
                        FROM imagenes_producto ip
                        WHERE ip.id_producto = p.id_producto AND ip.color IS NOT NULL AND TRIM(ip.color) != ''
                        GROUP BY LOWER(TRIM(ip.color))
                     ) sub),
                    '{}'
                ) AS imagenes_color,
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
              AND EXISTS (
                  SELECT 1 FROM variantes_producto vp WHERE vp.id_producto = p.id_producto
              )
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
        const local = await pool.query(
            `SELECT nombres, apellidos FROM clientes WHERE dni = $1 AND estado != 2 LIMIT 1`,
            [dni]
        );
        if (local.rows.length) {
            const c = local.rows[0];
            return res.json({
                ok: true,
                nombre:    `${c.nombres} ${c.apellidos || ''}`.trim(),
                nombres:   c.nombres,
                apellidos: c.apellidos || '',
                fuente:    'local'
            });
        }
        const resp = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
            headers: {
                Authorization: `Bearer ${process.env.API_RENIEC}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        console.log('RENIEC Decolecta response:', JSON.stringify(data));
        if (!resp.ok || (!data.full_name && !data.first_name))
            return res.json({ ok: false, mensaje: 'DNI no encontrado en RENIEC' });
        const nombres   = data.first_name || '';
        const apellidos = `${data.first_last_name || ''} ${data.second_last_name || ''}`.trim();

        res.json({
            ok: true,
            nombre:    data.full_name || `${nombres} ${apellidos}`.trim(),
            nombres,
            apellidos,
            fuente:    'reniec'
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
        const pedidosVinculados = await pool.query(
            'SELECT COUNT(*) FROM pedidos WHERE id_direccion = $1', [req.params.idDir]
        );
        if (parseInt(pedidosVinculados.rows[0].count) > 0)
            return res.json({ ok: false, mensaje: `Esta dirección está vinculada a ${pedidosVinculados.rows[0].count} pedido(s) y no puede eliminarse.` });

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
    const { url_imagen, color } = req.body;
    if (!url_imagen) return res.json({ ok: false, mensaje: 'URL requerida' });
    try {
        await pool.query(
            'INSERT INTO imagenes_producto (id_producto, url_imagen, color) VALUES ($1, $2, $3)',
            [req.params.id, url_imagen, color || null]
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

router.get('/api/tallas', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query('SELECT id_talla, nombre_talla FROM tallas ORDER BY id_talla');
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/productos/:id/variantes', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT vp.id_variante, vp.id_talla, vp.color, t.nombre_talla, vp.stock
            FROM variantes_producto vp
            LEFT JOIN tallas t ON t.id_talla = vp.id_talla
            WHERE vp.id_producto = $1
            ORDER BY vp.color, t.id_talla
        `, [req.params.id]);
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.post('/api/productos/:id/variantes', verificarSesion, async (req, res) => {
    const { color, id_tallas } = req.body;
    if (!color || !Array.isArray(id_tallas) || id_tallas.length === 0) {
        return res.json({ ok: false, mensaje: 'El color y al menos una talla son requeridos' });
    }
    try {
        let creadas = 0;
        for (const idTalla of id_tallas) {
            const r = await pool.query(
                `INSERT INTO variantes_producto (id_producto, id_talla, color, stock, precio_extra)
                 VALUES ($1, $2, $3, 0, 0)
                 ON CONFLICT (id_producto, id_talla, color) DO NOTHING
                 RETURNING id_variante`,
                [req.params.id, idTalla, color.trim()]
            );
            if (r.rows.length) creadas++;
        }
        res.json({ ok: true, mensaje: `${creadas} talla${creadas !== 1 ? 's' : ''} agregada${creadas !== 1 ? 's' : ''} para "${color.trim()}"` });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.put('/api/productos/:id/variantes/:color', verificarSesion, async (req, res) => {
    const { id, color } = req.params;
    const { id_tallas } = req.body;
    if (!Array.isArray(id_tallas)) {
        return res.json({ ok: false, mensaje: 'Lista de tallas inválida' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const actuales = await client.query(
            `SELECT vp.id_variante, vp.id_talla, vp.stock, vp.color, t.nombre_talla
             FROM variantes_producto vp
             LEFT JOIN tallas t ON t.id_talla = vp.id_talla
             WHERE vp.id_producto = $1 AND LOWER(TRIM(vp.color)) = LOWER(TRIM($2))`,
            [id, color]
        );
        if (!actuales.rows.length) {
            await client.query('ROLLBACK');
            return res.json({ ok: false, mensaje: 'Ese color no existe para este producto' });
        }
        const nombreColorOriginal = actuales.rows[0].color || color;
        const idTallasNuevas = id_tallas.map(t => parseInt(t));
        const aQuitar = actuales.rows.filter(r => !idTallasNuevas.includes(r.id_talla));
        const aAgregar = idTallasNuevas.filter(idT => !actuales.rows.some(r => r.id_talla === idT));
        const bloqueadas = aQuitar.filter(r => Number(r.stock) > 0);
        if (bloqueadas.length) {
            await client.query('ROLLBACK');
            const nombres = bloqueadas.map(b => b.nombre_talla).join(', ');
            return res.json({
                ok: false,
                mensaje: `No puedes desmarcar la talla ${nombres} porque todavía tiene stock. Primero descarga el stock desde Inventario.`
            });
        }
        for (const r of aQuitar) {
            await client.query('DELETE FROM variantes_producto WHERE id_variante = $1', [r.id_variante]);
        }
        for (const idT of aAgregar) {
            await client.query(
                `INSERT INTO variantes_producto (id_producto, id_talla, color, stock, precio_extra)
                 VALUES ($1, $2, $3, 0, 0)
                 ON CONFLICT (id_producto, id_talla, color) DO NOTHING`,
                [id, idT, nombreColorOriginal]
            );
        }
        await client.query('COMMIT');
        res.json({ ok: true, mensaje: `Tallas de "${nombreColorOriginal}" actualizadas` });
    } catch (e) {
        await client.query('ROLLBACK');
        res.json({ ok: false, mensaje: e.message });
    } finally {
        client.release();
    }
});

router.delete('/api/productos/:id/variantes/:color', verificarSesion, async (req, res) => {
    const { id, color } = req.params;
    try {
        const actuales = await pool.query(
            `SELECT vp.id_variante, vp.stock, t.nombre_talla
             FROM variantes_producto vp
             LEFT JOIN tallas t ON t.id_talla = vp.id_talla
             WHERE vp.id_producto = $1 AND LOWER(TRIM(vp.color)) = LOWER(TRIM($2))`,
            [id, color]
        );
        if (!actuales.rows.length) {
            return res.json({ ok: false, mensaje: 'Ese color no existe para este producto' });
        }
        const conStock = actuales.rows.filter(r => Number(r.stock) > 0);
        if (conStock.length) {
            const nombres = conStock.map(r => r.nombre_talla).join(', ');
            return res.json({
                ok: false,
                mensaje: `No puedes eliminar este color: las tallas ${nombres} todavía tienen stock. Primero descarga el stock desde Inventario.`
            });
        }
        await pool.query(
            `DELETE FROM variantes_producto WHERE id_producto = $1 AND LOWER(TRIM(color)) = LOWER(TRIM($2))`,
            [id, color]
        );
        res.json({ ok: true, mensaje: 'Color eliminado' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/productos/:id/precios-talla', verificarSesion, async (req, res) => {
    try {
        const prod = await pool.query(
            'SELECT precio_costo, precio_venta FROM productos WHERE id_producto = $1',
            [req.params.id]
        );
        if (!prod.rows.length) return res.json({ ok: false, mensaje: 'Producto no encontrado' });

        const result = await pool.query(`
            SELECT t.id_talla, t.nombre_talla,
                   ptc.precio_costo, ptc.precio_venta,
                   (ptc.id_talla IS NOT NULL) AS tiene_precio_propio
            FROM tallas t
            LEFT JOIN producto_talla_costo ptc
                   ON ptc.id_talla = t.id_talla AND ptc.id_producto = $1
            ORDER BY t.id_talla
        `, [req.params.id]);

        res.json({
            ok: true,
            precio_general: prod.rows[0],
            data: result.rows
        });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.post('/api/productos/:id/precios-talla/:idTalla', verificarSesion, async (req, res) => {
    const { precio_costo, precio_venta } = req.body;
    const costo = parseFloat(precio_costo);
    const venta = parseFloat(precio_venta);

    if (isNaN(costo) || isNaN(venta) || costo < 0) {
        return res.json({ ok: false, mensaje: 'Costo y venta deben ser números válidos' });
    }
    if (venta <= costo) {
        return res.json({ ok: false, mensaje: 'El precio de venta debe ser mayor al costo' });
    }

    try {
        await pool.query(`
            INSERT INTO producto_talla_costo (id_producto, id_talla, precio_costo, precio_venta)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id_producto, id_talla)
            DO UPDATE SET precio_costo = $3, precio_venta = $4, actualizado_en = CURRENT_TIMESTAMP
        `, [req.params.id, req.params.idTalla, costo, venta]);

        res.json({ ok: true, mensaje: 'Precio de talla guardado correctamente' });
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

router.get('/api/dashboard/finanzas', verificarSesion, async (req, res) => {
    try {
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const [metodosRes, ingresosDiaRes, ingresosMesRes, gastosDiaRes, gastosMesRes, comprasRes] = await Promise.all([
            pool.query(
                `SELECT metodo_pago, COALESCE(SUM(monto),0) AS total
                 FROM pagos
                 WHERE estado = 'pagado' AND fecha_pago >= $1
                 GROUP BY metodo_pago
                 ORDER BY total DESC`,
                [inicioMes]
            ),
            pool.query(
                `SELECT COALESCE(SUM(monto),0) AS total FROM pagos
                 WHERE estado = 'pagado' AND DATE(fecha_pago) = CURRENT_DATE`
            ),
            pool.query(
                `SELECT COALESCE(SUM(monto),0) AS total FROM pagos
                 WHERE estado = 'pagado' AND fecha_pago >= $1`,
                [inicioMes]
            ),
            pool.query(
                `SELECT COALESCE(SUM(costo),0) AS total FROM compras_insumos
                 WHERE DATE(fecha_compra) = CURRENT_DATE`
            ),
            pool.query(
                `SELECT COALESCE(SUM(costo),0) AS total FROM compras_insumos
                 WHERE fecha_compra >= $1`,
                [inicioMes]
            ),
            pool.query(
                `SELECT nombre_insumo, categoria_insumo, costo, lugar_compra, fecha_compra
                 FROM compras_insumos
                 ORDER BY fecha_compra DESC
                 LIMIT 8`
            )
        ]);
        const ingresosMes = parseFloat(ingresosMesRes.rows[0].total);
        const gastosMes = parseFloat(gastosMesRes.rows[0].total);
        res.json({
            ok: true,
            ingresos_dia: ingresosDiaRes.rows[0].total,
            ingresos_mes: ingresosMes,
            gastos_dia: gastosDiaRes.rows[0].total,
            gastos_mes: gastosMes,
            balance_mes: ingresosMes - gastosMes,
            metodos_pago: metodosRes.rows,
            ultimas_compras: comprasRes.rows
        });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.get('/api/colegios', verificarSesion, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM colegios WHERE estado != 2 ORDER BY id_colegio'
        );
        res.json({ ok: true, data: result.rows });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.post('/api/colegios', verificarSesion, async (req, res) => {
    const { nombre_colegio, distrito, provincia, estado } = req.body;
    if (!nombre_colegio) return res.json({ ok: false, mensaje: 'Nombre requerido' });
    try {
        const eliminado = await pool.query(
            'SELECT id_colegio FROM colegios WHERE LOWER(nombre_colegio) = LOWER($1) AND estado = 2',
            [nombre_colegio]
        );
        if (eliminado.rows.length > 0) {
            await pool.query(
                'UPDATE colegios SET distrito=$1, provincia=$2, estado=1 WHERE id_colegio=$3',
                [distrito || 'Chiclayo', provincia || 'Chiclayo', eliminado.rows[0].id_colegio]
            );
            return res.json({ ok: true, mensaje: 'Colegio reactivado correctamente' });
        }
        const existe = await pool.query(
            'SELECT id_colegio FROM colegios WHERE LOWER(nombre_colegio) = LOWER($1) AND estado != 2',
            [nombre_colegio]
        );
        if (existe.rows.length > 0)
            return res.json({ ok: false, mensaje: 'Ya existe un colegio activo con ese nombre' });
        await pool.query(
            'INSERT INTO colegios (nombre_colegio, distrito, provincia, estado) VALUES ($1, $2, $3, $4)',
            [nombre_colegio, distrito || 'Chiclayo', provincia || 'Chiclayo', estado ?? 1]
        );
        res.json({ ok: true, mensaje: 'Colegio creado correctamente' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.put('/api/colegios/:id', verificarSesion, async (req, res) => {
    const { nombre_colegio, distrito, provincia, estado } = req.body;
    try {
        await pool.query(
            'UPDATE colegios SET nombre_colegio=$1, distrito=$2, provincia=$3, estado=$4, fecha_actualizacion=NOW() WHERE id_colegio=$5',
            [nombre_colegio, distrito, provincia, estado ?? 1, req.params.id]
        );
        res.json({ ok: true, mensaje: 'Colegio actualizado correctamente' });
    } catch (e) { res.json({ ok: false, mensaje: e.message }); }
});

router.delete('/api/colegios/:id', verificarSesion, async (req, res) => {
    try {
        const productosVinculados = await pool.query(
            'SELECT COUNT(*) FROM productos WHERE id_colegio = $1 AND estado != 2', [req.params.id]
        );
        if (parseInt(productosVinculados.rows[0].count) > 0)
            return res.json({ ok: false, mensaje: `Este colegio tiene ${productosVinculados.rows[0].count} producto(s) vinculado(s). Primero elimina o reasigna esos productos.` });

        await pool.query('UPDATE colegios SET estado=2 WHERE id_colegio=$1', [req.params.id]);
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