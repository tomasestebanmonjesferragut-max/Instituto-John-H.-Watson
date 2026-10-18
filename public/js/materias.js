document.addEventListener('DOMContentLoaded', () => {
    const contenedorMaterias = document.getElementById('contenedorMaterias');
    if (!contenedorMaterias) return;

    let db = null;
    const API_URL = '/api';

    inicializarMaterias();

    // 1. Cargar datos desde la base de datos
    async function inicializarMaterias() {
        try { 
            const respuesta = await fetch(`${API_URL}/db`); 
            if (!respuesta.ok) throw new Error("Error en la red");
            
            db = await respuesta.json(); 
            renderizarTarjetas(); 
        } catch (error) { 
            console.error("Error cargando materias:", error);
            contenedorMaterias.innerHTML = `<p class="text-danger w-100 text-center">Error al conectar con MySQL.</p>`; 
        }
    }

    // 2. Dibujar las tarjetas en el HTML
    function renderizarTarjetas() {
        contenedorMaterias.innerHTML = '';
        
        if (!db.asignaturas || db.asignaturas.length === 0) { 
            contenedorMaterias.innerHTML = `<p class="text-muted text-center w-100">No hay asignaturas registradas.</p>`; 
            return; 
        }

        // Asignatura con más bloques en la semana (referencia para la barra)
        const maxBloques = Math.max(1, ...db.asignaturas.map(a => (db.horarios || []).filter(h => h.asignatura_id === a.id).length));

        db.asignaturas.forEach(asig => {
            // Buscar el nombre del profesor
            const profesor = db.profesores.find(p => p.id === asig.profesor_id);
            const nombreProf = profesor ? profesor.nombre : 'Sin asignar';
            
            // Asignar icono según el color
            let icon = 'journal-bookmark'; 
            if(asig.color === 'primary') icon = 'laptop'; 
            if(asig.color === 'success') icon = 'calculator'; 
            if(asig.color === 'info') icon = 'diagram-3'; 
            if(asig.color === 'warning') icon = 'shield-lock'; 
            if(asig.color === 'danger') icon = 'bug';
            
            // Carga semanal real según la agenda (cada bloque dura 1,5 horas)
            const bloques = (db.horarios || []).filter(h => h.asignatura_id === asig.id).length;
            const horas = (bloques * 1.5).toLocaleString('es-CL');
            const porcentaje = Math.round((bloques / maxBloques) * 100);

            contenedorMaterias.innerHTML += `
                <div class="col-md-6 col-lg-4 fade-in">
                    <div class="card h-100 p-0 overflow-hidden" style="border-top: 4px solid var(--accent-${asig.color});">
                        <div class="p-4 border-bottom" style="border-color: var(--glass-border) !important;">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <span class="badge text-bg-secondary">Código: ${escaparHTML(asig.codigo)}</span>
                                <i class="bi bi-${icon} fs-3 text-${asig.color}"></i>
                            </div>
                            <h4 class="fw-bold mt-3 mb-1">${escaparHTML(asig.nombre)}</h4>
                            <p class="text-muted small mb-0"><i class="bi bi-person-circle me-1"></i> ${escaparHTML(nombreProf)}</p>
                        </div>
                        <div class="p-4 bg-transparent">
                            <div class="d-flex justify-content-between text-muted small mb-2">
                                <span>Carga semanal</span>
                                <span class="fw-bold text-${asig.color}">${bloques} ${bloques === 1 ? 'bloque' : 'bloques'} · ${horas} h</span>
                            </div>
                            <div class="progress mb-2" role="progressbar" aria-label="Carga semanal de ${escaparHTML(asig.nombre)}" aria-valuenow="${bloques}" aria-valuemin="0" aria-valuemax="${maxBloques}">
                                <div class="progress-bar bg-${asig.color}" style="width: ${porcentaje}%"></div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
    }

    // 3. Lógica para Agregar Materia
    const btnAgregar = document.getElementById('btnAgregarMateria');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', async () => {
            // Cargar los profesores disponibles en el select
            let opcionesProfesores = '<option value="">-- Seleccione un profesor --</option>'; 
            if (db.profesores) {
                db.profesores.forEach(p => opcionesProfesores += `<option value="${p.id}">${p.nombre}</option>`);
            }

            const { value: formValues } = await Swal.fire({ 
                title: 'Nueva Asignatura', 
                html: `
                    <div class="form-floating mb-3">
                        <input id="swal-cod" class="form-control" placeholder="Código">
                        <label>Código</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input id="swal-nom" class="form-control" placeholder="Nombre">
                        <label>Nombre</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="swal-prof" class="form-select">${opcionesProfesores}</select>
                        <label>Profesor</label>
                    </div>
                    <div class="form-floating">
                        <select id="swal-color" class="form-select">
                            <option value="primary">Azul</option>
                            <option value="success">Verde</option>
                            <option value="warning">Amarillo</option>
                            <option value="danger">Rojo</option>
                        </select>
                        <label>Color</label>
                    </div>`, 
                focusConfirm: false, 
                showCancelButton: true, 
                confirmButtonText: 'Guardar', 
                preConfirm: () => { 
                    const cod = document.getElementById('swal-cod').value;
                    const nom = document.getElementById('swal-nom').value;
                    
                    // Validación de campos vacíos
                    if (!cod || !nom) {
                        Swal.showValidationMessage('El código y el nombre son obligatorios');
                        return false;
                    }
                    
                    return { 
                        codigo: cod, 
                        nombre: nom, 
                        profesor_id: document.getElementById('swal-prof').value || null, 
                        color: document.getElementById('swal-color').value 
                    } 
                }
            });

            if (formValues) { 
                try { 
                    const response = await fetch(`${API_URL}/asignaturas`, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(formValues) 
                    }); 
                    if (!response.ok) throw new Error("Error guardando asignatura");
                    
                    await inicializarMaterias(); 
                    Swal.fire('¡Añadida!', 'La asignatura fue guardada correctamente.', 'success'); 
                } catch (e) {
                    console.error(e);
                    Swal.fire('Error', 'Hubo un problema al guardar.', 'error');
                } 
            }
        });
    }

    // 4. Lógica para Editar Materia
    const btnEditar = document.getElementById('btnEditarMateria');
    if (btnEditar) {
        btnEditar.addEventListener('click', async () => {
            // Verificar si hay asignaturas para editar
            if (!db || !db.asignaturas || db.asignaturas.length === 0) {
                return Swal.fire('Aviso', 'No hay asignaturas para editar.', 'info');
            }

            let opciones = ''; 
            db.asignaturas.forEach(a => opciones += `<option value="${a.id}">${escaparHTML(a.codigo)} - ${escaparHTML(a.nombre)}</option>`);
            
            // Primer modal: Seleccionar la materia a editar
            const { value: asigId } = await Swal.fire({ 
                title: 'Modificar Asignatura', 
                html: `<select id="swal-edit-asig" class="form-select mb-3">${opciones}</select>`, 
                showCancelButton: true, 
                confirmButtonText: 'Siguiente', 
                preConfirm: () => document.getElementById('swal-edit-asig').value 
            });

            if (asigId) {
                const materia = db.asignaturas.find(a => a.id === asigId);
                let opcProf = '<option value="">-- Sin asignar --</option>'; 
                
                db.profesores.forEach(p => {
                    opcProf += `<option value="${p.id}" ${p.id === materia.profesor_id ? 'selected' : ''}>${p.nombre}</option>`;
                });

                // Segundo modal: Editar los campos
                const { value: formEdit } = await Swal.fire({ 
                    title: 'Editando: ' + materia.codigo, 
                    html: `
                        <div class="form-floating mb-3">
                            <input id="edit-nom" class="form-control" value="${escaparHTML(materia.nombre)}">
                            <label>Nombre</label>
                        </div>
                        <div class="form-floating mb-3">
                            <select id="edit-prof" class="form-select">${opcProf}</select>
                            <label>Profesor</label>
                        </div>
                        <div class="form-floating">
                            <select id="edit-color" class="form-select">
                                <option value="primary" ${materia.color==='primary'?'selected':''}>Azul</option>
                                <option value="success" ${materia.color==='success'?'selected':''}>Verde</option>
                                <option value="warning" ${materia.color==='warning'?'selected':''}>Amarillo</option>
                                <option value="danger" ${materia.color==='danger'?'selected':''}>Rojo</option>
                            </select>
                            <label>Color</label>
                        </div>`, 
                    showCancelButton: true, 
                    confirmButtonText: 'Actualizar', 
                    preConfirm: () => { 
                        const nom = document.getElementById('edit-nom').value;
                        if (!nom) {
                            Swal.showValidationMessage('El nombre no puede estar vacío');
                            return false;
                        }
                        return { 
                            codigo: materia.codigo, 
                            nombre: nom, 
                            profesor_id: document.getElementById('edit-prof').value || null, 
                            color: document.getElementById('edit-color').value 
                        } 
                    }
                });

                if (formEdit) { 
                    try { 
                        const response = await fetch(`${API_URL}/asignaturas/${materia.id}`, { 
                            method: 'PUT', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify(formEdit) 
                        }); 
                        if (!response.ok) throw new Error("Error al modificar");
                        
                        await inicializarMaterias(); 
                        Swal.fire('¡Actualizado!', 'La asignatura fue modificada correctamente.', 'success'); 
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Error', 'Hubo un problema al actualizar.', 'error');
                    } 
                }
            }
        });
    }
});