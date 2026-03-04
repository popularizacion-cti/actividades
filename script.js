/**
 * CONFIGURACIÓN Y VARIABLES GLOBALES
 */
const SHEET_ID = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let eventosGlobal = [];
let map, geoLayer;
let graficoRegion, graficoAnio;
let metricaActual = 'actividades';

/**
 * 1. PROCESAMIENTO DE DATOS
 */
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
            anio: String(r.c[7]?.v || ""),
            localidad: r.c[8]?.v || "",
            region: String(r.c[9]?.v || "").toUpperCase().trim(),
            institucion: r.c[10]?.v || "",
            alcance: r.c[12]?.v || "",
            investigadores: (Number(r.c[13]?.v) || 0) + (Number(r.c[14]?.v) || 0),
            docentes: Number(r.c[15]?.v) || 0,
            estudiantes: (Number(r.c[16]?.v) || 0) + (Number(r.c[17]?.v) || 0),
            asistentes: (Number(r.c[18]?.v) || 0) + (Number(r.c[19]?.v) || 0),
        }));

        inicializarMapa();
        configurarEventos();
        actualizarVisualizacion();
    } catch (e) {
        console.error("Error al cargar datos de Google Sheets:", e);
    }
}

/**
 * 2. LÓGICA DE FILTRADO DINÁMICO
 */
function obtenerDatosFiltrados() {
    const getVal = (id) => document.getElementById(id).value;
    return eventosGlobal.filter(e => 
        (!getVal("filtroObjetivo") || e.objetivo === getVal("filtroObjetivo")) &&
        (!getVal("filtroPrograma") || e.programa === getVal("filtroPrograma")) &&
        (!getVal("filtroProyecto") || e.proyecto === getVal("filtroProyecto")) &&
        (!getVal("filtroActividad") || e.nombre === getVal("filtroActividad")) &&
        (!getVal("filtroAnio") || e.anio === getVal("filtroAnio")) &&
        (!getVal("filtroRegion") || e.region === getVal("filtroRegion")) &&
        (!getVal("filtroInstitucion") || e.institucion === getVal("filtroInstitucion")) &&
        (!getVal("filtroAlcance") || e.alcance === getVal("filtroAlcance"))
    );
}

function actualizarFiltrosCascada() {
    const filtrados = obtenerDatosFiltrados();
    const selects = [
        ["filtroObjetivo", "objetivo"], ["filtroPrograma", "programa"],
        ["filtroProyecto", "proyecto"], ["filtroActividad", "nombre"],
        ["filtroAnio", "anio"], ["filtroRegion", "region"],
        ["filtroInstitucion", "institucion"], ["filtroAlcance", "alcance"]
    ];

    selects.forEach(([id, campo]) => {
        const el = document.getElementById(id);
        const actual = el.value;
        if (!actual) { // Solo actualiza si no hay selección para acotar opciones disponibles
            const opciones = [...new Set(filtrados.map(e => e[campo]))].filter(Boolean).sort();
            el.innerHTML = '<option value="">Todos</option>' + 
                opciones.map(o => `<option value="${o}">${o}</option>`).join('');
        }
    });
}

/**
 * 3. CONTROL DEL MAPA E INTENSIDAD DE COLOR
 */
