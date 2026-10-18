document.addEventListener('DOMContentLoaded', () => {
    const tablaSoporte = document.getElementById('tablaSoporte');
    if (!tablaSoporte) return;

    let db = null;
    const API_URL = '/api';

    inicializarSistema();

    // 1. Inicialización y conexión con MySQL
    async function inicializarSistema() {
        try {
            const respuesta = await fetch(`${API_URL}/db`);
            if (!respuesta.ok) throw new Error("Error de red");
            
            db = await respuesta.json();
            
            // Iniciar la clase gestora
            new GestorSoporte(); 
        } catch (error) { 
            console.error(error);
            tablaSoporte.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">Error al conectar con MySQL.</td></tr>`; 
        }
    }

    // 2. Clase Gestora para la lógica de la vista
    class GestorSoporte {
        constructor() {
            this.tabla = tablaSoporte;
            this.panelContenido = document.getElementById('panelContenido');
            this.initEvents();
            this.actualizarTabla();
        }

        // Renderizar tabla con filtros cruzados (Texto + Select de Prioridad)
        actualizarTabla(filtroTexto = '', filtroPrioridad = 'Todas') {
            this.tabla.innerHTML = '';
            
            if (!db.solicitudes_profesores || db.solicitudes_profesores.length === 0) {
                this.tabla.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No hay reportes técnicos en MySQL.</td></tr>`; 
                return;
            }

            const textoFiltro = filtroTexto.toLowerCase();
            
            db.solicitudes_profesores.forEach((ticket) => {
                const { id, profesor, ubicacion, problema, prioridad, fecha } = ticket;
                
                // Lógica de doble filtro
                const coincideTexto = profesor.toLowerCase().includes(textoFiltro) || id.toLowerCase().includes(textoFiltro);
                const coincidePrioridad = filtroPrioridad === 'Todas' || prioridad === filtroPrioridad;

                if (coincideTexto && coincidePrioridad) {
                    let badgeClass = prioridad === 'Alta' ? 'text-bg-danger' : prioridad === 'Media' ? 'text-bg-warning' : 'text-bg-info text-white';
                    
                    const fila = document.createElement('tr');
                    fila.className = 'fade-in'; 
                    fila.style.cursor = 'pointer'; 
                    
                    fila.innerHTML = `
                        <td><span class="badge badge-id">#${id}</span></td>
                        <td>
                            <strong class="d-block">${profesor}</strong>
                            <small class="text-muted"><i class="bi bi-geo-alt-fill me-1"></i>${ubicacion}</small>
                        </td>
                        <td style="max-width: 250px;">
                            <span class="text-truncate d-block text-muted">
                                <i class="bi bi-chat-right-dots me-2 text-primary"></i>${problema}
                            </span>
                        </td>
                        <td><span class="badge rounded-pill ${badgeClass}">${prioridad}</span></td>
                        <td class="text-muted small">${fecha}</td>
                    `;
                    
                    // Evento para abrir detalles
                    fila.addEventListener('click', () => this.verDetalles(ticket, badgeClass));
                    this.tabla.appendChild(fila);
                }
            });
        }

        // Mostrar detalles completos del ticket en un Modal (¡Implementado!)
        verDetalles(ticket, badgeClass) { 
            Swal.fire({
                title: `<i class="bi bi-tools text-primary me-2"></i>Detalle del Reporte`,
                html: `
                    <div class="text-start mt-3 px-2">
                        <div class="d-flex justify-content-between border-bottom pb-2 mb-3">
                            <h5 class="fw-bold m-0">${ticket.profesor}</h5>
                            <span class="badge badge-id fs-6">#${ticket.id}</span>
                        </div>
                        <p class="mb-2"><strong class="text-primary">Ubicación:</strong> <span class="text-muted">${ticket.ubicacion}</span></p>
                        <p class="mb-2"><strong class="text-primary">Fecha Reporte:</strong> <span class="text-muted">${ticket.fecha}</span></p>
                        <p class="mb-3"><strong class="text-primary">Prioridad:</strong> <span class="badge ${badgeClass}">${ticket.prioridad}</span></p>
                        <div class="mt-4 p-3 rounded" style="background: var(--bg-tertiary); border: 1px solid var(--glass-border);">
                            <strong class="text-primary d-block mb-2">Descripción del Problema:</strong>
                            <p class="text-muted m-0">${ticket.problema}</p>
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

        // Renderizar formulario lateral para reportar nueva incidencia
        mostrarFormularioRegistro() {
            // Cargar los profesores desde la BD al select
            let opcionesProf = '<option value="" disabled selected>Seleccione al Docente...</option>';
            if (db.profesores) {
                db.profesores.forEach(p => opcionesProf += `<option value="${p.nombre}">${p.nombre}</option>`);
            }

            this.panelContenido.innerHTML = `
                <div class="fade-in">
                    <h5 class="mb-4 fw-bold text-primary">Reportar Incidencia</h5>
                    <form id="formRegistro">
                        <div class="form-floating mb-3">
                            <select id="prof" class="form-select" required>${opcionesProf}</select>
                            <label>Profesor</label>
                        </div>
                        <div class="form-floating mb-3">
                            <input type="text" id="ubi" class="form-control" placeholder="Ubicación" required>
                            <label>Ubicación (Ej: Lab 3)</label>
                        </div>
                        <div class="form-floating mb-3">
                            <textarea id="prob" class="form-control" style="height: 100px" required></textarea>
                            <label>Problema</label>
                        </div>
                        <div class="form-floating mb-4">
                            <select id="prio" class="form-select">
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                            </select>
                            <label>Urgencia</label>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 py-2">
                            <i class="bi bi-send-fill me-2"></i>Enviar Reporte
                        </button>
                    </form>
                </div>`;

            document.getElementById('formRegistro').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nuevoTicket = { 
                    id: 'SOP-' + Math.floor(Math.random() * 900 + 100), 
                    profesor: document.getElementById('prof').value, 
                    ubicacion: document.getElementById('ubi').value.trim(), 
                    problema: document.getElementById('prob').value.trim(), 
                    prioridad: document.getElementById('prio').value, 
                    fecha: new Intl.DateTimeFormat('es-CL', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date()) 
                };
                
                try { 
                    const response = await fetch(`${API_URL}/solicitudes_profesores`, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(nuevoTicket) 
                    }); 
                    if(!response.ok) throw new Error("Fallo en red");
                    
                    await inicializarSistema(); 
                    this.panelContenido.innerHTML = `
                        <div class="text-center text-muted mt-4 fade-in">
                            <i class="bi bi-check-circle-fill fs-1 d-block mb-3 text-success"></i>
                            <span class="fw-medium">Ticket enviado.</span>
                        </div>`; 
                    Swal.fire('Ticket Enviado', 'El reporte ha sido guardado en MySQL.', 'success'); 
                } catch (e) {
                    Swal.fire('Error', 'No se pudo enviar el reporte.', 'error');
                }
            });
        }

        // Renderizar formulario lateral para cambiar urgencia
        mostrarFormularioModificar() {
            this.panelContenido.innerHTML = `
                <div class="fade-in">
                    <h5 class="mb-4 fw-bold text-warning">Ajustar Prioridad</h5>
                    <div class="form-floating mb-3">
                        <input type="text" id="idMod" class="form-control" placeholder="ID">
                        <label>Ticket ID (Ej: SOP-101)</label>
                    </div>
                    <div class="form-floating mb-4">
                        <select id="nuevaPrio" class="form-select">
                            <option value="Alta">Alta</option>
                            <option value="Media">Media</option>
                            <option value="Baja">Baja</option>
                        </select>
                        <label>Nueva Prioridad</label>
                    </div>
                    <button id="confirmarMod" class="btn btn-warning w-100 py-2 text-white">
                        <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
                    </button>
                </div>`;

            document.getElementById('confirmarMod').addEventListener('click', async () => {
                const idTicket = document.getElementById('idMod').value.trim().toUpperCase();
                if (!idTicket) return Swal.fire('Atención', 'Ingresa un ID válido', 'warning');

                try { 
                    const response = await fetch(`${API_URL}/solicitudes_profesores/${idTicket}`, { 
                        method: 'PUT', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ prioridad: document.getElementById('nuevaPrio').value }) 
                    }); 
                    if(!response.ok) throw new Error("Fallo en BD");

                    await inicializarSistema(); 
                    this.panelContenido.innerHTML = `
                        <div class="text-center text-muted mt-4 fade-in">
                            <i class="bi bi-check-circle-fill fs-1 d-block mb-3 text-success"></i>
                            <span class="fw-medium">Prioridad ajustada.</span>
                        </div>`; 
                    Swal.fire('Actualizado', 'La prioridad se ha modificado en MySQL.', 'success'); 
                } catch (e) {
                    Swal.fire('Error', 'Verifica que el ID del ticket exista.', 'error');
                }
            });
        }

        // Renderizar formulario lateral para eliminar ticket (Resolver)
        mostrarFormularioEliminar() {
            this.panelContenido.innerHTML = `
                <div class="fade-in">
                    <h5 class="mb-4 fw-bold text-success">Marcar como Resuelto</h5>
                    <div class="form-floating mb-4">
                        <input type="text" id="idEliminar" class="form-control" placeholder="ID">
                        <label>Ticket ID (Ej: SOP-101)</label>
                    </div>
                    <button id="confirmarEliminar" class="btn btn-success w-100 py-2">
                        <i class="bi bi-check2-circle me-2"></i>Cerrar Ticket
                    </button>
                </div>`;

            document.getElementById('confirmarEliminar').addEventListener('click', () => {
                const idBuscado = document.getElementById('idEliminar').value.trim().toUpperCase();
                if(!idBuscado) return Swal.fire('Atención', 'Ingresa un ID válido', 'warning');

                Swal.fire({
                    title: '¿Marcar como Resuelto?', 
                    text: "El ticket se considerará solucionado y se borrará de MySQL.", 
                    icon: 'info', 
                    showCancelButton: true, 
                    confirmButtonColor: '#2e6b4c',
                    confirmButtonText: 'Sí, cerrar ticket',
                    cancelButtonText: 'Cancelar'
                }).then(async (result) => {
                    if (result.isConfirmed) { 
                        try { 
                            await fetch(`${API_URL}/solicitudes_profesores/${idBuscado}`, { method: 'DELETE' }); 
                            await inicializarSistema(); 
                            this.panelContenido.innerHTML = `
                                <div class="text-center text-muted mt-4 fade-in">
                                    <i class="bi bi-check-circle-fill fs-1 d-block mb-3 text-success"></i>
                                    <span class="fw-medium">Ticket cerrado y borrado.</span>
                                </div>`; 
                            Swal.fire('Excelente', 'El problema ha sido resuelto y borrado.', 'success'); 
                        } catch(e) {
                            Swal.fire('Error', 'Problema al intentar borrar el ticket.', 'error');
                        } 
                    }
                });
            });
        }

        // Vincular los eventos al DOM
        initEvents() {
            document.getElementById('btnRegistrar')?.addEventListener('click', () => this.mostrarFormularioRegistro());
            document.getElementById('btnModificar')?.addEventListener('click', () => this.mostrarFormularioModificar());
            document.getElementById('btnEliminar')?.addEventListener('click', () => this.mostrarFormularioEliminar());
            
            // Filtros de búsqueda y select
            document.getElementById('buscador')?.addEventListener('input', (e) => {
                this.actualizarTabla(e.target.value, document.getElementById('filtroPrioridad')?.value || 'Todas');
            });
            document.getElementById('filtroPrioridad')?.addEventListener('change', (e) => {
                this.actualizarTabla(document.getElementById('buscador')?.value || '', e.target.value);
            });
        }
    }
});