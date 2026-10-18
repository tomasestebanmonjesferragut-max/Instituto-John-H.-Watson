document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    const vistaLogin = document.getElementById('vistaLogin');
    const vistaDashboard = document.getElementById('vistaDashboard');
    const dashboardAlumno = document.getElementById('dashboardAlumno');
    const dashboardProfesor = document.getElementById('dashboardProfesor');
    const saludoUsuario = document.getElementById('saludoUsuario');
    const subtituloUsuario = document.getElementById('subtituloUsuario');

    const formLogin = document.getElementById('formLogin');
    const loginCorreo = document.getElementById('loginCorreo');
    const loginClave = document.getElementById('loginClave');
    const loginError = document.getElementById('loginError');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');

    if (!vistaLogin || !vistaDashboard) return;

    const ICONOS_TIPO = {
        libro: 'bi-book-half',
        documento: 'bi-file-earmark-text-fill',
        video: 'bi-camera-video-fill',
        enlace: 'bi-link-45deg',
        tarea: 'bi-clipboard-check-fill'
    };
    const NOMBRES_TIPO = {
        libro: 'Libro digital',
        documento: 'Documento / Guía',
        video: 'Video',
        enlace: 'Enlace',
        tarea: 'Tarea'
    };

    let sesion = null; // { rol, estudiante | profesor | admin, asignaturas }
    let asignaturaProfesorActiva = null;
    let estudiantesCache = null;

    // =====================================================
    // 1. LOGIN ÚNICO (el servidor detecta el rol automáticamente)
    // =====================================================
    formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';

        const correo = loginCorreo.value.trim();
        const contrasena = loginClave.value;
        const btnSubmit = formLogin.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';

        try {
            const respuesta = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, contrasena })
            });
            const data = await respuesta.json();

            if (!respuesta.ok) {
                loginError.textContent = data.error || 'No se pudo iniciar sesión.';
                loginError.style.display = 'block';
                return;
            }

            // Recargar para que el menú y todos los permisos usen la nueva sesión
            location.reload();
        } catch (error) {
            loginError.textContent = 'No se pudo conectar con el servidor. Verifica que esté corriendo.';
            loginError.style.display = 'block';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = textoOriginal;
        }
    });

    // =====================================================
    // 3. CERRAR SESIÓN
    // =====================================================
    btnCerrarSesion?.addEventListener('click', () => cerrarSesion());

    // =====================================================
    // 4. RESTAURAR SESIÓN EXISTENTE (validada por el servidor)
    // =====================================================
    obtenerSesion().then(datos => {
        if (datos.rol) {
            sesion = datos;
            mostrarDashboard();
        }
    });

    // =====================================================
    // 5. RENDER DEL DASHBOARD
    // =====================================================
    async function mostrarDashboard() {
        vistaLogin.style.display = 'none';
        vistaDashboard.style.display = 'block';

        if (sesion.rol === 'alumno') {
            saludoUsuario.textContent = `Bienvenido/a, ${sesion.estudiante.nombre}`;
            subtituloUsuario.textContent = `Alumno/a · ${sesion.estudiante.curso || ''}`;
            dashboardAlumno.style.display = 'block';
            dashboardProfesor.style.display = 'none';
            cargarAnuncios();
            cargarMateriasAlumno();
        } else if (sesion.rol === 'apoderado') {
            saludoUsuario.textContent = `Bienvenido/a, ${sesion.estudiante.apoderado_nombre || 'Apoderado/a'}`;
            subtituloUsuario.textContent = `Apoderado/a de ${sesion.estudiante.nombre} · ${sesion.estudiante.curso || ''}`;
            dashboardAlumno.style.display = 'block';
            dashboardProfesor.style.display = 'none';
            cargarAnuncios();
            cargarMateriasAlumno();
        } else if (sesion.rol === 'profesor') {
            saludoUsuario.textContent = `Bienvenido/a, ${sesion.profesor.nombre}`;
            subtituloUsuario.textContent = `Profesor/a · ${sesion.profesor.departamento || ''}`;
            dashboardAlumno.style.display = 'none';
            dashboardProfesor.style.display = 'block';
            document.getElementById('tituloPanelProfesor').innerHTML = '<i class="bi bi-journal-bookmark-fill me-2 text-primary"></i>Mi(s) Asignatura(s)';
            cargarPanelProfesor(sesion.asignaturas || []);
        } else if (sesion.rol === 'admin') {
            saludoUsuario.textContent = `Bienvenido/a, ${sesion.admin.nombre}`;
            subtituloUsuario.textContent = 'Administración · acceso a todas las asignaturas';
            dashboardAlumno.style.display = 'none';
            dashboardProfesor.style.display = 'block';
            document.getElementById('tituloPanelProfesor').innerHTML = '<i class="bi bi-journal-bookmark-fill me-2 text-primary"></i>Todas las Asignaturas';
            try {
                const respuesta = await fetch(`${API_URL}/db`);
                const db = await respuesta.json();
                cargarPanelProfesor(db.asignaturas);
            } catch (error) {
                cargarPanelProfesor([]);
            }
        }
    }

    // =====================================================
    // 6. VISTA ALUMNO / APODERADO
    // =====================================================
    async function cargarAnuncios() {
        const contenedor = document.getElementById('contenedorAnunciosAlumno');
        contenedor.innerHTML = `<div class="col-12"><div class="skeleton" style="height:120px;border-radius:8px;"></div></div>`;
        try {
            const respuesta = await fetch(`${API_URL}/anuncios_aula`);
            const anuncios = await respuesta.json();

            if (!Array.isArray(anuncios) || anuncios.length === 0) {
                contenedor.innerHTML = `<div class="col-12 empty-state"><i class="bi bi-megaphone"></i><p>No hay anuncios por el momento.</p></div>`;
                return;
            }

            contenedor.innerHTML = anuncios.map(a => `
                <div class="col-md-6 mb-3">
                    <div class="card anuncio-card p-3 h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge badge-primary"><i class="bi bi-person-badge me-1"></i>${escaparHTML(a.autor)}</span>
                            <small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${escaparHTML(a.fecha)}</small>
                        </div>
                        <h5 class="fw-bold mb-1">${escaparHTML(a.titulo)}</h5>
                        <p class="text-muted mb-0 small">${escaparHTML(a.contenido)}</p>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            contenedor.innerHTML = `<div class="col-12 empty-state"><p class="text-danger">No se pudieron cargar los anuncios.</p></div>`;
        }
    }

    async function cargarMateriasAlumno() {
        const contenedor = document.getElementById('contenedorMateriasAlumno');
        contenedor.innerHTML = `<div class="col-12"><div class="skeleton" style="height:120px;border-radius:8px;"></div></div>`;
        try {
            const respuesta = await fetch(`${API_URL}/db`);
            const db = await respuesta.json();

            contenedor.innerHTML = db.asignaturas.map(asig => {
                const profesor = db.profesores.find(p => p.id === asig.profesor_id);
                return `
                    <div class="col-md-6 col-lg-4">
                        <div class="card materia-card p-3 h-100" style="border-top-color: var(--accent-${asig.color});">
                            <span class="materia-codigo">Código: ${asig.codigo}</span>
                            <h5 class="materia-nombre" title="${escaparHTML(asig.nombre)}">${escaparHTML(asig.nombre)}</h5>
                            <p class="materia-profesor mb-3">
                                <i class="bi bi-person-fill"></i>${profesor ? profesor.nombre : 'Sin asignar'}
                            </p>
                            <div class="d-flex gap-2 mt-auto">
                                <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1" data-ver-recursos="${asig.id}" data-nombre-asig="${escaparHTML(asig.nombre)}">
                                    <i class="bi bi-collection-fill me-1"></i>Materiales
                                </button>
                                <button class="btn btn-sm btn-outline-warning rounded-pill flex-grow-1" data-ver-notas="${asig.id}" data-nombre-asig="${escaparHTML(asig.nombre)}">
                                    <i class="bi bi-mortarboard-fill me-1"></i>Notas
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            contenedor.querySelectorAll('[data-ver-recursos]').forEach(btn => {
                btn.addEventListener('click', () => verRecursosAlumno(btn.dataset.verRecursos, btn.dataset.nombreAsig));
            });
            contenedor.querySelectorAll('[data-ver-notas]').forEach(btn => {
                btn.addEventListener('click', () => verNotasAlumno(btn.dataset.verNotas, btn.dataset.nombreAsig));
            });
        } catch (error) {
            contenedor.innerHTML = `<div class="col-12 empty-state"><p class="text-danger">No se pudieron cargar las materias.</p></div>`;
        }
    }

    async function verRecursosAlumno(asignaturaId, nombreAsignatura) {
        try {
            const respuesta = await fetch(`${API_URL}/recursos_aula?asignatura_id=${asignaturaId}`);
            const recursos = await respuesta.json();

            const html = (!recursos || recursos.length === 0)
                ? `<p class="text-muted text-center py-4"><i class="bi bi-inbox fs-2 d-block mb-2"></i>El profesor aún no ha publicado material.</p>`
                : `<div class="text-start">${recursos.map(r => `
                    <div class="d-flex align-items-start gap-3 p-2 mb-2 rounded" style="background: var(--bg-tertiary);">
                        <i class="bi ${ICONOS_TIPO[r.tipo] || 'bi-file-earmark'} fs-4 text-primary"></i>
                        <div class="flex-grow-1">
                            <strong class="d-block">${escaparHTML(r.titulo)}</strong>
                            <small class="text-muted d-block mb-1">${NOMBRES_TIPO[r.tipo] || r.tipo} · ${escaparHTML(r.fecha)}</small>
                            ${r.descripcion ? `<p class="small mb-1">${escaparHTML(r.descripcion)}</p>` : ''}
                            ${r.url ? `<a href="${escaparHTML(r.url)}" target="_blank" rel="noopener noreferrer" class="small fw-semibold">Abrir <i class="bi bi-box-arrow-up-right ms-1"></i></a>` : ''}
                        </div>
                    </div>
                `).join('')}</div>`;

            Swal.fire({
                title: escaparHTML(nombreAsignatura),
                html,
                width: '600px',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#1c3a63',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)'
            });
        } catch (error) {
            Swal.fire('Error', 'No se pudo cargar el material de esta materia.', 'error');
        }
    }

    async function verNotasAlumno(asignaturaId, nombreAsignatura) {
        try {
            const estudianteId = sesion.estudiante.id;
            const respuesta = await fetch(`${API_URL}/calificaciones?asignatura_id=${asignaturaId}&estudiante_id=${estudianteId}`);
            const notas = await respuesta.json();

            const html = (!notas || notas.length === 0)
                ? `<p class="text-muted text-center py-4"><i class="bi bi-mortarboard fs-2 d-block mb-2"></i>Aún no hay notas registradas en esta materia.</p>`
                : `<div class="text-start">${notas.map(n => `
                    <div class="d-flex justify-content-between align-items-center p-2 mb-2 rounded" style="background: var(--bg-tertiary);">
                        <div>
                            <strong class="d-block">${escaparHTML(n.evaluacion)}</strong>
                            <small class="text-muted">${escaparHTML(n.fecha)}</small>
                        </div>
                        <span class="badge ${Number(n.nota) >= 4 ? 'badge-primary' : 'badge-danger'} fs-6">${Number(n.nota).toFixed(1)}</span>
                    </div>
                `).join('')}</div>`;

            Swal.fire({
                title: `Notas · ${escaparHTML(nombreAsignatura)}`,
                html,
                width: '500px',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#1c3a63',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)'
            });
        } catch (error) {
            Swal.fire('Error', 'No se pudieron cargar las notas de esta materia.', 'error');
        }
    }

    // =====================================================
    // 7. VISTA PROFESOR
    // =====================================================
    async function cargarPanelProfesor(asignaturas) {
        const selector = document.getElementById('selectorAsignaturaProfesor');
        asignaturas = asignaturas || [];

        if (asignaturas.length === 0) {
            selector.innerHTML = `<p class="text-muted">No hay asignaturas disponibles.</p>`;
            document.getElementById('listaRecursosProfesor').innerHTML = '';
            document.getElementById('listaNotasProfesor').innerHTML = '';
            return;
        }

        if (!estudiantesCache) {
            try {
                const respuesta = await fetch(`${API_URL}/estudiantes`);
                estudiantesCache = await respuesta.json();
                const select = document.getElementById('notaEstudiante');
                select.innerHTML = estudiantesCache.map(e => `<option value="${e.id}">${escaparHTML(e.nombre)} (${escaparHTML(e.curso || 's/c')})</option>`).join('');
            } catch (error) {
                estudiantesCache = [];
            }
        }

        selector.innerHTML = asignaturas.map((a, i) => `
            <button class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-outline-primary'} rounded-pill" data-asig-id="${a.id}" data-asig-nombre="${escaparHTML(a.nombre)}">
                ${escaparHTML(a.nombre)}
            </button>
        `).join('');

        selector.querySelectorAll('[data-asig-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                selector.querySelectorAll('[data-asig-id]').forEach(b => b.className = 'btn btn-sm btn-outline-primary rounded-pill');
                btn.className = 'btn btn-sm btn-primary rounded-pill';
                asignaturaProfesorActiva = { id: btn.dataset.asigId, nombre: btn.dataset.asigNombre };
                cargarRecursosProfesor();
                cargarNotasProfesor();
            });
        });

        asignaturaProfesorActiva = { id: asignaturas[0].id, nombre: asignaturas[0].nombre };
        cargarRecursosProfesor();
        cargarNotasProfesor();
    }

    async function cargarRecursosProfesor() {
        const lista = document.getElementById('listaRecursosProfesor');
        if (!asignaturaProfesorActiva) return;
        lista.innerHTML = `<div class="skeleton" style="height:100px;border-radius:8px;"></div>`;

        try {
            const respuesta = await fetch(`${API_URL}/recursos_aula?asignatura_id=${asignaturaProfesorActiva.id}`);
            const recursos = await respuesta.json();

            if (!recursos || recursos.length === 0) {
                lista.innerHTML = `<div class="empty-state"><i class="bi bi-inbox"></i><p>Aún no has publicado material en ${escaparHTML(asignaturaProfesorActiva.nombre)}.</p></div>`;
                return;
            }

            lista.innerHTML = recursos.map(r => `
                <div class="card p-3 mb-2 d-flex flex-row align-items-start gap-3">
                    <i class="bi ${ICONOS_TIPO[r.tipo] || 'bi-file-earmark'} fs-4 text-primary"></i>
                    <div class="flex-grow-1">
                        <strong class="d-block">${escaparHTML(r.titulo)}</strong>
                        <small class="text-muted d-block mb-1">${NOMBRES_TIPO[r.tipo] || r.tipo} · ${escaparHTML(r.fecha)}</small>
                        ${r.descripcion ? `<p class="small mb-1">${escaparHTML(r.descripcion)}</p>` : ''}
                        ${r.url ? `<a href="${escaparHTML(r.url)}" target="_blank" rel="noopener noreferrer" class="small fw-semibold">Ver enlace <i class="bi bi-box-arrow-up-right ms-1"></i></a>` : ''}
                    </div>
                    <div class="d-flex flex-column gap-1">
                        <button class="btn btn-sm btn-outline-primary" data-editar-recurso="${r.id}" title="Modificar">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-eliminar-recurso="${r.id}" title="Quitar del aula">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            lista.querySelectorAll('[data-eliminar-recurso]').forEach(btn => {
                btn.addEventListener('click', () => eliminarRecurso(btn.dataset.eliminarRecurso));
            });
            lista.querySelectorAll('[data-editar-recurso]').forEach(btn => {
                const recurso = recursos.find(r => r.id === btn.dataset.editarRecurso);
                btn.addEventListener('click', () => editarRecurso(recurso));
            });
        } catch (error) {
            lista.innerHTML = `<p class="text-danger">No se pudo cargar el contenido publicado.</p>`;
        }
    }

    async function editarRecurso(recurso) {
        const { value: formValues } = await Swal.fire({
            title: 'Modificar contenido',
            html: `
                <select id="swalTipo" class="swal2-select" style="display:block;">
                    <option value="libro" ${recurso.tipo === 'libro' ? 'selected' : ''}>Libro digital</option>
                    <option value="documento" ${recurso.tipo === 'documento' ? 'selected' : ''}>Documento / Guía</option>
                    <option value="video" ${recurso.tipo === 'video' ? 'selected' : ''}>Video</option>
                    <option value="enlace" ${recurso.tipo === 'enlace' ? 'selected' : ''}>Enlace</option>
                    <option value="tarea" ${recurso.tipo === 'tarea' ? 'selected' : ''}>Tarea</option>
                </select>
                <input id="swalTitulo" class="swal2-input" placeholder="Título" value="${escaparHTML(recurso.titulo)}">
                <textarea id="swalDescripcion" class="swal2-textarea" placeholder="Descripción">${escaparHTML(recurso.descripcion)}</textarea>
                <input id="swalUrl" class="swal2-input" placeholder="Enlace (opcional)" value="${escaparHTML(recurso.url)}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar cambios',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c3a63',
            preConfirm: () => {
                const titulo = document.getElementById('swalTitulo').value.trim();
                if (!titulo) {
                    Swal.showValidationMessage('El título es obligatorio');
                    return false;
                }
                return {
                    tipo: document.getElementById('swalTipo').value,
                    titulo,
                    descripcion: document.getElementById('swalDescripcion').value.trim(),
                    url: document.getElementById('swalUrl').value.trim()
                };
            }
        });

        if (!formValues) return;

        try {
            const respuesta = await fetch(`${API_URL}/recursos_aula/${recurso.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });
            if (!respuesta.ok) throw new Error('No se pudo actualizar');
            cargarRecursosProfesor();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Contenido actualizado', showConfirmButton: false, timer: 1800 });
        } catch (error) {
            Swal.fire('Error', 'No se pudo modificar el contenido.', 'error');
        }
    }

    document.getElementById('formRecurso')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!asignaturaProfesorActiva) return;

        const nuevoRecurso = {
            id: `REC-${Date.now()}`,
            asignatura_id: asignaturaProfesorActiva.id,
            tipo: document.getElementById('recursoTipo').value,
            titulo: document.getElementById('recursoTitulo').value.trim(),
            descripcion: document.getElementById('recursoDescripcion').value.trim(),
            url: document.getElementById('recursoUrl').value.trim(),
            fecha: new Date().toLocaleDateString('es-CL')
        };

        if (!nuevoRecurso.titulo) return;

        try {
            const respuesta = await fetch(`${API_URL}/recursos_aula`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoRecurso)
            });

            if (!respuesta.ok) throw new Error('No se pudo publicar el recurso');

            document.getElementById('formRecurso').reset();
            cargarRecursosProfesor();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Publicado en el Aula', showConfirmButton: false, timer: 1800 });
        } catch (error) {
            Swal.fire('Error', 'No se pudo publicar el recurso.', 'error');
        }
    });

    async function eliminarRecurso(id) {
        const confirmacion = await Swal.fire({
            title: '¿Quitar este contenido del Aula?',
            text: 'Los alumnos y apoderados ya no podrán verlo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, quitar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#963337'
        });

        if (!confirmacion.isConfirmed) return;

        try {
            const respuesta = await fetch(`${API_URL}/recursos_aula/${id}`, { method: 'DELETE' });
            if (!respuesta.ok) throw new Error('No se pudo eliminar');
            cargarRecursosProfesor();
        } catch (error) {
            Swal.fire('Error', 'No se pudo quitar el contenido.', 'error');
        }
    }

    // =====================================================
    // 8. NOTAS (calificaciones) — el profesor las agrega y edita
    // =====================================================
    async function cargarNotasProfesor() {
        const lista = document.getElementById('listaNotasProfesor');
        if (!asignaturaProfesorActiva) return;
        lista.innerHTML = `<div class="skeleton" style="height:100px;border-radius:8px;"></div>`;

        try {
            const respuesta = await fetch(`${API_URL}/calificaciones?asignatura_id=${asignaturaProfesorActiva.id}`);
            const notas = await respuesta.json();

            if (!notas || notas.length === 0) {
                lista.innerHTML = `<div class="empty-state"><i class="bi bi-mortarboard"></i><p>Aún no hay notas registradas en ${escaparHTML(asignaturaProfesorActiva.nombre)}.</p></div>`;
                return;
            }

            lista.innerHTML = `
                <div class="table-responsive">
                    <table class="table align-middle">
                        <thead><tr><th>Alumno</th><th>Evaluación</th><th>Nota</th><th></th></tr></thead>
                        <tbody>
                            ${notas.map(n => `
                                <tr>
                                    <td>${escaparHTML(n.estudiante_nombre)}</td>
                                    <td>${escaparHTML(n.evaluacion)}<br><small class="text-muted">${escaparHTML(n.fecha)}</small></td>
                                    <td><span class="badge ${Number(n.nota) >= 4 ? 'badge-primary' : 'badge-danger'}">${Number(n.nota).toFixed(1)}</span></td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-primary me-1" data-editar-nota="${n.id}" data-eval="${escaparHTML(n.evaluacion)}" data-nota="${n.nota}" title="Modificar">
                                            <i class="bi bi-pencil-fill"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" data-eliminar-nota="${n.id}" title="Eliminar">
                                            <i class="bi bi-trash-fill"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            lista.querySelectorAll('[data-eliminar-nota]').forEach(btn => {
                btn.addEventListener('click', () => eliminarNota(btn.dataset.eliminarNota));
            });
            lista.querySelectorAll('[data-editar-nota]').forEach(btn => {
                btn.addEventListener('click', () => editarNota(btn.dataset.editarNota, btn.dataset.eval, btn.dataset.nota));
            });
        } catch (error) {
            lista.innerHTML = `<p class="text-danger">No se pudieron cargar las notas.</p>`;
        }
    }

    document.getElementById('formNota')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!asignaturaProfesorActiva) return;

        const nuevaNota = {
            id: `CAL-${Date.now()}`,
            estudiante_id: document.getElementById('notaEstudiante').value,
            asignatura_id: asignaturaProfesorActiva.id,
            evaluacion: document.getElementById('notaEvaluacion').value.trim(),
            nota: parseFloat(document.getElementById('notaValor').value),
            fecha: new Date().toLocaleDateString('es-CL')
        };

        if (!nuevaNota.estudiante_id || !nuevaNota.evaluacion || Number.isNaN(nuevaNota.nota)) return;

        try {
            const respuesta = await fetch(`${API_URL}/calificaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevaNota)
            });

            if (!respuesta.ok) throw new Error('No se pudo guardar la nota');

            document.getElementById('formNota').reset();
            cargarNotasProfesor();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota guardada', showConfirmButton: false, timer: 1800 });
        } catch (error) {
            Swal.fire('Error', 'No se pudo guardar la nota.', 'error');
        }
    });

    async function editarNota(id, evaluacionActual, notaActual) {
        const { value: formValues } = await Swal.fire({
            title: 'Modificar nota',
            html: `
                <input id="swalEvaluacion" class="swal2-input" placeholder="Evaluación" value="${escaparHTML(evaluacionActual)}">
                <input id="swalNota" type="number" min="1" max="7" step="0.1" class="swal2-input" placeholder="Nota" value="${notaActual}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar cambios',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1c3a63',
            preConfirm: () => {
                const evaluacion = document.getElementById('swalEvaluacion').value.trim();
                const nota = parseFloat(document.getElementById('swalNota').value);
                if (!evaluacion || Number.isNaN(nota)) {
                    Swal.showValidationMessage('Completa la evaluación y una nota válida');
                    return false;
                }
                return { evaluacion, nota };
            }
        });

        if (!formValues) return;

        try {
            const respuesta = await fetch(`${API_URL}/calificaciones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });
            if (!respuesta.ok) throw new Error('No se pudo actualizar');
            cargarNotasProfesor();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota actualizada', showConfirmButton: false, timer: 1800 });
        } catch (error) {
            Swal.fire('Error', 'No se pudo modificar la nota.', 'error');
        }
    }

    async function eliminarNota(id) {
        const confirmacion = await Swal.fire({
            title: '¿Eliminar esta nota?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#963337'
        });

        if (!confirmacion.isConfirmed) return;

        try {
            const respuesta = await fetch(`${API_URL}/calificaciones/${id}`, { method: 'DELETE' });
            if (!respuesta.ok) throw new Error('No se pudo eliminar');
            cargarNotasProfesor();
        } catch (error) {
            Swal.fire('Error', 'No se pudo eliminar la nota.', 'error');
        }
    }
});
