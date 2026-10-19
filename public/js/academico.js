document.addEventListener('DOMContentLoaded', async () => {
    const sesion = await obtenerSesion();
    const gestiona = esDirectiva(sesion);               // dirección y secretaría organizan asignaturas y horario
    const esDirector = sesion.rol === 'director';       // solo el director crea y edita docentes
    const veAlumnos = gestiona || sesion.rol === 'profesor';
    const esMia = (a) => sesion.rol === 'profesor' && a.profesor_id === sesion.profesor.id;
    const esc = escaparHTML;

    const listaAsignaturas = document.getElementById('listaAsignaturas');
    const detalleAsignatura = document.getElementById('detalleAsignatura');
    const DIAS = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' };
    const COLORES = [['primary', 'Azul'], ['success', 'Verde'], ['warning', 'Amarillo'], ['danger', 'Rojo'], ['info', 'Celeste'], ['secondary', 'Gris']];

    let asignaturas = [];
    let docentes = [];
    let horario = { bloques: [], avisos: [] };
    let alumnos = [];

    async function recargar() {
        [asignaturas, docentes, horario, alumnos] = await Promise.all([
            api('asignaturas'),
            sesion.rol ? api('docentes') : [],
            sesion.rol ? api('horario') : horario,
            veAlumnos ? api('estudiantes') : []
        ]);
        mostrarAsignaturas();
        mostrarDocentes();
        mostrarAgenda();
        mostrarAlumnos();
    }

    // =====================================================
    // 1. ASIGNATURAS: lista por tipo y detalle de cada materia
    // =====================================================
    function mostrarAsignaturas() {
        const grupos = [
            ['Plan común', 'bi-book', asignaturas.filter(a => !a.codigo.startsWith('MOD'))],
            ['Módulos técnico-profesionales', 'bi-tools', asignaturas.filter(a => a.codigo.startsWith('MOD'))]
        ];
        listaAsignaturas.innerHTML = grupos.map(([titulo, icono, lista]) => `
            <h3 class="h5 fw-bold mt-4 mb-3"><i class="bi ${icono} me-2 text-primary"></i>${titulo} <span class="badge text-bg-secondary">${lista.length}</span></h3>
            <div class="list-group">${lista.map(a => `
                <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3" data-asignatura="${a.id}" style="border-left: 4px solid var(--accent-${a.color});">
                    <span class="badge text-bg-secondary">${esc(a.codigo)}</span>
                    <span class="flex-grow-1"><strong class="d-block">${esc(a.nombre)}</strong><small class="text-muted">${esc(a.descripcion)}</small></span>
                    <i class="bi bi-chevron-right text-muted" aria-hidden="true"></i>
                </button>`).join('')}
            </div>`).join('');
    }

    function verAsignatura(id) {
        const a = asignaturas.find(x => x.id === id);
        const docente = !a.tiene_docente
            ? '<p class="text-muted mb-0">Docente por asignar.</p>'
            : sesion.rol
                ? `<strong class="d-block">${esc(a.profesor_nombre)}</strong><a href="mailto:${esc(a.profesor_correo)}">${esc(a.profesor_correo)}</a>`
                : '<p class="text-muted mb-0">Esta asignatura está a cargo de un docente especialista. Inicia sesión para ver sus datos de contacto.</p>';

        detalleAsignatura.innerHTML = `
            <button type="button" class="btn btn-link px-0 mb-3" data-accion="volver"><i class="bi bi-arrow-left me-1"></i>Volver a las asignaturas</button>
            <div class="row g-4">
                <div class="col-lg-8">
                    <article class="card p-4 h-100" style="border-top: 4px solid var(--accent-${a.color});">
                        <span class="badge text-bg-secondary align-self-start mb-2">${esc(a.codigo)}</span>
                        <h3 class="fw-bold">${esc(a.nombre)}</h3>
                        <h4 class="h6 fw-bold mt-3">Qué aprenderás</h4>
                        <p class="text-muted">${esc(a.descripcion || 'Pronto publicaremos el detalle de esta asignatura.')}</p>
                        <p class="text-muted small mb-0"><i class="bi bi-clock me-1"></i>Carga semanal: ${a.bloques} ${a.bloques === 1 ? 'bloque' : 'bloques'} de 90 minutos</p>
                        ${gestiona ? `<button type="button" class="btn btn-outline-warning btn-sm align-self-start mt-3" data-accion="editar-asignatura" data-id="${a.id}"><i class="bi bi-pencil-fill me-1"></i>Editar asignatura</button>` : ''}
                        ${esMia(a) ? `<button type="button" class="btn btn-outline-warning btn-sm align-self-start mt-3" data-accion="editar-descripcion" data-id="${a.id}"><i class="bi bi-pencil-fill me-1"></i>Editar lo que se enseña</button>` : ''}
                    </article>
                </div>
                <div class="col-lg-4">
                    <aside class="card p-4 h-100">
                        <h4 class="h6 fw-bold mb-3"><i class="bi bi-person-badge me-2 text-primary"></i>Docente</h4>
                        ${docente}
                        <a href="aula.html?asignatura=${a.id}" class="btn btn-primary mt-4"><i class="bi bi-laptop me-2"></i>Entrar al Aula Virtual</a>
                    </aside>
                </div>
            </div>`;
        listaAsignaturas.hidden = true;
        detalleAsignatura.hidden = false;
        window.scrollTo(0, 0);
    }

    async function guardarAsignatura(a) {
        const datos = await formularioModal(a ? 'Editar asignatura' : 'Nueva asignatura', [
            { name: 'codigo', label: 'Código (Ej: MOD-009)', required: true },
            { name: 'nombre', label: 'Nombre', required: true },
            { name: 'descripcion', label: 'Qué se aprende', type: 'textarea' },
            { name: 'profesor_id', label: 'Docente a cargo', type: 'select', options: [['', 'Sin asignar'], ...docentes.map(d => [d.id, d.nombre])] },
            { name: 'color', label: 'Color', type: 'select', options: COLORES }
        ], a);
        if (!datos) return;
        try {
            await api(a ? `asignaturas/${a.id}` : 'asignaturas', a ? 'PUT' : 'POST', datos);
            aviso('Asignatura guardada');
            await recargar();
            if (a) verAsignatura(a.id);
        } catch (error) {
            mostrarError(error);
        }
    }

    // =====================================================
    // 2. DOCENTES: alumnos y apoderados ven nombre, asignatura y correo;
    //    docentes y directiva ven la ficha completa
    // =====================================================
    function mostrarDocentes() {
        const contenedor = document.getElementById('listaDocentes');

        if (!sesion.rol) {
            contenedor.innerHTML = `
                <div class="card p-4 mb-4 text-center">
                    <i class="bi bi-person-check-fill text-primary fs-1" aria-hidden="true"></i>
                    <h3 class="h5 fw-bold mt-2">Un docente especialista por asignatura</h3>
                    <p class="text-muted mb-3">Cada asignatura está a cargo de un profesor de su especialidad. Los datos de contacto de los docentes están disponibles para alumnos y apoderados.</p>
                    <button type="button" class="btn btn-primary align-self-center px-4" onclick="abrirLogin()"><i class="bi bi-box-arrow-in-right me-2"></i>Iniciar sesión</button>
                </div>
                <div class="list-group">${asignaturas.map(a => `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${esc(a.nombre)}</span>
                        <span class="small ${a.tiene_docente ? 'text-success' : 'text-muted'}"><i class="bi ${a.tiene_docente ? 'bi-check-circle-fill' : 'bi-hourglass-split'} me-1"></i>${a.tiene_docente ? 'Docente asignado' : 'Por asignar'}</span>
                    </div>`).join('')}
                </div>`;
            return;
        }

        // Lista de docentes; el profesor aparece primero y solo ve su propia ficha completa
        const esPropio = (d) => sesion.rol === 'profesor' && d.id === sesion.profesor.id;
        const lista = [...docentes].sort((a, b) => esPropio(b) - esPropio(a));
        const conAcciones = lista.some(d => 'curriculum' in d);

        contenedor.innerHTML = `
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead><tr><th>Docente</th><th>Asignaturas</th><th>Correo institucional</th>${conAcciones ? '<th></th>' : ''}</tr></thead>
                    <tbody>${lista.map(d => `
                        <tr>
                            <td><strong>${esc(d.nombre)}</strong>${esPropio(d) ? ' <span class="badge text-bg-primary">Tú</span>' : ''}
                                ${d.departamento ? `<br><small class="text-muted">${esc(d.departamento)}</small>` : ''}</td>
                            <td class="small">${esc(d.asignaturas.join(', ') || 'Sin asignaturas a cargo')}</td>
                            <td class="small">${d.correo ? `<a href="mailto:${esc(d.correo)}">${esc(d.correo)}</a>` : '—'}</td>
                            ${conAcciones ? `<td class="text-end text-nowrap">
                                ${'curriculum' in d ? `<button type="button" class="btn btn-sm btn-outline-primary" data-accion="ver-ficha" data-id="${d.id}"><i class="bi bi-person-vcard me-1"></i>${esPropio(d) ? 'Ver mi ficha' : 'Ver ficha'}</button>` : ''}
                                ${esDirector ? `<button type="button" class="btn btn-sm btn-outline-warning" data-accion="editar-docente" data-id="${d.id}"><i class="bi bi-pencil-fill me-1"></i>Editar</button>` : ''}
                            </td>` : ''}
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    function verFicha(d) {
        const filas = [['RUT', d.rut], ['Teléfono', d.telefono], ['Correo institucional', d.correo], ['Correo personal', d.correo_personal],
            ['Horario de trabajo', d.horario_trabajo], ['Asignaturas', d.asignaturas.join(', ')], ['Currículum', d.curriculum]];
        Swal.fire({
            title: esc(d.nombre),
            html: `<p class="text-muted">${esc(d.departamento)}</p><dl class="ficha-docente text-start">${filas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl>`,
            confirmButtonText: 'Cerrar', confirmButtonColor: '#1c3a63'
        });
    }

    async function guardarDocente(d) {
        const campos = [
            { name: 'nombre', label: 'Nombre y título', required: true },
            { name: 'departamento', label: 'Departamento', required: true },
            ...(d ? [] : [{ name: 'correo', label: 'Correo institucional (acceso al Aula)', type: 'email' }, { name: 'contrasena', label: 'Contraseña inicial (mín. 6)', type: 'password' }]),
            { name: 'rut', label: 'RUT' },
            { name: 'telefono', label: 'Teléfono' },
            { name: 'correo_personal', label: 'Correo personal', type: 'email' },
            { name: 'horario_trabajo', label: 'Horario de trabajo' },
            { name: 'curriculum', label: 'Currículum (trayectoria docente)', type: 'textarea' }
        ];
        const datos = await formularioModal(d ? 'Editar docente' : 'Nuevo docente', campos, d);
        if (!datos) return;
        try {
            await api(d ? `profesores/${d.id}` : 'profesores', d ? 'PUT' : 'POST', datos);
            aviso('Docente guardado');
            recargar();
        } catch (error) {
            mostrarError(error);
        }
    }

    // =====================================================
    // 3. AGENDA SEMANAL: al hacer clic en una clase se muestra su información
    // =====================================================
    function mostrarAgenda() {
        const contenedor = document.getElementById('contenidoAgenda');
        if (!sesion.rol) {
            contenedor.innerHTML = htmlInicioSesion('La agenda semanal está disponible para alumnos, apoderados y docentes del instituto.');
            return;
        }
        document.getElementById('accionesAgenda').hidden = false;

        const bloques = [...new Set(horario.bloques.map(h => h.bloque))];
        const pausa = (icono, texto) => `<tr class="fila-pausa"><td colspan="6"><i class="bi ${icono} me-2"></i>${texto}</td></tr>`;

        const filas = bloques.map((bloque, i) => {
            const celdas = Object.keys(DIAS).map(dia => {
                const clase = horario.bloques.find(h => h.bloque === bloque && h.dia === dia);
                const a = clase && asignaturas.find(x => x.id === clase.asignatura_id);
                return a
                    ? `<td><button type="button" class="celda-clase" data-bloque="${esc(bloque)}" data-dia="${dia}"><span class="d-block fw-semibold text-${a.color}">${esc(a.nombre)}</span><small class="text-muted">${esc(clase.aula)}</small></button></td>`
                    : '<td><span class="text-muted">—</span></td>';
            }).join('');
            return `<tr><td><span class="badge badge-id">${esc(bloque)}</span></td>${celdas}</tr>`
                + (i === 1 ? pausa('bi-cup-hot', 'Almuerzo') : '') + (i === 3 ? pausa('bi-controller', 'Receso') : '');
        }).join('');

        contenedor.innerHTML = `
            <div class="table-responsive" id="tablaAgenda">
                <table class="table align-middle text-center">
                    <thead><tr><th>Bloque</th>${Object.values(DIAS).map(d => `<th>${d}</th>`).join('')}</tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            ${horario.avisos.length ? `<div class="card p-4 mt-3"><h3 class="h6 fw-bold text-warning"><i class="bi bi-exclamation-triangle-fill me-2"></i>Avisos importantes</h3><ul class="small text-muted mb-0">${horario.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}`;
    }

    function verClase(bloque, dia) {
        const clase = horario.bloques.find(h => h.bloque === bloque && h.dia === dia);
        const a = asignaturas.find(x => x.id === clase.asignatura_id);
        Swal.fire({
            title: esc(a.nombre),
            html: `
                <dl class="ficha-docente text-start">
                    <dt>Código</dt><dd>${esc(a.codigo)}</dd>
                    <dt>Día y bloque</dt><dd>${DIAS[dia]}, ${esc(bloque)}</dd>
                    <dt>Sala</dt><dd>${esc(clase.aula || '—')}</dd>
                    <dt>Docente</dt><dd>${esc(a.profesor_nombre || 'Por asignar')}${a.profesor_correo ? `<br><a href="mailto:${esc(a.profesor_correo)}">${esc(a.profesor_correo)}</a>` : ''}</dd>
                    <dt>Qué se aprende</dt><dd>${esc(a.descripcion || '—')}</dd>
                </dl>
                <a href="aula.html?asignatura=${a.id}" class="btn btn-primary btn-sm mt-2"><i class="bi bi-laptop me-1"></i>Abrir en el Aula Virtual</a>`,
            confirmButtonText: 'Cerrar', confirmButtonColor: '#1c3a63'
        });
    }

    async function editarAgenda() {
        const datos = await formularioModal('Editar horario', [
            { name: 'bloque', label: 'Bloque horario', type: 'select', options: [...new Set(horario.bloques.map(h => h.bloque))].map(b => [b, b]) },
            { name: 'dia', label: 'Día', type: 'select', options: Object.entries(DIAS) },
            { name: 'asignatura_id', label: 'Asignatura', type: 'select', options: [['', '— Dejar libre —'], ...asignaturas.map(a => [a.id, `${a.codigo} · ${a.nombre}`])] },
            { name: 'aula', label: 'Sala (Ej: Lab Computación 1)' }
        ]);
        if (!datos) return;
        try {
            await api('horarios', 'PUT', datos);
            aviso('Horario actualizado');
            recargar();
        } catch (error) {
            mostrarError(error);
        }
    }

    function exportarAgenda() {
        html2pdf().set({
            margin: 0.3, filename: 'Agenda_Semanal_JHW.pdf',
            html2canvas: { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        }).from(document.getElementById('tablaAgenda')).save();
    }

    // =====================================================
    // 4. ALUMNOS: contacto para docentes; ficha completa para la directiva
    // =====================================================
    function mostrarAlumnos() {
        const contenedor = document.getElementById('listaAlumnos');
        if (!veAlumnos) {
            contenedor.innerHTML = '<p class="text-muted text-center py-4">La información de los alumnos es exclusiva para docentes y directiva.</p>';
            return;
        }
        const filtro = document.getElementById('buscarAlumno').value.toLowerCase();
        const lista = alumnos.filter(a => `${a.nombre} ${a.curso}`.toLowerCase().includes(filtro));
        const conFicha = gestiona;
        const fecha = (f) => f ? f.split('-').reverse().join('/') : '—';

        contenedor.innerHTML = `
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead><tr><th>Alumno</th><th>Curso</th>${conFicha ? '<th>RUT</th><th>Nacimiento</th>' : ''}<th>Correo del alumno</th><th>Apoderado</th></tr></thead>
                    <tbody>${lista.map(a => `
                        <tr>
                            <td><strong>${esc(a.nombre)}</strong></td>
                            <td>${esc(a.curso)}</td>
                            ${conFicha ? `<td class="small">${esc(a.rut || '—')}</td><td class="small">${fecha(a.fecha_nacimiento)}</td>` : ''}
                            <td class="small"><a href="mailto:${esc(a.correo_alumno)}">${esc(a.correo_alumno)}</a></td>
                            <td class="small">${esc(a.apoderado_nombre || '—')}<br>
                                ${a.correo_apoderado ? `<a href="mailto:${esc(a.correo_apoderado)}">${esc(a.correo_apoderado)}</a>` : ''}
                                ${conFicha && a.telefono_apoderado ? `<br><span class="text-muted">${esc(a.telefono_apoderado)}</span>` : ''}</td>
                        </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">No hay alumnos con ese nombre o curso.</td></tr>'}
                    </tbody>
                </table>
            </div>`;
    }
    document.getElementById('buscarAlumno').addEventListener('input', mostrarAlumnos);
    if (sesion.rol === 'profesor') document.getElementById('tituloAlumnos').lastChild.textContent = 'Mis alumnos';

    async function editarDescripcion(a) {
        const datos = await formularioModal(`Qué se enseña en ${a.nombre}`, [{ name: 'descripcion', label: 'Contenidos de la asignatura', type: 'textarea', required: true }], a);
        if (!datos) return;
        try {
            await api(`asignaturas/${a.id}/descripcion`, 'PUT', datos);
            aviso('Descripción actualizada');
            await recargar();
            verAsignatura(a.id);
        } catch (error) {
            mostrarError(error);
        }
    }

    // =====================================================
    // 5. ACCIONES (un solo manejador para toda la página)
    // =====================================================
    document.querySelector('main').addEventListener('click', (e) => {
        const item = e.target.closest('[data-asignatura]');
        if (item) return verAsignatura(item.dataset.asignatura);

        const celda = e.target.closest('.celda-clase');
        if (celda) return verClase(celda.dataset.bloque, celda.dataset.dia);

        const boton = e.target.closest('[data-accion]');
        if (!boton) return;
        const id = boton.dataset.id;
        const acciones = {
            'volver': () => { detalleAsignatura.hidden = true; listaAsignaturas.hidden = false; },
            'nueva-asignatura': () => guardarAsignatura(),
            'editar-asignatura': () => guardarAsignatura(asignaturas.find(a => a.id === id)),
            'editar-descripcion': () => editarDescripcion(asignaturas.find(a => a.id === id)),
            'nuevo-docente': () => guardarDocente(),
            'editar-docente': () => guardarDocente(docentes.find(d => d.id === id)),
            'ver-ficha': () => verFicha(docentes.find(d => d.id === id)),
            'editar-agenda': editarAgenda,
            'exportar-agenda': exportarAgenda
        };
        acciones[boton.dataset.accion]?.();
    });

    recargar().catch(() => {
        listaAsignaturas.innerHTML = '<p class="text-danger">No se pudo cargar la información académica.</p>';
    });
});