function inicializarMapa() {
    map = L.map('map', { zoomControl: true, minZoom: 5 }).setView([-9.19, -75.015], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('peru-regiones.geojson')
        .then(res => res.json())
        .then(data => {
            geoLayer = L.geoJSON(data, {
                style: estiloMapaDinamico,
                onEachFeature: (f, l) => l.bindPopup(() => generarPopup(f))
            }).addTo(map);
        });
}

function obtenerValorMetrica(listaEventos) {
    if (metricaActual === 'actividades') return listaEventos.length;
    if (metricaActual === 'participantes') return listaEventos.reduce((a, b) => a + b.investigadores + b.docentes + b.estudiantes, 0);
    return listaEventos.reduce((a, b) => a + (b[metricaActual] || 0), 0);
}

function estiloMapaDinamico(feature) {
    const region = feature.properties.NOMBDEP.toUpperCase();
    const filtradosGlobal = obtenerDatosFiltrados();
    
    // Calcular valor de la región actual
    const valorRegion = obtenerValorMetrica(filtradosGlobal.filter(e => e.region === region));

    // Calcular el máximo valor actual entre todas las regiones para normalizar la intensidad
    const resumenRegiones = {};
    filtradosGlobal.forEach(e => {
        resumenRegiones[e.region] = (resumenRegiones[e.region] || 0) + 
            (metricaActual === 'actividades' ? 1 : 
             metricaActual === 'participantes' ? (e.investigadores + e.docentes + e.estudiantes) : 
             (e[metricaActual] || 0));
    });
    
    const maxVal = Math.max(...Object.values(resumenRegiones), 1);
    const ratio = valorRegion / maxVal;

    return {
        fillColor: valorRegion > 0 ? '#00A3E0' : 'transparent',
        fillOpacity: valorRegion > 0 ? (ratio * 0.7 + 0.2) : 0, // Mínimo 0.2 de opacidad si hay datos
        weight: 1,
        color: '#fff'
    };
}

/**
 * 4. ACTUALIZACIÓN DE GRÁFICAS Y COMPONENTES
 */
function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    if (geoLayer) geoLayer.setStyle(estiloMapaDinamico);

    // KPIs
    const totalP = filtrados.reduce((a,b) => a + b.investigadores + b.docentes + b.estudiantes, 0);
    const totalA = filtrados.reduce((a,b) => a + b.asistentes, 0);
    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${new Set(filtrados.map(e=>e.region)).size} Regiones</strong>`;
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong>`;
    document.getElementById("kpiParticipantes").innerHTML = `<span>Participantes</span><strong>${totalP.toLocaleString()}</strong>`;
    document.getElementById("kpiAsistentes").innerHTML = `<span>Asistentes</span><strong>${totalA.toLocaleString()}</strong>`;

    // Lista lateral
    document.getElementById("listaEventos").innerHTML = filtrados.map(e => `
        <div class="evento-item">
            <h4>${e.nombre}</h4>
            <p>📅 ${e.mes} ${e.anio} | 📍 ${e.region}</p>
        </div>`).join('');

    actualizarGraficas(filtrados);
}

function actualizarGraficas(datos) {
    if(graficoRegion) graficoRegion.destroy();
    if(graficoAnio) graficoAnio.destroy();

    const labelMetrica = document.getElementById("selectorMetricaMapa").selectedOptions[0].text;
    document.getElementById("tituloGraficoRegion").innerText = labelMetrica + " por Región";
    document.getElementById("tituloGraficoAnio").innerText = labelMetrica por Año";

    const resReg = {}, resAnio = {};
    datos.forEach(e => {
        const v = (metricaActual === 'actividades') ? 1 : 
                  (metricaActual === 'participantes') ? (e.investigadores+e.docentes+e.estudiantes) : (e[metricaActual] || 0);
        resReg[e.region] = (resReg[e.region] || 0) + v;
        resAnio[e.anio] = (resAnio[e.anio] || 0) + v;
    });

    const regs = Object.keys(resReg).sort((a,b) => resReg[b] - resReg[a]).slice(0, 10);
    graficoRegion = new Chart(document.getElementById("graficoRegiones"), {
        type: 'bar',
        data: { labels: regs, datasets: [{ data: regs.map(r=>resReg[r]), backgroundColor: '#00A3E0' }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });

    const anios = Object.keys(resAnio).sort();
    graficoAnio = new Chart(document.getElementById("graficoAnio"), {
        type: 'line',
        data: { labels: anios, datasets: [{ data: anios.map(a=>resAnio[a]), borderColor: '#00A3E0', fill: true, tension: 0.4, backgroundColor: 'rgba(0,163,224,0.1)' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });
}

/**
 * 5. EVENTOS
 */
function configurarEventos() {
    actualizarFiltrosCascada();
    document.querySelectorAll(".filter-panel select").forEach(s => {
        s.addEventListener("change", () => { actualizarFiltrosCascada(); actualizarVisualizacion(); });
    });
    document.getElementById("selectorMetricaMapa").addEventListener("change", (e) => {
        metricaActual = e.target.value;
        actualizarVisualizacion();
    });
}

function generarPopup(feature) {
    const region = feature.properties.NOMBDEP.toUpperCase();
    const data = obtenerDatosFiltrados().filter(e => e.region === region);
    return `<div class="popup-box"><b>${region}</b><br>Actividades: ${data.length}<br>Participantes: ${data.reduce((a,b)=>a+b.investigadores+b.docentes+b.estudiantes,0)}</div>`;
}

cargarDatos();
