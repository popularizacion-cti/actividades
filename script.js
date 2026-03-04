/**
 * CONFIGURACIÓN DE DATOS Y VARIABLES GLOBALES
 */
const SHEET_ID = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let eventosGlobal = [];
let map, geoLayer;
let graficoRegion, graficoAnio;
let metricaActual = 'actividades';

/**
 * 1. CARGA INICIAL DE DATOS
 */
async function cargarDatos() {
    try {
        const response = await fetch(URL);
        const text = await response.text();
        const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));

        // Mapeo de columnas según la estructura de tu Google Sheet
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
        configurarInteracciones();
        actualizarVisualizacion();
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

/**
 * 2. CONFIGURACIÓN DEL MAPA (Leaflet)
 */
function inicializarMapa() {
    map = L.map('map', {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 7,
        maxBounds: [[-20, -85], [1, -65]] // Bloqueo en Perú
    }).setView([-9.19, -75.015], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('peru-regiones.geojson')
        .then(res => res.json())
        .then(data => {
            geoLayer = L.geoJSON(data, {
                style: estiloRegion,
                onEachFeature: configurarPopupRegion
            }).addTo(map);
        });
}

/**
 * 3. LÓGICA DE FILTRADO (Cascada)
 */
function obtenerDatosFiltrados() {
    const f = (id) => document.getElementById(id).value;
    return eventosGlobal.filter(e => 
        (!f("filtroObjetivo") || e.objetivo === f("filtroObjetivo")) &&
        (!f("filtroPrograma") || e.programa === f("filtroPrograma")) &&
        (!f("filtroProyecto") || e.proyecto === f("filtroProyecto")) &&
        (!f("filtroActividad") || e.nombre === f("filtroActividad")) &&
        (!f("filtroAnio") || e.anio === f("filtroAnio")) &&
        (!f("filtroRegion") || e.region === f("filtroRegion")) &&
        (!f("filtroInstitucion") || e.institucion === f("filtroInstitucion")) &&
        (!f("filtroAlcance") || e.alcance === f("filtroAlcance"))
    );
}

function actualizarFiltrosCascada() {
    const filtrados = obtenerDatosFiltrados();
    const combos = [
        ["filtroObjetivo", "objetivo"], ["filtroPrograma", "programa"],
        ["filtroProyecto", "proyecto"], ["filtroActividad", "nombre"],
        ["filtroAnio", "anio"], ["filtroRegion", "region"],
        ["filtroInstitucion", "institucion"], ["filtroAlcance", "alcance"]
    ];

    combos.forEach(([id, campo]) => {
        const combo = document.getElementById(id);
        if (!combo.value) { // Solo acota filtros que no han sido seleccionados
            const valorActual = combo.value;
            const opciones = [...new Set(filtrados.map(e => e[campo]))].filter(Boolean).sort();
            combo.innerHTML = '<option value="">Todos</option>' + 
                opciones.map(o => `<option value="${o}" ${o===valorActual?'selected':''}>${o}</option>`).join('');
        }
    });
}

/**
 * 4. ACTUALIZACIÓN VISUAL (Gráficas y Mapa)
 */
function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    
    // Sincronizar Mapa
    if (geoLayer) geoLayer.setStyle(estiloRegion);

    // Actualizar KPIs
    const regUnicas = new Set(filtrados.map(e => e.region)).size;
    const part = filtrados.reduce((a,b) => a + b.investigadores + b.docentes + b.estudiantes, 0);
    const asist = filtrados.reduce((a,b) => a + b.asistentes, 0);

    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${regUnicas} Regiones</strong>`;
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong>`;
    document.getElementById("kpiParticipantes").innerHTML = `<span>Participantes</span><strong>${part.toLocaleString()}</strong>`;
    document.getElementById("kpiAsistentes").innerHTML = `<span>Asistentes</span><strong>${asist.toLocaleString()}</strong>`;

    // Actualizar Lista lateral
    document.getElementById("listaEventos").innerHTML = filtrados.map(e => `
        <div class="evento-item">
            <h4>${e.nombre}</h4>
            <p>📍 ${e.region} | 📅 ${e.mes} ${e.anio}</p>
            <small>${e.institucion}</small>
        </div>
    `).join('');

    actualizarGraficasDinamicas(filtrados);
}

