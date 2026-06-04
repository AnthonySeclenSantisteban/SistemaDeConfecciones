async function cargarModulo(modulo) {
    const contenido = document.getElementById('contenido');
    const titulo = document.getElementById('titulo-modulo');

    try {
        const res = await fetch(`/vistas/modulos/${modulo}.html`);
        if (!res.ok) throw new Error('Módulo no encontrado');
        const html = await res.text();
        contenido.innerHTML = html;

        const titulos = {
            'dashboard': 'Dashboard',
            'usuarios': 'Usuarios',
            'perfiles': 'Perfiles de acceso',
            'categorias': 'Categorías',
            'productos': 'Productos',
            'variantes': 'Variantes',
            'clientes': 'Clientes',
            'pedidos': 'Pedidos',
            'ventas': 'Ventas',
            'envios': 'Envíos',
            'verificacion-pagos': 'Verificación de Pagos',
            'inventario': 'Inventario',
            'compras': 'Compras',
            'gestion-tienda': 'Gestión Tienda',
            'configuracion': 'Configuración'
        };
        titulo.textContent = titulos[modulo] || modulo;

        if (window.lucide) lucide.createIcons();

        const moduloJs = modulo.replace('-', '_');
        const fnNombre = `cargar_${moduloJs}`;

        if (window[fnNombre]) {
            window[fnNombre]();
        } else {
            const script = document.createElement('script');
            script.src = `/js/modulos/${moduloJs}.js`;
            script.onload = () => {
                if (window[fnNombre]) window[fnNombre]();
            };
            document.body.appendChild(script);
        }

    } catch (error) {
        contenido.innerHTML = `
            <div style="padding:40px;text-align:center;color:var(--muted);">
                <p>Módulo no disponible aún</p>
            </div>`;
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        if (this.target === '_blank') return;
        e.preventDefault();

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');

        const modulo = this.getAttribute('data-modulo');
        cargarModulo(modulo);
    });
});

const hoy = new Date();
document.getElementById('fecha-hoy').textContent =
    hoy.toLocaleDateString('es-PE', {
        weekday: 'long', year: 'numeric',
        month: 'long', day: 'numeric'
    });

    async function cargarMisOpciones() {
    const res = await fetch('/api/mis-opciones');
    const json = await res.json();
    const opciones = json.opciones;

    if (opciones.length === 0) return;

    document.querySelectorAll('.nav-item').forEach(item => {
    const modulo = item.getAttribute('data-modulo');
    if (modulo === 'dashboard' || modulo === 'catalogo') return; 
    const rutaModulo = modulo + '.html';
    if (!opciones.includes(rutaModulo)) {
        item.style.display = 'none';
    }
    });
}

async function cargarDatosSesion() {
    const res = await fetch('/api/sesion');
    const json = await res.json();
    if (!json.ok) return;
    const u = json.usuario;
    document.getElementById('user-nombre').textContent = u.nombre;
    document.getElementById('user-perfil').textContent = u.perfil_nombre;
    document.getElementById('avatar').textContent = u.nombre.charAt(0).toUpperCase();
}

cargarDatosSesion();
cargarMisOpciones();
cargarModulo('dashboard');