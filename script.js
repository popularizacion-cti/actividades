const SHEET_ID = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

let eventosGlobal = [];
let map, geoLayer;
let grafico1, grafico2, grafico3;

// Métricas para el mapa
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
            anio: String(r.c[7]?.v || ""),
            localidad: r.c[8]?.v || "",
            region: String(r.c[9]?.v || "").toUpperCase().trim(),
            institucion: r.c[10]?.v || "",
            alcance: r.c[12]?.v || "",
            investigadores: (Number(r.c[13]?.v) || 0) + (Number(r.c[14]?.v) || 0),
            docentes: Number(r.c[15]?.v) || 0,
            estudiantes: (Number(r.c[16]?.v) || 0) + (Number(r.c[17]?.v) || 0),
            asistentes: (Number(r.c[18]?.v) || 0) + (Number(r.c[19]?.v) || 0),
            cantActividades: Number(r.c[20]?.v) || 1
        }));

        inicializarMapa();
        configurarEventosSelectors();
        actualizarVisualizacion();
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

function inicializarMapa() {
    map = L.map('map', {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 7,
        maxBounds: [[-20, -85], [1, -65]]
    }).setView([-9.19, -75.015], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('peru-regiones.geojson')
        .then(res => res.json())
        .then(data => {
            geoLayer = L.geoJSON(data, {
                style: estiloRegion,
                onEachFeature: onEachRegion
            }).addTo(map);
        });
}

// FILTRADO DINÁMICO EN CASCADA
function obtenerDatosFiltrados() {
    const filtros = {
        objetivo: document.getElementById("filtroObjetivo").value,
        programa: document.getElementById("filtroPrograma").value,
        proyecto: document.getElementById("filtroProyecto").value,
        nombre: document.getElementById("filtroActividad").value,
        anio: document.getElementById("filtroAnio").value,
        region: document.getElementById("filtroRegion").value,
        institucion: document.getElementById("filtroInstitucion").value,
        alcance: document.getElementById("filtroAlcance").value
    };

    return eventosGlobal.filter(e => {
        return (!filtros.objetivo || e.objetivo === filtros.objetivo) &&
               (!filtros.programa || e.programa === filtros.programa) &&
               (!filtros.proyecto || e.proyecto === filtros.proyecto) &&
               (!filtros.nombre || e.nombre === filtros.nombre) &&
               (!filtros.anio || e.anio === filtros.anio) &&
               (!filtros.region || e.region === filtros.region) &&
               (!filtros.institucion || e.institucion === filtros.institucion) &&
               (!filtros.alcance || e.alcance === filtros.alcance);
    });
}

function actualizarFiltrosCascada() {
    // Esta función actualiza las opciones de los selects basándose en lo que ya está filtrado
    const filtrados = obtenerDatosFiltrados();
    
    const actualizarSelect = (id, campo) => {
        const select = document.getElementById(id);
        const valorPrevio = select.value;
        const unicos = [...new Set(filtrados.map(e => e[campo]))].filter(Boolean).sort();
        
        select.innerHTML = '<option value="">Todos</option>';
        unicos.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            if(v === valorPrevio) opt.selected = true;
            select.appendChild(opt);
        });
    };

    // Solo actualizamos los que no tienen selección activa o están "debajo" en la jerarquía
    // Para simplificar, llenamos todos con lo disponible según el set actual
    const ids = [
        ["filtroObjetivo", "objetivo"], ["filtroPrograma", "programa"],
        ["filtroProyecto", "proyecto"], ["filtroActividad", "nombre"],
        ["filtroAnio", "anio"], ["filtroRegion", "region"],
        ["filtroInstitucion", "institucion"], ["filtroAlcance", "alcance"]
    ];

    ids.forEach(item => {
        const el = document.getElementById(item[0]);
        if (!el.value) { // Si el usuario no ha seleccionado nada en este filtro, lo acotamos
             actualizarSelect(item[0], item[1]);
        }
    });
}

function configurarEventosSelectors() {
    // Llenado inicial
    actualizarFiltrosCascada();

    document.querySelectorAll(".filter-panel select").forEach(s => {
        s.addEventListener("change", () => {
            actualizarFiltrosCascada();
            actualizarVisualizacion();
        });
    });

    document.getElementById("selectorMetricaMapa").addEventListener("change", (e) => {
        metricaActual = e.target.value;
        geoLayer.setStyle(estiloRegion);
    });
}

