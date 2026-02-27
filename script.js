// ==========================
// PEGAR IDS GOOGLE SHEETS
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

// ================= UTIL =================
function normalizarTexto(texto){
return texto.toUpperCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.trim();
}

// ================= CARGAR CSV ROBUSTO =================
async function cargarCSV(url){
const res=await fetch(url);
const text=await res.text();
const rows=text.trim().split("\n");
const headers=rows[0].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
.map(h=>h.replace(/"/g,"").trim());

return rows.slice(1).map(row=>{
const values=row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
let obj={};
headers.forEach((h,i)=>{
let v=values?values[i]:"";
if(v) v=v.replace(/"/g,"").trim();
obj[h]=v;
});
return obj;
});
}

// ================= PROCESAR ACTIVIDADES =================
function procesarActividades(data){
actividades=data.map(d=>{

let invH=Number(d["investigadores participantes"]||0);
let invM=Number(d["investigadoras participantes"]||0);
let docentes=Number(d["docentes participantes"]||0);
let estH=Number(d["estudiantes hombres participantes"]||0);
let estM=Number(d["estudiantes mujeres participantes"]||0);
let pubPres=Number(d["público presencial"]||0);
let pubVirt=Number(d["público virtual"]||0);

let impactado=invH+invM+docentes+estH+estM+pubPres;
let alcanzado=impactado+pubVirt;

return{
region:normalizarTexto(d["Región"]),
anio:d["Año"],
impactado,
alcanzado,
investigadores:invH+invM,
docentes,
estudiantes:estH+estM
};
});
}

// ================= PROCESAR POBLACION =================
function procesarPoblacion(data){
data.forEach(d=>{
poblacion[normalizarTexto(d.Region)]=d;
});
}

// ================= PROCESAR ESTUDIANTES =================
function procesarEstudiantes(data){
data.forEach(d=>{
estudiantes[normalizarTexto(d.Region)]=d;
});
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
let pob=Number(poblacion[region]?.[anio]||1);
return total/pob;
}

if(modo==="estudiantes"){
let total=data.reduce((s,a)=>s+a.estudiantes,0);
let est=Number(estudiantes[region]?.[anio]||1);
return total/est;
}

return 0;
}

// ================= ESCALA DINAMICA =================
function escalaColor(valor){
let regiones=Object.keys(poblacion);
let max=Math.max(...regiones.map(r=>calcularIndicador(r)));
if(valor===0)return"transparent";
let intensidad=valor/max;
if(intensidad>0.8)return"#800026";
if(intensidad>0.6)return"#BD0026";
if(intensidad>0.4)return"#E31A1C";
if(intensidad>0.2)return"#FC4E2A";
return"#FD8D3C";
}

// ================= MAPA =================
function inicializarMapa(){
map=L.map('map').setView([-9,-75],6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

fetch('data/peru-regiones.geojson')
.then(r=>r.json())
.then(data=>{
geoLayer=L.geoJSON(data,{
style:f=>({
fillColor:escalaColor(calcularIndicador(normalizarTexto(f.properties.NOMBDEP))),
weight:1,
color:"#555",
fillOpacity:0.7
})
}).addTo(map);
});

window.addEventListener("resize",()=>map.invalidateSize());
}

// ================= TABS =================
function mostrarTab(id){
document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
document.getElementById(id).classList.add('active');
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
