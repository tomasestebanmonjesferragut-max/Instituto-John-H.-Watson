document.addEventListener('DOMContentLoaded', () => {
    const tablaSolicitudes = document.getElementById('tablaSolicitudes');
    if (!tablaSolicitudes) return;

    let db = null;
    const API_URL = '/api';

    inicializarSistema();

    // 1. Inicialización y carga de datos
    async function inicializarSistema() {
        try {
            const respuesta = await fetch(`${API_URL}/db`);
            if (!respuesta.ok) throw new Error("Error de red al intentar obtener los datos");
            
            db = await respuesta.json();
            
            // Instanciar la clase gestora una vez que tenemos los datos
            new GestorPostulaciones(); 
        } catch (error) {
            console.error("Error inicializando el sistema de solicitudes:", error);
            tablaSolicitudes.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">Error al conectar con MySQL. Verifica que tu servidor esté corriendo.</td></tr>`;
        }
    }

    // 2. Clase para gestionar toda la lógica de la vista
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
                this.tabla.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No hay postulaciones registradas en MySQL.</td></tr>`;
                return;
            }

            const textoFiltro = filtro.toLowerCase();
            
            db.solicitudes_estudiantes.forEach((solicitud) => {
                const fechaMostrar = solicitud.fecha_inscripcion || solicitud.fecha; 
                const { id, nombre, correo, fecha_nacimiento, anio_postulacion, motivacion, estado } = solicitud;
                const comentario = motivacion || "Sin comentarios adicionales.";

                // Filtrar por nombre o ID (folio)
                if (nombre.toLowerCase().includes(textoFiltro) || id.toLowerCase().includes(textoFiltro)) {
                    const badgeClass = estado === 'Aceptado' ? 'text-bg-success' : estado === 'Rechazado' ? 'text-bg-danger' : 'text-bg-warning';
                    
                    const fila = document.createElement('tr');
                    fila.className = 'fade-in';
                    fila.style.cursor = 'pointer'; 
                    
                    fila.innerHTML = `
                        <td><span class="badge badge-id">#${id}</span></td>
                        <td>
                            <strong class="d-block">${nombre}</strong>
                            <small class="text-muted">${correo}</small>
                        </td>
                        <td>
                            <span class="fw-medium d-block">${anio_postulacion}</span>
                            <small class="text-muted text-truncate d-block" style="max-width: 200px;">
                                <i class="bi bi-chat-left-text me-1"></i>${comentario}
                            </small>
                        </td>
                        <td><span class="badge rounded-pill ${badgeClass}">${estado}</span></td>
                        <td class="text-muted small">${fechaMostrar}</td>
                    `;
                    
                    // Abrir detalles al hacer clic en la fila
                    fila.addEventListener('click', () => this.verDetalles(solicitud, badgeClass, fechaMostrar));
                    this.tabla.appendChild(fila);
                }
            });
        }

        // Mostrar modal con los detalles completos del estudiante
        verDetalles(solicitud, badgeClass, fechaMostrar) {
            // Formatear la fecha de nacimiento para evitar desfases de zona horaria
            const fechaNacParts = solicitud.fecha_nacimiento.split('T')[0].split('-');
            const fechaNac = `${fechaNacParts[2]}/${fechaNacParts[1]}/${fechaNacParts[0]}`; 

            Swal.fire({
                title: `<i class="bi bi-person-vcard text-primary me-2"></i>Detalle de Postulación`,
                html: `
                    <div class="text-start mt-3 px-2">
                        <div class="d-flex justify-content-between border-bottom pb-2 mb-3">
                            <h5 class="fw-bold m-0">${solicitud.nombre}</h5>
                            <span class="badge badge-id fs-6">#${solicitud.id}</span>
                        </div>
                        <p class="mb-2"><strong class="text-primary">Correo:</strong> <span class="text-muted">${solicitud.correo}</span></p>
                        <p class="mb-2"><strong class="text-primary">Nacimiento:</strong> <span class="text-muted">${fechaNac}</span></p>
                        <p class="mb-2"><strong class="text-primary">Postula a:</strong> <span class="text-muted">${solicitud.anio_postulacion}</span></p>
                        <p class="mb-2"><strong class="text-primary">Inscripción:</strong> <span class="text-muted">${fechaMostrar}</span></p>
                        <p class="mb-3"><strong class="text-primary">Estado:</strong> <span class="badge ${badgeClass}">${solicitud.estado}</span></p>
                        <div class="mt-4 p-3 rounded" style="background: var(--bg-tertiary); border: 1px solid var(--glass-border);">
                            <strong class="text-primary d-block mb-2">Motivación:</strong>
                            <p class="fst-italic text-muted m-0">"${solicitud.motivacion || 'Sin comentarios'}"</p>
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
                            <input type="text" id="nom" class="form-control" placeholder="Nombre" required>
                            <label>Nombre completo</label>
                        </div>
                        <div class="form-floating mb-3">
                            <input type="date" id="fechaNac" class="form-control" required>
                            <label>Fecha de Nacimiento</label>
                        </div>
                        <div class="form-floating mb-3">
                            <input type="email" id="corr" class="form-control" placeholder="Correo" required>
                            <label>Correo</label>
                        </div>
                        <div class="form-floating mb-3">
                            <select id="anio" class="form-select" required>
                                <option value="1° Medio">1° Medio</option>
                                <option value="2° Medio">2° Medio</option>
                                <option value="3° Medio">3° Medio</option>
                                <option value="4° Medio">4° Medio</option>
                            </select>
                            <label>Año al que postula</label>
                        </div>
                        <div class="form-floating mb-4">
                            <textarea id="motivo" class="form-control" style="height: 100px" required></textarea>
                            <label>Motivación</label>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 py-2">
                            <i class="bi bi-save me-2"></i>Registrar
                        </button>
                    </form>
                </div>`;

            document.getElementById('formRegistro').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nuevaSolicitud = {
                    id: 'ADM-' + Math.floor(Math.random() * 900 + 100),
                    nombre: document.getElementById('nom').value.trim(),
                    fecha_nacimiento: document.getElementById('fechaNac').value,
                    correo: document.getElementById('corr').value.trim(),
                    anio_postulacion: document.getElementById('anio').value,
                    motivacion: document.getElementById('motivo').value.trim(),
                    estado: 'En Revisión',
                    fecha: new Intl.DateTimeFormat('es-CL', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date())
                };

                try {
                    const response = await fetch(`${API_URL}/solicitudes_estudiantes`, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(nuevaSolicitud) 
                    });
                    
                    if (!response.ok) throw new Error("Error al guardar la solicitud");

                    await inicializarSistema(); 
                    
                    // Limpiar el panel tras el éxito
                    this.panelContenido.innerHTML = `
                        <div class="text-center text-muted mt-4 fade-in">
                            <i class="bi bi-check-circle-fill fs-1 d-block mb-3 text-success"></i>
                            <span class="fw-medium">Registro exitoso.</span>
                        </div>`;
                    
                    Swal.fire('Registrado', 'La postulación ha sido guardada en MySQL.', 'success');
                } catch (error) { 
                    console.error(error);
                    Swal.fire('Error', 'No se pudo guardar la postulación.', 'error'); 
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
                        <label>Folio (Ej: ADM-123)</label>
                    </div>
                    <div class="form-floating mb-4">
                        <select id="nuevoEstado" class="form-select">
                            <option value="En Revisión">En Revisión</option>
                            <option value="Aceptado">Aceptado</option>
                            <option value="Lista de Espera">Lista de Espera</option>
                            <option value="Rechazado">Rechazado</option>
                        </select>
                        <label>Nuevo Estado</label>
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
                    const response = await fetch(`${API_URL}/solicitudes_estudiantes/${idBuscado}`, { 
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
                    
                    Swal.fire('Actualizado', 'El estado ha sido modificado en MySQL.', 'success');
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
                        <label>Folio (Ej: ADM-123)</label>
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
                    text: "Esta acción borrará el registro de MySQL y no se puede deshacer.", 
                    icon: 'warning', 
                    showCancelButton: true, 
                    confirmButtonText: 'Sí, anular',
                    cancelButtonText: 'Cancelar'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        try {
                            const response = await fetch(`${API_URL}/solicitudes_estudiantes/${idBuscado}`, { 
                                method: 'DELETE' 
                            });
                            
                            if (!response.ok) throw new Error("Error en eliminación");

                            await inicializarSistema();
                            this.panelContenido.innerHTML = `
                                <div class="text-center text-muted mt-4 fade-in">
                                    <i class="bi bi-trash-fill fs-1 d-block mb-3 text-secondary"></i>
                                    <span class="fw-medium">Registro anulado.</span>
                                </div>`;
                            
                            Swal.fire('Eliminada', 'La postulación ha sido borrada de MySQL.', 'success');
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