// ==========================
// PEGAR IDs DE GOOGLE SHEETS
// ==========================
const ID_ACTIVIDADES = "1e9ogOXCAVOoZAM8T9lITUD0K0o1KpnwK-6ZarZmVjSM";
const ID_POBLACION = "1N_xa_CU8bK0nKjnp5hgyZOqHUOUf5hckJyO9nQZ8WXM";
const ID_ESTUDIANTES = "1tod4mESfZJz3s6e0DUwNuUF6bKTsuD-HiQHakwU_Vgs";

const urlActividades = `https://docs.google.com/spreadsheets/d/e/${ID_ACTIVIDADES}/pub?output=csv`;
const urlPoblacion = `https://docs.google.com/spreadsheets/d/e/${ID_POBLACION}/pub?output=csv`;
const urlEstudiantes = `https://docs.google.com/spreadsheets/d/e/${ID_ESTUDIANTES}/pub?output=csv`;

let actividades=[];
let poblacion={};
let estudiantes={};
let map,geoLayer;

// ================= CARGA CSV =================
async function cargarCSV(url){
const res=await fetch(url);
const text=await res.text();
const rows=text.trim().split("\n").map(r=>r.split(","));
const headers=rows.shift();
return rows.map(r=>{
let obj={};
headers.forEach((h,i)=>obj[h.trim()]=r[i]);
return obj;
});
}

// ================= PROCESAR ACTIVIDADES =================
function procesarActividades(data){
actividades=data.map(d=>{

let investigadores=Number(d["investigadores participantes"]||0);
let investigadoras=Number(d["investigadoras participantes"]||0);
let docentes=Number(d["docentes participantes"]||0);
let estH=Number(d["estudiantes hombres participantes"]||0);
let estM=Number(d["estudiantes mujeres participantes"]||0);
let publicoPres=Number(d["público presencial"]||0);
let publicoVirtual=Number(d["público virtual"]||0);

let publicoImpactado=
investigadores+investigadoras+
docentes+
estH+estM+
publicoPres;

let publicoAlcanzado=
publicoImpactado+publicoVirtual;

return{
region:d["Región"],
anio:d["Año"],
impactado:publicoImpactado,
alcanzado:publicoAlcanzado,
investigadores:investigadores+investigadoras,
docentes:docentes,
estudiantes:estH+estM
};

});
}

// ================= PROCESAR POBLACION =================
function procesarPoblacion(data){
data.forEach(d=>poblacion[d.Region]=d);
}

// ================= PROCESAR ESTUDIANTES =================
function procesarEstudiantes(data){
data.forEach(d=>estudiantes[d.Region]=d);
}

// ================= FILTROS =================
function aplicarFiltros(){
let anio=document.getElementById("filtroAnio").value;
let region=document.getElementById("filtroRegion").value;
return actividades.filter(a=>
(!anio||a.anio===anio)&&
(!region||a.region===region)
);
}

// ================= INDICADOR MAPA =================
function calcularIndicador(region){

let anio=document.getElementById("filtroAnio").value;
let data=aplicarFiltros().filter(a=>a.region===region);
let modo=document.getElementById("selectorIndicador").value;

if(modo==="actividades") return data.length;
if(modo==="impactado") return data.reduce((s,a)=>s+a.impactado,0);
if(modo==="alcanzado") return data.reduce((s,a)=>s+a.alcanzado,0);

if(modo==="percapita"){
let total=data.reduce((s,a)=>s+a.impactado,0);
let pob=poblacion[region]?.[anio]||1;
return total/pob;
}

if(modo==="estudiantes"){
let total=data.reduce((s,a)=>s+a.estudiantes,0);
let est=estudiantes[region]?.[anio]||1;
return total/est;
}

return 0;
}

// ================= MAPA =================
function inicializarMapa(){
map=L.map('map').setView([-9,-75],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

fetch('data/peru-regiones.geojson')
.then(r=>r.json())
.then(data=>{
geoLayer=L.geoJSON(data,{
style:f=>({
fillColor:escalaColor(calcularIndicador(f.properties.NOMBDEP)),
weight:1,
color:"#555",
fillOpacity:0.7
})
}).addTo(map);
});
}

function escalaColor(v){
if(v===0)return"transparent";
if(v>0.05)return"#800026";
if(v>0.02)return"#BD0026";
if(v>0.01)return"#E31A1C";
if(v>0.005)return"#FC4E2A";
return"#FD8D3C";
}

// ================= INICIO =================
async function iniciar(){
let act=await cargarCSV(urlActividades);
let pob=await cargarCSV(urlPoblacion);
let est=await cargarCSV(urlEstudiantes);

procesarActividades(act);
procesarPoblacion(pob);
procesarEstudiantes(est);

inicializarMapa();
}

iniciar();
