const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

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

const rutasAuth = require('./routes/rutasAuth');
app.use('/', rutasAuth);

const rutasCliente = require('./routes/rutasClientes');
app.use('/', rutasCliente);

const rutasCompras = require('./routes/rutasCompras');
app.use('/', rutasCompras);

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});