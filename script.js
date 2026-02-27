// ==========================
// PEGAR IDS GOOGLE SHEETS
// ==========================
const ID_ACTIVIDADES = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const ID_POBLACION = "1N_xa_CU8bK0nKjnp5hgyZOqHUOUf5hckJyO9nQZ8WXM";
const ID_ESTUDIANTES = "1tod4mESfZJz3s6e0DUwNuUF6bKTsuD-HiQHakwU_Vgs";

const urlActividades = `https://docs.google.com/spreadsheets/d/${ID_ACTIVIDADES}/gviz/tq?tqx=out:json`;
const urlPoblacion = `https://docs.google.com/spreadsheets/d/${ID_POBLACION}/gviz/tq?tqx=out:json`;
const urlEstudiantes = `https://docs.google.com/spreadsheets/d/${ID_ESTUDIANTES}/gviz/tq?tqx=out:json`;

let actividades = [];
let poblacion = {};
let estudiantes = {};
let map, geoLayer;

// ================= LIMPIAR JSON GVIZ =================
async function cargarJSON(url){
  const res = await fetch(url);
  const text = await res.text();

  const json = JSON.parse(
    text.substring(47).slice(0, -2)
  );

  return json.table.rows;
}

// ================= NORMALIZAR TEXTO =================
function normalizar(texto){
  return (texto || "")
    .toString()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ================= PROCESAR ACTIVIDADES =================
async function cargarActividades(){

  const rows = await cargarJSON(urlActividades);

  actividades = rows.map(r => {

    const c = r.c;

    const region = normalizar(c[8]?.v);
    const anio = c[6]?.v?.toString() || "";

    const invH = Number(c[11]?.v || 0);
    const invM = Number(c[12]?.v || 0);
    const docentes = Number(c[13]?.v || 0);
    const estH = Number(c[14]?.v || 0);
    const estM = Number(c[15]?.v || 0);
    const pubPres = Number(c[16]?.v || 0);
    const pubVirt = Number(c[17]?.v || 0);

    const impactado = invH + invM + docentes + estH + estM + pubPres;
    const alcanzado = impactado + pubVirt;

    return {
      region,
      anio,
      impactado,
      alcanzado,
      investigadores: invH + invM,
      docentes,
      estudiantes: estH + estM
    };
  });
}

// ================= PROCESAR POBLACION =================
async function cargarPoblacion(){

  const rows = await cargarJSON(urlPoblacion);

  rows.forEach(r => {
    const c = r.c;
    const region = normalizar(c[0]?.v);
    poblacion[region] = {
      "2022": Number(c[1]?.v || 0),
      "2023": Number(c[2]?.v || 0),
      "2024": Number(c[3]?.v || 0),
      "2025": Number(c[4]?.v || 0),
      "2026": Number(c[5]?.v || 0)
    };
  });
}

// ================= PROCESAR ESTUDIANTES =================
async function cargarEstudiantes(){

  const rows = await cargarJSON(urlEstudiantes);

  rows.forEach(r => {
    const c = r.c;
    const region = normalizar(c[0]?.v);
    estudiantes[region] = {
      "2022": Number(c[1]?.v || 0),
      "2023": Number(c[2]?.v || 0),
      "2024": Number(c[3]?.v || 0),
      "2025": Number(c[4]?.v || 0),
      "2026": Number(c[5]?.v || 0)
    };
  });
}

// ================= FILTROS =================
function aplicarFiltros(){
  const anio = document.getElementById("filtroAnio").value;
  const region = document.getElementById("filtroRegion").value;

  return actividades.filter(a =>
    (!anio || a.anio === anio) &&
    (!region || a.region === region)
  );
}

// ================= CALCULAR INDICADOR =================
function calcularIndicador(region){

  const anio = document.getElementById("filtroAnio").value;
  const modo = document.getElementById("selectorIndicador").value;

  const data = aplicarFiltros().filter(a => a.region === region);

  if(modo === "actividades")
    return data.length;

  if(modo === "impactado")
    return data.reduce((s,a)=>s+a.impactado,0);

  if(modo === "alcanzado")
    return data.reduce((s,a)=>s+a.alcanzado,0);

  if(modo === "percapita"){
    const total = data.reduce((s,a)=>s+a.impactado,0);
    const pob = poblacion[region]?.[anio] || 1;
    return total / pob;
  }

  if(modo === "estudiantes"){
    const total = data.reduce((s,a)=>s+a.estudiantes,0);
    const est = estudiantes[region]?.[anio] || 1;
    return total / est;
  }

  return 0;
}

// ================= ESCALA DINÁMICA =================
function escalaColor(valor){

  const regiones = Object.keys(poblacion);
  const valores = regiones.map(r => calcularIndicador(r));
  const max = Math.max(...valores);

  if(valor === 0) return "transparent";

  const ratio = valor / max;

  if(ratio > 0.8) return "#800026";
  if(ratio > 0.6) return "#BD0026";
  if(ratio > 0.4) return "#E31A1C";
  if(ratio > 0.2) return "#FC4E2A";
  return "#FD8D3C";
}

// ================= MAPA =================
function inicializarMapa(){

  map = L.map('map').setView([-9,-75],6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    .addTo(map);

  fetch('data/peru-regiones.geojson')
  .then(r=>r.json())
  .then(data=>{
    geoLayer = L.geoJSON(data,{
      style: f => ({
        fillColor: escalaColor(
          calcularIndicador(normalizar(f.properties.NOMBDEP))
        ),
        weight:1,
        color:"#555",
        fillOpacity:0.7
      })
    }).addTo(map);
  });

  window.addEventListener("resize", ()=> map.invalidateSize());
}

// ================= INICIO =================
async function iniciar(){

  await cargarActividades();
  await cargarPoblacion();
  await cargarEstudiantes();

  inicializarMapa();
}

iniciar();
