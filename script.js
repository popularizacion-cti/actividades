const SHEET_ID = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let eventosGlobal = [];
let map, geoLayer;
let graficoRegion, graficoAnio;
let metricaActual = 'actividades';

async function cargarDatos() {
    try {
        const response = await fetch(URL);
        const text = await response.text();
        const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));

        eventosGlobal = json.table.rows.map(r => ({
            objetivo: r.c[0]?.v || "",
            programa: r.c[1]?.v || "",
            proyecto: r.c[2]?.v || "",
            nombre: r.c[3]?.v || "",
            tipo: r.c[4]?.v || "",
            modalidad: r.c[5]?.v || "",
            mes: r.c[6]?.v || "",
            anio: r.c[7]?.v ? String(r.c[7].v) : "",
            localidad: r.c[8]?.v || "",
            region: String(r.c[9]?.v || "").toUpperCase().trim(),
            institucion: r.c[10]?.v || "",
            alcance: r.c[12]?.v || "",
            investigadores: (Number(r.c[13]?.v) || 0) + (Number(r.c[14]?.v) || 0),
            docentes: Number(r.c[15]?.v) || 0,
            estudiantes: (Number(r.c[16]?.v) || 0) + (Number(r.c[17]?.v) || 0),
            presenciales: Number(r.c[18]?.v) || 0,
            virtuales: Number(r.c[19]?.v) || 0,
            asistentes: (Number(r.c[18]?.v) || 0) + (Number(r.c[19]?.v) || 0)
        }));

        inicializarMapa();
        configurarEventos();
        actualizarVisualizacion();
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

function calcularValorPorMetrica(evento, metrica) {
    if (metrica === 'actividades') return 1;
    if (metrica === 'participantes') return evento.investigadores + evento.docentes + evento.estudiantes;
    return evento[metrica] || 0;
}

function obtenerDatosFiltrados() {
    const v = (id) => document.getElementById(id).value;
    const busqueda = document.getElementById("buscadorTexto").value.toLowerCase();

    return eventosGlobal.filter(e => {
        const coincideBusqueda = !busqueda || 
            e.nombre.toLowerCase().includes(busqueda) || 
            e.programa.toLowerCase().includes(busqueda) ||
            e.proyecto.toLowerCase().includes(busqueda) ||
            e.region.toLowerCase().includes(busqueda) ||
            e.institucion.toLowerCase().includes(busqueda);

        return coincideBusqueda &&
            (!v("filtroObjetivo") || e.objetivo === v("filtroObjetivo")) &&
            (!v("filtroPrograma") || e.programa === v("filtroPrograma")) &&
            (!v("filtroProyecto") || e.proyecto === v("filtroProyecto")) &&
            (!v("filtroActividad") || e.nombre === v("filtroActividad")) &&
            (!v("filtroAnio") || e.anio === v("filtroAnio")) &&
            (!v("filtroRegion") || e.region === v("filtroRegion")) &&
            (!v("filtroInstitucion") || e.institucion === v("filtroInstitucion")) &&
            (!v("filtroAlcance") || e.alcance === v("filtroAlcance"));
    });
}

function estiloMapaDinamico(feature) {
    const region = feature.properties.NOMBDEP.toUpperCase();
    const filtrados = obtenerDatosFiltrados();
    const valorRegion = filtrados.filter(e => e.region === region)
                                 .reduce((acc, curr) => acc + calcularValorPorMetrica(curr, metricaActual), 0);

    const resumen = {};
    filtrados.forEach(e => resumen[e.region] = (resumen[e.region] || 0) + calcularValorPorMetrica(e, metricaActual));
    const maxVal = Math.max(...Object.values(resumen), 1);
    const ratio = valorRegion / maxVal;

    return {
        fillColor: valorRegion > 0 ? '#00A3E0' : 'transparent',
        fillOpacity: valorRegion > 0 ? (ratio * 0.75 + 0.15) : 0,
        weight: 1, color: '#fff'
    };
}

