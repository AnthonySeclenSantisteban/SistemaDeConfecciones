require('dotenv').config();
if (!process.env.SESSION_SECRET) {
    console.error('Falta SESSION_SECRET en el archivo .env');
    process.exit(1);
}
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = 3000;
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
 
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8
    }
}));
 
app.use('/', require('./routes/rutasAuth'));
app.use('/', require('./routes/rutasClientes'));
app.use('/', require('./routes/rutasCompras'));
app.use('/', require('./routes/Rutaspagos'));  
app.use('/', require('./routes/rutasVentas'));
app.use('/', require('./routes/rutasPedidos'));
app.use('/', require('./routes/rutasInventario'));
app.use('/', require('./routes/rutasEnvios'));
app.use('/', require('./routes/rutasCheckout'))
app.use('/', require('./routes/rutasProduccion'));
 
app.get('/vistas/modulos/:vista', (req, res) => {
    const nombreVista = path.basename(req.params.vista);
    const carpetaBase = path.join(__dirname, 'views', 'modulos');
    const filePath = path.join(carpetaBase, nombreVista);

    if (!filePath.startsWith(carpetaBase + path.sep)) {
        return res.status(400).send('Ruta inválida');
    }

    res.sendFile(filePath, (err) => {
        if (err) {
            const vistaSegura = nombreVista.replace(/[&<>"']/g, (c) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
            console.warn(`Vista no encontrada: ${nombreVista}`);
            res.status(404).send(`
                <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
                <title>Módulo no disponible</title></head>
                <body style="font-family:sans-serif;padding:2rem">
                <h2>⚠️ Módulo en construcción</h2>
                <p>La vista <b>${vistaSegura}</b> aún no está disponible.</p>
                <a href="/dashboard">← Volver al dashboard</a>
                </body></html>
            `);
        }
    });
});

 
app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});


 