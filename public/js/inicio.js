document.addEventListener('DOMContentLoaded', () => {
    const contenedorNoticias = document.getElementById('contenedorNoticias');
    if (!contenedorNoticias) return;

    const API_URL = '/api';

    cargarInicio();

    // Últimas noticias y cifras reales desde la base de datos
    async function cargarInicio() {
        try {
            const respuesta = await fetch(`${API_URL}/db`);
            if (!respuesta.ok) throw new Error('Error de red');
            const db = await respuesta.json();

            document.getElementById('cifraDocentes').textContent = db.profesores.length;
            document.getElementById('cifraAsignaturas').textContent = db.asignaturas.length;

            const noticias = db.anuncios_aula.slice(0, 3);
            if (noticias.length === 0) {
                contenedorNoticias.innerHTML = '<p class="text-muted">No hay noticias publicadas por el momento.</p>';
                return;
            }

            contenedorNoticias.innerHTML = noticias.map(n => `
                <div class="col-md-4">
                    <article class="card noticia-card p-4 h-100">
                        <small class="text-muted mb-2"><i class="bi bi-calendar-event me-1"></i>${escaparHTML(n.fecha)} · ${escaparHTML(n.autor)}</small>
                        <h3 class="h5 fw-bold">${escaparHTML(n.titulo)}</h3>
                        <p class="text-muted small mb-0">${escaparHTML(n.contenido)}</p>
                    </article>
                </div>
            `).join('');
        } catch (error) {
            contenedorNoticias.innerHTML = '<p class="text-muted">No se pudieron cargar las noticias. Inténtalo más tarde.</p>';
        }
    }
});
