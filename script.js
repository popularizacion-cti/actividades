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
            region: String(r.c[9]?.v || "").toUpperCase().trim(),
            institucion: r.c[10]?.v || "",
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
    } catch (e) { console.error("Error:", e); }
}

function inicializarMapa() {
    if (map) map.remove();
    map = L.map('map', {
        zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1, minZoom: 5.5, maxZoom: 5.5, tap: true
    }).setView([-9.19, -75.015], 5.5);

    const currentTheme = document.documentElement.getAttribute('data-theme');
    tileLayer = L.tileLayer(currentTheme === 'dark' ? TILE_DARK : TILE_LIGHT).addTo(map);

    fetch('peru-regiones.geojson').then(res => res.json()).then(data => {
        geoLayer = L.geoJSON(data, {
            style: estiloMapaDinamico,
            onEachFeature: (f, l) => {
                l.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    const reg = f.properties.NOMBDEP.toUpperCase();
                    const dataReg = obtenerDatosFiltrados().filter(ev => ev.region === reg);
                    const nAct = dataReg.length;
                    const nEst = dataReg.reduce((a,b)=>a+b.estudiantes, 0);
                    const nDoc = dataReg.reduce((a,b)=>a+b.docentes, 0);
                    const nInv = dataReg.reduce((a,b)=>a+b.investigadores, 0);
                    const nAsist = dataReg.reduce((a,b)=>a+b.asistentes, 0);
                    l.bindPopup(`<div class="custom-popup"><h3>${reg}</h3><hr><b>Actividades:</b> ${nAct}<br><b>Participantes:</b> ${(nEst+nDoc+nInv).toLocaleString()}<br><small>• Estudiantes: ${nEst.toLocaleString()}</small><br><small>• Docentes: ${nDoc.toLocaleString()}</small><br><small>• Investigadores: ${nInv.toLocaleString()}</small><br><b>Asistentes:</b> ${nAsist.toLocaleString()}</div>`).openPopup();
                });
            }
        }).addTo(map);
    });
}

function actualizarVisualizacion() {
    const filtrados = obtenerDatosFiltrados();
    if (geoLayer) geoLayer.setStyle(estiloMapaDinamico);

    const anios = filtrados.map(e => parseInt(e.anio)).filter(n => !isNaN(n));
    document.getElementById("kpiAnios").innerHTML = `<span>Periodo</span><strong>${anios.length ? Math.min(...anios) + ' - ' + Math.max(...anios) : '-'}</strong>`;
    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${new Set(filtrados.map(e=>e.region)).size} Regiones</strong>`;

    const tipos = filtrados.reduce((acc, e) => { acc[e.tipo] = (acc[e.tipo] || 0) + 1; return acc; }, {});
    const sorted = Object.entries(tipos).sort((a,b)=>b[1]-a[1]);
    const top3 = sorted.slice(0,3);
    const otros = sorted.slice(3).reduce((s,c)=>s+c[1],0);
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong><small>${top3.map(t=>`${t[1]} ${t[0].substring(0,8)}`).join(' | ')}${otros>0?' | Otros':''}</small>`;

    const est = filtrados.reduce((a,b)=>a+b.estudiantes,0), doc = filtrados.reduce((a,b)=>a+b.docentes,0), inv = filtrados.reduce((a,b)=>a+b.investigadores,0);
    document.getElementById("kpiParticipantes").innerHTML = `<span>Participantes</span><strong>${(est+doc+inv).toLocaleString()}</strong><small>${est>0?est+' Alum.':''} ${doc>0?'| '+doc+' Doc.':''} ${inv>0?'| '+inv+' Inv.':''}</small>`;

    const pres = filtrados.reduce((a,b)=>a+b.presenciales,0), virt = filtrados.reduce((a,b)=>a+b.virtuales,0);
    document.getElementById("kpiAsistentes").innerHTML = `<span>Asistentes</span><strong>${(pres+virt).toLocaleString()}</strong><small>${pres>0?pres+' Pres.':''} ${virt>0?'| '+virt+' Virt.':''}</small>`;

    document.getElementById("listaEventos").innerHTML = filtrados.map(e => {
        let p = []; if(e.estudiantes>0) p.push(e.estudiantes+' est.'); if(e.docentes>0) p.push(e.docentes+' doc.'); if(e.investigadores>0) p.push(e.investigadores+' inv.');
        let a = []; if(e.presenciales>0) a.push(e.presenciales+' pres.'); if(e.virtuales>0) a.push(e.virtuales+' virt.');
        return `<div class="evento-item"><h4>${e.nombre} (${e.mes} ${e.anio})</h4><p><strong>Org:</strong> ${e.institucion}</p><p class="detalles-lista">${p.length?'Part: '+p.join(', '):''} ${a.length?'Asist: '+a.join(', '):''}</p></div>`;
    }).join('');
    actualizarGraficas(filtrados);
}