function actualizarGraficasDinamicas(datos) {
    if(graficoRegion) graficoRegion.destroy();
    if(graficoAnio) graficoAnio.destroy();

    const selector = document.getElementById("selectorMetricaMapa");
    const textoMetrica = selector.options[selector.selectedIndex].text;
    document.getElementById("tituloGraficoRegion").innerText = textoMetrica + " por Región";
    document.getElementById("tituloGraficoAnio").innerText = textoMetrica + " por Año";

    const dataReg = {}, dataAnio = {};

    datos.forEach(e => {
        let v = 0;
        if(metricaActual === 'actividades') v = 1;
        else if(metricaActual === 'participantes') v = e.investigadores + e.docentes + e.estudiantes;
        else v = e[metricaActual] || 0;

        dataReg[e.region] = (dataReg[e.region] || 0) + v;
        dataAnio[e.anio] = (dataAnio[e.anio] || 0) + v;
    });

    // Gráfica de Regiones (Barras horizontales)
    const regsSorted = Object.keys(dataReg).sort((a,b) => dataReg[b] - dataReg[a]).slice(0,10);
    graficoRegion = new Chart(document.getElementById("graficoRegiones"), {
        type: 'bar',
        data: {
            labels: regsSorted,
            datasets: [{ data: regsSorted.map(r => dataReg[r]), backgroundColor: '#00A3E0', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    });

    // Gráfica de Años (Línea de tiempo)
    const aniosSorted = Object.keys(dataAnio).sort();
    graficoAnio = new Chart(document.getElementById("graficoAnio"), {
        type: 'line',
        data: {
            labels: aniosSorted,
            datasets: [{ 
                data: aniosSorted.map(a => dataAnio[a]), 
                borderColor: '#00A3E0', 
                backgroundColor: 'rgba(0,163,224,0.1)', 
                fill: true, 
                tension: 0.4,
                pointRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    });
}

/**
 * 5. ESTILOS DE MAPA Y POPUPS
 */
function estiloRegion(feature) {
    const region = feature.properties.NOMBDEP.toUpperCase();
    const filtrados = obtenerDatosFiltrados();
    const dataRegion = filtrados.filter(e => e.region === region);

    let valorTotal = 0;
    dataRegion.forEach(e => {
        if(metricaActual === 'actividades') valorTotal += 1;
        else if(metricaActual === 'participantes') valorTotal += (e.investigadores + e.docentes + e.estudiantes);
        else valorTotal += (e[metricaActual] || 0);
    });

    return {
        fillColor: valorTotal > 0 ? '#00A3E0' : 'transparent',
        fillOpacity: valorTotal > 0 ? Math.min(valorTotal / 100 + 0.2, 0.9) : 0,
        weight: 1,
        color: '#fff'
    };
}

function configurarPopupRegion(feature, layer) {
    layer.on("click", () => {
        const region = feature.properties.NOMBDEP.toUpperCase();
        const data = obtenerDatosFiltrados().filter(e => e.region === region);
        const sum = (p) => data.reduce((a,b) => a + (b[p] || 0), 0);
        
        layer.bindPopup(`
            <div style="font-family: Inter, sans-serif">
                <h3 style="margin:0; color:#00A3E0">${region}</h3>
                <hr>
                <b>Actividades:</b> ${data.length}<br>
                <b>Estudiantes:</b> ${sum('estudiantes')}<br>
                <b>Asistentes:</b> ${sum('asistentes')}
            </div>
        `).openPopup();
    });
}

/**
 * 6. EVENTOS DE INTERFAZ
 */
function configurarInteracciones() {
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

cargarDatos();