function inicializarMapa() {
    map = L.map('map', { zoomControl: true, minZoom: 5, maxZoom: 5 }).setView([-9.19, -75.015], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('peru-regiones.geojson')
        .then(res => res.json())
        .then(data => {
            geoLayer = L.geoJSON(data, {
                style: estiloMapaDinamico,
                onEachFeature: (f, l) => {
                    l.on('click', () => {
                        const reg = f.properties.NOMBDEP.toUpperCase();
                        const dataReg = obtenerDatosFiltrados().filter(e => e.region === reg);
                        const nAct = dataReg.length;
                        const nEst = dataReg.reduce((a,b)=>a+b.estudiantes, 0);
                        const nDoc = dataReg.reduce((a,b)=>a+b.docentes, 0);
                        const nInv = dataReg.reduce((a,b)=>a+b.investigadores, 0);
                        const nAsist = dataReg.reduce((a,b)=>a+b.asistentes, 0);

                        l.bindPopup(`
                            <div class="custom-popup">
                                <h3>${reg}</h3><hr>
                                <b>Actividades:</b> ${nAct}<br>
                                <b>Participantes:</b> ${(nEst+nDoc+nInv).toLocaleString()}<br>
                                <small>• Estudiantes: ${nEst.toLocaleString()}</small><br>
                                <small>• Docentes: ${nDoc.toLocaleString()}</small><br>
                                <small>• Investigadores: ${nInv.toLocaleString()}</small><br>
                                <b>Asistentes:</b> ${nAsist.toLocaleString()}
                            </div>
                        `).openPopup();
                    });
                }
            }).addTo(map);
        });
}

function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    if (geoLayer) geoLayer.setStyle(estiloMapaDinamico);

    // KPI Años
    const listaAnios = filtrados.map(e => parseInt(e.anio)).filter(n => !isNaN(n));
    const minAnio = Math.min(...listaAnios);
    const maxAnio = Math.max(...listaAnios);
    document.getElementById("kpiAnios").innerHTML = `<span>Periodo</span><strong>${minAnio === Infinity ? '-' : minAnio + ' - ' + maxAnio}</strong>`;

    // KPI Cobertura y Actividades
    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${new Set(filtrados.map(e=>e.region)).size} Regiones</strong>`;
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong>`;

    // KPI Participantes Disgregado
    const est = filtrados.reduce((a,b)=>a+b.estudiantes, 0);
    const doc = filtrados.reduce((a,b)=>a+b.docentes, 0);
    const inv = filtrados.reduce((a,b)=>a+b.investigadores, 0);
    let htmlPart = `<span>Participantes</span><strong>${(est+doc+inv).toLocaleString()}</strong>`;
    let detailPart = [];
    if(est > 0) detailPart.push(`${est.toLocaleString()} Alum.`);
    if(doc > 0) detailPart.push(`${doc.toLocaleString()} Doc.`);
    if(inv > 0) detailPart.push(`${inv.toLocaleString()} Inv.`);
    if(detailPart.length > 0) htmlPart += `<small>${detailPart.join(' | ')}</small>`;
    document.getElementById("kpiParticipantes").innerHTML = htmlPart;

    // KPI Asistentes Disgregado
    const pres = filtrados.reduce((a,b)=>a+b.presenciales, 0);
    const virt = filtrados.reduce((a,b)=>a+b.virtuales, 0);
    let htmlAsist = `<span>Asistentes</span><strong>${(pres+virt).toLocaleString()}</strong>`;
    let detailAsist = [];
    if(pres > 0) detailAsist.push(`${pres.toLocaleString()} Pres.`);
    if(virt > 0) detailAsist.push(`${virt.toLocaleString()} Virt.`);
    if(detailAsist.length > 0) htmlAsist += `<small>${detailAsist.join(' | ')}</small>`;
    document.getElementById("kpiAsistentes").innerHTML = htmlAsist;

    // Lista
    document.getElementById("listaEventos").innerHTML = filtrados.map(e => `
        <div class="evento-item">
            <h4>${e.nombre}</h4>
            <p>${e.region} | ${e.anio}</p>
        </div>`).join('');

    actualizarGraficas(filtrados);
}

