document.addEventListener('DOMContentLoaded', () => {
    const tablaSolicitudes = document.getElementById('tablaSolicitudes');
    if (!tablaSolicitudes) return;

    const vistaPublica = document.getElementById('vistaPublica');
    const vistaAdmin = document.getElementById('vistaAdmin');

    let db = null;
    let gestor = null;
    const API_URL = '/api';

    const claseEstado = (estado) => estado === 'Aceptado' ? 'text-bg-success' : estado === 'Rechazado' ? 'text-bg-danger' : 'text-bg-warning';

    configurarVistaPublica();

    // La lista de postulantes solo la ve administración
    obtenerSesion().then(sesion => {
        if (sesion.rol === 'admin') {
            vistaPublica.style.display = 'none';
            vistaAdmin.style.display = '';
            inicializarSistema();
        }
    });

    // =====================================================
    // 1. VISTA PÚBLICA: postular y consultar estado
    // =====================================================
    function configurarVistaPublica() {
        const formPostulacion = document.getElementById('formPostulacion');
        const formConsulta = document.getElementById('formConsulta');
        const resultadoConsulta = document.getElementById('resultadoConsulta');

        formPostulacion?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const boton = formPostulacion.querySelector('button[type="submit"]');
            boton.disabled = true;

            try {
                const respuesta = await fetch(`${API_URL}/solicitudes_estudiantes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre: document.getElementById('postNombre').value.trim(),
                        fecha_nacimiento: document.getElementById('postFechaNac').value,
                        correo: document.getElementById('postCorreo').value.trim(),
                        anio_postulacion: document.getElementById('postAnio').value,
                        motivacion: document.getElementById('postMotivo').value.trim()
                    })
                });
                const data = await respuesta.json().catch(() => ({}));
                if (!respuesta.ok) throw new Error(data.error || 'No se pudo enviar la postulación');

                formPostulacion.reset();
                Swal.fire({
                    icon: 'success',
                    title: '¡Postulación recibida!',
                    html: `
                        <p>Tu folio de seguimiento es:</p>
                        <p class="fs-3 fw-bold">${escaparHTML(data.id)}</p>
                        <p class="text-muted small mb-0">Guárdalo: con este folio y tu correo puedes consultar el estado en esta misma página.</p>
                    `,
                    confirmButtonColor: '#1c3a63'
                });
            } catch (error) {
                Swal.fire('No se pudo enviar', error.message, 'error');
            } finally {
                boton.disabled = false;
            }
        });

        formConsulta?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const folio = document.getElementById('consultaFolio').value.trim();
            const correo = document.getElementById('consultaCorreo').value.trim();

            try {
                const respuesta = await fetch(`${API_URL}/solicitudes_estudiantes/estado?folio=${encodeURIComponent(folio)}&correo=${encodeURIComponent(correo)}`);
                const data = await respuesta.json();
                if (!respuesta.ok) throw new Error(data.error);

                resultadoConsulta.innerHTML = `
                    <div class="p-3 rounded" style="background: var(--bg-tertiary);">
                        <strong class="d-block">${escaparHTML(data.nombre)}</strong>
                        <small class="text-muted d-block mb-2">Folio ${escaparHTML(data.id)} · ${escaparHTML(data.anio_postulacion)} · enviada el ${escaparHTML(data.fecha_inscripcion)}</small>
                        <span class="badge rounded-pill ${claseEstado(data.estado)}">${escaparHTML(data.estado)}</span>
                    </div>`;
            } catch (error) {
                resultadoConsulta.innerHTML = `<p class="text-danger small mb-0"><i class="bi bi-exclamation-circle me-1"></i>${escaparHTML(error.message || 'No se pudo consultar')}</p>`;
            }
        });
    }

    // =====================================================
    // 2. VISTA ADMINISTRACIÓN: carga de postulaciones
    // =====================================================
    async function inicializarSistema() {
        try {
            const respuesta = await fetch(`${API_URL}/solicitudes_estudiantes`);
            if (!respuesta.ok) throw new Error("Error de red al intentar obtener los datos");

            db = { solicitudes_estudiantes: await respuesta.json() };

            // La clase gestora se crea una sola vez; después solo se refresca la tabla
            if (!gestor) gestor = new GestorPostulaciones();
            else gestor.actualizarTabla(document.getElementById('buscador')?.value || '');
        } catch (error) {
            console.error("Error inicializando el sistema de solicitudes:", error);
            tablaSolicitudes.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">No se pudieron cargar las postulaciones.</td></tr>`;
        }
    }

    // 3. Clase para gestionar toda la lógica de la vista
    class GestorPostulaciones {
        constructor() {
            this.tabla = tablaSolicitudes;
            this.panelContenido = document.getElementById('panelContenido');
            this.initEvents();
            this.actualizarTabla();
        }

        // Renderizar la tabla principal con opción a filtro
        actualizarTabla(filtro = '') {
            this.tabla.innerHTML = '';

            if (!db.solicitudes_estudiantes || db.solicitudes_estudiantes.length === 0) {
                this.tabla.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No hay postulaciones registradas.</td></tr>`;
                return;
            }

            const textoFiltro = filtro.toLowerCase();

            db.solicitudes_estudiantes.forEach((solicitud) => {
                const fechaMostrar = solicitud.fecha_inscripcion || solicitud.fecha;
                const { id, nombre, correo, anio_postulacion, motivacion, estado } = solicitud;
                const comentario = motivacion || "Sin comentarios adicionales.";

                // Filtrar por nombre o ID (folio)
                if (nombre.toLowerCase().includes(textoFiltro) || id.toLowerCase().includes(textoFiltro)) {
                    const badgeClass = claseEstado(estado);

                    const fila = document.createElement('tr');
                    fila.className = 'fade-in';
                    fila.style.cursor = 'pointer';

                    fila.innerHTML = `
                        <td><span class="badge badge-id">#${escaparHTML(id)}</span></td>
                        <td>
                            <strong class="d-block">${escaparHTML(nombre)}</strong>
                            <small class="text-muted">${escaparHTML(correo)}</small>
                        </td>
                        <td>
                            <span class="fw-medium d-block">${escaparHTML(anio_postulacion)}</span>
                            <small class="text-muted text-truncate d-block" style="max-width: 200px;">
                                <i class="bi bi-chat-left-text me-1"></i>${escaparHTML(comentario)}
                            </small>
                        </td>
                        <td><span class="badge rounded-pill ${badgeClass}">${escaparHTML(estado)}</span></td>
                        <td class="text-muted small">${escaparHTML(fechaMostrar)}</td>
                    `;

                    // Abrir detalles al hacer clic en la fila
                    fila.addEventListener('click', () => this.verDetalles(solicitud, badgeClass, fechaMostrar));
                    this.tabla.appendChild(fila);
                }
            });
        }

        // Mostrar modal con los detalles completos del estudiante
        verDetalles(solicitud, badgeClass, fechaMostrar) {
            // Formatear la fecha de nacimiento (AAAA-MM-DD -> DD/MM/AAAA)
            const fechaNacParts = String(solicitud.fecha_nacimiento).split('T')[0].split('-');
            const fechaNac = `${fechaNacParts[2]}/${fechaNacParts[1]}/${fechaNacParts[0]}`;

            Swal.fire({
                title: `<i class="bi bi-person-vcard text-primary me-2"></i>Detalle de Postulación`,
                html: `
                    <div class="text-start mt-3 px-2">
                        <div class="d-flex justify-content-between border-bottom pb-2 mb-3">
                            <h5 class="fw-bold m-0">${escaparHTML(solicitud.nombre)}</h5>
                            <span class="badge badge-id fs-6">#${escaparHTML(solicitud.id)}</span>
                        </div>
                        <p class="mb-2"><strong class="text-primary">Correo:</strong> <span class="text-muted">${escaparHTML(solicitud.correo)}</span></p>
                        <p class="mb-2"><strong class="text-primary">Nacimiento:</strong> <span class="text-muted">${escaparHTML(fechaNac)}</span></p>
                        <p class="mb-2"><strong class="text-primary">Postula a:</strong> <span class="text-muted">${escaparHTML(solicitud.anio_postulacion)}</span></p>
                        <p class="mb-2"><strong class="text-primary">Inscripción:</strong> <span class="text-muted">${escaparHTML(fechaMostrar)}</span></p>
                        <p class="mb-3"><strong class="text-primary">Estado:</strong> <span class="badge ${badgeClass}">${escaparHTML(solicitud.estado)}</span></p>
                        <div class="mt-4 p-3 rounded" style="background: var(--bg-tertiary); border: 1px solid var(--glass-border);">
                            <strong class="text-primary d-block mb-2">Motivación:</strong>
                            <p class="fst-italic text-muted m-0">"${escaparHTML(solicitud.motivacion || 'Sin comentarios')}"</p>
                        </div>
                    </div>
                `,
                width: '600px',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#1c3a63',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)'
            });
        }

        // Renderizar el formulario para crear una postulación nueva en el panel lateral
        mostrarFormularioRegistro() {
            this.panelContenido.innerHTML = `
                <div class="fade-in">
                    <h5 class="mb-4 fw-bold text-primary">Ingresar Postulante</h5>
                    <form id="formRegistro">
                        <div class="form-floating mb-3">
                            <input type="text" id="nom" class="form-control" placeholder="Nombre" maxlength="100" required>
                            <label for="nom">Nombre completo</label>
                        </div>
                        <div class="form-floating mb-3">
                            <input type="date" id="fechaNac" class="form-control" required>
                            <label for="fechaNac">Fecha de Nacimiento</label>
                        </div>
                        <div class="form-floating mb-3">
                            <input type="email" id="corr" class="form-control" placeholder="Correo" maxlength="100" required>
                            <label for="corr">Correo</label>
                        </div>
                        <div class="form-floating mb-3">
                            <select id="anio" class="form-select" required>
                                <option value="1° Medio">1° Medio</option>
                                <option value="2° Medio">2° Medio</option>
                                <option value="3° Medio">3° Medio</option>
                                <option value="4° Medio">4° Medio</option>
                            </select>
                            <label for="anio">Año al que postula</label>
                        </div>
                        <div class="form-floating mb-4">
                            <textarea id="motivo" class="form-control" style="height: 100px" maxlength="1000" required></textarea>
                            <label for="motivo">Motivación</label>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 py-2">
                            <i class="bi bi-save me-2"></i>Registrar
                        </button>
                    </form>
                </div>`;

            document.getElementById('formRegistro').addEventListener('submit', async (e) => {
                e.preventDefault();

                const nuevaSolicitud = {
                    nombre: document.getElementById('nom').value.trim(),
                    fecha_nacimiento: document.getElementById('fechaNac').value,
                    correo: document.getElementById('corr').value.trim(),
                    anio_postulacion: document.getElementById('anio').value,
                    motivacion: document.getElementById('motivo').value.trim()
                };

                try {
                    const response = await fetch(`${API_URL}/solicitudes_estudiantes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(nuevaSolicitud)
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || "Error al guardar la solicitud");

                    await inicializarSistema();

                    // Limpiar el panel tras el éxito
                    this.panelContenido.innerHTML = `
                        <div class="text-center text-muted mt-4 fade-in">
                            <i class="bi bi-check-circle-fill fs-1 d-block mb-3 text-success"></i>
                            <span class="fw-medium">Registro exitoso. Folio ${escaparHTML(data.id)}.</span>
                        </div>`;

                    Swal.fire('Registrado', `La postulación quedó registrada con el folio ${escaparHTML(data.id)}.`, 'success');
                } catch (error) {
                    console.error(error);
                    Swal.fire('Error', escaparHTML(error.message), 'error');
                }
            });
        }

        // Renderizar el formulario para modificar estado en el panel lateral
        mostrarFormularioModificar() {
            this.panelContenido.innerHTML = `
                <div class="fade-in">
                    <h5 class="mb-4 fw-bold text-warning">Actualizar Estado</h5>
                    <div class="form-floating mb-3">
                        <input type="text" id="idMod" class="form-control" placeholder="ID">
                        <label for="idMod">Folio (Ej: ADM-1234567)</label>
                    </div>
                    <div class="form-floating mb-4">
                        <select id="nuevoEstado" class="form-select">
                            <option value="En Revisión">En Revisión</option>
                            <option value="Aceptado">Aceptado</option>
                            <option value="Lista de Espera">Lista de Espera</option>
                            <option value="Rechazado">Rechazado</option>
                        </select>
                        <label for="nuevoEstado">Nuevo Estado</label>
                    </div>
                    <button id="confirmarMod" class="btn btn-warning w-100 py-2 text-white">
                        <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
                    </button>
                </div>`;

            document.getElementById('confirmarMod').addEventListener('click', async () => {
                const idBuscado = document.getElementById('idMod').value.trim().toUpperCase();
                const nuevoEstado = document.getElementById('nuevoEstado').value;

                if (!idBuscado) {
                    return Swal.fire('Atención', 'Debes ingresar un folio válido.', 'warning');
                }

                try {
                    const response = await fetch(`${API_URL}/solicitudes_estudiantes/${encodeURIComponent(idBuscado)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: nuevoEstado })
                    });

                    if (!response.ok) throw new Error("Error en actualización");

                    await inicializarSistema();
                    this.panelContenido.innerHTML = `
                        <div class="text-center text-muted mt-4 fade-in">
                            <i class="bi bi-check-circle-fill fs-1 d-block mb-3 text-success"></i>
                            <span class="fw-medium">Actualización exitosa.</span>
                        </div>`;

                    Swal.fire('Actualizado', 'El estado de la postulación fue modificado.', 'success');
                } catch (error) {
                    console.error(error);
                    Swal.fire('Error', 'No se pudo actualizar. Verifica que el folio exista.', 'error');
                }
            });
        }

        // Renderizar el formulario de eliminación en el panel lateral
        mostrarFormularioEliminar() {
            this.panelContenido.innerHTML = `
                <div class="fade-in">
                    <h5 class="mb-4 fw-bold text-danger">Anular Postulación</h5>
                    <div class="form-floating mb-4">
                        <input type="text" id="idEliminar" class="form-control" placeholder="Folio">
                        <label for="idEliminar">Folio (Ej: ADM-1234567)</label>
                    </div>
                    <button id="confirmarEliminar" class="btn btn-danger w-100 py-2">
                        <i class="bi bi-trash me-2"></i>Anular Definitivamente
                    </button>
                </div>`;

            document.getElementById('confirmarEliminar').addEventListener('click', () => {
                const idBuscado = document.getElementById('idEliminar').value.trim().toUpperCase();

                if (!idBuscado) {
                    return Swal.fire('Atención', 'Debes ingresar un folio válido.', 'warning');
                }

                Swal.fire({
                    title: '¿Anular Postulación?',
                    text: "Esta acción borrará el registro y no se puede deshacer.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, anular',
                    cancelButtonText: 'Cancelar'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        try {
                            const response = await fetch(`${API_URL}/solicitudes_estudiantes/${encodeURIComponent(idBuscado)}`, {
                                method: 'DELETE'
                            });

                            if (!response.ok) throw new Error("Error en eliminación");

                            await inicializarSistema();
                            this.panelContenido.innerHTML = `
                                <div class="text-center text-muted mt-4 fade-in">
                                    <i class="bi bi-trash-fill fs-1 d-block mb-3 text-secondary"></i>
                                    <span class="fw-medium">Registro anulado.</span>
                                </div>`;

                            Swal.fire('Eliminada', 'La postulación fue anulada.', 'success');
                        } catch(error) {
                            console.error(error);
                            Swal.fire('Error', 'Problema al borrar el registro. Verifica el folio.', 'error');
                        }
                    }
                });
            });
        }

        // Vincular los eventos a los botones del menú y buscador
        initEvents() {
            document.getElementById('btnRegistrar')?.addEventListener('click', () => this.mostrarFormularioRegistro());
            document.getElementById('btnModificar')?.addEventListener('click', () => this.mostrarFormularioModificar());
            document.getElementById('btnEliminar')?.addEventListener('click', () => this.mostrarFormularioEliminar());
            document.getElementById('buscador')?.addEventListener('input', (e) => this.actualizarTabla(e.target.value));
        }
    }
});
