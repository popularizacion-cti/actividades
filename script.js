const SHEET_ID = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let eventosGlobal = [];
let map, geoLayer, tileLayer;
let graficoRegion, graficoAnio;
let metricaActual = 'actividades';

const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

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

        configurarEventos();
        actualizarFiltrosCascada();
        inicializarMapa();
        actualizarVisualizacion();
        
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

function calcularValorPorMetrica(evento, metrica) {
    if (metrica === 'actividades') return 1;
    if (metrica === 'participantes') return (evento.investigadores || 0) + (evento.docentes || 0) + (evento.estudiantes || 0);
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

function inicializarMapa() {
    if (map) map.remove();
    // Optimización para Google Sites: Permitimos navegación pero quitamos el scroll zoom molesto
    map = L.map('map', {
        zoomControl: true, dragging: true, scrollWheelZoom: false,
        touchZoom: true, zoomSnap: 0.1,
        minZoom: 4.5, maxZoom: 8
    }).setView([-9.19, -75.015], 5.2);

    const currentTheme = document.documentElement.getAttribute('data-theme');
    tileLayer = L.tileLayer(currentTheme === 'dark' ? TILE_DARK : TILE_LIGHT).addTo(map);
    
    fetch('peru-regiones.geojson')
        .then(res => res.json())
        .then(data => {
            geoLayer = L.geoJSON(data, {
                style: estiloMapaDinamico,
                onEachFeature: (f, l) => {
                    l.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        const reg = f.properties.NOMBDEP.toUpperCase();
                        const dataReg = obtenerDatosFiltrados().filter(ev => ev.region === reg);
                        const nAct = dataReg.length;
                        const nPart = dataReg.reduce((a,b)=>a+calcularValorPorMetrica(b, 'participantes'), 0);
                        const nAsist = dataReg.reduce((a,b)=>a+(b.asistentes||0), 0);

                        l.bindPopup(`
                            <div style="font-family: 'Inter', sans-serif;">
                                <h4 style="margin:0; color:#00A3E0">${reg}</h4>
                                <hr style="margin:5px 0; opacity:0.2">
                                <b>Actividades:</b> ${nAct}<br>
                                <b>Participantes:</b> ${nPart.toLocaleString()}<br>
                                <b>Asistentes:</b> ${nAsist.toLocaleString()}
                            </div>
                        `).openPopup();
                    });
                }
            }).addTo(map);
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
        fillOpacity: valorRegion > 0 ? (ratio * 0.7 + 0.2) : 0,
        weight: 1, color: '#fff'
    };
}

function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    if (geoLayer) geoLayer.setStyle(estiloMapaDinamico);

    // KPIs
    const listaAnios = filtrados.map(e => parseInt(e.anio)).filter(n => !isNaN(n));
    document.getElementById("kpiAnios").innerHTML = `<span>Periodo</span><strong>${listaAnios.length ? Math.min(...listaAnios) + ' - ' + Math.max(...listaAnios) : '-'}</strong>`;
    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${new Set(filtrados.map(e=>e.region)).size} Regiones</strong>`;
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong><small>Total programadas</small>`;
    
    const partTotal = filtrados.reduce((a,b)=>a+calcularValorPorMetrica(b, 'participantes'), 0);
    document.getElementById("kpiParticipantes").innerHTML = `<span>Participantes</span><strong>${partTotal.toLocaleString()}</strong><small>Estud. | Docent. | Inv.</small>`;
    
    const asistTotal = filtrados.reduce((a,b)=>a+b.asistentes, 0);
    document.getElementById("kpiAsistentes").innerHTML = `<span>Asistentes</span><strong>${asistTotal.toLocaleString()}</strong><small>Presencial y Virtual</small>`;

    // Lista
    document.getElementById("listaEventos").innerHTML = filtrados.map(e => `
        <div class="evento-item">
            <h4>${e.nombre}</h4>
            <p><strong>${e.region}</strong> | ${e.mes} ${e.anio}</p>
            <p>${e.institucion}</p>
        </div>`).join('');

    actualizarGraficas(filtrados);
}

function actualizarGraficas(datos) {
    if(graficoRegion) graficoRegion.destroy();
    if(graficoAnio) graficoAnio.destroy();

    const rReg = {}, rAnio = {};
    datos.forEach(e => {
        const v = calcularValorPorMetrica(e, metricaActual);
        rReg[e.region] = (rReg[e.region] || 0) + v;
        rAnio[e.anio] = (rAnio[e.anio] || 0) + v;
    });

    const regs = Object.keys(rReg).sort((a,b)=>rReg[b]-rReg[a]).slice(0, 10);
    graficoRegion = new Chart(document.getElementById("graficoRegiones"), {
        type: 'bar',
        data: { labels: regs.map(r => r.substring(0,10)), datasets: [{ data: regs.map(r=>rReg[r]), backgroundColor: '#00A3E0' }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });

    const anios = Object.keys(rAnio).sort();
    graficoAnio = new Chart(document.getElementById("graficoAnio"), {
        type: 'line',
        data: { labels: anios, datasets: [{ data: anios.map(a=>rAnio[a]), borderColor: '#00A3E0', fill: true, tension: 0.3, backgroundColor: 'rgba(0,163,224,0.1)' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });
}

function configurarEventos() {
    document.getElementById("themeToggle").onclick = () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(next === 'dark' ? TILE_DARK : TILE_LIGHT).addTo(map);
    };
    
    document.querySelectorAll(".filter-panel select").forEach(s => s.onchange = () => { actualizarFiltrosCascada(); actualizarVisualizacion(); });
    document.getElementById("buscadorTexto").oninput = actualizarVisualizacion;
    document.getElementById("selectorMetricaMapa").onchange = (e) => { metricaActual = e.target.value; actualizarVisualizacion(); };
    document.getElementById("btnLimpiar").onclick = () => {
        document.querySelectorAll(".filter-panel select").forEach(s => s.value = "");
        document.getElementById("buscadorTexto").value = "";
        actualizarFiltrosCascada(); actualizarVisualizacion();
    };
}

function actualizarFiltrosCascada() {
    const filtrados = obtenerDatosFiltrados();
    const config = [["filtroObjetivo","objetivo"], ["filtroPrograma","programa"], ["filtroProyecto","proyecto"], ["filtroActividad","nombre"], ["filtroAnio","anio"], ["filtroRegion","region"], ["filtroInstitucion","institucion"], ["filtroAlcance","alcance"]];
    config.forEach(([id, campo]) => {
        const el = document.getElementById(id);
        if (!el.value) {
            const opts = [...new Set(filtrados.map(e => e[campo]))].filter(Boolean).sort();
            el.innerHTML = '<option value="">Todos</option>' + opts.map(o => `<option value="${o}">${o}</option>`).join('');
        }
    });
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
cargarDatos();
