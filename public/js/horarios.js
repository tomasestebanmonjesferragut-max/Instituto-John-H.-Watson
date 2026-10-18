document.addEventListener('DOMContentLoaded', () => {
    const tablaHorarios = document.getElementById('tablaHorarios');
    const btnMover = document.getElementById('btnMoverHorario');
    
    if (!tablaHorarios) return;

    let db = null; 
    const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const API_URL = '/api';

    inicializarHorario();

    async function inicializarHorario() {
        try {
            const respuesta = await fetch(`${API_URL}/db`);
            const dbJson = await respuesta.json();
            
            // Transformar filas SQL a la tabla HTML
            const horariosAgrupados = [];
            const bloquesUnicos = [...new Set(dbJson.horarios.map(h => h.bloque))];
            
            bloquesUnicos.forEach(bloqueHora => {
                let bloqueEstructura = { bloque: bloqueHora };
                let filasDelBloque = dbJson.horarios.filter(h => h.bloque === bloqueHora);
                filasDelBloque.forEach(fila => { 
                    bloqueEstructura[fila.dia] = { asignatura_id: fila.asignatura_id, aula: fila.aula }; 
                });
                horariosAgrupados.push(bloqueEstructura);
            });
            
            dbJson.horarios = horariosAgrupados;
            db = dbJson;
            renderizarTabla();
        } catch (error) { 
            console.error("Error al conectar con la base de datos:", error);
            tablaHorarios.innerHTML = `<tr><td colspan="6" class="text-danger py-4">Error conectando con MySQL.</td></tr>`; 
        }
    }

    function renderizarTabla() {
        tablaHorarios.innerHTML = ''; 
        db.horarios.forEach((bloqueData, index) => {
            const fila = document.createElement('tr');
            fila.className = 'fade-in';
            let htmlFila = `<td><span class="badge badge-id">${bloqueData.bloque}</span></td>`;
            
            diasSemana.forEach(dia => {
                const claseDelDia = bloqueData[dia];
                if (claseDelDia && claseDelDia.asignatura_id) {
                    const asignatura = db.asignaturas.find(a => a.id === claseDelDia.asignatura_id);
                    if (asignatura) { 
                        htmlFila += `<td><span class="d-block fw-semibold text-${asignatura.color}">${asignatura.nombre}</span><small class="text-muted">${claseDelDia.aula}</small></td>`; 
                    } else { 
                        htmlFila += `<td><span class="text-muted">-</span></td>`; 
                    }
                } else { 
                    htmlFila += `<td><span class="text-muted">-</span></td>`; 
                }
            });
            
            fila.innerHTML = htmlFila;
            tablaHorarios.appendChild(fila);
            
            // Inyección visual de Almuerzo y Receso según la posición de la fila
            if (index === 1) {
                tablaHorarios.innerHTML += `<tr style="background: var(--bg-tertiary);"><td colspan="6" class="text-muted fw-bold letter-spacing-1 text-center"><i class="bi bi-cup-hot me-2"></i> A L M U E R Z O</td></tr>`;
            }
            if (index === 3) {
                tablaHorarios.innerHTML += `<tr style="background: var(--bg-tertiary);"><td colspan="6" class="text-muted fw-bold letter-spacing-1 text-center"><i class="bi bi-controller me-2"></i> R E C E S O</td></tr>`;
            }
        });

        // Renderizado de la sección de avisos y notas desde la BD
        if (db.notas && db.notas.length > 0) {
            let contenidoNotas = db.notas.map(nota => `<li>${nota}</li>`).join('');
            tablaHorarios.innerHTML += `<tr><td colspan="6" class="text-start p-4 bg-light bg-opacity-10 rounded-bottom"><h6 class="fw-bold text-warning mb-2"><i class="bi bi-exclamation-triangle-fill me-2"></i>Avisos Importantes:</h6><ul class="mb-0 small text-muted text-start" style="list-style-type: square;">${contenidoNotas}</ul></td></tr>`;
        }
    }

    // LÓGICA DEL BOTÓN: MOVER / EDITAR HORARIO
    if (btnMover) {
        btnMover.addEventListener('click', async () => {
            if (!db) return;

            // Generamos las opciones del select de bloques dinámicamente
            let opcionesBloques = '';
            db.horarios.forEach((b) => {
                opcionesBloques += `<option value="${b.bloque}">${b.bloque}</option>`;
            });

            // Generamos las opciones del select de asignaturas dinámicamente
            let opcionesAsignaturas = `<option value="NULL">-- Dejar libre --</option>`;
            db.asignaturas.forEach(a => {
                opcionesAsignaturas += `<option value="${a.id}">${a.codigo} - ${a.nombre}</option>`;
            });

            const { value: formValues } = await Swal.fire({
                title: 'Editar Horario',
                html: `
                    <div class="form-floating mb-3">
                        <select id="swal-bloque" class="form-select">${opcionesBloques}</select>
                        <label>Bloque horario</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="swal-dia" class="form-select">
                            <option value="lunes">Lunes</option>
                            <option value="martes">Martes</option>
                            <option value="miercoles">Miércoles</option>
                            <option value="jueves">Jueves</option>
                            <option value="viernes">Viernes</option>
                        </select>
                        <label>Día</label>
                    </div>
                    <div class="form-floating mb-3">
                        <select id="swal-asig" class="form-select">${opcionesAsignaturas}</select>
                        <label>Asignatura</label>
                    </div>
                    <div class="form-floating">
                        <input id="swal-aula" class="form-control" placeholder="Ej: Lab 1">
                        <label>Sala / Aula</label>
                    </div>
                `,
                confirmButtonText: 'Guardar cambios',
                showCancelButton: true,
                preConfirm: () => {
                    const asigValue = document.getElementById('swal-asig').value;
                    return {
                        bloque: document.getElementById('swal-bloque').value,
                        dia: document.getElementById('swal-dia').value,
                        // Convertimos la cadena 'NULL' en un valor nulo real si seleccionan limpiar la celda
                        asignatura_id: asigValue === 'NULL' ? null : asigValue,
                        aula: document.getElementById('swal-aula').value
                    }
                }
            });

            if (formValues) {
                try {
                    // Enviamos los cambios al Backend mediante PUT
                    const respuesta = await fetch(`${API_URL}/horarios`, { 
                        method: 'PUT', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(formValues) 
                    });
                    
                    if (!respuesta.ok) throw new Error("Error en la solicitud");
                    
                    // Recargamos los datos desde MySQL para actualizar la tabla en tiempo real
                    await inicializarHorario(); 
                    Swal.fire('¡Éxito!', 'Horario actualizado y guardado en MySQL.', 'success');
                } catch (e) {
                    console.error(e);
                    Swal.fire('Error', 'No se pudo guardar en la BD. Revisa el endpoint en tu servidor.', 'error');
                }
            }
        });
    }

    // EXPORTACIÓN A PDF 
    const btnExportar = document.querySelector('.bi-printer')?.closest('button');
    if (btnExportar) {
        btnExportar.addEventListener('click', () => {
            const elementoTabla = document.querySelector('.table-responsive');
            if (!elementoTabla) {
                Swal.fire('Error', 'No se encontró el contenedor de la tabla para exportar.', 'error');
                return;
            }

            const opciones = { 
                margin: 0.3, 
                filename: 'Horario.pdf', 
                image: { type: 'jpeg', quality: 1 }, 
                html2canvas: { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 }, 
                jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' } 
            };
            
            const textoOriginal = btnExportar.innerHTML;
            btnExportar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';
            
            html2pdf().set(opciones).from(elementoTabla).save().then(() => { 
                btnExportar.innerHTML = textoOriginal; 
                Swal.fire('¡Completo!', 'El archivo PDF se ha descargado.', 'success'); 
            }).catch(err => {
                console.error(err);
                btnExportar.innerHTML = textoOriginal;
                Swal.fire('Error', 'No se pudo generar el archivo PDF.', 'error');
            });
        });
    }
});