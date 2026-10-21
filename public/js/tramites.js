document.addEventListener('DOMContentLoaded', async () => {
    const sesion = await obtenerSesion();
    const esAdmin = esDirectiva(sesion); // dirección y secretaría gestionan admisión y soporte
    const esc = escaparHTML;

    const ESTADOS = ['En Revisión', 'Aceptado', 'Lista de Espera', 'Rechazado'];
    const ESTADOS_DOCENTE = ['En Revisión', 'Entrevista', 'Contratado', 'Rechazado'];
    const CURSOS = ['1° Medio', '2° Medio', '3° Medio', '4° Medio'];
    const PRIORIDADES = ['Alta', 'Media', 'Baja'];
    const claseEstado = (e) => ['Aceptado', 'Contratado'].includes(e) ? 'text-bg-success' : e === 'Rechazado' ? 'text-bg-danger' : 'text-bg-warning';
    const clasePrioridad = (p) => p === 'Alta' ? 'text-bg-danger' : p === 'Media' ? 'text-bg-warning' : 'text-bg-info';
    const opciones = (lista, actual) => lista.map(v => `<option ${v === actual ? 'selected' : ''}>${esc(v)}</option>`).join('');

    let postulaciones = [];
    let postulacionesDocentes = [];
    let tickets = [];

    // =====================================================
    // 1. ADMISIÓN PÚBLICA: postular (estudiante o docente) y consultar el estado
    // =====================================================
    const formPostulacion = document.getElementById('formPostulacion');
    const formDocente = document.getElementById('formDocente');
    const formConsulta = document.getElementById('formConsulta');

    // "Soy estudiante" / "Soy docente" muestra el formulario que corresponde
    document.querySelectorAll('[name="tipoPostulacion"]').forEach(opcion => opcion.addEventListener('change', () => {
        formPostulacion.hidden = opcion.value !== 'alumno';
        formDocente.hidden = opcion.value !== 'docente';
    }));

    const enviarPostulacion = (form, ruta) => form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const { id } = await api(ruta, 'POST', Object.fromEntries(new FormData(form)));
            form.reset();
            Swal.fire({
                icon: 'success', title: '¡Postulación recibida!', confirmButtonColor: '#1c3a63',
                html: `<p>Tu folio de seguimiento es:</p><p class="fs-3 fw-bold">${esc(id)}</p><p class="text-muted small mb-0">Guárdalo: con este folio y tu correo puedes consultar el estado en esta página.</p>`
            });
        } catch (error) {
            mostrarError(error);
        }
    });
    enviarPostulacion(formPostulacion, 'postulaciones_alumnos');
    enviarPostulacion(formDocente, 'postulaciones_docentes');

    formConsulta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resultado = document.getElementById('resultadoConsulta');
        const { folio, correo } = Object.fromEntries(new FormData(formConsulta));
        try {
            const p = await api(`postulaciones/estado?folio=${encodeURIComponent(folio)}&correo=${encodeURIComponent(correo)}`);
            resultado.innerHTML = `
                <div class="p-3 rounded fondo-suave">
                    <strong class="d-block">${esc(p.nombre)}</strong>
                    <small class="text-muted d-block mb-2">Folio ${esc(p.id)} · ${esc(p.postula_a)} · enviada el ${esc(p.fecha)}</small>
                    <span class="badge rounded-pill ${claseEstado(p.estado)}">${esc(p.estado)}</span>
                </div>`;
        } catch (error) {
            resultado.innerHTML = `<p class="text-danger small mb-0"><i class="bi bi-exclamation-circle me-1"></i>${esc(error.message)}</p>`;
        }
    });

    // =====================================================
    // 2. ADMISIÓN: GESTIÓN DE POSTULANTES ALUMNOS Y DOCENTES (directiva)
    // =====================================================
    async function cargarPostulaciones() {
        [postulaciones, postulacionesDocentes] = await Promise.all([api('postulaciones_alumnos'), api('postulaciones_docentes')]);
        const filtro = document.getElementById('buscarPostulante').value.toLowerCase();
        const coincide = (p) => p.nombre.toLowerCase().includes(filtro) || p.id.toLowerCase().includes(filtro);
        const lista = postulaciones.filter(coincide);

        document.getElementById('tablaDocentes').innerHTML = postulacionesDocentes.filter(coincide).map(p => `
            <tr>
                <td><span class="badge badge-id">#${esc(p.id)}</span></td>
                <td><strong class="d-block">${esc(p.nombre)}</strong><small class="text-muted">${esc(p.correo)}</small></td>
                <td>${esc(p.especialidad)}</td>
                <td><select class="form-select form-select-sm" data-estado-docente="${esc(p.id)}" aria-label="Estado de ${esc(p.nombre)}">${opciones(ESTADOS_DOCENTE, p.estado)}</select></td>
                <td class="small text-muted">${esc(p.fecha_postulacion)}</td>
                <td class="text-end text-nowrap">
                    <button type="button" class="btn btn-sm btn-outline-primary" data-accion="ver-docente" data-id="${esc(p.id)}" aria-label="Ver detalle"><i class="bi bi-eye-fill"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-accion="anular-docente" data-id="${esc(p.id)}" aria-label="Anular postulación"><i class="bi bi-trash-fill"></i></button>
                </td>
            </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">No hay postulaciones de docentes.</td></tr>';

        document.getElementById('tablaPostulaciones').innerHTML = lista.map(p => `
            <tr>
                <td><span class="badge badge-id">#${esc(p.id)}</span></td>
                <td><strong class="d-block">${esc(p.nombre)}</strong><small class="text-muted">${esc(p.correo)}</small></td>
                <td>${esc(p.anio_postulacion)}</td>
                <td><select class="form-select form-select-sm" data-estado="${esc(p.id)}" aria-label="Estado de ${esc(p.nombre)}">${opciones(ESTADOS, p.estado)}</select></td>
                <td class="small text-muted">${esc(p.fecha_inscripcion)}</td>
                <td class="text-end text-nowrap">
                    <button type="button" class="btn btn-sm btn-outline-primary" data-accion="ver-postulacion" data-id="${esc(p.id)}" aria-label="Ver detalle"><i class="bi bi-eye-fill"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-accion="anular-postulacion" data-id="${esc(p.id)}" aria-label="Anular postulación"><i class="bi bi-trash-fill"></i></button>
                </td>
            </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">No hay postulaciones.</td></tr>';
    }

    function verPostulacion(p) {
        const [anio, mes, dia] = String(p.fecha_nacimiento).split('-');
        Swal.fire({
            title: esc(p.nombre), confirmButtonText: 'Cerrar', confirmButtonColor: '#1c3a63',
            html: `
                <dl class="ficha-docente text-start">
                    <dt>Folio</dt><dd>${esc(p.id)}</dd>
                    <dt>Correo</dt><dd>${esc(p.correo)}</dd>
                    <dt>Nacimiento</dt><dd>${esc(`${dia}/${mes}/${anio}`)}</dd>
                    <dt>Postula a</dt><dd>${esc(p.anio_postulacion)}</dd>
                    <dt>Estado</dt><dd><span class="badge ${claseEstado(p.estado)}">${esc(p.estado)}</span></dd>
                    <dt>Motivación</dt><dd>${esc(p.motivacion || 'Sin comentarios')}</dd>
                </dl>`
        });
    }

    function verDocente(p) {
        Swal.fire({
            title: esc(p.nombre), confirmButtonText: 'Cerrar', confirmButtonColor: '#1c3a63',
            html: `
                <dl class="ficha-docente text-start">
                    <dt>Folio</dt><dd>${esc(p.id)}</dd>
                    <dt>RUT</dt><dd>${esc(p.rut || '—')}</dd>
                    <dt>Correo</dt><dd>${esc(p.correo)}</dd>
                    <dt>Teléfono</dt><dd>${esc(p.telefono || '—')}</dd>
                    <dt>Especialidad</dt><dd>${esc(p.especialidad)}</dd>
                    <dt>Estado</dt><dd><span class="badge ${claseEstado(p.estado)}">${esc(p.estado)}</span></dd>
                    <dt>Títulos y experiencia</dt><dd>${esc(p.experiencia)}</dd>
                </dl>`
        });
    }

    if (esAdmin) {
        document.getElementById('admisionPublica').hidden = true;
        document.getElementById('admisionGestion').hidden = false;
        document.getElementById('buscarPostulante').addEventListener('input', cargarPostulaciones);

        // Cambiar el estado desde la misma fila (alumnos o docentes)
        document.getElementById('admisionGestion').addEventListener('change', (e) => {
            const { estado: idAlumno, estadoDocente: idDocente } = e.target.dataset;
            if (!idAlumno && !idDocente) return;
            const [ruta, lista, id] = idAlumno ? ['postulaciones_alumnos', postulaciones, idAlumno] : ['postulaciones_docentes', postulacionesDocentes, idDocente];
            api(`${ruta}/${id}`, 'PUT', { estado: e.target.value })
                .then(() => { lista.find(p => p.id === id).estado = e.target.value; aviso('Estado actualizado'); })
                .catch(mostrarError);
        });
        cargarPostulaciones().catch(mostrarError);
    }

    // =====================================================
    // 3. SOPORTE DOCENTE (docentes y directiva)
    // =====================================================
    const formTicket = document.getElementById('formTicket');

    async function cargarTickets() {
        tickets = await api('tickets_soporte');
        const filtro = document.getElementById('filtroPrioridad').value;
        const lista = tickets.filter(t => !filtro || t.prioridad === filtro);

        document.getElementById('tablaTickets').innerHTML = lista.map(t => `
            <tr>
                <td><span class="badge badge-id">#${esc(t.id)}</span></td>
                <td><strong class="d-block">${esc(t.profesor)}</strong><small class="text-muted"><i class="bi bi-geo-alt-fill me-1"></i>${esc(t.ubicacion)}</small></td>
                <td class="small text-muted" style="max-width: 260px;">${esc(t.problema)}</td>
                <td>${esAdmin
                    ? `<select class="form-select form-select-sm" data-prioridad="${esc(t.id)}" aria-label="Prioridad del ticket ${esc(t.id)}">${opciones(PRIORIDADES, t.prioridad)}</select>`
                    : `<span class="badge rounded-pill ${clasePrioridad(t.prioridad)}">${esc(t.prioridad)}</span>`}</td>
                <td class="small text-muted">${esc(t.fecha)}</td>
                <td class="text-end">${esAdmin ? `<button type="button" class="btn btn-sm btn-outline-success text-nowrap" data-accion="resolver-ticket" data-id="${esc(t.id)}"><i class="bi bi-check2-circle me-1"></i>Resuelto</button>` : ''}</td>
            </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">No hay reportes abiertos.</td></tr>';
    }

    if (esAdmin || sesion.rol === 'profesor') {
        document.getElementById('soporteVista').hidden = false;
        document.getElementById('tituloTickets').textContent = esAdmin ? 'Reportes abiertos' : 'Mis reportes';

        // El profesor reporta a su nombre; la directiva elige al docente
        const nombres = esAdmin ? (await api('docentes')).map(d => d.nombre) : [sesion.nombre];
        formTicket.profesor.innerHTML = opciones(nombres);
        formTicket.profesor.disabled = !esAdmin;

        formTicket.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const { id } = await api('tickets_soporte', 'POST', { ...Object.fromEntries(new FormData(formTicket)), profesor: formTicket.profesor.value });
                formTicket.reset();
                formTicket.profesor.value = nombres[0];
                Swal.fire('Reporte enviado', `Tu reporte quedó registrado con el número ${esc(id)}.`, 'success');
                cargarTickets();
            } catch (error) {
                mostrarError(error);
            }
        });
        document.getElementById('filtroPrioridad').addEventListener('change', cargarTickets);
        document.getElementById('tablaTickets').addEventListener('change', (e) => {
            const id = e.target.dataset.prioridad;
            if (id) api(`tickets_soporte/${id}`, 'PUT', { prioridad: e.target.value }).then(() => aviso('Prioridad actualizada')).catch(mostrarError);
        });
        cargarTickets().catch(mostrarError);
    } else {
        document.getElementById('soporteSinAcceso').innerHTML = sesion.rol
            ? '<p class="text-center text-muted lead py-5">La mesa de soporte técnico es exclusiva para docentes y directiva. Si necesitas ayuda, escríbenos desde <a href="index.html#contacto">Contacto</a>.</p>'
            : htmlInicioSesion('La mesa de soporte técnico es exclusiva para docentes y directiva. Inicia sesión para reportar fallas en salas, laboratorios o equipos.');
    }

    // =====================================================
    // 4. ACCIONES DE LAS TABLAS
    // =====================================================
    const acciones = {
        'ver-postulacion': (id) => verPostulacion(postulaciones.find(p => p.id === id)),
        'ver-docente': (id) => verDocente(postulacionesDocentes.find(p => p.id === id)),
        'anular-docente': async (id) => {
            if (await confirmar(`¿Anular la postulación ${id}?`)) api(`postulaciones_docentes/${id}`, 'DELETE').then(cargarPostulaciones).catch(mostrarError);
        },
        'anular-postulacion': async (id) => {
            if (await confirmar(`¿Anular la postulación ${id}?`)) api(`postulaciones_alumnos/${id}`, 'DELETE').then(cargarPostulaciones).catch(mostrarError);
        },
        'nueva-postulacion': async () => {
            const datos = await formularioModal('Ingresar postulación', [
                { name: 'nombre', label: 'Nombre completo', required: true },
                { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', required: true },
                { name: 'correo', label: 'Correo', type: 'email', required: true },
                { name: 'anio_postulacion', label: 'Curso al que postula', type: 'select', options: CURSOS.map(c => [c, c]) },
                { name: 'motivacion', label: 'Motivación', type: 'textarea', required: true }
            ]);
            if (datos) api('postulaciones_alumnos', 'POST', datos).then(({ id }) => { aviso(`Folio ${id} registrado`); cargarPostulaciones(); }).catch(mostrarError);
        },
        'resolver-ticket': async (id) => {
            if (await confirmar(`¿Marcar el ticket ${id} como resuelto?`)) api(`tickets_soporte/${id}`, 'DELETE').then(cargarTickets).catch(mostrarError);
        }
    };

    document.querySelector('main').addEventListener('click', (e) => {
        const boton = e.target.closest('[data-accion]');
        if (boton) acciones[boton.dataset.accion]?.(boton.dataset.id);
    });
});
