async function cargarModulo(modulo) {
    const contenido = document.getElementById('contenido');
    const titulo = document.getElementById('titulo-modulo');

    try {
        const res = await fetch(`/vistas/modulos/${modulo}.html?v=${Date.now()}`);
        if (!res.ok) {
            throw new Error(`No se encontró el HTML del módulo: ${modulo}`);
        }

        const html = await res.text();
        contenido.innerHTML = html;

        const titulos = {
            dashboard: 'Dashboard',
            usuarios: 'Usuarios',
            perfiles: 'Perfiles de acceso',
            categorias: 'Categorías',
            productos: 'Productos',
            variantes: 'Variantes',
            clientes: 'Clientes',
            pedidos: 'Pedidos',
            envios: 'Envíos',
            'verificacion-pagos': 'Verificación de Pagos',
            inventario: 'Inventario',
            compras: 'Compras',
            'gestion-tienda': 'Gestión Tienda',
            configuracion: 'Configuración'
        };

        titulo.textContent = titulos[modulo] || modulo;

        if (window.lucide) lucide.createIcons();

        const moduloJs = modulo.replace(/-/g, '_');
        const fnNombre = `cargar_${moduloJs}`;
        let script = document.querySelector(`script[data-modulo="${moduloJs}"]`);

        if (modulo !== 'dashboard') {
            if (!window[fnNombre]) {
                if (!script) {
                    script = document.createElement('script');
                    script.src = `/js/modulos/${moduloJs}.js?v=${Date.now()}`;
                    script.dataset.modulo = moduloJs;

                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = () => reject(new Error(`No cargó el JS del módulo: ${moduloJs}`));
                        document.body.appendChild(script);
                    });
                } else {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            if (typeof window[fnNombre] === 'function') {
                window[fnNombre]();
            } else {
                throw new Error(`No existe la función ${fnNombre}()`);
            }
        }

    } catch (error) {
        console.error('Error cargando módulo:', modulo, error);
        contenido.innerHTML = `
            <div style="padding:40px;text-align:center;color:var(--muted);">
                <p>No se pudo cargar el módulo <strong>${modulo}</strong></p>
            </div>
        `;
    }
}

function enlazarMenu() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
            if (this.target === '_blank') return;

            e.preventDefault();

            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            const modulo = this.getAttribute('data-modulo');
            cargarModulo(modulo);
        });
    });
}

function cargarFechaActual() {
    const hoy = new Date();
    const fecha = document.getElementById('fecha-hoy');
    if (!fecha) return;

    fecha.textContent = hoy.toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function cargarMisOpciones() {
    try {
        const res = await fetch('/api/mis-opciones');
        const json = await res.json();
        const opciones = json.opciones || [];

        if (opciones.length === 0) return;

        document.querySelectorAll('.nav-item').forEach(item => {
            const modulo = item.getAttribute('data-modulo');
            if (modulo === 'dashboard' || modulo === 'catalogo') return;

            const rutaModulo = modulo + '.html';
            if (!opciones.includes(rutaModulo)) {
                item.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Error cargando opciones:', error);
    }
}

async function cargarDatosSesion() {
    try {
        const res = await fetch('/api/sesion');
        const json = await res.json();
        if (!json.ok) return;

        const u = json.usuario;
        document.getElementById('user-nombre').textContent = u.nombre;
        document.getElementById('user-perfil').textContent = u.perfil_nombre;
        document.getElementById('avatar').textContent = u.nombre.charAt(0).toUpperCase();
    } catch (error) {
        console.error('Error cargando sesión:', error);
    }
}

async function cargarLogoSidebar() {
    try {
        const res = await fetch('/api/gestion-tienda/logos');
        const json = await res.json();

        const img = document.getElementById('sidebar-logo-img');
        const fallback = document.getElementById('sidebar-logo-fallback');

        if (!img) return;

        const logos = (json.data || []).filter(item => item.tipo === 'logo');
        const logoActivo = logos.find(item => item.activo);

        if (!logoActivo || !logoActivo.url) {
            img.style.display = 'none';
            if (fallback) fallback.style.display = 'flex';
            return;
        }

        img.onload = function () {
            img.style.display = 'block';
            if (fallback) fallback.style.display = 'none';
        };

        img.onerror = function () {
            img.style.display = 'none';
            if (fallback) fallback.style.display = 'flex';
        };

        img.src = logoActivo.url + '?v=' + Date.now();
    } catch (error) {
        console.error('Error cargando logo del sidebar:', error);

        const img = document.getElementById('sidebar-logo-img');
        const fallback = document.getElementById('sidebar-logo-fallback');

        if (img) img.style.display = 'none';
        if (fallback) fallback.style.display = 'flex';
    }
}
async function iniciarDashboard() {
    enlazarMenu();
    cargarFechaActual();

    await cargarDatosSesion();
    await cargarMisOpciones();
    await cargarLogoSidebar();
    await cargarModulo('dashboard');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarDashboard);
} else {
    iniciarDashboard();
}