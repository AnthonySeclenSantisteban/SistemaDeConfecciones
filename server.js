require('dotenv').config();
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
    secret: 'confecciones_lix_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
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
 
app.get('/vistas/modulos/:vista', (req, res) => {
    const filePath = path.join(__dirname, 'views', 'modulos', req.params.vista);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.warn(`Vista no encontrada: ${req.params.vista}`);
            res.status(404).send(`
                <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
                <title>Módulo no disponible</title></head>
                <body style="font-family:sans-serif;padding:2rem">
                <h2>⚠️ Módulo en construcción</h2>
                <p>La vista <b>${req.params.vista}</b> aún no está disponible.</p>
                <a href="/dashboard">← Volver al dashboard</a>
                </body></html>
            `);
        }
    });
});

 
app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});


 