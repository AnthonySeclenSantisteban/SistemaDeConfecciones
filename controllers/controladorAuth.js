const pool = require('../config/bd');
const { verificar } = require('../utils/encriptar');
const path = require('path');

const controladorAuth = {
    mostrarLogin: (req, res) => {
        if (req.session.usuario) {
            return res.redirect('/dashboard');
        }
        res.sendFile(path.join(__dirname, '../views/auth/login.html'));
    },

    procesarLogin: async (req, res) => {
        const { correo, contra } = req.body;
        try {
            const resultado = await pool.query(
                `SELECT u.*, p.nombre AS perfil_nombre, p.estado AS perfil_estado
                FROM usuarios u
                JOIN perfiles p ON p.id_perfil = u.id_perfil
                WHERE u.correo = $1`,
                [correo]
            );

            if (resultado.rows.length === 0) return res.redirect('/login?error=1');

            const usuario = resultado.rows[0];

            const coincide = await verificar(contra, usuario.contrasena);
            if (!coincide) return res.redirect('/login?error=1');
            if (usuario.estado === 0) return res.redirect('/login?error=3');
            if (usuario.perfil_estado === 0 || usuario.perfil_estado === 2) return res.redirect('/login?error=4');
            const opcionesRes = await pool.query(
                `SELECT o.ruta FROM opciones o
                 INNER JOIN perfiles_opciones po ON po.id_opcion = o.id_opcion
                 WHERE po.id_perfil = $1 AND po.deleted_at IS NULL`,
                [usuario.id_perfil]
            );

            const opciones = opcionesRes.rows.map(o => o.ruta);

            req.session.usuario = {
                id:            usuario.id_usuario,
                nombre:        usuario.nombre,
                correo:        usuario.correo,
                id_perfil:     usuario.id_perfil,
                perfil_nombre: usuario.perfil_nombre, 
                opciones:      opciones
            };

            res.redirect('/dashboard');
        } catch (error) {
            console.error('Error en login:', error);
            res.redirect('/login?error=2');
        }
    },

    mostrarDashboard: (req, res) => {
        res.sendFile(path.join(__dirname, '../views/dashboard.html'));
    },

    cerrarSesion: (req, res) => {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    }
};

module.exports = controladorAuth;