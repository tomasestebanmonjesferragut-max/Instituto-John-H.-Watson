document.addEventListener('DOMContentLoaded', () => {
    const formContacto = document.getElementById('formContacto');
    if (!formContacto) return;

    const API_URL = '/api';
    const bandeja = document.getElementById('bandejaMensajes');
    const listaMensajes = document.getElementById('listaMensajes');

    // Asunto sugerido desde otras páginas (ej: "Consulta para Lic. Carmen Rojas")
    const asuntoSugerido = new URLSearchParams(location.search).get('asunto');
    if (asuntoSugerido) {
        document.getElementById('contactoAsunto').value = asuntoSugerido.slice(0, 150);
    }

    // 1. ENVIAR MENSAJE
    formContacto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const boton = formContacto.querySelector('button[type="submit"]');
        boton.disabled = true;

        try {
            const respuesta = await fetch(`${API_URL}/contacto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: document.getElementById('contactoNombre').value.trim(),
                    correo: document.getElementById('contactoCorreo').value.trim(),
                    asunto: document.getElementById('contactoAsunto').value.trim(),
                    mensaje: document.getElementById('contactoMensaje').value.trim()
                })
            });
            const data = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo enviar el mensaje');

            formContacto.reset();
            Swal.fire('¡Mensaje enviado!', 'Gracias por escribirnos. Te responderemos al correo indicado dentro de 2 días hábiles.', 'success');
            if (bandeja.style.display !== 'none') cargarMensajes();
        } catch (error) {
            Swal.fire('No se pudo enviar', escaparHTML(error.message), 'error');
        } finally {
            boton.disabled = false;
        }
    });

    // 2. BANDEJA DE MENSAJES (solo administración)
    obtenerSesion().then(sesion => {
        if (sesion.rol === 'admin') {
            bandeja.style.display = '';
            cargarMensajes();
        }
    });

    async function cargarMensajes() {
        try {
            const respuesta = await fetch(`${API_URL}/contacto`);
            if (!respuesta.ok) throw new Error('Sin acceso');
            const mensajes = await respuesta.json();

            if (mensajes.length === 0) {
                listaMensajes.innerHTML = '<p class="text-muted"><i class="bi bi-inbox me-2"></i>No hay mensajes pendientes.</p>';
                return;
            }

            listaMensajes.innerHTML = mensajes.map(m => `
                <article class="card p-3 mb-3">
                    <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
                        <div>
                            <strong class="d-block">${escaparHTML(m.asunto)}</strong>
                            <small class="text-muted">${escaparHTML(m.nombre)} · <a href="mailto:${escaparHTML(m.correo)}">${escaparHTML(m.correo)}</a> · ${escaparHTML(m.fecha)}</small>
                        </div>
                        <div class="d-flex gap-2 align-items-start">
                            <a class="btn btn-sm btn-outline-primary" href="mailto:${escaparHTML(m.correo)}?subject=${encodeURIComponent('Re: ' + m.asunto)}" title="Responder por correo" aria-label="Responder por correo"><i class="bi bi-reply-fill"></i></a>
                            <button class="btn btn-sm btn-outline-danger" data-eliminar-mensaje="${m.id}" title="Eliminar mensaje" aria-label="Eliminar mensaje"><i class="bi bi-trash-fill"></i></button>
                        </div>
                    </div>
                    <p class="mb-0 text-muted" style="white-space: pre-line;">${escaparHTML(m.mensaje)}</p>
                </article>
            `).join('');

            listaMensajes.querySelectorAll('[data-eliminar-mensaje]').forEach(btn => {
                btn.addEventListener('click', () => eliminarMensaje(btn.dataset.eliminarMensaje));
            });
        } catch (error) {
            listaMensajes.innerHTML = '<p class="text-danger">No se pudieron cargar los mensajes.</p>';
        }
    }

    async function eliminarMensaje(id) {
        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar este mensaje?',
            text: 'Hazlo cuando ya esté respondido.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#963337'
        });
        if (!isConfirmed) return;

        const respuesta = await fetch(`${API_URL}/contacto/${id}`, { method: 'DELETE' }).catch(() => null);
        if (!respuesta?.ok) return Swal.fire('Error', 'No se pudo eliminar el mensaje.', 'error');
        cargarMensajes();
    }
});
