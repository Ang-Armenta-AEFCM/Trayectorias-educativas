/* Trayectorias educativas de secundaria · ArcGIS Maps SDK 4.31 */
'use strict';
const $ = id => document.getElementById(id);
const fmt = n => n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('es-MX');
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const METRICS = {total:'Total combinado', no_promovidos:'No promovidos', abandono:'Abandono', no_certificado:'No certificados'};
const DATA = {'2025-2026':'data/trayectorias_2025_2026.json','2026-2027':'data/trayectorias_2026_2027.json'};
const CDMX = {xmin:-99.38,ymin:19.03,xmax:-98.91,ymax:19.61,spatialReference:{wkid:4326}};
const palette = ['#e6d194','#a57f2c','#1e5b4f','#9b2247','#611232'];
const state = {compare:false,selected:null,data:{},views:{},points:{},heat:{},highlights:{},rows:{A:[],B:[]},toggles:{A:{points:true,clusters:true,heat:false},B:{points:true,clusters:true,heat:false}},mapReady:{A:false,B:false},compareOpen:false};

function numeric(v){return v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null)}
function school(row,cycle,index){
  const cct=normalize(row.cct??row.CCT);
  if(!cct)return null;
  const read=k=>numeric(row[k]);
  const noProm=read('no_promovidos_total'), abandon=read('abandono_total'), noCert=read('no_certificado_3');
  return {oid:index+1,cycle,cct,nombre:String(row.nombre??'Escuela'),alcaldia:normalize(row.alcaldia),sostenimiento:String(row.sostenimiento??'').trim(),turno:String(row.turno??''),domicilio:String(row.domicilio??''),matricula:read('matricula'),lat:numeric(row.latitud??row.lat),lon:numeric(row.longitud??row.lon),no_promovidos_1:read('no_promovidos_1'),no_promovidos_2:read('no_promovidos_2'),no_promovidos_3:read('no_promovidos_3'),no_promovidos_total:noProm,no_promovidos_otros:read('no_promovidos_otros'),abandono_1:read('abandono_1'),abandono_2:read('abandono_2'),abandono_3:read('abandono_3'),abandono_total:abandon,no_certificado_3:noCert,total_casos:[noProm,abandon,noCert].some(v=>v!==null)?[noProm,abandon,noCert].reduce((s,v)=>s+(v??0),0):null};
}
function value(r,metric,grade){
  if(metric==='total'){
    if(grade==='total')return r.total_casos;
    const parts=[r['no_promovidos_'+grade],r['abandono_'+grade],...(grade==='3'?[r.no_certificado_3]:[])];
    return parts.some(v=>v!==null)?parts.reduce((n,v)=>n+(v??0),0):null;
  }
  if(metric==='no_certificado')return grade==='1'||grade==='2'?null:r.no_certificado_3;
  return r[metric+'_'+(grade==='total'?'total':grade)]??null;
}
function el(side,id){return $(id+(side==='B'?'B':''))}
function control(side){
  return {cycle:el(side,'cycle').value,alcaldia:el(side,'alcaldia').value,sostenimiento:el(side,'sostenimiento').value,metric:el(side,'metric').value,grade:el(side,'grado').value,minimum:Math.max(0,Number(el(side,'minimum').value)||0),search:normalize(el(side,'search').value)};
}
function available(c){return state.data[c.cycle]||[]}
function matches(r,c,withSearch=true){return (!c.alcaldia||r.alcaldia===c.alcaldia)&&(!c.sostenimiento||r.sostenimiento===c.sostenimiento)&&(!withSearch||!c.search||normalize(r.cct+' '+r.nombre).includes(c.search))}
function filtered(side){const c=control(side);return available(c).filter(r=>r.lat!==null&&r.lon!==null&&matches(r,c)&&value(r,c.metric,c.grade)!==null&&value(r,c.metric,c.grade)>=c.minimum)}
function unique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function options(id,values,prefix){const elem=$(id),prev=elem.value;elem.replaceChildren(new Option(prefix,''),...values.map(v=>new Option(v,v)));if(values.includes(prev))elem.value=prev}
function refreshGradeOptions(side){
  const c=control(side),rows=available(c),grade=el(side,'grado'),prev=grade.value;
  const choices=[['total','Todos / total'],['1','1.º'],['2','2.º'],['3','3.º']].filter(([key])=>rows.some(r=>value(r,c.metric,key)!==null));
  grade.replaceChildren(...choices.map(([key,text])=>new Option(text,key)));
  if(choices.some(([key])=>key===prev))grade.value=prev;
}
function populateCycleFilters(side){
  const c=control(side),rows=available(c);
  const metric=el(side,'metric'),prevMetric=metric.value;
  const metricKeys=Object.keys(METRICS).filter(key=>rows.some(r=>value(r,key,'total')!==null));
  metric.replaceChildren(...metricKeys.map(key=>new Option(METRICS[key],key)));
  if(metricKeys.includes(prevMetric))metric.value=prevMetric;
  refreshGradeOptions(side);
  options(side==='B'?'alcaldiaB':'alcaldia',unique(rows,'alcaldia'),'Todas las alcaldías');
  options(side==='B'?'sostenimientoB':'sostenimiento',unique(rows,'sostenimiento').filter(v=>!['SIN DATO','SIN REGISTRO',''].includes(normalize(v))),'Todos');
  options('compareAlcaldia'+side,unique(rows,'alcaldia'),'Todas las alcaldías');
  fillSchoolSelect(side);
  $('filterCaption'+side).textContent=c.cycle;
  $('compareCycle'+side).textContent=c.cycle;
}
function fillSchoolSelect(side){
  const c=control(side),elem=$('compareCct'+side),prev=elem.value,area=$('compareAlcaldia'+side).value;
  const rows=available(c).filter(r=>!area||r.alcaldia===area).sort((a,b)=>a.cct.localeCompare(b.cct));
  elem.replaceChildren(new Option('Selecciona un CCT',''),...rows.map(r=>new Option(r.cct+' · '+r.nombre,r.cct)));
  if(rows.some(r=>r.cct===prev))elem.value=prev;
}
function rowsForDetail(r){
  return [['CCT',r.cct],['Ciclo escolar',r.cycle],['Alcaldía',r.alcaldia],['Sostenimiento',r.sostenimiento],['Turno',r.turno],['Domicilio',r.domicilio],['Matrícula',r.matricula],['No promovidos 1.º',r.no_promovidos_1],['No promovidos 2.º',r.no_promovidos_2],['No promovidos 3.º',r.no_promovidos_3],['No promovidos total',r.no_promovidos_total],['No promovidos en otros grados registrados',r.no_promovidos_otros],['Abandono 1.º',r.abandono_1],['Abandono 2.º',r.abandono_2],['Abandono 3.º',r.abandono_3],['Abandono total',r.abandono_total],['No certificados 3.º',r.no_certificado_3],['Total combinado',r.total_casos]].filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!==''&&!['SIN DATO','SIN REGISTRO'].includes(normalize(v)));
}
function tableFromRows(rows){return '<table class="dataTable"><tbody>'+rows.map(([key,val])=>'<tr><th>'+escapeHTML(key)+'</th><td>'+escapeHTML(typeof val==='number'?fmt(val):val)+'</td></tr>').join('')+'</tbody></table>'}
function renderDetail(r,side='A'){
  state.selected={row:r,side};
  $('detailTitle').textContent=r.nombre;
  $('detailContent').innerHTML='<span class="pill">'+escapeHTML(r.cct+' · '+r.cycle)+'</span>'+tableFromRows(rowsForDetail(r));
  $('compareSelected').disabled=false;
  $('detail').classList.remove('hidden');$('detail').scrollTop=0;
  markSelected(side,r);
}
function renderClusterDetail(rows,side){
  state.selected=null;
  $('detailTitle').textContent=rows.length+' escuelas agrupadas';
  $('detailContent').innerHTML='<p class="muted">Estas escuelas comparten una ubicación o siguen muy próximas. Selecciona el CCT para consultar su ficha.</p><div class="clusterList">'+rows.map(r=>'<button type="button" data-cct="'+escapeHTML(r.cct)+'" data-side="'+escapeHTML(side)+'">'+escapeHTML(r.cct+' · '+r.nombre)+'</button>').join('')+'</div>';
  $('compareSelected').disabled=true;
  $('detail').classList.remove('hidden');$('detail').scrollTop=0;
}
function closeDetail(){state.selected=null;$('detail').classList.add('hidden');$('compareSelected').disabled=true;for(const side of ['A','B'])state.highlights[side]?.removeAll()}
function findSelected(side){const c=control(side);return available(c).find(r=>r.cct===$('compareCct'+side).value)}
function renderComparison(){
  if(!state.compareOpen)return;
  const cell=side=>{
    const r=findSelected(side);
    if(!r)return '<div><p class="muted">Selecciona un CCT para consultar los registros de ese ciclo.</p></div>';
    const selectedValue=value(r,control(side).metric,control(side).grade);
    const extra=selectedValue===null?[]:[[METRICS[control(side).metric]+' · variable seleccionada',selectedValue]];
    const data=rowsForDetail(r).filter(([k])=>!['CCT','Ciclo escolar','Domicilio','Turno'].includes(k));
    return '<div><h3>'+escapeHTML(r.nombre)+'</h3><span class="pill">'+escapeHTML(r.cct+' · '+r.cycle)+'</span><p class="muted">'+escapeHTML([r.alcaldia,r.sostenimiento].filter(Boolean).join(' · '))+'</p>'+tableFromRows([...data,...extra])+'</div>';
  };
  $('compareResult').innerHTML='<div class="compareData">'+cell('A')+cell('B')+'</div>';
}
function setCompareOpen(on){state.compareOpen=on;$('comparePanel').classList.toggle('hidden',!on);$('openComparePanel').classList.toggle('hidden',!state.compare)}
function openCompare(selected=null){
  if(!state.compare)toggleCompare(true);
  setCompareOpen(true);
  if(selected){
    const {row:r,side}=selected;
    if(available(control(side)).some(x=>x.cct===r.cct)){
      $('compareAlcaldia'+side).value=r.alcaldia;fillSchoolSelect(side);$('compareCct'+side).value=r.cct;
    }
    const other=side==='A'?'B':'A';
    if(available(control(other)).some(x=>x.cct===r.cct)){
      const rOther=available(control(other)).find(x=>x.cct===r.cct);
      $('compareAlcaldia'+other).value=rOther.alcaldia;fillSchoolSelect(other);$('compareCct'+other).value=r.cct;
    }
  }
  renderComparison();
  $('comparePanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function toggleCompare(on){
  state.compare=on;
  $('cardB').classList.toggle('hidden',!on);$('mapGrid').classList.toggle('comparing',on);
  $('toggleCompare').textContent=on?'Vista individual':'Comparar mapas';
  $('viewTitle').textContent=on?'Comparación de trayectorias · Mapas independientes':'Mapa de escuelas · CDMX';
  $('openComparePanel').classList.toggle('hidden',!on);
  setCompareOpen(on);
  if(on && !state.views.B && state.MapView)createView('B');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    for(const side of on?['A','B']:['A']){const view=state.views[side];if(view){resetView(side);renderMap(side)}}
  }));
  renderComparison();
}
function resetView(side){const v=state.views[side];if(!v)return;v.goTo(new state.Extent(CDMX).expand(1.04),{animate:false}).catch(()=>{});}
function updateSummary(){
  const c=control('A'),rows=filtered('A'),nums=rows.map(r=>value(r,c.metric,c.grade));
  $('countSchools').textContent=fmt(rows.length);
  $('countCases').textContent=fmt(nums.reduce((sum,n)=>sum+n,0));
  $('countMax').textContent=nums.length?fmt(Math.max(...nums)):'—';
  const missing=available(c).filter(r=>r.lat===null||r.lon===null).length;
  $('sourceNote').textContent=(c.cycle==='2025-2026'?'2025–2026: no promovidos y abandono del visor de Secundarias; no certificados de 3.º del Excel actualizado.':'2026–2027: no promovidos y no certificados de los Excel recibidos.')+(missing?' '+fmt(missing)+' CCT sin coordenadas siguen disponibles en la ficha comparativa.':'');
}
function setToggle(side,type,on){
  state.toggles[side][type]=on;
  const id=type==='points'?'showSchools':type==='clusters'?'showClusters':'showHeat';
  const btn=el(side,id);btn.setAttribute('aria-pressed',String(on));btn.classList.toggle('isActive',on);
  renderMap(side);
}
function geometry(r){return new state.Point({longitude:r.lon,latitude:r.lat,spatialReference:{wkid:4326}})}
function graphicsFor(rows,side){
  const view=state.views[side],toggles=state.toggles[side],output=[];
  if(!view?.ready || !view.width || !view.height)return output;
  const c=control(side),max=Math.max(1,...rows.map(r=>value(r,c.metric,c.grade)||0));
  if(!toggles.clusters){
    if(toggles.points)rows.forEach(r=>output.push(new state.Graphic({geometry:geometry(r),symbol:pointSymbol(r,c,max),attributes:{kind:'school',cct:r.cct}})));
    return output;
  }
  const radius=54,groups=[],buckets=new Map();
  // Agrupación espacial en píxeles: se recalcula después de cada cambio de escala.
  // Evita que los clústeres se queden fijos en posiciones geográficas al acercarse.
  for(const r of rows){
    const point=state.webMercatorUtils.geographicToWebMercator(geometry(r));
    const screen=view.toScreen(point);
    if(!screen||!Number.isFinite(screen.x)||!Number.isFinite(screen.y))continue;
    const x=screen.x,y=screen.y,cellX=Math.floor(x/radius),cellY=Math.floor(y/radius);
    let best=null,bestDistance=radius*radius;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      for(const group of buckets.get((cellX+dx)+','+(cellY+dy))||[]){
        const distance=(group.x-x)**2+(group.y-y)**2;
        if(distance<bestDistance){best=group;bestDistance=distance}
      }
    }
    if(!best){best={x,y,anchorX:cellX,anchorY:cellY,rows:[]};groups.push(best);const key=cellX+','+cellY;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(best)}
    best.rows.push(r);
    // Mantener el ancla estable evita desajustes al reasignar los grupos.
  }
  for(const group of groups){
    if(group.rows.length===1){
      if(toggles.points){const r=group.rows[0];output.push(new state.Graphic({geometry:geometry(r),symbol:pointSymbol(r,c,max),attributes:{kind:'school',cct:r.cct}}))}
      continue;
    }
    const meanLon=group.rows.reduce((s,r)=>s+r.lon,0)/group.rows.length;
    const meanLat=group.rows.reduce((s,r)=>s+r.lat,0)/group.rows.length;
    const geo={type:'point',longitude:meanLon,latitude:meanLat,spatialReference:{wkid:4326}};
    const diameter=Math.min(46,Math.max(26,25+Math.sqrt(group.rows.length)*3));
    const ids=group.rows.map(r=>r.cct).join('|');
    const attributes={kind:'cluster',ids,count:group.rows.length};
    output.push(new state.Graphic({geometry:geo,attributes,symbol:{type:'simple-marker',style:'circle',size:diameter,color:'#611232',outline:{color:'#fff',width:1.5}}}));
    output.push(new state.Graphic({geometry:geo,attributes,symbol:{type:'text',text:String(group.rows.length),color:'#fff',font:{family:'Noto Sans',size:11,weight:'bold'},horizontalAlignment:'center',verticalAlignment:'middle',haloColor:'#611232',haloSize:0.5}}));
  }
  return output;
}
function pointSymbol(r,c,max){const n=value(r,c.metric,c.grade)||0;return {type:'simple-marker',style:'circle',size:9,color:palette[max===0?0:Math.min(4,Math.floor(n/max*5))],outline:{color:'#fff',width:1}}}
function makeHeatLayer(rows,side){
  const c=control(side),active=rows.filter(r=>(value(r,c.metric,c.grade)??0)>0);
  if(!active.length)return null;
  const nums=active.map(r=>value(r,c.metric,c.grade)).sort((a,b)=>a-b);
  const p95=nums[Math.min(nums.length-1,Math.floor(nums.length*0.95))];
  const source=active.map((r,i)=>new state.Graphic({geometry:geometry(r),attributes:{ObjectID:i+1,valor:Math.max(0,value(r,c.metric,c.grade))}}));
  return new state.FeatureLayer({title:'Zonas de calor · '+c.cycle,source,objectIdField:'ObjectID',geometryType:'point',spatialReference:{wkid:4326},fields:[{name:'ObjectID',type:'oid'},{name:'valor',type:'double'}],renderer:{type:'heatmap',field:'valor',radius:26,minDensity:0,maxDensity:Math.max(8,p95*2),colorStops:[{ratio:0,color:'rgba(255,255,255,0)'},{ratio:0.15,color:'rgba(230,209,148,0.22)'},{ratio:0.35,color:'rgba(166,128,45,0.52)'},{ratio:0.60,color:'rgba(155,34,71,0.75)'},{ratio:1,color:'rgba(97,18,50,0.92)'}]},popupEnabled:false,visible:true});
}
function renderMap(side){
  const c=control(side),rows=filtered(side);state.rows[side]=rows;
  $('caption'+side).textContent=c.cycle+' · '+METRICS[c.metric]+(c.grade!=='total'?' · '+c.grade+'.º':'')+' · '+fmt(rows.length)+' escuelas';
  if(!state.mapReady[side])return;
  const view=state.views[side];
  const layer=state.points[side];
  if(layer){layer.removeAll();layer.addMany(graphicsFor(rows,side));layer.visible=true}
  if(state.heat[side]){view.map.remove(state.heat[side]);state.heat[side].destroy();state.heat[side]=null}
  if(state.toggles[side].heat){
    const heat=makeHeatLayer(rows,side);
    if(heat){view.map.add(heat,1);state.heat[side]=heat}
  }
  // Los puntos permanecen por encima del mapa de calor; los límites y clústeres son seleccionables.
}
function redrawClusters(side){
  if(!state.mapReady[side]||!state.points[side])return;
  const layer=state.points[side];layer.removeAll();layer.addMany(graphicsFor(state.rows[side],side));
}
function markSelected(side,r){
  for(const other of ['A','B'])state.highlights[other]?.removeAll();
  const layer=state.highlights[side];if(!layer||r.lat===null||r.lon===null)return;
  layer.add(new state.Graphic({geometry:geometry(r),symbol:{type:'simple-marker',style:'circle',size:20,color:[0,0,0,0],outline:{color:'#a57f2c',width:3}}}));
}
function locateSchool(side){
  const c=control(side),query=c.search;if(!query)return;
  const list=available(c).filter(r=>matches(r,c,false));
  const found=list.find(r=>r.cct===query)||list.find(r=>r.cct.startsWith(query))||list.find(r=>normalize(r.nombre).includes(query));
  if(!found){$('status').textContent='No se encontró un CCT o escuela con ese nombre en el ciclo y filtros seleccionados.';return}
  $('status').textContent='';
  if(found.lat!==null&&found.lon!==null&&state.views[side]){
    const view=state.views[side];
    view.goTo({target:geometry(found),zoom:16},{animate:true}).catch(()=>{});
  }else if(found.lat===null||found.lon===null){
    $('status').textContent='Se encontró el CCT '+found.cct+', pero no tiene coordenadas; su ficha está disponible.';
  }
  renderDetail(found,side);
}
function refresh(side,{cycleChanged=false}={}){
  if(cycleChanged)populateCycleFilters(side);
  renderMap(side);if(side==='A')updateSummary();
  renderComparison();
}
function clearFilters(side){
  for(const id of ['alcaldia','sostenimiento','metric','grado','minimum','search'])el(side,id).value=id==='metric'||id==='grado'?'total':id==='minimum'?'0':'';
  $('status').textContent='';refresh(side);resetView(side);
}
function handleMapClick(side,event){
  const view=state.views[side],layer=state.points[side];if(!layer)return;
  view.hitTest(event,{include:[layer]}).then(result=>{
    const hit=result.results.find(x=>x.graphic?.attributes?.kind);
    if(!hit)return;
    const attr=hit.graphic.attributes;
    if(attr.kind==='school'){
      const row=available(control(side)).find(r=>r.cct===attr.cct);
      if(row)renderDetail(row,side);
    }else if(attr.kind==='cluster'){
      const ids=String(attr.ids||'').split('|');
      const rows=ids.map(id=>state.rows[side].find(r=>r.cct===id)).filter(Boolean);
      if(view.zoom<16.5){view.goTo({target:hit.graphic.geometry,zoom:Math.min(view.zoom+2.5,17)},{animate:true}).catch(()=>{});}else if(rows.length){renderClusterDetail(rows,side)}
    }
  }).catch(e=>console.warn('Selección en mapa:',e));
}
function createView(side){
  const map=new state.Map({basemap:null,layers:[new state.WebTileLayer({urlTemplate:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{level}/{row}/{col}',copyright:'Tiles © Esri'})]});
  const view=new state.MapView({container:'map'+side,map,center:[-99.14,19.32],zoom:10,ui:{components:['zoom','attribution']},popupEnabled:false,constraints:{minZoom:8}});
  state.views[side]=view;
  const points=new state.GraphicsLayer({title:'Escuelas y clústeres',listMode:'hide'});
  const highlight=new state.GraphicsLayer({title:'CCT seleccionado',listMode:'hide'});
  state.points[side]=points;state.highlights[side]=highlight;
  view.when(async()=>{
    try{
      const boundary=new state.GeoJSONLayer({url:'data/alcaldias.json',title:'Límites de alcaldías',renderer:{type:'simple',symbol:{type:'simple-fill',color:[0,0,0,0],outline:{color:'#1e5b4f',width:1.5}}},popupEnabled:false});
      map.add(boundary);await boundary.load();
    }catch(e){console.warn('Límites:',e)}
    map.add(points);map.add(highlight);
    state.mapReady[side]=true;
    resetView(side);renderMap(side);
    // La recomposición de clústeres se realiza solo cuando termina el zoom o el desplazamiento.
    view.watch('stationary',stable=>{if(stable)redrawClusters(side)});
    view.watch('width',()=>redrawClusters(side));
  }).catch(e=>showError('No se pudo iniciar el mapa Esri: '+e.message));
  view.on('click',event=>handleMapClick(side,event));
}
function showError(message){$('status').textContent=message;console.error(message)}
function bind(){
  for(const side of ['A','B']){
    for(const id of ['cycle','alcaldia','sostenimiento','metric','grado','minimum','search']){
      const input=el(side,id);
      input.addEventListener(id==='search'||id==='minimum'?'input':'change',()=>{if(id==='metric')refreshGradeOptions(side);refresh(side,{cycleChanged:id==='cycle'})});
      if(id==='search')input.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();locateSchool(side)}
        if(event.key==='Escape'){input.value='';refresh(side)}
      });
    }
    for(const [id,type] of [['showSchools','points'],['showClusters','clusters'],['showHeat','heat']]){
      el(side,id).addEventListener('click',()=>setToggle(side,type,!state.toggles[side][type]));
    }
    el(side,'clear').addEventListener('click',()=>clearFilters(side));
    $('compareAlcaldia'+side).addEventListener('change',()=>{fillSchoolSelect(side);renderComparison()});
    $('compareCct'+side).addEventListener('change',renderComparison);
  }
  $('toggleCompare').addEventListener('click',()=>toggleCompare(!state.compare));
  $('reset').addEventListener('click',()=>{resetView('A');if(state.compare)resetView('B')});
  $('closeDetail').addEventListener('click',closeDetail);
  $('compareSelected').addEventListener('click',()=>{if(state.selected){openCompare(state.selected);closeDetail()}});
  $('closeCompare').addEventListener('click',()=>setCompareOpen(false));
  $('openComparePanel').addEventListener('click',()=>openCompare());
  $('detailContent').addEventListener('click',event=>{
    const button=event.target.closest('button[data-cct][data-side]');if(!button)return;
    const side=button.dataset.side,r=available(control(side)).find(row=>row.cct===button.dataset.cct);
    if(r)renderDetail(r,side);
  });
}
async function init(){
  bind();
  try{
    const entries=await Promise.all(Object.entries(DATA).map(async([cycle,path])=>{
      const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('No se pudo cargar '+path);
      const rows=await response.json();if(!Array.isArray(rows))throw Error('Formato incorrecto en '+path);
      return [cycle,rows.map((row,i)=>school(row,cycle,i)).filter(Boolean)];
    }));
    state.data=Object.fromEntries(entries);
    for(const side of ['A','B'])populateCycleFilters(side);
    updateSummary();
    require(['esri/Map','esri/views/MapView','esri/layers/WebTileLayer','esri/layers/FeatureLayer','esri/layers/GeoJSONLayer','esri/Graphic','esri/layers/GraphicsLayer','esri/geometry/Point','esri/geometry/Extent','esri/geometry/support/webMercatorUtils'],
    (Map,MapView,WebTileLayer,FeatureLayer,GeoJSONLayer,Graphic,GraphicsLayer,Point,Extent,webMercatorUtils)=>{
      Object.assign(state,{Map,MapView,WebTileLayer,FeatureLayer,GeoJSONLayer,Graphic,GraphicsLayer,Point,Extent,webMercatorUtils});
      createView('A');
    });
  }catch(e){showError('No fue posible cargar los datos: '+e.message+'; abre el visor con servidor local o GitHub Pages.')}
}
init();
