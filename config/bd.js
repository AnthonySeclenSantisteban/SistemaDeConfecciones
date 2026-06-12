const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bdconfecciones',
    user: 'postgres',
    password: '123456'
});

pool.connect()
.then(()=> console.log('Conectado a PostgreSQL :D'))
.catch(err => console.error('Error de conexion :c', err));

module.exports = pool;