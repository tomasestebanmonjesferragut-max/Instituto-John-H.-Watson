    document.addEventListener('DOMContentLoaded', () => {
        const contenedorAnuncios = document.getElementById('contenedorAnuncios');
        const contenedorMateriasAula = document.getElementById('contenedorMateriasAula');
        const contenedorProfContacto = document.getElementById('contenedorProfesoresContacto');
        
        const btnPublicar = document.getElementById('btnPublicarAnuncio');
        const buscadorAula = document.getElementById('buscadorAula');
        
        if (!contenedorAnuncios) return;

        const API_URL = '/api';
        let db = null;
        let esAdmin = false;

        // Solo administración publica y borra anuncios
        obtenerSesion().then(sesion => {
            esAdmin = sesion.rol === 'admin';
            if (btnPublicar) btnPublicar.style.display = esAdmin ? 'block' : 'none';
            if (db) renderizarAnuncios(buscadorAula?.value || '');
        });

        inicializarAula();

        async function inicializarAula() {
            try {
                const respuesta = await fetch(`${API_URL}/db`);
                if (!respuesta.ok) throw new Error("Error de red");
                
                db = await respuesta.json();
                
                // Renderizamos todas las secciones
                renderizarAnuncios();
                renderizarMateriasAula();
                renderizarProfesoresContacto(); 
                
            } catch (error) {
                contenedorAnuncios.innerHTML = `<p class="text-danger w-100 text-center py-5"><i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>Error al conectar con MySQL.</p>`;
            }
        }

        // ==========================================
        // SECCIÓN 1: ANUNCIOS
        // ==========================================
        function generarEtiquetas(texto) {
            let tags = '';
            const t = texto.toLowerCase();
            
            if (t.includes('examen') || t.includes('prueba') || t.includes('evaluación')) {
                tags += '<span class="badge bg-danger me-1 shadow-sm"><i class="bi bi-pencil-square me-1"></i>Evaluación</span>';
            }
            if (t.includes('urgente') || t.includes('importante') || t.includes('atención')) {
                tags += '<span class="badge bg-warning text-dark me-1 shadow-sm"><i class="bi bi-exclamation-circle me-1"></i>Importante</span>';
            }
            if (t.includes('material') || t.includes('apunte') || t.includes('libro') || t.includes('guía')) {
                tags += '<span class="badge bg-info text-dark me-1 shadow-sm"><i class="bi bi-file-earmark-text me-1"></i>Material</span>';
            }
            return tags;
        }

        function renderizarAnuncios(filtro = '') {
            contenedorAnuncios.innerHTML = '';
            if (!db.anuncios_aula || db.anuncios_aula.length === 0) {
                contenedorAnuncios.innerHTML = `<div class="text-center w-100 py-5"><i class="bi bi-inbox fs-1 text-muted d-block mb-3"></i><p class="text-muted">No hay anuncios publicados.</p></div>`;
                return;
            }

            const textoFiltro = filtro.toLowerCase();
            const anunciosFiltrados = db.anuncios_aula.filter(a => 
                a.titulo.toLowerCase().includes(textoFiltro) || a.contenido.toLowerCase().includes(textoFiltro) || a.autor.toLowerCase().includes(textoFiltro)
            );

            if (anunciosFiltrados.length === 0) {
                contenedorAnuncios.innerHTML = `<div class="text-center w-100 py-5"><p class="text-muted">No se encontraron anuncios para "${escaparHTML(filtro)}".</p></div>`;
                return;
            }

            // El servidor ya los entrega del más reciente al más antiguo
            const likesGuardados = JSON.parse(localStorage.getItem('likesAula') || '[]');

            anunciosFiltrados.forEach(anuncio => {
                const btnEliminarHtml = esAdmin ? `<button class="btn btn-sm btn-outline-danger ms-auto" onclick="eliminarAnuncio('${escaparHTML(anuncio.id)}')" title="Borrar anuncio" aria-label="Borrar anuncio"><i class="bi bi-trash"></i></button>` : '';
                const tieneLike = likesGuardados.includes(anuncio.id);
                const likeIcon = tieneLike ? 'bi-heart-fill text-danger' : 'bi-heart text-muted';
                const etiquetas = generarEtiquetas(`${anuncio.titulo} ${anuncio.contenido}`);

                contenedorAnuncios.innerHTML += `
                    <div class="col-md-6 mb-4 fade-in">
                        <div class="card h-100 p-4 d-flex flex-column shadow-sm" style="border-top: 4px solid var(--accent-primary); background: var(--glass-panel);">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div class="w-100">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <span class="badge text-bg-primary"><i class="bi bi-person-circle me-1"></i>${escaparHTML(anuncio.autor)}</span>
                                        <small class="text-muted"><i class="bi bi-calendar-event me-1"></i>${escaparHTML(anuncio.fecha)}</small>
                                    </div>
                                    ${etiquetas ? `<div class="mb-2">${etiquetas}</div>` : ''}
                                    <h4 class="fw-bold mb-1 mt-2">${escaparHTML(anuncio.titulo)}</h4>
                                </div>
                            </div>
                            <p class="text-muted flex-grow-1" style="white-space: pre-line;">${escaparHTML(anuncio.contenido)}</p>
                            <div class="d-flex align-items-center mt-3 pt-3 border-top" style="border-color: var(--glass-border) !important;">
                                <button class="btn btn-sm btn-link text-decoration-none p-0 me-3 btn-like" data-id="${escaparHTML(anuncio.id)}" title="Marcar como importante" aria-label="Marcar como importante">
                                    <i class="bi ${likeIcon} fs-5" style="transition: transform 0.2s;"></i>
                                </button>
                                <button class="btn btn-sm btn-link text-muted text-decoration-none p-0 btn-copiar" data-texto="${escaparHTML(`${anuncio.titulo}: ${anuncio.contenido}`)}" title="Copiar al portapapeles" aria-label="Copiar al portapapeles">
                                    <i class="bi bi-share fs-5"></i>
                                </button>
                                ${btnEliminarHtml}
                            </div>
                        </div>
                    </div>
                `;
            });

            document.querySelectorAll('.btn-like').forEach(btn => btn.addEventListener('click', (e) => manejarLike(e.currentTarget)));
            document.querySelectorAll('.btn-copiar').forEach(btn => btn.addEventListener('click', (e) => copiarContenido(e.currentTarget)));
        }

        // ==========================================
        // SECCIÓN 2: CAJAS DE MATERIAS
        // ==========================================
        function renderizarMateriasAula() {
            if (!contenedorMateriasAula || !db.asignaturas) return;
            contenedorMateriasAula.innerHTML = '';

            db.asignaturas.forEach(materia => {
                const profesor = db.profesores.find(p => p.id === materia.profesor_id);
                const nombreProf = profesor ? profesor.nombre : 'Sin asignar';
                
                // Usamos una estructura que permite al texto expandirse horizontalmente
                contenedorMateriasAula.innerHTML += `
                    <div class="materia-card card h-100 p-3 shadow-sm" style="background: var(--glass-panel); border: 1px solid var(--glass-border); border-left: 4px solid var(--accent-${materia.color});">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge text-bg-${materia.color} bg-opacity-75" style="font-size: 0.75rem;">${materia.codigo}</span>
                            <i class="bi bi-folder-fill text-${materia.color} fs-4"></i>
                        </div>
                        <h5 class="fw-bold mb-1 materia-nombre" title="${materia.nombre}">${materia.nombre}</h5>
                        <p class="text-muted small mb-3">
                            <i class="bi bi-person-fill me-1"></i>${nombreProf}
                        </p>
                        <button class="btn btn-sm btn-outline-${materia.color} rounded-pill w-100 fw-bold mt-auto" onclick="verMaterialMateria('${escaparHTML(materia.id)}')">
                            Ver Material
                        </button>
                    </div>
                `;
            });
        }

        // Material publicado por el docente (requiere iniciar sesión)
        window.verMaterialMateria = async (asignaturaId) => {
            const materia = db.asignaturas.find(a => a.id === asignaturaId);
            const titulo = `<i class="bi bi-folder-check text-primary me-2"></i>${escaparHTML(materia?.nombre)}`;

            const respuesta = await fetch(`${API_URL}/recursos_aula?asignatura_id=${encodeURIComponent(asignaturaId)}`).catch(() => null);

            if (respuesta?.status === 401) {
                const { isConfirmed } = await Swal.fire({
                    title: titulo,
                    html: '<p class="text-muted mt-3">El material de las asignaturas es exclusivo para alumnos, apoderados y docentes del instituto.</p>',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: '<i class="bi bi-box-arrow-in-right me-1"></i>Iniciar sesión',
                    cancelButtonText: 'Cerrar',
                    confirmButtonColor: '#1c3a63'
                });
                if (isConfirmed) abrirLogin();
                return;
            }

            if (!respuesta?.ok) {
                return Swal.fire('Error', 'No se pudo cargar el material de esta asignatura.', 'error');
            }

            const recursos = await respuesta.json();
            const html = recursos.length === 0
                ? '<p class="text-muted mt-3">El docente aún no ha publicado material en esta asignatura.</p>'
                : `<div class="text-start mt-3">${recursos.map(r => `
                    <div class="p-2 mb-2 rounded" style="background: var(--bg-tertiary);">
                        <strong class="d-block">${escaparHTML(r.titulo)}</strong>
                        <small class="text-muted d-block">${escaparHTML(r.fecha)}</small>
                        ${r.descripcion ? `<p class="small mb-1">${escaparHTML(r.descripcion)}</p>` : ''}
                        ${r.url ? `<a href="${escaparHTML(r.url)}" target="_blank" rel="noopener noreferrer" class="small fw-semibold">Abrir <i class="bi bi-box-arrow-up-right ms-1"></i></a>` : ''}
                    </div>`).join('')}</div>`;

            Swal.fire({
                title: titulo,
                html,
                width: '600px',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#1c3a63',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            });
        };

        // ==========================================
        // SECCIÓN 3: DIRECTORIO DE CONTACTO DOCENTE
        // ==========================================
        function renderizarProfesoresContacto() {
            if (!contenedorProfContacto || !db.profesores) return;
            contenedorProfContacto.innerHTML = '';

            const colores = ['primary', 'success', 'info', 'warning', 'danger'];

            db.profesores.forEach((prof, index) => {
                const color = colores[index % colores.length];
                
                contenedorProfContacto.innerHTML += `
                    <div class="profesor-card card h-100 p-3" style="background: var(--glass-panel); border: 1px solid var(--glass-border); border-bottom: 4px solid var(--accent-${color});">
                        <div class="d-flex align-items-center mb-2">
                            <div class="bg-${color} bg-opacity-10 p-2 rounded me-3 text-${color}">
                                <i class="bi bi-person-badge fs-3"></i>
                            </div>
                            <div style="min-width: 0;"> <h6 class="fw-bold mb-0 text-truncate">${escaparHTML(prof.nombre)}</h6>
                                <small class="text-${color} d-block text-truncate" style="font-size: 0.75rem;">${escaparHTML(prof.departamento)}</small>
                            </div>
                        </div>
                        <a class="btn btn-sm btn-outline-${color} w-100 rounded-pill" href="contacto.html?asunto=${encodeURIComponent(`Consulta para ${prof.nombre}`)}">
                            Contactar
                        </a>
                    </div>
                `;
            });
        }

        // ==========================================
        // INTERACCIONES Y LÓGICA DE BD (LIKES, BORRAR, PUBLICAR)
        // ==========================================
        if (buscadorAula) buscadorAula.addEventListener('input', (e) => renderizarAnuncios(e.target.value));

        function manejarLike(btn) {
            const id = btn.dataset.id;
            let likes = JSON.parse(localStorage.getItem('likesAula') || '[]');
            const icon = btn.querySelector('i');
            if (likes.includes(id)) {
                likes = likes.filter(l => l !== id);
                icon.classList.replace('bi-heart-fill', 'bi-heart');
                icon.classList.replace('text-danger', 'text-muted');
            } else {
                likes.push(id);
                icon.classList.replace('bi-heart', 'bi-heart-fill');
                icon.classList.replace('text-muted', 'text-danger');
                icon.style.transform = 'scale(1.3)';
                setTimeout(() => icon.style.transform = 'scale(1)', 200);
            }
            localStorage.setItem('likesAula', JSON.stringify(likes));
        }

        function copiarContenido(btn) {
            navigator.clipboard.writeText(btn.dataset.texto).then(() => {
                Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Copiado al portapapeles', showConfirmButton: false, timer: 2000 });
            });
        }

        window.eliminarAnuncio = async (idBuscado) => {
            Swal.fire({ title: '¿Borrar anuncio?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar' }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const respuesta = await fetch(`${API_URL}/anuncios_aula/${idBuscado}`, { method: 'DELETE' });
                        if (!respuesta.ok) throw new Error('No se pudo borrar');
                        await inicializarAula();
                        Swal.fire('Eliminado', 'El anuncio fue eliminado.', 'success');
                    } catch(error) { Swal.fire('Error', 'Problema al borrar.', 'error'); }
                }
            });
        };

        btnPublicar?.addEventListener('click', async () => {
            let opcionesAsignaturas = '<option value="">Anuncio General (Sin asignatura)</option>';
            if (db && db.asignaturas) {
                db.asignaturas.forEach(a => opcionesAsignaturas += `<option value="${a.nombre}">${a.nombre}</option>`);
            }

            const { value: formValues } = await Swal.fire({
                title: 'Nuevo Anuncio',
                width: '600px',
                html: `
                    <div class="row g-2 mb-3">
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input id="swal-titulo" class="form-control" placeholder="Título">
                                <label>Título del Anuncio</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input id="swal-autor" class="form-control" placeholder="Autor">
                                <label>Autor (Ej: Dirección)</label>
                            </div>
                        </div>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="swal-materia" class="form-select">${opcionesAsignaturas}</select>
                        <label>Asignatura Relacionada</label>
                    </div>
                    <div class="form-floating">
                        <textarea id="swal-cont" class="form-control" style="height: 150px" placeholder="Mensaje"></textarea>
                        <label>Contenido del Mensaje</label>
                    </div>
                `,
                focusConfirm: false, 
                showCancelButton: true, 
                confirmButtonText: 'Publicar',
                preConfirm: () => {
                    const tituloOriginal = document.getElementById('swal-titulo').value.trim();
                    const autor = document.getElementById('swal-autor').value.trim();
                    const materia = document.getElementById('swal-materia').value;
                    const cont = document.getElementById('swal-cont').value.trim();
                    
                    if (!tituloOriginal || !autor || !cont) { 
                        Swal.showValidationMessage('Título, Autor y Contenido son obligatorios'); 
                        return false; 
                    }

                    const tituloFinal = materia ? `[${materia}] ${tituloOriginal}` : tituloOriginal;
                    
                    return { 
                        titulo: tituloFinal, 
                        autor: autor, 
                        contenido: cont, 
                        fecha: new Intl.DateTimeFormat('es-CL', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date()) 
                    }
                }
            });

            if (formValues) {
                try {
                    const respuesta = await fetch(`${API_URL}/anuncios_aula`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formValues)
                    });
                    if (!respuesta.ok) throw new Error('No se pudo publicar');
                    await inicializarAula();
                    Swal.fire('¡Publicado!', 'El anuncio está en el Aula Virtual.', 'success');
                } catch (e) { Swal.fire('Error', 'No se pudo guardar', 'error'); }
            }
        });
    });