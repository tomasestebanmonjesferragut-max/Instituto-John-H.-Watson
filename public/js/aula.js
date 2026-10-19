document.addEventListener('DOMContentLoaded', async () => {
    const sesion = await obtenerSesion();
    const esc = escaparHTML;

    if (!sesion.rol) {
        const aviso = document.getElementById('aulaSinSesion');
        aviso.insertAdjacentHTML('beforeend', htmlInicioSesion('El Aula Virtual es exclusiva para alumnos, apoderados y docentes. Inicia sesión con tu correo institucional: el sistema reconoce automáticamente si eres alumno, apoderado o profesor.'));
        aviso.hidden = false;
        return;
    }

    const pestanas = document.getElementById('aulaPestanas');
    const contenido = document.getElementById('aulaContenido');
    const cajaDocente = document.getElementById('aulaDocente');
    const buscador = document.getElementById('aulaBuscador');
    const resultados = document.getElementById('aulaResultados');

    const esEstudiante = sesion.rol === 'alumno' || sesion.rol === 'apoderado';
    const TIPOS = { libro: ['bi-book-half', 'Libro digital'], documento: ['bi-file-earmark-text-fill', 'Documento / Guía'], video: ['bi-camera-video-fill', 'Video'], enlace: ['bi-link-45deg', 'Enlace'], tarea: ['bi-clipboard-check-fill', 'Tarea'] };

    document.getElementById('aulaSaludo').textContent = `Bienvenido/a, ${sesion.nombre}`;
    document.getElementById('aulaRol').textContent = sesion.rol === 'apoderado'
        ? `Apoderado/a de ${sesion.estudiante.nombre} · ${sesion.estudiante.curso || ''}`
        : `${NOMBRES_ROL[sesion.rol]}${sesion.estudiante ? ` · ${sesion.estudiante.curso || ''}` : ''}`;
    document.getElementById('aulaVista').hidden = false;

    const [todas, docentes] = await Promise.all([api('asignaturas'), api('docentes')]);

    // El profesor trabaja en sus asignaturas; alumnos, apoderados y directiva ven todas
    const clases = sesion.rol === 'profesor' ? todas.filter(a => a.profesor_id === sesion.profesor.id) : todas;
    // El aula la edita el profesor a cargo de la asignatura (y el director)
    const puedeEditar = (a) => sesion.rol === 'director' || (sesion.rol === 'profesor' && a.profesor_id === sesion.profesor.id);
    const nombreCorto = (nombre) => nombre.replace(/^Módulo:\s*/, '');
    let activa = null;
    let estudiantes = null;

    // =====================================================
    // 1. PESTAÑAS: anuncios + una por clase
    // =====================================================
    pestanas.innerHTML = [{ id: 'anuncios', nombre: 'Anuncios' }, ...clases].map(c => `
        <li class="nav-item" role="presentation">
            <button type="button" class="nav-link" role="tab" data-clase="${c.id}">${c.id === 'anuncios' ? '<i class="bi bi-megaphone-fill me-1"></i>' : ''}${esc(nombreCorto(c.nombre))}</button>
        </li>`).join('');

    function abrir(id) {
        activa = clases.find(c => c.id === id) || null;
        pestanas.querySelectorAll('[data-clase]').forEach(b => {
            const seleccionada = b.dataset.clase === (activa?.id || 'anuncios');
            b.classList.toggle('active', seleccionada);
            b.setAttribute('aria-selected', seleccionada);
            if (seleccionada) b.scrollIntoView({ block: 'nearest', inline: 'center' });
        });
        history.replaceState(null, '', activa ? `?asignatura=${activa.id}` : location.pathname);
        mostrarDocente();
        activa ? mostrarClase() : mostrarAnuncios();
    }

    // =====================================================
    // 2. BUSCADOR DE CLASES Y DOCENTE DE LA ASIGNATURA (columna derecha)
    // =====================================================
    buscador.addEventListener('input', () => {
        const texto = buscador.value.trim().toLowerCase();
        const encontradas = texto ? clases.filter(c => c.nombre.toLowerCase().includes(texto) || c.codigo.toLowerCase().includes(texto)) : [];
        resultados.innerHTML = encontradas.map(c => `
            <button type="button" class="list-group-item list-group-item-action small" data-clase="${c.id}">
                <span class="badge text-bg-secondary me-1">${esc(c.codigo)}</span>${esc(nombreCorto(c.nombre))}
            </button>`).join('') || (texto ? '<p class="small text-muted mt-2 mb-0">No hay clases con ese nombre o código.</p>' : '');
    });
    buscador.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') resultados.querySelector('[data-clase]')?.click();
    });

    function mostrarDocente() {
        const d = activa && docentes.find(x => x.id === activa.profesor_id);
        if (!activa) {
            cajaDocente.innerHTML = '<p class="small text-muted mb-0"><i class="bi bi-info-circle me-1"></i>Elige una clase para ver los datos de su docente.</p>';
            return;
        }
        const dato = (icono, valor) => valor ? `<p class="small mb-2"><i class="bi ${icono} me-2 text-primary"></i>${valor}</p>` : '';
        cajaDocente.innerHTML = `
            <h3 class="h6 fw-bold mb-3"><i class="bi bi-person-badge me-2 text-primary"></i>Docente de la asignatura</h3>
            ${d ? `
                <div class="d-flex align-items-center gap-2 mb-3"><span class="avatar-docente" aria-hidden="true"><i class="bi bi-person-fill"></i></span><strong>${esc(d.nombre)}</strong></div>
                ${dato('bi-envelope', d.correo && `<a href="mailto:${esc(d.correo)}">${esc(d.correo)}</a>`)}
                ${dato('bi-telephone', esc(d.telefono))}
                ${dato('bi-clock', esc(d.horario_trabajo))}
                <a class="btn btn-outline-primary btn-sm w-100 mt-1" href="index.html?asunto=${encodeURIComponent(`Consulta para ${d.nombre}`)}#contacto">Escribir al docente</a>`
            : '<p class="small text-muted mb-0">Docente por asignar.</p>'}`;
    }

    // =====================================================
    // 3. CONTENIDO DE UNA CLASE: material y notas
    // =====================================================
    async function mostrarClase() {
        const a = activa;
        const editable = puedeEditar(a);
        contenido.innerHTML = `
            <span class="badge text-bg-secondary align-self-start">${esc(a.codigo)}</span>
            <h3 class="fw-bold mt-2 mb-1">${esc(a.nombre)}</h3>
            <p class="text-muted mb-1">${esc(a.descripcion)}</p>
            ${editable ? '<button type="button" class="btn btn-link btn-sm px-0 align-self-start" data-accion="editar-descripcion"><i class="bi bi-pencil-fill me-1"></i>Editar lo que se enseña</button>' : ''}
            <div class="d-flex justify-content-between align-items-center mt-3 mb-3">
                <h4 class="h5 fw-bold mb-0"><i class="bi bi-collection-fill me-2 text-primary"></i>Material de estudio</h4>
                ${editable ? '<button type="button" class="btn btn-sm btn-primary" data-accion="nuevo-recurso"><i class="bi bi-plus-lg me-1"></i>Agregar</button>' : ''}
            </div>
            <div id="claseRecursos"><div class="skeleton" style="height: 80px;"></div></div>
            <div class="d-flex justify-content-between align-items-center mt-4 mb-3">
                <h4 class="h5 fw-bold mb-0"><i class="bi bi-mortarboard-fill me-2 text-warning"></i>${esEstudiante ? 'Mis notas' : 'Notas del curso'}</h4>
                ${editable ? '<button type="button" class="btn btn-sm btn-primary" data-accion="nueva-nota"><i class="bi bi-plus-lg me-1"></i>Agregar</button>' : ''}
            </div>
            <div id="claseNotas"></div>`;

        try {
            const [recursos, notas] = await Promise.all([
                api(`recursos_aula?asignatura_id=${a.id}`),
                esEstudiante || editable ? api(`calificaciones?asignatura_id=${a.id}`) : []
            ]);
            if (activa !== a) return; // se cambió de pestaña mientras cargaba

            document.getElementById('claseRecursos').innerHTML = recursos.map(r => `
                <div class="d-flex align-items-start gap-3 p-3 mb-2 rounded fondo-suave">
                    <i class="bi ${(TIPOS[r.tipo] || TIPOS.documento)[0]} fs-4 text-primary" aria-hidden="true"></i>
                    <div class="flex-grow-1">
                        <strong class="d-block">${esc(r.titulo)}</strong>
                        <small class="text-muted d-block">${(TIPOS[r.tipo] || TIPOS.documento)[1]} · ${esc(r.fecha)}</small>
                        ${r.descripcion ? `<p class="small mb-1 mt-1">${esc(r.descripcion)}</p>` : ''}
                        ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="small fw-semibold">Abrir <i class="bi bi-box-arrow-up-right ms-1"></i></a>` : ''}
                    </div>
                    ${editable ? `
                        <div class="d-flex flex-column gap-1">
                            <button type="button" class="btn btn-sm btn-outline-primary" data-accion="editar-recurso" data-id="${r.id}" aria-label="Modificar"><i class="bi bi-pencil-fill"></i></button>
                            <button type="button" class="btn btn-sm btn-outline-danger" data-accion="borrar-recurso" data-id="${r.id}" aria-label="Quitar"><i class="bi bi-trash-fill"></i></button>
                        </div>` : ''}
                </div>`).join('') || '<p class="text-muted"><i class="bi bi-inbox me-2"></i>Aún no hay material publicado en esta clase.</p>';

            const nota = (n) => `<span class="badge ${Number(n.nota) >= 4 ? 'badge-primary' : 'badge-danger'} fs-6">${Number(n.nota).toFixed(1)}</span>`;
            document.getElementById('claseNotas').innerHTML = !notas.length
                ? `<p class="text-muted"><i class="bi bi-mortarboard me-2"></i>${esEstudiante || editable ? 'Aún no hay notas registradas.' : 'Las notas solo las ven el alumno, su apoderado y el docente.'}</p>`
                : `<div class="table-responsive"><table class="table align-middle">
                    <thead><tr>${editable ? '<th>Alumno</th>' : ''}<th>Evaluación</th><th>Fecha</th><th>Nota</th>${editable ? '<th></th>' : ''}</tr></thead>
                    <tbody>${notas.map(n => `<tr>
                        ${editable ? `<td>${esc(n.estudiante_nombre)}</td>` : ''}
                        <td>${esc(n.evaluacion)}</td><td class="small text-muted">${esc(n.fecha)}</td><td>${nota(n)}</td>
                        ${editable ? `<td class="text-end text-nowrap">
                            <button type="button" class="btn btn-sm btn-outline-primary" data-accion="editar-nota" data-id="${n.id}" aria-label="Modificar nota"><i class="bi bi-pencil-fill"></i></button>
                            <button type="button" class="btn btn-sm btn-outline-danger" data-accion="borrar-nota" data-id="${n.id}" aria-label="Eliminar nota"><i class="bi bi-trash-fill"></i></button>
                        </td>` : ''}</tr>`).join('')}</tbody>
                </table></div>`;

            contenido.recursos = recursos;
            contenido.notas = notas;
        } catch (error) {
            document.getElementById('claseRecursos').innerHTML = `<p class="text-danger">${esc(error.message)}</p>`;
        }
    }

    // =====================================================
    // 4. ANUNCIOS GENERALES (la directiva publica y elimina)
    // =====================================================
    async function mostrarAnuncios() {
        const anuncios = await api('anuncios_aula').catch(() => []);
        contenido.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3 class="h5 fw-bold mb-0"><i class="bi bi-megaphone-fill me-2 text-warning"></i>Anuncios del instituto</h3>
                ${esDirectiva(sesion) ? '<button type="button" class="btn btn-sm btn-primary" data-accion="nuevo-anuncio"><i class="bi bi-plus-lg me-1"></i>Publicar</button>' : ''}
            </div>
            ${anuncios.map(n => `
                <article class="p-3 mb-3 rounded fondo-suave">
                    <div class="d-flex justify-content-between gap-2">
                        <small class="text-muted"><i class="bi bi-person-circle me-1"></i>${esc(n.autor)} · ${esc(n.fecha)}</small>
                        ${esDirectiva(sesion) ? `<button type="button" class="btn btn-sm btn-outline-danger" data-accion="borrar-anuncio" data-id="${n.id}" aria-label="Eliminar anuncio"><i class="bi bi-trash"></i></button>` : ''}
                    </div>
                    <h4 class="h6 fw-bold mt-2">${esc(n.titulo)}</h4>
                    <p class="text-muted small mb-0" style="white-space: pre-line;">${esc(n.contenido)}</p>
                </article>`).join('') || '<p class="text-muted">No hay anuncios publicados.</p>'}
            <p class="small text-muted mb-0"><i class="bi bi-arrow-up me-1"></i>Elige una clase en las pestañas o búscala a la derecha.</p>`;
    }

    // =====================================================
    // 5. ACCIONES DE EDICIÓN (docente de la asignatura o director)
    // =====================================================
    const camposRecurso = [
        { name: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(TIPOS).map(([k, [, t]]) => [k, t]) },
        { name: 'titulo', label: 'Título', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
        { name: 'url', label: 'Enlace (https://...)' }
    ];

    async function guardar(ruta, metodo, datos, mensaje) {
        if (!datos) return;
        try {
            await api(ruta, metodo, datos);
            aviso(mensaje);
            activa ? mostrarClase() : mostrarAnuncios();
        } catch (error) {
            mostrarError(error);
        }
    }

    async function borrar(ruta, pregunta) {
        if (await confirmar(pregunta)) guardar(ruta, 'DELETE', {}, 'Eliminado');
    }

    const acciones = {
        'nuevo-recurso': async () => guardar('recursos_aula', 'POST', await formularioModal('Agregar material', camposRecurso).then(d => d && { ...d, asignatura_id: activa.id }), 'Material publicado'),
        'editar-recurso': async (id) => guardar(`recursos_aula/${id}`, 'PUT', await formularioModal('Modificar material', camposRecurso, contenido.recursos.find(r => r.id === id)), 'Material actualizado'),
        'borrar-recurso': (id) => borrar(`recursos_aula/${id}`, '¿Quitar este material del aula?'),
        'nueva-nota': async () => {
            estudiantes ??= await api('estudiantes');
            const datos = await formularioModal('Agregar nota', [
                { name: 'estudiante_id', label: 'Alumno', type: 'select', options: estudiantes.map(e => [e.id, `${e.nombre} (${e.curso || 's/c'})`]) },
                { name: 'evaluacion', label: 'Evaluación (Ej: Prueba 1)', required: true },
                { name: 'nota', label: 'Nota (1.0 a 7.0)', type: 'number', required: true }
            ]);
            guardar('calificaciones', 'POST', datos && { ...datos, asignatura_id: activa.id }, 'Nota guardada');
        },
        'editar-nota': async (id) => guardar(`calificaciones/${id}`, 'PUT', await formularioModal('Modificar nota', [
            { name: 'evaluacion', label: 'Evaluación', required: true },
            { name: 'nota', label: 'Nota (1.0 a 7.0)', type: 'number', required: true }
        ], contenido.notas.find(n => n.id === id)), 'Nota actualizada'),
        'borrar-nota': (id) => borrar(`calificaciones/${id}`, '¿Eliminar esta nota?'),
        'nuevo-anuncio': async () => guardar('anuncios_aula', 'POST', await formularioModal('Nuevo anuncio', [
            { name: 'titulo', label: 'Título', required: true },
            { name: 'autor', label: 'Autor (Ej: Dirección)', required: true },
            { name: 'contenido', label: 'Contenido', type: 'textarea', required: true }
        ]), 'Anuncio publicado'),
        'borrar-anuncio': (id) => borrar(`anuncios_aula/${id}`, '¿Eliminar este anuncio?'),
        'editar-descripcion': async () => {
            const datos = await formularioModal('Qué se enseña en esta asignatura', [{ name: 'descripcion', label: 'Contenidos', type: 'textarea', required: true }], activa);
            if (!datos) return;
            try {
                await api(`asignaturas/${activa.id}/descripcion`, 'PUT', datos);
                activa.descripcion = datos.descripcion;
                aviso('Descripción actualizada');
                mostrarClase();
            } catch (error) {
                mostrarError(error);
            }
        }
    };

    document.getElementById('aulaVista').addEventListener('click', (e) => {
        const pestana = e.target.closest('[data-clase]');
        if (pestana) {
            buscador.value = '';
            resultados.innerHTML = '';
            return abrir(pestana.dataset.clase);
        }
        const boton = e.target.closest('[data-accion]');
        if (boton) acciones[boton.dataset.accion]?.(boton.dataset.id);
    });

    // Abrir la clase indicada en la dirección (?asignatura=A101) o los anuncios
    abrir(new URLSearchParams(location.search).get('asignatura'));
});