function actualizarGraficas(datos) {
    if(graficoRegion) graficoRegion.destroy();
    if(graficoAnio) graficoAnio.destroy();

    const label = document.getElementById("selectorMetricaMapa").selectedOptions[0].text;
    document.getElementById("tituloGraficoRegion").innerText = label + " por Región";
    document.getElementById("tituloGraficoAnio").innerText = label + " por Año";

    const rReg = {}, rAnio = {};
    datos.forEach(e => {
        const v = calcularValorPorMetrica(e, metricaActual);
        rReg[e.region] = (rReg[e.region] || 0) + v;
        rAnio[e.anio] = (rAnio[e.anio] || 0) + v;
    });

    const regs = Object.keys(rReg).sort((a,b)=>rReg[b]-rReg[a]).slice(0, 10);
    graficoRegion = new Chart(document.getElementById("graficoRegiones"), {
        type: 'bar',
        data: { labels: regs, datasets: [{ data: regs.map(r=>rReg[r]), backgroundColor: '#00A3E0' }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });

    const anios = Object.keys(rAnio).sort();
    graficoAnio = new Chart(document.getElementById("graficoAnio"), {
        type: 'line',
        data: { labels: anios, datasets: [{ data: anios.map(a=>rAnio[a]), borderColor: '#00A3E0', fill: true, tension: 0.4, backgroundColor: 'rgba(0,163,224,0.1)' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });
}

function configurarEventos() {
    const inputs = document.querySelectorAll(".filter-panel select");
    inputs.forEach(i => i.addEventListener("change", () => {
        actualizarFiltrosCascada();
        actualizarVisualizacion();
    }));
    
    document.getElementById("buscadorTexto").addEventListener("input", actualizarVisualizacion);
    
    document.getElementById("selectorMetricaMapa").addEventListener("change", (e) => {
        metricaActual = e.target.value;
        actualizarVisualizacion();
    });

    document.getElementById("btnLimpiar").addEventListener("click", () => {
        document.querySelectorAll(".filter-panel select").forEach(s => s.value = "");
        document.getElementById("buscadorTexto").value = "";
        actualizarFiltrosCascada();
        actualizarVisualizacion();
    });

    document.getElementById("btnExportar").addEventListener("click", exportarCSV);
    actualizarFiltrosCascada();
}

function actualizarFiltrosCascada() {
    const filtrados = obtenerDatosFiltrados();
    const config = [["filtroObjetivo","objetivo"], ["filtroPrograma","programa"], ["filtroProyecto","proyecto"], ["filtroActividad","nombre"], ["filtroAnio","anio"], ["filtroRegion","region"], ["filtroInstitucion","institucion"], ["filtroAlcance","alcance"]];
    config.forEach(([id, campo]) => {
        const el = document.getElementById(id);
        const actualVal = el.value;
        if (!actualVal) {
            const opts = [...new Set(filtrados.map(e => e[campo]))].filter(Boolean).sort();
            el.innerHTML = '<option value="">Todos</option>' + opts.map(o => `<option value="${o}">${o}</option>`).join('');
        }
    });
}

function exportarCSV() {
    const datos = obtenerDatosFiltrados();
    if (!datos.length) {
        alert("No hay datos para exportar.");
        return;
    }

    const headers = ["Nombre", "Programa", "Proyecto", "Objetivo", "Tipo", "Modalidad", "Mes", "Año", "Localidad", "Region", "Institucion", "Alcance", "Investigadores", "Docentes", "Estudiantes", "Presenciales", "Virtuales"];
    
    const rows = datos.map(d => [
        `"${d.nombre}"`, `"${d.programa}"`, `"${d.proyecto}"`, `"${d.objetivo}"`,
        `"${d.tipo}"`, `"${d.modalidad}"`, `"${d.mes}"`, `"${d.anio}"`,
        `"${d.localidad}"`, `"${d.region}"`, `"${d.institucion}"`, `"${d.alcance}"`,
        d.investigadores, d.docentes, d.estudiantes, d.presenciales, d.virtuales
    ].join(","));

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "popularizacion_ciencia_concytec.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

cargarDatos();