// ESTILO DINÁMICO DEL MAPA SEGÚN MÉTRICA
function estiloRegion(feature) {
    const regionNombre = feature.properties.NOMBDEP.toUpperCase();
    const filtrados = obtenerDatosFiltrados();
    const dataRegion = filtrados.filter(e => e.region === regionNombre);

    let valor = 0;
    switch(metricaActual) {
        case 'actividades': valor = dataRegion.length; break;
        case 'participantes': valor = dataRegion.reduce((a,b) => a + (b.investigadores + b.docentes + b.estudiantes), 0); break;
        case 'asistentes': valor = dataRegion.reduce((a,b) => a + b.asistentes, 0); break;
        case 'estudiantes': valor = dataRegion.reduce((a,b) => a + b.estudiantes, 0); break;
        case 'docentes': valor = dataRegion.reduce((a,b) => a + b.docentes, 0); break;
        case 'investigadores': valor = dataRegion.reduce((a,b) => a + b.investigadores, 0); break;
    }

    // Calcular máximo para la intensidad
    const totalesPorRegion = {};
    filtrados.forEach(e => {
        let v = 0;
        if(metricaActual === 'actividades') v = 1;
        else if(metricaActual === 'participantes') v = e.investigadores + e.docentes + e.estudiantes;
        else v = e[metricaActual] || 0;
        totalesPorRegion[e.region] = (totalesPorRegion[e.region] || 0) + v;
    });
    
    const maxGlobal = Math.max(...Object.values(totalesPorRegion), 1);
    const intensidad = valor > 0 ? (valor / maxGlobal) : 0;

    return {
        fillColor: valor > 0 ? '#00A3E0' : 'transparent',
        fillOpacity: intensidad * 0.9,
        weight: 1,
        color: '#fff'
    };
}

function onEachRegion(feature, layer) {
    layer.on("click", () => {
        const regionNombre = feature.properties.NOMBDEP.toUpperCase();
        const data = obtenerDatosFiltrados().filter(e => e.region === regionNombre);
        
        const sum = (p) => data.reduce((a,b) => a + (b[p] || 0), 0);
        
        layer.bindPopup(`
            <div class="popup-custom">
                <h3>${regionNombre}</h3>
                <p><strong>Actividades:</strong> ${data.length}</p>
                <p><strong>Estudiantes:</strong> ${sum('estudiantes')}</p>
                <p><strong>Docentes:</strong> ${sum('docentes')}</p>
                <p><strong>Público Asistente:</strong> ${sum('asistentes')}</p>
            </div>
        `).openPopup();
    });
}

// ACTUALIZACIÓN DE COMPONENTES
function actualizarVisualizacion() {
    if (geoLayer) geoLayer.setStyle(estiloRegion);
    
    const filtrados = obtenerDatosFiltrados();
    
    // KPIs
    const regUnicas = new Set(filtrados.map(e => e.region)).size;
    const totalPart = filtrados.reduce((a,b) => a + b.investigadores + b.docentes + b.estudiantes, 0);
    const totalAsist = filtrados.reduce((a,b) => a + b.asistentes, 0);

    document.getElementById("kpiCobertura").innerHTML = `<span>Cobertura</span><strong>${regUnicas} Regiones</strong>`;
    document.getElementById("kpiTotal").innerHTML = `<span>Actividades</span><strong>${filtrados.length}</strong>`;
    document.getElementById("kpiParticipantes").innerHTML = `<span>Participantes</span><strong>${totalPart.toLocaleString()}</strong>`;
    document.getElementById("kpiAsistentes").innerHTML = `<span>Asistentes</span><strong>${totalAsist.toLocaleString()}</strong>`;

    // Lista
    const lista = document.getElementById("listaEventos");
    lista.innerHTML = filtrados.map(e => `
        <div class="evento-item">
            <h4>${e.nombre}</h4>
            <p>📍 ${e.region} | 📅 ${e.mes} ${e.anio}</p>
            <small>${e.institucion}</small>
        </div>
    `).join('');

    actualizarGraficos(filtrados);
}

function actualizarGraficos(datos) {
    const ctx1 = document.getElementById("graficoEncuentros");
    const ctx2 = document.getElementById("graficoAsistentes");
    const ctx3 = document.getElementById("graficoRegiones");

    // Lógica de agregación para gráficos...
    // (Similar a tu versión pero con datos.reduce para mayor limpieza)
    if(grafico1) grafico1.destroy();
    if(grafico2) grafico2.destroy();
    if(grafico3) grafico3.destroy();

    const configBase = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    // Ejemplo Gráfico Regiones
    const regData = {};
    datos.forEach(e => regData[e.region] = (regData[e.region] || 0) + 1);
    
    grafico3 = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: Object.keys(regData),
            datasets: [{ label: 'Actividades', data: Object.values(regData), backgroundColor: '#00A3E0' }]
        },
        options: configBase
    });
}

cargarDatos();
