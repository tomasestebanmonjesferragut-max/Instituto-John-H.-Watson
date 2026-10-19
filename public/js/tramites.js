document.addEventListener('DOMContentLoaded', async () => {
    const sesion = await obtenerSesion();
    const esAdmin = esDirectiva(sesion); // dirección y secretaría gestionan admisión y soporte
    const esc = escaparHTML;

    const ESTADOS = ['En Revisión', 'Aceptado', 'Lista de Espera', 'Rechazado'];
    const CURSOS = ['1° Medio', '2° Medio', '3° Medio', '4° Medio'];
    const PRIORIDADES = ['Alta', 'Media', 'Baja'];
    const claseEstado = (e) => e === 'Aceptado' ? 'text-bg-success' : e === 'Rechazado' ? 'text-bg-danger' : 'text-bg-warning';
    const clasePrioridad = (p) => p === 'Alta' ? 'text-bg-danger' : p === 'Media' ? 'text-bg-warning' : 'text-bg-info';
    const opciones = (lista, actual) => lista.map(v => `<option ${v === actual ? 'selected' : ''}>${esc(v)}</option>`).join('');

    let postulaciones = [];
    let tickets = [];

    // =====================================================
    // 1. ADMISIÓN PÚBLICA: postular y consultar el estado
    // =====================================================
    const formPostulacion = document.getElementById('formPostulacion');
    const formConsulta = document.getElementById('formConsulta');

    formPostulacion.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const { id } = await api('solicitudes_estudiantes', 'POST', Object.fromEntries(new FormData(formPostulacion)));
            formPostulacion.reset();
            Swal.fire({
                icon: 'success', title: '¡Postulación recibida!', confirmButtonColor: '#1c3a63',
                html: `<p>Tu folio de seguimiento es:</p><p class="fs-3 fw-bold">${esc(id)}</p><p class="text-muted small mb-0">Guárdalo: con este folio y tu correo puedes consultar el estado en esta página.</p>`
            });
        } catch (error) {
            mostrarError(error);
        }
    });

    formConsulta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resultado = document.getElementById('resultadoConsulta');
        const { folio, correo } = Object.fromEntries(new FormData(formConsulta));
        try {
            const p = await api(`solicitudes_estudiantes/estado?folio=${encodeURIComponent(folio)}&correo=${encodeURIComponent(correo)}`);
            resultado.innerHTML = `
                <div class="p-3 rounded fondo-suave">
                    <strong class="d-block">${esc(p.nombre)}</strong>
                    <small class="text-muted d-block mb-2">Folio ${esc(p.id)} · ${esc(p.anio_postulacion)} · enviada el ${esc(p.fecha_inscripcion)}</small>
                    <span class="badge rounded-pill ${claseEstado(p.estado)}">${esc(p.estado)}</span>
                </div>`;
        } catch (error) {
            resultado.innerHTML = `<p class="text-danger small mb-0"><i class="bi bi-exclamation-circle me-1"></i>${esc(error.message)}</p>`;
        }
    });

    // =====================================================
    // 2. ADMISIÓN: GESTIÓN (directiva)
    // =====================================================
    async function cargarPostulaciones() {
        postulaciones = await api('solicitudes_estudiantes');
        const filtro = document.getElementById('buscarPostulante').value.toLowerCase();
        const lista = postulaciones.filter(p => p.nombre.toLowerCase().includes(filtro) || p.id.toLowerCase().includes(filtro));

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

    if (esAdmin) {
        document.getElementById('admisionPublica').hidden = true;
        document.getElementById('admisionGestion').hidden = false;
        document.getElementById('buscarPostulante').addEventListener('input', cargarPostulaciones);
        document.getElementById('tablaPostulaciones').addEventListener('change', (e) => {
            const id = e.target.dataset.estado;
            if (!id) return;
            api(`solicitudes_estudiantes/${id}`, 'PUT', { estado: e.target.value })
                .then(() => { postulaciones.find(p => p.id === id).estado = e.target.value; aviso('Estado actualizado'); })
                .catch(mostrarError);
        });
        cargarPostulaciones().catch(mostrarError);
    }

    // =====================================================
    // 3. SOPORTE DOCENTE (docentes y directiva)
    // =====================================================
    const formTicket = document.getElementById('formTicket');

    async function cargarTickets() {
        tickets = await api('solicitudes_profesores');
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
                const { id } = await api('solicitudes_profesores', 'POST', { ...Object.fromEntries(new FormData(formTicket)), profesor: formTicket.profesor.value });
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
            if (id) api(`solicitudes_profesores/${id}`, 'PUT', { prioridad: e.target.value }).then(() => aviso('Prioridad actualizada')).catch(mostrarError);
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
        'anular-postulacion': async (id) => {
            if (await confirmar(`¿Anular la postulación ${id}?`)) api(`solicitudes_estudiantes/${id}`, 'DELETE').then(cargarPostulaciones).catch(mostrarError);
        },
        'nueva-postulacion': async () => {
            const datos = await formularioModal('Ingresar postulación', [
                { name: 'nombre', label: 'Nombre completo', required: true },
                { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', required: true },
                { name: 'correo', label: 'Correo', type: 'email', required: true },
                { name: 'anio_postulacion', label: 'Curso al que postula', type: 'select', options: CURSOS.map(c => [c, c]) },
                { name: 'motivacion', label: 'Motivación', type: 'textarea', required: true }
            ]);
            if (datos) api('solicitudes_estudiantes', 'POST', datos).then(({ id }) => { aviso(`Folio ${id} registrado`); cargarPostulaciones(); }).catch(mostrarError);
        },
        'resolver-ticket': async (id) => {
            if (await confirmar(`¿Marcar el ticket ${id} como resuelto?`)) api(`solicitudes_profesores/${id}`, 'DELETE').then(cargarTickets).catch(mostrarError);
        }
    };

    document.querySelector('main').addEventListener('click', (e) => {
        const boton = e.target.closest('[data-accion]');
        if (boton) acciones[boton.dataset.accion]?.(boton.dataset.id);
    });
});