function configurarEventos() {
    document.getElementById("themeToggle").addEventListener("click", () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(next === 'dark' ? TILE_DARK : TILE_LIGHT).addTo(map);
    });

    document.querySelectorAll(".filter-panel select, #buscadorTexto").forEach(el => el.addEventListener("input", () => {
        if(el.tagName === 'SELECT') actualizarFiltrosCascada();
        actualizarVisualizacion();
    }));
    document.getElementById("selectorMetricaMapa").addEventListener("change", (e) => { metricaActual = e.target.value; actualizarVisualizacion(); });
    document.getElementById("btnLimpiar").addEventListener("click", () => {
        document.querySelectorAll(".filter-panel select, #buscadorTexto").forEach(el => el.value = "");
        actualizarFiltrosCascada(); actualizarVisualizacion();
    });
}

function estiloMapaDinamico(feature) {
    const region = feature.properties.NOMBDEP.toUpperCase();
    const filtrados = obtenerDatosFiltrados();
    const valReg = filtrados.filter(e => e.region === region).reduce((acc, curr) => acc + (metricaActual==='actividades'?1:(metricaActual==='participantes'?curr.estudiantes+curr.docentes+curr.investigadores:curr[metricaActual]||0)), 0);
    const resumen = {};
    filtrados.forEach(e => { const v = (metricaActual==='actividades'?1:(metricaActual==='participantes'?e.estudiantes+e.docentes+e.investigadores:e[metricaActual]||0)); resumen[e.region] = (resumen[e.region]||0)+v; });
    const maxVal = Math.max(...Object.values(resumen), 1);
    return { fillColor: valReg > 0 ? '#00A3E0' : 'transparent', fillOpacity: valReg > 0 ? (valReg/maxVal * 0.75 + 0.15) : 0, weight: 1, color: '#fff' };
}

function obtenerDatosFiltrados() {
    const v = (id) => document.getElementById(id).value;
    const busq = document.getElementById("buscadorTexto").value.toLowerCase();
    return eventosGlobal.filter(e => {
        const coinc = !busq || e.nombre.toLowerCase().includes(busq) || e.programa.toLowerCase().includes(busq) || e.region.toLowerCase().includes(busq);
        return coinc && (!v("filtroObjetivo") || e.objetivo === v("filtroObjetivo")) && (!v("filtroPrograma") || e.programa === v("filtroPrograma")) && (!v("filtroProyecto") || e.proyecto === v("filtroProyecto")) && (!v("filtroActividad") || e.nombre === v("filtroActividad")) && (!v("filtroAnio") || e.anio === v("filtroAnio")) && (!v("filtroRegion") || e.region === v("filtroRegion")) && (!v("filtroInstitucion") || e.institucion === v("filtroInstitucion")) && (!v("filtroAlcance") || e.alcance === v("filtroAlcance"));
    });
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

function actualizarGraficas(datos) {
    if(graficoRegion) graficoRegion.destroy(); if(graficoAnio) graficoAnio.destroy();
    const rReg = {}, rAnio = {};
    datos.forEach(e => { const v = (metricaActual==='actividades'?1:(metricaActual==='participantes'?e.estudiantes+e.docentes+e.investigadores:e[metricaActual]||0)); rReg[e.region] = (rReg[e.region] || 0) + v; rAnio[e.anio] = (rAnio[e.anio] || 0) + v; });
    const config = (ctx, labels, data, type) => new Chart(ctx, { type, data: { labels, datasets: [{ data, backgroundColor: '#00A3E0', borderColor: '#00A3E0', fill: type==='line' }] }, options: { indexAxis: type==='bar'?'y':'x', responsive: true, maintainAspectRatio: false, plugins: { legend: false } } });
    const regs = Object.keys(rReg).sort((a,b)=>rReg[b]-rReg[a]).slice(0, 10);
    graficoRegion = config(document.getElementById("graficoRegiones"), regs, regs.map(r=>rReg[r]), 'bar');
    const anios = Object.keys(rAnio).sort(); graficoAnio = config(document.getElementById("graficoAnio"), anios, anios.map(a=>rAnio[a]), 'line');
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
cargarDatos();
