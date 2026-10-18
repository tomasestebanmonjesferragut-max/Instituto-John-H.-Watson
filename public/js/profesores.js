document.addEventListener('DOMContentLoaded', () => {
    const contenedorProfesores = document.getElementById('contenedorProfesores');
    if (!contenedorProfesores) return;

    let db = null;
    const paletaColores = ['primary', 'success', 'info', 'warning', 'danger', 'secondary'];
    const API_URL = '/api';

    inicializarProfesores();

    // 1. Cargar datos desde la base de datos
    async function inicializarProfesores() {
        try { 
            const respuesta = await fetch(`${API_URL}/db`); 
            if (!respuesta.ok) throw new Error("Error de red");
            
            db = await respuesta.json(); 
            // Renderizamos sin filtro al inicio
            renderizarTarjetas(); 
        } catch (error) { 
            console.error("Error cargando profesores:", error);
            contenedorProfesores.innerHTML = `<p class="text-danger w-100 text-center">Error al conectar con MySQL.</p>`; 
        }
    }

    // 2. Renderizar las tarjetas de profesores (con soporte para búsqueda)
    function renderizarTarjetas(filtro = '') {
        contenedorProfesores.innerHTML = '';
        const textoFiltro = filtro.toLowerCase();
        
        if (!db || !db.profesores) return;

        // Filtrar por nombre o departamento
        const profesoresFiltrados = db.profesores.filter(p => 
            p.nombre.toLowerCase().includes(textoFiltro) || 
            p.departamento.toLowerCase().includes(textoFiltro)
        );

        if (profesoresFiltrados.length === 0) { 
            contenedorProfesores.innerHTML = `<p class="text-muted w-100 text-center py-5">No se encontraron docentes con ese criterio.</p>`; 
            return; 
        }

        profesoresFiltrados.forEach((prof, index) => {
            // Asignar un color de la paleta dinámicamente
            const color = paletaColores[index % paletaColores.length];
            
            contenedorProfesores.innerHTML += `
                <div class="col-md-6 col-lg-4 fade-in">
                    <div class="p-4 h-100 text-center d-flex flex-column justify-content-center" style="background: var(--glass-panel); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
                        <div class="mb-3">
                            <div class="bg-white rounded-circle d-inline-flex justify-content-center align-items-center shadow-sm" style="width: 80px; height: 80px;">
                                <i class="bi bi-person-fill fs-1 text-${color}"></i>
                            </div>
                        </div>
                        <h5 class="fw-bold mb-1">${escaparHTML(prof.nombre)}</h5>
                        <p class="text-muted small mb-2">Dpto. de ${escaparHTML(prof.departamento)}</p>
                        <div class="mb-2">
                            <span class="badge text-bg-${color} rounded-pill">Académico</span> 
                            <span class="badge text-bg-dark rounded-pill">ID: ${escaparHTML(prof.id)}</span>
                        </div>
                    </div>
                </div>`;
        });
    }

    // 3. Buscador en tiempo real
    const buscador = document.getElementById('buscadorDocentes');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            renderizarTarjetas(e.target.value);
        });
    }

    // 4. Lógica para Agregar un nuevo Docente
    const btnAgregar = document.getElementById('btnAgregarProf');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', async () => {
            const { value: formValues } = await Swal.fire({ 
                title: 'Nuevo Docente', 
                html: `
                    <div class="form-floating mb-3">
                        <input id="swal-nombre" class="form-control" placeholder="Ej: Dr. Juan Pérez">
                        <label>Nombre y Título</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input id="swal-dpto" class="form-control" placeholder="Ej: Ciencias Exactas">
                        <label>Departamento Académico</label>
                    </div>
                    <p class="small text-muted text-start mb-2">Acceso al Aula Virtual (opcional)</p>
                    <div class="form-floating mb-3">
                        <input id="swal-correo" type="email" class="form-control" placeholder="nombre@jhwatson.cl" autocomplete="off">
                        <label>Correo institucional</label>
                    </div>
                    <div class="form-floating">
                        <input id="swal-clave" type="password" class="form-control" placeholder="Contraseña inicial" autocomplete="new-password">
                        <label>Contraseña inicial (mín. 6 caracteres)</label>
                    </div>`,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Guardar Docente',
                preConfirm: () => {
                    const nombre = document.getElementById('swal-nombre').value.trim();
                    const dpto = document.getElementById('swal-dpto').value.trim();
                    const correo = document.getElementById('swal-correo').value.trim();
                    const contrasena = document.getElementById('swal-clave').value;

                    // Validación para evitar campos vacíos
                    if (!nombre || !dpto) {
                        Swal.showValidationMessage('Nombre y departamento son obligatorios');
                        return false;
                    }
                    if (correo && contrasena.length < 6) {
                        Swal.showValidationMessage('La contraseña inicial debe tener al menos 6 caracteres');
                        return false;
                    }

                    return { nombre, departamento: dpto, correo, contrasena };
                }
            });

            if (formValues) {
                try {
                    const response = await fetch(`${API_URL}/profesores`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formValues)
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || "Error al guardar en el servidor");

                    await inicializarProfesores();
                    if(buscador) buscador.value = ''; // Limpiar el buscador si estaba en uso
                    Swal.fire('¡Añadido!', 'El docente fue registrado correctamente.', 'success');
                } catch (e) {
                    console.error(e);
                    Swal.fire('Error', escaparHTML(e.message), 'error');
                }
            }
        });
    }

    // 5. Lógica para Editar un Docente existente
    const btnEditar = document.getElementById('btnEditarProf');
    if (btnEditar) {
        btnEditar.addEventListener('click', async () => {
            if (!db || !db.profesores || db.profesores.length === 0) {
                return Swal.fire('Aviso', 'No hay docentes registrados para editar.', 'info');
            }

            let opciones = '<option value="">-- Seleccione un docente --</option>'; 
            db.profesores.forEach(p => opciones += `<option value="${p.id}">${escaparHTML(p.nombre)} (Dpto. ${escaparHTML(p.departamento)})</option>`);
            
            // Primer modal: Seleccionar docente
            const { value: profId } = await Swal.fire({ 
                title: 'Modificar Docente', 
                html: `<select id="swal-edit-prof" class="form-select mb-3">${opciones}</select>`, 
                showCancelButton: true, 
                confirmButtonText: 'Siguiente', 
                preConfirm: () => {
                    const id = document.getElementById('swal-edit-prof').value;
                    if (!id) {
                        Swal.showValidationMessage('Debes seleccionar un docente de la lista');
                        return false;
                    }
                    return id;
                }
            });

            if (profId) {
                const prof = db.profesores.find(p => p.id === profId);
                
                // Segundo modal: Editar datos
                const { value: formEdit } = await Swal.fire({ 
                    title: 'Editando Perfil', 
                    html: `
                        <div class="form-floating mb-3">
                            <input id="edit-nombre" class="form-control" value="${escaparHTML(prof.nombre)}">
                            <label>Nombre y Título</label>
                        </div>
                        <div class="form-floating">
                            <input id="edit-dpto" class="form-control" value="${escaparHTML(prof.departamento)}">
                            <label>Departamento Académico</label>
                        </div>`, 
                    showCancelButton: true, 
                    confirmButtonText: 'Actualizar', 
                    preConfirm: () => { 
                        const nombre = document.getElementById('edit-nombre').value.trim();
                        const dpto = document.getElementById('edit-dpto').value.trim();

                        if (!nombre || !dpto) {
                            Swal.showValidationMessage('Todos los campos son obligatorios');
                            return false;
                        }

                        return { nombre: nombre, departamento: dpto } 
                    }
                });

                if (formEdit) { 
                    try { 
                        const response = await fetch(`${API_URL}/profesores/${prof.id}`, { 
                            method: 'PUT', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify(formEdit) 
                        }); 
                        
                        if (!response.ok) throw new Error("Error al modificar en el servidor");

                        await inicializarProfesores(); 
                        if(buscador) buscador.value = ''; // Limpiar el buscador
                        Swal.fire('¡Actualizado!', 'Los datos del docente fueron modificados.', 'success'); 
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Error', 'Hubo un problema al actualizar el docente.', 'error');
                    } 
                }
            }
        });
    }
});