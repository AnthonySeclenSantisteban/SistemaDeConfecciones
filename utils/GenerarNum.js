const pool = require('../config/bd');
async function generarNumeroVenta(tipo = 'nota_venta') {
    const anio = new Date().getFullYear();
    const resultado = await pool.query(
        `SELECT COUNT(*) AS total
         FROM ventas
         WHERE tipo_documento = $1
           AND EXTRACT(YEAR FROM fecha_venta) = $2`,
        [tipo, anio]
    );

    const correlativo = String(parseInt(resultado.rows[0].total) + 1).padStart(6, '0');

    if (tipo === 'boleta') {
        return `B001-${correlativo}`;
    }
    return `NV-${anio}-${correlativo}`;
}

module.exports = { generarNumeroVenta };