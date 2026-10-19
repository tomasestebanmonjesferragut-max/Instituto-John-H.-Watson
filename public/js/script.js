/* =========================================
   SCRIPT GLOBAL - Instituto John H. Watson
   Utilidades compartidas por todas las páginas
========================================= */

// Escapa el texto antes de insertarlo como HTML (evita inyección de código)
window.escaparHTML = (texto) => String(texto ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Llamada a la API: devuelve el JSON o lanza un error con el mensaje del servidor
window.api = async (ruta, metodo = 'GET', datos) => {
    const respuesta = await fetch(`/api/${ruta}`, {
        method: metodo,
        headers: datos ? { 'Content-Type': 'application/json' } : undefined,
        body: datos ? JSON.stringify(datos) : undefined
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(json.error || 'No se pudo completar la acción');
    return json;
};

// Mensajes breves
window.aviso = (titulo) => Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: titulo, showConfirmButton: false, timer: 2200 });
window.mostrarError = (error) => Swal.fire('Error', escaparHTML(error.message || error), 'error');
window.confirmar = async (titulo) => (await Swal.fire({
    title: titulo, icon: 'warning', showCancelButton: true,
    confirmButtonText: 'Sí, continuar', cancelButtonText: 'Cancelar', confirmButtonColor: '#963337'
})).isConfirmed;

// Bloque que invita a iniciar sesión
window.htmlInicioSesion = (texto) => `
    <div class="text-center py-5">
        <i class="bi bi-shield-lock-fill text-primary" style="font-size: 3rem;" aria-hidden="true"></i>
        <p class="text-muted lead mx-auto mt-3" style="max-width: 560px;">${texto}</p>
        <button type="button" class="btn btn-primary px-4" onclick="abrirLogin()"><i class="bi bi-box-arrow-in-right me-2"></i>Iniciar sesión</button>
    </div>`;

/**
 * Formulario en ventana modal. campos: [{ name, label, type, options, required }]
 * Retorna un objeto { name: valor } o undefined si se cancela.
 */
window.formularioModal = async (titulo, campos, valores = {}) => {
    const html = campos.map(c => {
        const id = `campo-${c.name}`;
        const valor = valores[c.name] ?? '';
        let control;
        if (c.type === 'select') {
            control = `<select id="${id}" class="form-select">${c.options.map(([v, t]) =>
                `<option value="${escaparHTML(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${escaparHTML(t)}</option>`).join('')}</select>`;
        } else if (c.type === 'textarea') {
            control = `<textarea id="${id}" class="form-control" placeholder=" " style="height: 110px;">${escaparHTML(valor)}</textarea>`;
        } else {
            control = `<input id="${id}" type="${c.type || 'text'}" class="form-control" placeholder=" " value="${escaparHTML(valor)}" ${c.type === 'number' ? 'min="1" max="7" step="0.1"' : ''}>`;
        }
        return `<div class="form-floating mb-3 text-start">${control}<label for="${id}">${c.label}</label></div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: titulo, html, width: '560px', focusConfirm: false, showCancelButton: true,
        confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', confirmButtonColor: '#1c3a63',
        preConfirm: () => {
            const datos = {};
            for (const c of campos) {
                const texto = document.getElementById(`campo-${c.name}`).value.trim();
                if (c.required && !texto) {
                    Swal.showValidationMessage(`Completa el campo: ${c.label}`);
                    return false;
                }
                datos[c.name] = c.type === 'number' ? parseFloat(texto) : texto;
            }
            return datos;
        }
    });
    return value;
};

// Roles de la página. La directiva (director y secretaría) gestiona la academia.
window.NOMBRES_ROL = { director: 'Director', secretaria: 'Secretaría', profesor: 'Docente', alumno: 'Alumno/a', apoderado: 'Apoderado/a', visitante: 'Visitante' };
window.esDirectiva = (sesion) => sesion.rol === 'director' || sesion.rol === 'secretaria';

// Menú corto: cada rol ve solo las opciones que usa ([enlace, ícono, texto])
const PANEL = ['index.html#miPanel', 'bi-grid-fill', 'Mi panel'];
const AULA = ['aula.html', 'bi-laptop', 'Mi Aula'];
const ASIGNATURAS = ['academico.html#asignaturas', 'bi-journal-bookmark-fill', 'Asignaturas'];
const DOCENTES = ['academico.html#docentes', 'bi-person-video3', 'Docentes'];
const HORARIO = ['academico.html#agenda', 'bi-calendar-week', 'Horario'];
const ALUMNOS = ['academico.html#alumnos', 'bi-people-fill', 'Alumnos'];
const ADMISION = ['tramites.html#admision', 'bi-person-vcard', 'Admisión'];
const SOPORTE = ['tramites.html#soporte', 'bi-pc-display', 'Soporte'];
const MENU_POR_ROL = {
    visitante: [['index.html#nosotros', 'bi-info-circle-fill', 'Nosotros'], ASIGNATURAS, DOCENTES, ADMISION, ['index.html#contacto', 'bi-envelope-fill', 'Contacto']],
    alumno: [PANEL, AULA, HORARIO, ASIGNATURAS, DOCENTES],
    apoderado: [PANEL, AULA, HORARIO, ASIGNATURAS, DOCENTES],
    profesor: [PANEL, AULA, ['academico.html#alumnos', 'bi-people-fill', 'Mis alumnos'], HORARIO, SOPORTE],
    secretaria: [PANEL, ADMISION, HORARIO, ALUMNOS, SOPORTE, ['index.html#mensajes', 'bi-envelope-fill', 'Mensajes']],
    director: [PANEL, ADMISION, DOCENTES, ALUMNOS, HORARIO, SOPORTE]
};

// Sesión actual, compartida por todos los scripts de la página (se consulta una sola vez)
let promesaSesion = null;
window.obtenerSesion = () => {
    promesaSesion ??= api('auth/sesion').catch(() => ({ rol: null }));
    return promesaSesion;
};

// Formulario de inicio de sesión; al entrar se recarga la página con los permisos del rol
window.abrirLogin = async () => {
    const { value: sesion } = await Swal.fire({
        title: 'Iniciar sesión',
        html: `
            <p class="text-muted small mb-2">Administración, docentes, alumnos y apoderados</p>
            <input id="swalLoginCorreo" type="email" class="swal2-input" placeholder="Correo institucional" autocomplete="username" autocapitalize="off">
            <input id="swalLoginClave" type="password" class="swal2-input" placeholder="Contraseña" autocomplete="current-password">`,
        focusConfirm: false, showCancelButton: true, showLoaderOnConfirm: true,
        confirmButtonText: 'Ingresar', cancelButtonText: 'Cancelar', confirmButtonColor: '#1c3a63',
        didOpen: () => document.getElementById('swalLoginCorreo').focus(),
        preConfirm: () => {
            const correo = document.getElementById('swalLoginCorreo').value.trim();
            const contrasena = document.getElementById('swalLoginClave').value;
            if (!correo || !contrasena) return Swal.showValidationMessage('Ingresa correo y contraseña');
            return api('auth/login', 'POST', { correo, contrasena }).catch(error => Swal.showValidationMessage(error.message));
        }
    });
    if (sesion) location.reload();
};

window.cerrarSesion = async () => {
    await api('auth/logout', 'POST').catch(() => {});
    location.reload();
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. ILUMINAR MENÚ ACTIVO (página actual y, si corresponde, su sección)
    const marcarMenu = () => {
        const pagina = location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('header .nav-link, header .dropdown-item').forEach(link => {
            const [archivo, ancla] = (link.getAttribute('href') || '').split('#');
            const activo = archivo === pagina && (ancla ? `#${ancla}` === location.hash : !location.hash || link.classList.contains('dropdown-toggle'));
            link.classList.toggle('active', activo);
            if (activo) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
            if (archivo === pagina && link.classList.contains('dropdown-item')) {
                link.closest('.dropdown')?.querySelector('.dropdown-toggle').classList.add('active');
            }
        });
    };

    // 2. PESTAÑAS ENLAZADAS CON LA DIRECCIÓN (#asignaturas, #agenda, #soporte...)
    const abrirPestanaDesdeHash = () => {
        if (/^#[\w-]+$/.test(location.hash)) {
            const boton = document.querySelector(`[data-bs-toggle="tab"][data-bs-target="${location.hash}"]`);
            if (boton) bootstrap.Tab.getOrCreateInstance(boton).show();
        }
        marcarMenu();
    };
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(boton => {
        boton.addEventListener('shown.bs.tab', () => { history.replaceState(null, '', boton.dataset.bsTarget); marcarMenu(); });
    });
    window.addEventListener('hashchange', abrirPestanaDesdeHash);
    abrirPestanaDesdeHash();

    // 3. MODO OSCURO (por defecto) / CLARO
    const btnTheme = document.getElementById('btnTheme');
    const themeIcon = btnTheme?.querySelector('i');
    const aplicarIcono = () => {
        if (themeIcon) themeIcon.className = document.body.classList.contains('dark-mode') ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    };

    // Siempre parte oscuro; solo queda claro si se eligió con el botón en esta visita
    if (sessionStorage.getItem('temaJHW') !== 'light') document.body.classList.add('dark-mode');
    aplicarIcono();

    btnTheme?.addEventListener('click', () => {
        const esOscuro = document.body.classList.toggle('dark-mode');
        sessionStorage.setItem('temaJHW', esOscuro ? 'dark' : 'light');
        aplicarIcono();
    });

    // 4. SESIÓN DEL USUARIO: cada rol ve su menú, sus secciones y su nombre en la franja superior
    const btnAdmin = document.getElementById('btnAdmin');

    obtenerSesion().then(sesion => {
        const rol = sesion.rol || 'visitante';
        document.body.dataset.rol = rol;

        // Opciones del menú de este rol (antes del botón de tema y sesión)
        document.querySelector('#navbarNav .navbar-nav')?.insertAdjacentHTML('afterbegin', MENU_POR_ROL[rol].map(([enlace, icono, texto]) =>
            `<li class="nav-item"><a class="nav-link" href="${enlace}"><i class="bi ${icono} me-1"></i>${texto}</a></li>`).join(''));
        marcarMenu();

        // Elementos con data-roles="..." solo se muestran a los roles indicados
        document.querySelectorAll('[data-roles]').forEach(el => { el.hidden = !el.dataset.roles.split(' ').includes(rol); });

        if (!sesion.rol) return;
        const franja = document.getElementById('franjaRol');
        franja.innerHTML = `<i class="bi bi-person-badge-fill me-1"></i>Sesión: <strong>${escaparHTML(sesion.nombre)}</strong> · ${NOMBRES_ROL[rol]}
            <a href="index.html#miPanel" class="ms-2">Ir a mi panel</a>`;
        franja.hidden = false;

        if (btnAdmin) {
            const primerNombre = (sesion.nombre || '').split(' ').find(p => !p.endsWith('.')) || NOMBRES_ROL[rol];
            btnAdmin.innerHTML = `<i class="bi bi-person-check-fill me-1"></i>${escaparHTML(primerNombre)}`;
            btnAdmin.className = `btn btn-sm rounded-pill ${esDirectiva(sesion) ? 'btn-danger' : 'btn-primary'}`;
            btnAdmin.setAttribute('aria-label', `Sesión de ${sesion.nombre}`);
        }
    });

    btnAdmin?.addEventListener('click', async () => {
        const sesion = await obtenerSesion();
        if (!sesion.rol) return abrirLogin();

        const { isConfirmed, isDenied } = await Swal.fire({
            title: escaparHTML(sesion.nombre),
            html: `<span class="badge text-bg-primary">${NOMBRES_ROL[sesion.rol]}</span>`,
            icon: 'info', showDenyButton: true, showCancelButton: true,
            confirmButtonText: '<i class="bi bi-box-arrow-right me-1"></i>Cerrar sesión',
            denyButtonText: '<i class="bi bi-mortarboard me-1"></i>Ir al Aula Virtual',
            cancelButtonText: 'Volver', confirmButtonColor: '#963337', denyButtonColor: '#1c3a63'
        });
        if (isConfirmed) cerrarSesion();
        if (isDenied) location.href = 'aula.html';
    });

    // 5. CARRUSEL Y AÑO ACTUAL EN EL PIE DE PÁGINA
    const carousel = document.getElementById('carouselExamples');
    if (carousel && window.bootstrap) new bootstrap.Carousel(carousel, { interval: 5000, ride: 'carousel' });
    document.querySelectorAll('.anio-actual').forEach(el => { el.textContent = new Date().getFullYear(); });
});
