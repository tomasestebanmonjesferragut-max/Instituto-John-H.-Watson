document.addEventListener('DOMContentLoaded', () => {
    const formContacto = document.getElementById('formContacto');
    const listaMensajes = document.getElementById('listaMensajes');

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

    // 3. BANDEJA DE MENSAJES (solo administración)
    async function cargarMensajes() {
        if ((await obtenerSesion()).rol !== 'admin') return;
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
