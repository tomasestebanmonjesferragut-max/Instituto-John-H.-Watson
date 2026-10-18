/* =========================================
   SCRIPT GLOBAL - Instituto John H. Watson
========================================= */

document.addEventListener('DOMContentLoaded', () => {
    // 1. ILUMINAR MENÚ ACTIVO
    const currentUrl = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
        if (link.getAttribute('href') === currentUrl) {
            link.classList.add('active');
            if (link.classList.contains('dropdown-item')) {
                link.closest('.dropdown')?.querySelector('.dropdown-toggle').classList.add('active');
            }
        }
    });

    // 2. MODO CLARO (por defecto) / OSCURO
    const btnTheme = document.getElementById('btnTheme');
    const themeIcon = btnTheme?.querySelector('i');

    // Revisar si ya había elegido modo oscuro antes
    if (localStorage.getItem('temaJHW') === 'dark') {
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
        localStorage.setItem('temaJHW', esOscuro ? 'dark' : 'light');
        if (themeIcon) themeIcon.className = esOscuro ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    });

    // 3. SIMULADOR DE LOGIN (ADMIN)
    const btnAdmin = document.getElementById('btnAdmin');
    let isAdmin = localStorage.getItem('adminJHW') === 'true';

    // Función para mostrar/ocultar botones de edición
    const actualizarPermisos = () => {
        const botonesCRUD = document.querySelectorAll('#btnModificar, #btnEliminar, #btnEditarMateria, #btnEditarProf, #btnMoverHorario, #btnAgregarMateria, #btnAgregarProf');
        botonesCRUD.forEach(btn => {
            btn.style.display = isAdmin ? 'block' : 'none';
        });
        if(btnAdmin) {
            btnAdmin.innerHTML = isAdmin ? '<i class="bi bi-unlock-fill"></i> Admin' : '<i class="bi bi-lock-fill"></i>';
            btnAdmin.className = isAdmin ? 'btn btn-danger btn-sm rounded-pill' : 'btn btn-outline-danger btn-sm rounded-pill';
        }
    };

    actualizarPermisos(); // Ejecutar al cargar

    btnAdmin?.addEventListener('click', async () => {
        if (isAdmin) {
            localStorage.setItem('adminJHW', 'false');
            isAdmin = false;
            actualizarPermisos();
            Swal.fire('Sesión Cerrada', 'Modo lectura activado.', 'info');
        } else {
            const { value: credenciales } = await Swal.fire({
                title: 'Acceso Administrativo',
                html: `
                    <input id="swalAdminCorreo" type="email" class="swal2-input" placeholder="Correo administrativo" autocapitalize="off" autocorrect="off">
                    <input id="swalAdminClave" type="password" class="swal2-input" placeholder="Contraseña" autocapitalize="off" autocorrect="off">
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Ingresar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const correo = document.getElementById('swalAdminCorreo').value.trim();
                    const contrasena = document.getElementById('swalAdminClave').value;
                    if (!correo || !contrasena) {
                        Swal.showValidationMessage('Ingresa correo y contraseña');
                        return false;
                    }
                    return { correo, contrasena };
                }
            });

            if (!credenciales) return;

            try {
                const respuesta = await fetch('/api/auth/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credenciales)
                });

                if (!respuesta.ok) {
                    const data = await respuesta.json().catch(() => ({}));
                    Swal.fire('Error', data.error || 'Correo o contraseña incorrectos.', 'error');
                    return;
                }

                localStorage.setItem('adminJHW', 'true');
                isAdmin = true;
                actualizarPermisos();
                Swal.fire('Acceso Concedido', 'Tienes permisos de edición.', 'success');
            } catch (error) {
                Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
            }
        }
    });

    // 4. ANIMACIONES Y CARRUSEL
    document.querySelectorAll('.card, .col-md-6 > a > .p-4').forEach((tarjeta, index) => {
        tarjeta.style.animationDelay = `${index * 0.1}s`;
    });

    const carouselElement = document.getElementById('carouselExamples');
    if (carouselElement && window.bootstrap) {
        new bootstrap.Carousel(carouselElement, { interval: 5000, ride: 'carousel' });
    }

    // ==========================================
    // 5. EXPORTAR A PDF (Protegido)
    // ==========================================
    // Usamos ?. para que no dé error si el botón no existe en la página actual
    const btnExportar = document.querySelector('.bi-printer')?.closest('button');
    
    if (btnExportar) {
        btnExportar.addEventListener('click', () => {
            const elementoTabla = document.querySelector('.table-responsive');
            
            if (!elementoTabla) return; // Si no hay tabla, no hace nada

            const opciones = {
                margin:       1,
                filename:     'Horario_Academico_JHW.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
            };
            
            // Animación de carga mientras genera
            const textoOriginal = btnExportar.innerHTML;
            btnExportar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';
            
            // Asegurarnos de que la librería HTML2PDF exista antes de llamarla
            if (typeof html2pdf !== 'undefined') {
                html2pdf().set(opciones).from(elementoTabla).save().then(() => {
                    btnExportar.innerHTML = textoOriginal;
                    Swal.fire('¡Éxito!', 'El horario se ha descargado en tu equipo.', 'success');
                });
            } else {
                btnExportar.innerHTML = textoOriginal;
                Swal.fire('Error', 'No se ha cargado la librería de PDF.', 'error');
            }
        });
    }
});