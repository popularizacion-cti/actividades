// Configuración de origen de datos
const SHEET_ID = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let eventosGlobal = [];
let map, geoLayer;
let graficoRegion, graficoAnio;
let metricaActual = 'actividades';

/**
 * Función principal de carga
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
        console.error("Error en carga:", e);
    }
}

/**
 * Inicialización de Mapa
 */
function inicializarMapa() {
    if (map) map.remove();
    map = L.map('map', { zoomControl: true, minZoom: 5 }).setView([-9.19, -75.015], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('peru-regiones.geojson')
        .then(res => res.json())
        .then(data => {
            geoLayer = L.geoJSON(data, {
                style: estiloMapaDinamico,
                onEachFeature: (f, l) => {
                    l.on('click', () => {
                        const region = f.properties.NOMBDEP.toUpperCase();
                        const dataRegion = obtenerDatosFiltrados().filter(e => e.region === region);
                        const v = calcularValorMetrica(dataRegion);
                        l.bindPopup(`<b>${region}</b><br>${metricaActual}: ${v.toLocaleString()}`).openPopup();
                    });
                }
            }).addTo(map);
        });
}

/**
 * Cálculo de métrica según selección
 */
function calcularValorMetrica(datos) {
    if (metricaActual === 'actividades') return datos.length;
    if (metricaActual === 'participantes') return datos.reduce((a, b) => a + b.investigadores + b.docentes + b.estudiantes, 0);
    return datos.reduce((a, b) => a + (b[metricaActual] || 0), 0);
}

/**
 * Estilo de intensidad de color
 */
function estiloMapaDinamico(feature) {
    const region = feature.properties.NOMBDEP.toUpperCase();
    const filtradosActuales = obtenerDatosFiltrados();
    
    // Valor de la región específica
    const valorRegion = calcularValorMetrica(filtradosActuales.filter(e => e.region === region));

    // Valor máximo actual para normalizar colores
    const resumen = {};
    filtradosActuales.forEach(e => {
        const v = (metricaActual === 'actividades') ? 1 : 
                  (metricaActual === 'participantes') ? (e.investigadores+e.docentes+e.estudiantes) : (e[metricaActual] || 0);
        resumen[e.region] = (resumen[e.region] || 0) + v;
    });
    const maxVal = Math.max(...Object.values(resumen), 1);
    
    const ratio = valorRegion / maxVal;

    return {
        fillColor: valorRegion > 0 ? '#00A3E0' : 'transparent',
        fillOpacity: valorRegion > 0 ? (ratio * 0.75 + 0.15) : 0,
        weight: 1,
        color: '#fff'
    };
}

/**
 * Filtrado Cascada
 */
function obtenerDatosFiltrados() {
    const v = (id) => document.getElementById(id).value;
    return eventosGlobal.filter(e => 
        (!v("filtroObjetivo") || e.objetivo === v("filtroObjetivo")) &&
        (!v("filtroPrograma") || e.programa === v("filtroPrograma")) &&
        (!v("filtroProyecto") || e.proyecto === v("filtroProyecto")) &&
        (!v("filtroActividad") || e.nombre === v("filtroActividad")) &&
        (!v("filtroAnio") || e.anio === v("filtroAnio")) &&
        (!v("filtroRegion") || e.region === v("filtroRegion")) &&
        (!v("filtroInstitucion") || e.institucion === v("filtroInstitucion")) &&
        (!v("filtroAlcance") || e.alcance === v("filtroAlcance"))
    );
}

function actualizarFiltrosCascada() {
    const filtrados = obtenerDatosFiltrados();
    const selectConfig = [
        ["filtroObjetivo", "objetivo"], ["filtroPrograma", "programa"],
        ["filtroProyecto", "proyecto"], ["filtroActividad", "nombre"],
        ["filtroAnio", "anio"], ["filtroRegion", "region"],
        ["filtroInstitucion", "institucion"], ["filtroAlcance", "alcance"]
    ];

    selectConfig.forEach(([id, campo]) => {
        const el = document.getElementById(id);
        if (!el.value) {
            const opciones = [...new Set(filtrados.map(e => e[campo]))].filter(Boolean).sort();
            el.innerHTML = '<option value="">Todos</option>' + 
                opciones.map(o => `<option value="${o}">${o}</option>`).join('');
        }
    });
}

/**
 * Actualización Visual General
 */
function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    if (geoLayer) geoLayer.setStyle(estiloMapaDinamico);

    // Actualizar KPIs
    const p = filtrados.reduce((a,b) => a + b.investigadores + b.docentes + b.estudiantes, 0);
    const as = filtrados.reduce((a,b) => a + b.asistentes, 0);
    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${new Set(filtrados.map(e=>e.region)).size} Regiones</strong>`;
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong>`;
    document.getElementById("kpiParticipantes").innerHTML = `<span>Participantes</span><strong>${p.toLocaleString()}</strong>`;
    document.getElementById("kpiAsistentes").innerHTML = `<span>Asistentes</span><strong>${as.toLocaleString()}</strong>`;

    // Lista de eventos
    document.getElementById("listaEventos").innerHTML = filtrados.map(e => `
        <div class="evento-item">
            <h4>${e.nombre}</h4>
            <p>${e.region} | ${e.mes} ${e.anio}</p>
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
        const v = (metricaActual === 'actividades') ? 1 : 
                  (metricaActual === 'participantes') ? (e.investigadores+e.docentes+e.estudiantes) : (e[metricaActual] || 0);
        rReg[e.region] = (rReg[e.region] || 0) + v;
        rAnio[e.anio] = (rAnio[e.anio] || 0) + v;
    });

    const regs = Object.keys(rReg).sort((a,b) => rReg[b] - rReg[a]).slice(0, 8);
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
    actualizarFiltrosCascada();
    document.querySelectorAll(".filter-panel select").forEach(s => {
        s.addEventListener("change", () => {
            actualizarFiltrosCascada();
            actualizarVisualizacion();
        });
    });
    document.getElementById("selectorMetricaMapa").addEventListener("change", (e) => {
        metricaActual = e.target.value;
        actualizarVisualizacion();
    });
}

// Iniciar app
cargarDatos();
