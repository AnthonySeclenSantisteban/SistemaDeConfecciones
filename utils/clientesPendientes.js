const fs = require('fs');
const path = require('path');

const RUTA_JSON = path.join(__dirname, '../data/clientes_pendientes.json');

function leerPendientes() {
    if (!fs.existsSync(RUTA_JSON)) return [];
    const contenido = fs.readFileSync(RUTA_JSON, 'utf-8').trim();
    return contenido ? JSON.parse(contenido) : [];
}

function guardarPendientes(lista) {
    fs.writeFileSync(RUTA_JSON, JSON.stringify(lista, null, 2), 'utf-8');
}

function agregarPendiente(datos) {
    const lista = leerPendientes();
    const ref = 'PEND-' + Date.now();
    lista.push({ ref, ...datos, creado_en: new Date().toISOString() });
    guardarPendientes(lista);
    return ref;
}

function buscarPorRef(ref) {
    return leerPendientes().find(c => c.ref === ref) || null;
}

function eliminarPorRef(ref) {
    const lista = leerPendientes();
    const filtrada = lista.filter(c => c.ref !== ref);
    guardarPendientes(filtrada);
}

module.exports = { leerPendientes, guardarPendientes, agregarPendiente, buscarPorRef, eliminarPorRef };