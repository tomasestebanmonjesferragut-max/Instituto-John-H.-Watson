document.addEventListener('DOMContentLoaded', () => {
    const formContacto = document.getElementById('formContacto');
    const listaMensajes = document.getElementById('listaMensajes');
    const esc = escaparHTML;

    // 0. MI PANEL: resumen distinto para cada rol
    obtenerSesion().then(mostrarPanel).catch(() => {});

    async function mostrarPanel(sesion) {
        if (!sesion.rol) return;
        const panel = document.getElementById('miPanel');
        const hoy = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];
        const lista = (items, vacio) => items.length ? `<ul class="list-unstyled small mb-0">${items.join('')}</ul>` : `<p class="small text-muted mb-0">${vacio}</p>`;
        const cifra = (n, texto) => `<p class="mb-1"><strong class="fs-4 me-2">${n}</strong>${texto}</p>`;
        const tarjeta = (icono, titulo, cuerpo, enlace, textoEnlace) => `
            <div class="col-md-6 col-lg-4">
                <div class="card p-4 h-100">
                    <h3 class="h6 fw-bold mb-3"><i class="bi ${icono} me-2 text-primary"></i>${titulo}</h3>
                    ${cuerpo}
                    ${enlace ? `<a href="${enlace}" class="small fw-semibold mt-auto pt-3">${textoEnlace} <i class="bi bi-arrow-right"></i></a>` : ''}
                </div>
            </div>`;
        let tarjetas;

        if (esDirectiva(sesion)) {
            const p = await api('panel');
            tarjetas = [
                tarjeta('bi-person-vcard', 'Admisión', cifra(p.postulaciones, 'postulaciones en revisión'), 'tramites.html#admision', 'Gestionar postulaciones'),
                tarjeta('bi-envelope', 'Mensajes', cifra(p.mensajes, 'mensajes de contacto'), '#contacto', 'Ver bandeja'),
                tarjeta('bi-pc-display', 'Soporte técnico', cifra(p.tickets, 'tickets abiertos'), 'tramites.html#soporte', 'Ver tickets'),
                tarjeta('bi-calendar-week', 'Horario y asignaturas', cifra(p.sin_docente, 'asignaturas sin docente'), 'academico.html#agenda', 'Organizar el horario'),
                tarjeta('bi-people', 'Comunidad', cifra(p.alumnos, 'alumnos') + cifra(p.docentes, 'docentes'), 'academico.html#alumnos', 'Ver fichas de alumnos'),
                sesion.rol === 'director'
                    ? tarjeta('bi-person-video3', 'Docentes', '<p class="small text-muted mb-0">Crea y edita las fichas de los docentes.</p>', 'academico.html#docentes', 'Gestionar docentes')
                    : tarjeta('bi-megaphone', 'Anuncios', '<p class="small text-muted mb-0">Publica avisos para toda la comunidad.</p>', 'aula.html', 'Ir a anuncios')
            ];
        } else {
            const [horario, asignaturas] = await Promise.all([api('horario'), api('asignaturas')]);
            const mias = sesion.rol === 'profesor' ? asignaturas.filter(a => a.profesor_id === sesion.profesor.id) : asignaturas;
            const clasesHoy = horario.bloques.filter(h => h.dia === hoy && mias.some(a => a.id === h.asignatura_id))
                .map(h => `<li class="mb-1"><span class="badge badge-id me-2">${esc(h.bloque)}</span>${esc(asignaturas.find(a => a.id === h.asignatura_id).nombre)} · ${esc(h.aula)}</li>`);
            tarjetas = [tarjeta('bi-calendar-day', 'Clases de hoy', lista(clasesHoy, 'No hay clases hoy.'), 'academico.html#agenda', 'Ver agenda semanal')];

            if (sesion.rol === 'profesor') {
                tarjetas.push(
                    tarjeta('bi-journal-bookmark', 'Mis asignaturas', lista(mias.map(a => `<li class="mb-1"><a href="aula.html?asignatura=${a.id}">${esc(a.nombre)}</a></li>`), 'No tienes asignaturas a cargo.'), 'aula.html', 'Ir a mi aula'),
                    tarjeta('bi-people', 'Mis alumnos', '<p class="small text-muted mb-0">Datos de contacto de alumnos y apoderados.</p>', 'academico.html#alumnos', 'Ver alumnos')
                );
            } else {
                const notas = await api('calificaciones');
                tarjetas.push(
                    tarjeta('bi-mortarboard', sesion.rol === 'apoderado' ? `Notas de ${esc(sesion.estudiante.nombre)}` : 'Mis últimas notas',
                        lista(notas.slice(0, 4).map(n => `<li class="d-flex justify-content-between gap-2 mb-1"><span>${esc(n.asignatura_nombre)} · ${esc(n.evaluacion)}</span><strong>${Number(n.nota).toFixed(1)}</strong></li>`), 'Aún no hay notas registradas.'),
                        'aula.html', 'Ver en el Aula Virtual'),
                    tarjeta('bi-exclamation-triangle', 'Avisos', lista(horario.avisos.map(a => `<li class="mb-1">• ${esc(a)}</li>`), 'Sin avisos.'))
                );
            }
        }

        panel.innerHTML = `
            <h2 class="fw-bold mb-1">Hola, ${esc(sesion.nombre)}</h2>
            <p class="text-muted mb-4">${NOMBRES_ROL[sesion.rol]}${sesion.rol === 'apoderado' ? ` de ${esc(sesion.estudiante.nombre)}` : ''} · Este es tu panel</p>
            <div class="row g-4">${tarjetas.join('')}</div>`;
        panel.hidden = false;
    }

    // 1. CIFRAS Y ÚLTIMAS NOTICIAS
    api('resumen').then(c => {
        document.getElementById('cifraDocentes').textContent = c.docentes;
        document.getElementById('cifraAsignaturas').textContent = c.asignaturas;
    }).catch(() => {});

    api('anuncios_aula').then(anuncios => {
        document.getElementById('contenedorNoticias').innerHTML = anuncios.slice(0, 3).map(n => `
            <div class="col-md-4">
                <article class="card noticia-card p-4 h-100">
                    <small class="text-muted mb-2"><i class="bi bi-calendar-event me-1"></i>${escaparHTML(n.fecha)} · ${escaparHTML(n.autor)}</small>
                    <h3 class="h5 fw-bold">${escaparHTML(n.titulo)}</h3>
                    <p class="text-muted small mb-0">${escaparHTML(n.contenido)}</p>
                </article>
            </div>`).join('') || '<p class="text-muted">No hay noticias publicadas por el momento.</p>';
    }).catch(() => {
        document.getElementById('contenedorNoticias').innerHTML = '<p class="text-muted">No se pudieron cargar las noticias.</p>';
    });

    // 2. FORMULARIO DE CONTACTO (el asunto puede venir desde otra página: ?asunto=...)
    const asunto = new URLSearchParams(location.search).get('asunto');
    if (asunto) formContacto.asunto.value = asunto.slice(0, 150);

    formContacto.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('contacto', 'POST', Object.fromEntries(new FormData(formContacto)));
            formContacto.reset();
            Swal.fire('¡Mensaje enviado!', 'Gracias por escribirnos. Te responderemos dentro de 2 días hábiles.', 'success');
            cargarMensajes();
        } catch (error) {
            mostrarError(error);
        }
    });

    // 3. BANDEJA DE MENSAJES (directiva)
    async function cargarMensajes() {
        if (!esDirectiva(await obtenerSesion())) return;
        const mensajes = await api('contacto').catch(() => []);

        listaMensajes.innerHTML = mensajes.map(m => `
            <article class="card p-3 mb-3">
                <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <div>
                        <strong class="d-block">${escaparHTML(m.asunto)}</strong>
                        <small class="text-muted">${escaparHTML(m.nombre)} · ${escaparHTML(m.correo)} · ${escaparHTML(m.fecha)}</small>
                    </div>
                    <div class="d-flex gap-2 align-items-start">
                        <a class="btn btn-sm btn-outline-primary" href="mailto:${escaparHTML(m.correo)}?subject=${encodeURIComponent('Re: ' + m.asunto)}" aria-label="Responder por correo"><i class="bi bi-reply-fill"></i></a>
                        <button class="btn btn-sm btn-outline-danger" data-eliminar="${m.id}" aria-label="Eliminar mensaje"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </div>
                <p class="mb-0 text-muted" style="white-space: pre-line;">${escaparHTML(m.mensaje)}</p>
            </article>`).join('') || '<p class="text-muted"><i class="bi bi-inbox me-2"></i>No hay mensajes pendientes.</p>';
    }

    listaMensajes.addEventListener('click', async (e) => {
        const boton = e.target.closest('[data-eliminar]');
        if (!boton || !await confirmar('¿Eliminar este mensaje?')) return;
        api(`contacto/${boton.dataset.eliminar}`, 'DELETE').then(cargarMensajes).catch(mostrarError);
    });

    cargarMensajes();
});
