function mostrarToast(mensaje, tipo = 'info') {
    const colores = {
        success: '#16a34a',
        error: '#dc2626',
        warning: '#d97706',
        info: '#2563eb'
    };
    const iconos = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        background:#1a1a1a;color:#fff;padding:12px 18px;border-radius:10px;
        display:flex;align-items:center;gap:10px;font-size:13.5px;
        border-left:4px solid ${colores[tipo] || colores.info};
        box-shadow:0 4px 20px rgba(0,0,0,.25);
        animation:slideInToast .25s ease;min-width:240px;max-width:380px;
    `;
    toast.innerHTML = `<i data-lucide="${iconos[tipo] || 'info'}" style="width:16px;height:16px;color:${colores[tipo]};flex-shrink:0;"></i><span>${mensaje}</span>`;
    if (!document.getElementById('toast-style')) {
        const s = document.createElement('style');
        s.id = 'toast-style';
        s.textContent = `@keyframes slideInToast{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}`;
        document.head.appendChild(s);
    }
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
        toast.style.transition = 'opacity .3s,transform .3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(110%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

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

        const moduloJs = modulo.replace(/-/g, '_');
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