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
    map = L.map('map', {
        zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1,
        minZoom: 5.5, maxZoom: 5.5, tap: true, interactive: true
    }).setView([-9.19, -75.015], 5.5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

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
                        const nEst = dataReg.reduce((a,b)=>a+(b.estudiantes||0), 0);
                        const nDoc = dataReg.reduce((a,b)=>a+(b.docentes||0), 0);
                        const nInv = dataReg.reduce((a,b)=>a+(b.investigadores||0), 0);
                        const nAsist = dataReg.reduce((a,b)=>a+(b.asistentes||0), 0);

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

function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    if (geoLayer) geoLayer.setStyle(estiloMapaDinamico);

    // KPI Años
    const listaAnios = filtrados.map(e => parseInt(e.anio)).filter(n => !isNaN(n));
    const minAnio = Math.min(...listaAnios);
    const maxAnio = Math.max(...listaAnios);
    document.getElementById("kpiAnios").innerHTML = `<span>Periodo</span><strong>${minAnio === Infinity ? '-' : minAnio + ' - ' + maxAnio}</strong>`;
    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${new Set(filtrados.map(e=>e.region)).size} Regiones</strong>`;

    // KPI Actividades con Top 3
    const conteoTipos = filtrados.reduce((acc, e) => { acc[e.tipo] = (acc[e.tipo] || 0) + 1; return acc; }, {});
    const tiposSorted = Object.entries(conteoTipos).sort((a,b) => b[1]-a[1]);
    const top3 = tiposSorted.slice(0, 3);
    const otrosSum = tiposSorted.slice(3).reduce((s, c) => s + c[1], 0);
    let htmlAct = `<span>Actividades</span><strong>${filtrados.length}</strong>`;
    let detailAct = top3.map(t => `${t[1]} ${t[0].substring(0,10)}...`);
    if(otrosSum > 0) detailAct.push(`${otrosSum} Otros`);
    htmlAct += `<small>${detailAct.join(' | ')}</small>`;
    document.getElementById("kpiTotal").innerHTML = htmlAct;

    // KPI Participantes
    const estTotal = filtrados.reduce((a,b)=>a+b.estudiantes, 0);
    const docTotal = filtrados.reduce((a,b)=>a+b.docentes, 0);
    const invTotal = filtrados.reduce((a,b)=>a+b.investigadores, 0);
    let htmlPart = `<span>Participantes</span><strong>${(estTotal+docTotal+invTotal).toLocaleString()}</strong>`;
    let detailPart = [];
    if(estTotal > 0) detailPart.push(`${estTotal.toLocaleString()} Alum.`);
    if(docTotal > 0) detailPart.push(`${docTotal.toLocaleString()} Doc.`);
    if(invTotal > 0) detailPart.push(`${invTotal.toLocaleString()} Inv.`);
    document.getElementById("kpiParticipantes").innerHTML = htmlPart + `<small>${detailPart.join(' | ')}</small>`;

    // KPI Asistentes
    const pres = filtrados.reduce((a,b)=>a+b.presenciales, 0);
    const virt = filtrados.reduce((a,b)=>a+b.virtuales, 0);
    let htmlAsist = `<span>Asistentes</span><strong>${(pres+virt).toLocaleString()}</strong>`;
    let detailAsist = [];
    if(pres > 0) detailAsist.push(`${pres.toLocaleString()} Pres.`);
    if(virt > 0) detailAsist.push(`${virt.toLocaleString()} Virt.`);
    document.getElementById("kpiAsistentes").innerHTML = htmlAsist + `<small>${detailAsist.join(' | ')}</small>`;

    // Lista de actividades enriquecida
    document.getElementById("listaEventos").innerHTML = filtrados.map(e => {
        let p = [];
        if(e.estudiantes>0) p.push(`${e.estudiantes} estudiantes`);
        if(e.docentes>0) p.push(`${e.docentes} docentes`);
        if(e.investigadores>0) p.push(`${e.investigadores} investigadores`);
        let a = [];
        if(e.presenciales>0) a.push(`${e.presenciales} presencial`);
        if(e.virtuales>0) a.push(`${e.virtuales} virtual`);
        return `
            <div class="evento-item">
                <h4>${e.nombre} (${e.mes} ${e.anio})</h4>
                <p><strong>Organizado por:</strong> ${e.institucion}</p>
                <p class="detalles-lista">
                    ${p.length>0 ? 'Con la participación de '+p.join(', ')+'.' : ''}
                    ${a.length>0 ? ' Asistencia: '+a.join(' y ')+'.' : ''}
                </p>
            </div>`;
    }).join('');

    actualizarGraficas(filtrados);
}

function actualizarGraficas(datos) {
    if(graficoRegion) graficoRegion.destroy();
    if(graficoAnio) graficoAnio.destroy();
    const label = document.getElementById("selectorMetricaMapa").selectedOptions[0].text;
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
        data: { labels: anios, datasets: [{ data: anios.map(a=>rAnio[a]), borderColor: '#00A3E0', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
    });
}

function aplicarTema(tema) {
    if (tema === 'system') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', tema);
    }
}

function configurarEventos() {
    document.querySelectorAll(".filter-panel select").forEach(s => s.addEventListener("change", () => { 
        actualizarFiltrosCascada(); actualizarVisualizacion(); 
    }));
    document.getElementById("buscadorTexto").addEventListener("input", actualizarVisualizacion);
    document.getElementById("selectorMetricaMapa").addEventListener("change", (e) => { 
        metricaActual = e.target.value; actualizarVisualizacion(); 
    });
    document.getElementById("btnLimpiar").addEventListener("click", () => {
        document.querySelectorAll(".filter-panel select").forEach(s => s.value = "");
        document.getElementById("buscadorTexto").value = "";
        actualizarFiltrosCascada(); actualizarVisualizacion();
    });
    document.getElementById("themeSelector").addEventListener("change", (e) => {
        aplicarTema(e.target.value); localStorage.setItem('theme', e.target.value);
    });
    const savedTheme = localStorage.getItem('theme') || 'system';
    document.getElementById("themeSelector").value = savedTheme;
    aplicarTema(savedTheme);
    actualizarFiltrosCascada();
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

cargarDatos();
