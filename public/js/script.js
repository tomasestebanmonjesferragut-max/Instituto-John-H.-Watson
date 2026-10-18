/* =========================================
   SCRIPT GLOBAL - Instituto John H. Watson
========================================= */

// Escapa el texto antes de insertarlo como HTML (evita inyección de código)
window.escaparHTML = (texto) => String(texto ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Sesión actual, compartida por todos los scripts de la página (se consulta una sola vez)
let promesaSesion = null;
window.obtenerSesion = () => {
    if (!promesaSesion) {
        promesaSesion = fetch('/api/auth/sesion')
            .then(respuesta => respuesta.json())
            .catch(() => ({ rol: null }));
    }
    return promesaSesion;
};

// Formulario de inicio de sesión; al entrar se recarga la página con los permisos del rol
window.abrirLogin = async () => {
    const { value: credenciales } = await Swal.fire({
        title: 'Iniciar sesión',
        html: `
            <p class="text-muted small mb-2">Administración, docentes, alumnos y apoderados</p>
            <input id="swalLoginCorreo" type="email" class="swal2-input" placeholder="Correo institucional" autocomplete="username" autocapitalize="off" autocorrect="off">
            <input id="swalLoginClave" type="password" class="swal2-input" placeholder="Contraseña" autocomplete="current-password">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Ingresar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1c3a63',
        showLoaderOnConfirm: true,
        didOpen: () => document.getElementById('swalLoginCorreo').focus(),
        preConfirm: async () => {
            const correo = document.getElementById('swalLoginCorreo').value.trim();
            const contrasena = document.getElementById('swalLoginClave').value;
            if (!correo || !contrasena) {
                Swal.showValidationMessage('Ingresa correo y contraseña');
                return false;
            }
            try {
                const respuesta = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, contrasena })
                });
                const data = await respuesta.json().catch(() => ({}));
                if (!respuesta.ok) {
                    Swal.showValidationMessage(data.error || 'Correo o contraseña incorrectos');
                    return false;
                }
                return data;
            } catch (error) {
                Swal.showValidationMessage('No se pudo conectar con el servidor');
                return false;
            }
        }
    });

    if (credenciales) location.reload();
};

window.cerrarSesion = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.reload();
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. ILUMINAR MENÚ ACTIVO
    const currentUrl = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
        if (link.getAttribute('href') === currentUrl) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
            if (link.classList.contains('dropdown-item')) {
                link.closest('.dropdown')?.querySelector('.dropdown-toggle').classList.add('active');
            }
        }
    });

    // 2. MODO OSCURO (por defecto) / CLARO
    const btnTheme = document.getElementById('btnTheme');
    const themeIcon = btnTheme?.querySelector('i');

    // Siempre parte oscuro; solo queda claro si se eligió con el botón en esta visita
    if (sessionStorage.getItem('temaJHW') !== 'light') {
        document.body.classList.add('dark-mode');
    }
    if (themeIcon) {
        themeIcon.className = document.body.classList.contains('dark-mode')
            ? 'bi bi-sun-fill'
            : 'bi bi-moon-stars-fill';
    }

    btnTheme?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const esOscuro = document.body.classList.contains('dark-mode');
        sessionStorage.setItem('temaJHW', esOscuro ? 'dark' : 'light');
        if (themeIcon) themeIcon.className = esOscuro ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    });

    // 3. SESIÓN DEL USUARIO (botón del menú y permisos de edición)
    const btnAdmin = document.getElementById('btnAdmin');
    const NOMBRES_ROL = { admin: 'Administración', profesor: 'Docente', alumno: 'Alumno/a', apoderado: 'Apoderado/a' };

    obtenerSesion().then(sesion => {
        const isAdmin = sesion.rol === 'admin';
        document.body.dataset.rol = sesion.rol || 'visitante';

        // Botones de edición: solo visibles para administración
        document.querySelectorAll('#btnModificar, #btnEliminar, #btnEditarMateria, #btnEditarProf, #btnMoverHorario, #btnAgregarMateria, #btnAgregarProf')
            .forEach(btn => { btn.style.display = isAdmin ? 'block' : 'none'; });

        if (!btnAdmin) return;
        if (sesion.rol) {
            const primerNombre = (sesion.nombre || '').split(' ').filter(p => !p.endsWith('.'))[0] || NOMBRES_ROL[sesion.rol];
            btnAdmin.innerHTML = `<i class="bi bi-person-check-fill me-1"></i>${escaparHTML(primerNombre)}`;
            btnAdmin.className = isAdmin ? 'btn btn-danger btn-sm rounded-pill' : 'btn btn-primary btn-sm rounded-pill';
            btnAdmin.setAttribute('aria-label', `Sesión de ${sesion.nombre}`);
        } else {
            btnAdmin.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Ingresar';
            btnAdmin.className = 'btn btn-outline-primary btn-sm rounded-pill';
            btnAdmin.setAttribute('aria-label', 'Iniciar sesión');
        }
    });

    btnAdmin?.addEventListener('click', async () => {
        const sesion = await obtenerSesion();
        if (!sesion.rol) return abrirLogin();

        const { isConfirmed, isDenied } = await Swal.fire({
            title: escaparHTML(sesion.nombre),
            html: `<span class="badge text-bg-primary">${NOMBRES_ROL[sesion.rol]}</span>`,
            icon: 'info',
            showDenyButton: sesion.rol !== 'admin',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-box-arrow-right me-1"></i>Cerrar sesión',
            denyButtonText: '<i class="bi bi-mortarboard me-1"></i>Ir a mi Aula',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#963337',
            denyButtonColor: '#1c3a63'
        });

        if (isConfirmed) cerrarSesion();
        if (isDenied) location.href = 'aulaVirtualAlumnos.html';
    });

    // 4. ANIMACIONES Y CARRUSEL
    document.querySelectorAll('.card, .col-md-6 > a > .p-4').forEach((tarjeta, index) => {
        tarjeta.style.animationDelay = `${index * 0.1}s`;
    });

    const carouselElement = document.getElementById('carouselExamples');
    if (carouselElement && window.bootstrap) {
        new bootstrap.Carousel(carouselElement, { interval: 5000, ride: 'carousel' });
    }

    // 5. AÑO ACTUAL EN EL PIE DE PÁGINA
    document.querySelectorAll('.anio-actual').forEach(el => { el.textContent = new Date().getFullYear(); });
});
