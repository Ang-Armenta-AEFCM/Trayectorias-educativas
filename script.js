/* Trayectorias educativas de primaria y secundaria · ArcGIS Maps SDK 4.31 */
'use strict';
const $ = id => document.getElementById(id);
const fmt = n => n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('es-MX');
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const METRICS = {total:'Total combinado', no_promovidos:'No promovidos', abandono:'Abandono', no_certificado:'No certificados'};
const DATA = {'2025-2026':'data/trayectorias_2025_2026.json','2026-2027':'data/trayectorias_2026_2027.json'};
const CDMX = {xmin:-99.38,ymin:19.03,xmax:-98.91,ymax:19.61,spatialReference:{wkid:4326}};
const palette = ['#e6d194','#a57f2c','#1e5b4f','#9b2247','#611232'];
const state = {compare:false,selected:null,data:{},views:{},points:{},highlights:{},pointOffsets:{A:new Map(),B:new Map()},rows:{A:[],B:[]},toggles:{A:{points:true,clusters:true,heat:true},B:{points:true,clusters:true,heat:true}},heatFrames:{A:0,B:0},heatMotionFrames:{A:0,B:0},heatSnapshots:{A:null,B:null},heatRebuildTimers:{A:0,B:0},mapReady:{A:false,B:false},compareOpen:false};

function numeric(v){return v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null)}
function school(row,cycle,index){
  const cct=normalize(row.cct??row.CCT);
  if(!cct)return null;
  const read=k=>numeric(row[k]);
  const noProm=read('no_promovidos_total'), abandon=read('abandono_total'), noCert=read('no_certificado_3');
  return {oid:index+1,cycle,cct,nombre:String(row.nombre??'Escuela'),nivel:String(row.nivel||'Secundaria'),alcaldia:normalize(row.alcaldia),sostenimiento:String(row.sostenimiento??'').trim(),turno:String(row.turno??''),domicilio:String(row.domicilio??''),matricula:read('matricula'),lat:numeric(row.latitud??row.lat),lon:numeric(row.longitud??row.lon),no_promovidos_1:read('no_promovidos_1'),no_promovidos_2:read('no_promovidos_2'),no_promovidos_3:read('no_promovidos_3'),no_promovidos_4:read('no_promovidos_4'),no_promovidos_5:read('no_promovidos_5'),no_promovidos_6:read('no_promovidos_6'),no_promovidos_total:noProm,no_promovidos_otros:read('no_promovidos_otros'),abandono_1:read('abandono_1'),abandono_2:read('abandono_2'),abandono_3:read('abandono_3'),abandono_4:read('abandono_4'),abandono_5:read('abandono_5'),abandono_6:read('abandono_6'),abandono_total:abandon,no_certificado_3:noCert,total_casos:[noProm,abandon,noCert].some(v=>v!==null)?[noProm,abandon,noCert].reduce((s,v)=>s+(v??0),0):null};
}
function value(r,metric,grade){
  if(metric==='total'){
    if(grade==='total')return r.total_casos;
    const parts=[r['no_promovidos_'+grade],r['abandono_'+grade],...(grade==='3'?[r.no_certificado_3]:[])];
    return parts.some(v=>v!==null)?parts.reduce((n,v)=>n+(v??0),0):null;
  }
  if(metric==='no_certificado')return grade!=='3'&&grade!=='total'?null:r.no_certificado_3;
  return r[metric+'_'+(grade==='total'?'total':grade)]??null;
}
function el(side,id){return $(id+(side==='B'?'B':''))}
function control(side){
  return {cycle:el(side,'cycle').value,nivel:el(side,'nivel').value,alcaldia:el(side,'alcaldia').value,sostenimiento:el(side,'sostenimiento').value,metric:el(side,'metric').value,grade:el(side,'grado').value,minimum:Math.max(0,Number(el(side,'minimum').value)||0),search:normalize(el(side,'search').value)};
}
function available(c){return (state.data[c.cycle]||[]).filter(r=>!c.nivel||r.nivel===c.nivel)}
function matches(r,c,withSearch=true){return (!c.alcaldia||r.alcaldia===c.alcaldia)&&(!c.sostenimiento||r.sostenimiento===c.sostenimiento)&&(!withSearch||!c.search||normalize(r.cct+' '+r.nombre).includes(c.search))}
function filtered(side){const c=control(side);return available(c).filter(r=>r.lat!==null&&r.lon!==null&&matches(r,c)&&value(r,c.metric,c.grade)!==null&&value(r,c.metric,c.grade)>=c.minimum)}
function unique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function options(id,values,prefix){const elem=$(id),prev=elem.value;elem.replaceChildren(new Option(prefix,''),...values.map(v=>new Option(v,v)));if(values.includes(prev))elem.value=prev}
function refreshGradeOptions(side){
  const c=control(side),rows=available(c),grade=el(side,'grado'),prev=grade.value;
  const choices=[['total','Todos / total'],...Array.from({length:6},(_,i)=>[String(i+1),String(i+1)+'.º'])].filter(([key])=>rows.some(r=>value(r,c.metric,key)!==null));
  grade.replaceChildren(...choices.map(([key,text])=>new Option(text,key)));
  if(choices.some(([key])=>key===prev))grade.value=prev;
}
function populateCycleFilters(side){
  const c=control(side);
  options(side==='B'?'nivelB':'nivel',unique(state.data[c.cycle]||[],'nivel'),'Todos los niveles');
  const rows=available(control(side));
  const metric=el(side,'metric'),prevMetric=metric.value;
  const metricKeys=Object.keys(METRICS).filter(key=>rows.some(r=>value(r,key,'total')!==null));
  metric.replaceChildren(...metricKeys.map(key=>new Option(METRICS[key],key)));
  if(metricKeys.includes(prevMetric))metric.value=prevMetric;
  refreshGradeOptions(side);
  options(side==='B'?'alcaldiaB':'alcaldia',unique(rows,'alcaldia'),'Todas las alcaldías');
  options(side==='B'?'sostenimientoB':'sostenimiento',unique(rows,'sostenimiento').filter(v=>!['SIN DATO','SIN REGISTRO',''].includes(normalize(v))),'Todos');
  fillSchoolSelect(side);
  $('filterCaption'+side).textContent=c.cycle;
  $('compareCycle'+side).textContent=c.cycle;
}
function fillSchoolSelect(side){
  const c=control(side),elem=$('compareCct'+side),prev=elem.value;
  // Los CCT de la comparación usan el ciclo, alcaldía y sostenimiento del mapa correspondiente.
  // No se excluyen CCT por su métrica, grado o mínimo: la ficha puede mostrar otras variables.
  const rows=available(c).filter(r=>matches(r,c,false)).sort((a,b)=>a.cct.localeCompare(b.cct));
  elem.replaceChildren(new Option('Selecciona un CCT',''),...rows.map(r=>new Option(r.cct+' · '+r.nombre,r.cct)));
  if(rows.some(r=>r.cct===prev))elem.value=prev;
}
function rowsForDetail(r){
  return [['CCT',r.cct],['Ciclo escolar',r.cycle],['Nivel educativo',r.nivel],['Alcaldía',r.alcaldia],['Sostenimiento',r.sostenimiento],['Turno',r.turno],['Domicilio',r.domicilio],['Matrícula',r.matricula],['No promovidos 1.º',r.no_promovidos_1],['No promovidos 2.º',r.no_promovidos_2],['No promovidos 3.º',r.no_promovidos_3],['No promovidos 4.º',r.no_promovidos_4],['No promovidos 5.º',r.no_promovidos_5],['No promovidos 6.º',r.no_promovidos_6],['No promovidos total',r.no_promovidos_total],['No promovidos en otros grados registrados',r.no_promovidos_otros],['Abandono 1.º',r.abandono_1],['Abandono 2.º',r.abandono_2],['Abandono 3.º',r.abandono_3],['Abandono 4.º',r.abandono_4],['Abandono 5.º',r.abandono_5],['Abandono 6.º',r.abandono_6],['Abandono total',r.abandono_total],['No certificados 3.º',r.no_certificado_3],['Total combinado',r.total_casos]].filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!==''&&!['SIN DATO','SIN REGISTRO'].includes(normalize(v)));
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
  const a=findSelected('A'),b=findSelected('B');
  if(!a&&!b){
    $('compareResult').innerHTML='<p class="muted compareHint">Selecciona una escuela en cada columna para comparar sus datos.</p>';
    return;
  }
  const brief=(r,side)=>{
    if(!r)return '<span class="muted">Selecciona un CCT</span>';
    return '<strong>'+escapeHTML(r.nombre)+'</strong><span class="pill">'+escapeHTML(r.cct+' · '+r.cycle)+'</span><small>'+escapeHTML([r.alcaldia,r.sostenimiento].filter(Boolean).join(' · '))+'</small>';
  };
  const omit=new Set(['CCT','Ciclo escolar','Nivel educativo','Alcaldía','Sostenimiento','Turno','Domicilio']);
  const ra=new Map(a?rowsForDetail(a).filter(([label])=>!omit.has(label)):[]);
  const rb=new Map(b?rowsForDetail(b).filter(([label])=>!omit.has(label)):[]);
  const names=[...new Set([...ra.keys(),...rb.keys()])];
  const cell=(rows,key)=>rows.has(key)?escapeHTML(typeof rows.get(key)==='number'?fmt(rows.get(key)):rows.get(key)):'—';
  $('compareResult').innerHTML='<div class="comparisonTableWrap"><table class="comparisonTable"><thead><tr><th scope="col">Indicador</th><th scope="col">'+brief(a,'A')+'</th><th scope="col">'+brief(b,'B')+'</th></tr></thead><tbody>'+names.map(key=>'<tr><th scope="row">'+escapeHTML(key)+'</th><td>'+cell(ra,key)+'</td><td>'+cell(rb,key)+'</td></tr>').join('')+'</tbody></table></div>';
}
function setCompareOpen(on){state.compareOpen=on;$('comparePanel').classList.toggle('hidden',!on);$('openComparePanel').classList.toggle('hidden',!state.compare)}
function openCompare(selected=null){
  if(!state.compare)toggleCompare(true);
  setCompareOpen(true);
  if(selected){
    const {row:r,side}=selected;
    // No forzar el mismo CCT en ambos mapas: el otro selector es totalmente independiente.
    // Si el CCT viene de una ficha, adaptar únicamente el filtro territorial de su lado.
    if(available(control(side)).some(x=>x.cct===r.cct)){
      if(el(side,'alcaldia').value && el(side,'alcaldia').value!==r.alcaldia){el(side,'alcaldia').value='';}
      if(el(side,'sostenimiento').value && el(side,'sostenimiento').value!==r.sostenimiento){el(side,'sostenimiento').value='';}
      fillSchoolSelect(side);
      $('compareCct'+side).value=r.cct;
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
  $('sourceNote').textContent=(c.cycle==='2025-2026'?'2025–2026: primaria y secundaria; abandono y reprobados (no promovidos) de las bases depuradas, no certificados de 3.º de secundaria.':'2026–2027: no promovidos de primaria y secundaria; no certificados de secundaria cuando existe registro.')+(missing?' '+fmt(missing)+' CCT sin coordenadas siguen disponibles en la ficha comparativa.':'');
}
function setToggle(side,type,on){
  state.toggles[side][type]=on;
  const id=type==='points'?'showSchools':type==='clusters'?'showClusters':'showHeat';
  const btn=el(side,id);btn.setAttribute('aria-pressed',String(on));btn.classList.toggle('isActive',on);
  if(type==='heat'){
    const overlay=$('heat'+side);
    if(!on){overlay.classList.remove('isVisible');clearTimeout(state.heatRebuildTimers[side]);cancelAnimationFrame(state.heatFrames[side]);state.heatRebuildTimers[side]=0;state.heatFrames[side]=0;}
    else scheduleHeat(side);
    renderLegend(side,state.rows[side],control(side));
  }else renderMap(side);
}
function geometry(r){return new state.Point({longitude:r.lon,latitude:r.lat,spatialReference:{wkid:4326}})}
/* Varios CCT pueden compartir exactamente la misma ubicación. En lugar de
   dibujar símbolos uno encima de otro, los desplazamos sólo visualmente;
   la geometría y las coordenadas originales de cada escuela permanecen intactas. */
function schoolGraphics(rows,side,c,max){
  const groups=new Map(),graphics=[],offsets=new Map();
  for(const r of rows){
    const key=r.lat.toFixed(7)+','+r.lon.toFixed(7);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  }
  for(const sameLocation of groups.values()){
    sameLocation.sort((a,b)=>a.cct.localeCompare(b.cct));
    const count=sameLocation.length;
    sameLocation.forEach((r,i)=>{
      // ArcGIS expresa xoffset/yoffset en puntos de pantalla, no en grados.
      // 2–5 escuelas quedan separadas y seleccionables incluso con clústeres apagados.
      const radius=count===1?0:Math.max(12,Math.min(22,9+count*2));
      const angle=count===2?Math.PI*i:Math.PI/2+i*2*Math.PI/count;
      const dx=count===1?0:Math.round(Math.cos(angle)*radius*10)/10;
      const dy=count===1?0:Math.round(Math.sin(angle)*radius*10)/10;
      const symbol=pointSymbol(r,c,max);
      if(count>1){symbol.xoffset=dx;symbol.yoffset=dy}
      offsets.set(r.cct,{xoffset:dx,yoffset:dy});
      graphics.push(new state.Graphic({geometry:geometry(r),symbol,attributes:{kind:'school',cct:r.cct}}));
    });
  }
  state.pointOffsets[side]=offsets;
  return graphics;
}
function graphicsFor(rows,side){
  const view=state.views[side],toggles=state.toggles[side],output=[];
  state.pointOffsets[side]=new Map();
  if(!view?.ready || !view.width || !view.height)return output;
  const c=control(side),max=Math.max(1,...rows.map(r=>value(r,c.metric,c.grade)||0));
  // A escala de detalle los clústeres se disuelven, incluso si comparten edificio.
  if(!toggles.clusters || (toggles.points && view.zoom>=16.5)){
    if(toggles.points)output.push(...schoolGraphics(rows,side,c,max));
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
/* Densidad de casos al estilo del mapa de Movilidad (ponderación raíz cuadrada,
   degradado y desenfoque), adaptada a ESRI. Agregación en una malla de 10 píxeles,
   convolución gaussiana en dos pasadas: coste O(N + celdas * radio), sin círculos
   individuales. Mientras el mapa se mueve, solo se transforma el bitmap existente. */
function heatGaussian(input,width,height,sigma){
  const radius=Math.ceil(sigma*3),kernel=new Float32Array(radius*2+1);
  let sum=0;
  for(let k=-radius;k<=radius;k++){const v=Math.exp(-.5*(k/sigma)**2);kernel[k+radius]=v;sum+=v}
  for(let k=0;k<kernel.length;k++)kernel[k]/=sum;
  const temp=new Float32Array(input.length),out=new Float32Array(input.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let a=0;
    for(let k=-radius;k<=radius;k++){const xx=x+k;if(xx>=0&&xx<width)a+=input[y*width+xx]*kernel[k+radius]}
    temp[y*width+x]=a;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let a=0;
    for(let k=-radius;k<=radius;k++){const yy=y+k;if(yy>=0&&yy<height)a+=temp[yy*width+x]*kernel[k+radius]}
    out[y*width+x]=a;
  }
  return out;
}
const HEAT_STOPS=[[30,91,79],[230,209,148],[166,128,45],[155,34,71],[97,18,50]];
/* Mantener la textura térmica georreferenciada mientras el usuario mueve el mapa.
   Tres anclas cartográficas permiten actualizar una matriz CSS de traslación,
   escala y giro a 60 fps sin recalcular la densidad ni generar halos nuevos. */
function rememberHeatExtent(side,view,w,h){
  if(typeof view.toMap!=='function')return;
  const anchors=[[0,0],[w,0],[0,h]].map(([x,y])=>view.toMap({x,y}));
  if(anchors.every(Boolean))state.heatSnapshots[side]={w,h,anchors};
}
function followHeatMap(side){
  const snapshot=state.heatSnapshots[side],view=state.views[side],canvas=$('heat'+side);
  if(!snapshot||!view||!canvas||!canvas.classList.contains('isVisible'))return;
  if(state.heatMotionFrames[side])return;
  state.heatMotionFrames[side]=requestAnimationFrame(()=>{
    state.heatMotionFrames[side]=0;
    const snap=state.heatSnapshots[side];
    if(!snap||!state.toggles[side].heat||!canvas.classList.contains('isVisible'))return;
    const projected=snap.anchors.map(geometry=>view.toScreen(geometry));
    if(projected.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return;
    const [p0,px,py]=projected;
    const a=(px.x-p0.x)/snap.w,b=(px.y-p0.y)/snap.w;
    const c=(py.x-p0.x)/snap.h,d=(py.y-p0.y)/snap.h;
    if([a,b,c,d].some(v=>!Number.isFinite(v)))return;
    canvas.style.transform=`matrix(${a},${b},${c},${d},${p0.x},${p0.y})`;
  });
}
function smoothstep(x){const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t)}
function drawHeat(side){
  const canvas=$('heat'+side),view=state.views[side];
  if(!canvas||!state.toggles[side].heat||!view?.ready)return;
  const map=$('map'+side),w=Math.round(map.clientWidth),h=Math.round(map.clientHeight);
  if(w<40||h<40)return;
  const c=control(side),rows=(state.rows[side]||[]).filter(r=>(value(r,c.metric,c.grade)??0)>0);
  if(rows.length===0){canvas.classList.remove('isVisible');state.heatSnapshots[side]=null;return}
  const cell=10, sigma=Math.max(5.2,Math.min(9.5,Math.min(w,h)*.095/cell));
  const pad=Math.ceil(sigma*3)+2,cols=Math.ceil(w/cell),lines=Math.ceil(h/cell);
  const gw=cols+pad*2,gh=lines+pad*2;
  const mass=new Float32Array(gw*gh),numbers=new Float32Array(gw*gh);
  const counts=rows.map(r=>value(r,c.metric,c.grade)).sort((a,b)=>a-b);
  const reference=Math.max(1,counts[Math.floor((counts.length-1)*.9)]);
  // Pesar por casos, pero limitar valores atípicos que ocultaban la concentración.
  for(const r of rows){
    const xy=view.toScreen(geometry(r));
    if(!xy||!Number.isFinite(xy.x)||!Number.isFinite(xy.y))continue;
    const x=xy.x/cell+pad,y=xy.y/cell+pad;
    const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi;
    if(xi<0||xi>=gw-1||yi<0||yi>=gh-1)continue;
    const weight=Math.min(2.4,Math.sqrt(value(r,c.metric,c.grade)/reference));
    const i=yi*gw+xi;
    for(const [dx,dy,factor] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){
      mass[i+dy*gw+dx]+=weight*factor;
      numbers[i+dy*gw+dx]+=factor;
    }
  }
  const blurred=heatGaussian(mass,gw,gh,sigma),density=heatGaussian(numbers,gw,gh,sigma);
  let peak=0;
  for(let y=0;y<lines;y++)for(let x=0;x<cols;x++)peak=Math.max(peak,blurred[(y+pad)*gw+x+pad]);
  if(!peak){canvas.classList.remove('isVisible');state.heatSnapshots[side]=null;return}
  const oneSchoolKernel=1/(2*Math.PI*sigma*sigma);
  const cutoff=peak*.12;
  const thresholdCount=1.10*oneSchoolKernel;
  const layer=document.createElement('canvas');layer.width=cols;layer.height=lines;
  const layerCtx=layer.getContext('2d');if(!layerCtx)return;
  const picture=layerCtx.createImageData(cols,lines);
  let hasColor=false;
  for(let y=0;y<lines;y++)for(let x=0;x<cols;x++){
    const i=(y+pad)*gw+x+pad,raw=blurred[i];
    // La transición suave elimina los bordes duros de las isodensidades.
    // Suprimir núcleos aislados evita el aspecto de espectro escolar.
    if(raw<=cutoff||density[i]<=oneSchoolKernel)continue;
    const t=Math.min(1,(raw-cutoff)/Math.max(1e-8,peak-cutoff));
    const densityFade=smoothstep((density[i]-oneSchoolKernel)/(oneSchoolKernel*.65));
    const opacity=Math.round(175*Math.pow(smoothstep(t),.78)*densityFade);
    if(opacity<3)continue;
    const v=Math.min(3.999,t*4),k=Math.floor(v),mix=v-k;
    const a=HEAT_STOPS[k],b=HEAT_STOPS[k+1],j=(y*cols+x)*4;
    picture.data[j]=Math.round(a[0]+(b[0]-a[0])*mix);
    picture.data[j+1]=Math.round(a[1]+(b[1]-a[1])*mix);
    picture.data[j+2]=Math.round(a[2]+(b[2]-a[2])*mix);
    picture.data[j+3]=opacity;
    hasColor=true;
  }
  layerCtx.putImageData(picture,0,0);
  if(!hasColor){canvas.classList.remove('isVisible');state.heatSnapshots[side]=null;return}
  // La actualización es atómica: se prepara en un lienzo auxiliar y luego se
  // sustituye en un único fotograma, sin ocultar la superficie anterior.
  const composited=document.createElement('canvas');composited.width=w;composited.height=h;
  const finalCtx=composited.getContext('2d');if(!finalCtx)return;
  finalCtx.imageSmoothingEnabled=true;finalCtx.imageSmoothingQuality='high';
  finalCtx.drawImage(layer,0,0,w,h);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  canvas.style.transform='none';
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(composited,0,0);
  rememberHeatExtent(side,view,w,h);
  canvas.classList.add('isVisible');
}
function scheduleHeat(side){
  clearTimeout(state.heatRebuildTimers[side]);
  if(!state.toggles[side].heat)return;
  if(state.heatFrames[side])cancelAnimationFrame(state.heatFrames[side]);
  // Se agrupan los cambios de extent del SDK; solo se recalcula con mapa quieto.
  state.heatRebuildTimers[side]=setTimeout(()=>{
    state.heatRebuildTimers[side]=0;
    state.heatFrames[side]=requestAnimationFrame(()=>{
      state.heatFrames[side]=0;
      if(state.views[side]?.stationary!==false)drawHeat(side);
    });
  },75);
}
/* Leyenda vinculada a la simbología real: los cinco intervalos usan
   exactamente los mismos cortes que pointSymbol, sin alterar el renderer. */
function renderLegend(side,rows,c){
  const target=$('legendItems'+side),summary=$('legendSummary'+side);
  if(!target||!summary)return;
  const enabled=state.toggles[side];
  const counts=rows.map(row=>value(row,c.metric,c.grade)||0);
  const total=counts.reduce((sum,n)=>sum+n,0);
  const max=Math.max(1,...counts);
  summary.textContent=fmt(rows.length)+' escuelas · '+fmt(total)+' casos';
  const sections=[];
  if(enabled.points){
    const buckets=palette.map((color,index)=>({color,index,n:0}));
    for(const n of counts){
      const index=Math.min(4,Math.floor(n/max*5));
      buckets[index].n++;
    }
    const items=buckets.filter(bucket=>bucket.n>0).map(bucket=>{
      const start=Math.ceil(bucket.index*max/5);
      const end=bucket.index===4?max:Math.ceil((bucket.index+1)*max/5)-1;
      const range=start===end?fmt(start):fmt(start)+'–'+fmt(end);
      return '<span class="legendBand"><i class="legendDot" style="background:'+bucket.color+'" aria-hidden="true"></i><b>'+range+'</b><small>casos · '+fmt(bucket.n)+' esc.</small></span>';
    }).join('');
    sections.push('<div class="legendGroup"><span class="legendGroupTitle">Puntos · casos por escuela</span><div class="legendBands">'+(items||'<span class="muted">Sin escuelas</span>')+'</div></div>');
  }
  if(enabled.clusters){
    sections.push('<div class="legendGroup legendCluster"><span class="legendGroupTitle">Clústeres</span><div class="legendBands"><span class="legendClusterCircle" aria-hidden="true">N</span><span>N = escuelas agrupadas</span></div></div>');
  }
  if(enabled.heat){
    const active=rows.filter(r=>(value(r,c.metric,c.grade)??0)>0);
    const cases=active.reduce((n,r)=>n+value(r,c.metric,c.grade),0);
    sections.push('<div class="legendGroup"><span class="legendGroupTitle">Calor · concentración espacial de casos</span><div class="legendBands"><span>Menor</span><i class="legendHeatScale" aria-hidden="true"></i><span>Mayor</span></div><span class="muted">'+fmt(cases)+' casos · '+fmt(active.length)+' escuelas con casos; intensidad relativa, no casos por color</span></div>');
  }
  target.innerHTML=sections.join('')||'<span class="muted">Activa puntos, clústeres o calor para ver su simbología.</span>';
}
function renderMap(side){
  const c=control(side),rows=filtered(side);state.rows[side]=rows;
  renderLegend(side,rows,c);
  $('caption'+side).textContent=c.cycle+' · '+METRICS[c.metric]+(c.grade!=='total'?' · '+c.grade+'.º':'')+' · '+fmt(rows.length)+' escuelas';
  if(!state.mapReady[side])return;
  const view=state.views[side];
  const layer=state.points[side];
  if(layer){layer.removeAll();layer.addMany(graphicsFor(rows,side));layer.visible=true}
  if(state.selected?.side===side)markSelected(side,state.selected.row);
  if(state.toggles[side].heat)scheduleHeat(side);

}
function redrawClusters(side){
  if(!state.mapReady[side]||!state.points[side])return;
  const layer=state.points[side];layer.removeAll();layer.addMany(graphicsFor(state.rows[side],side));
  if(state.selected?.side===side)markSelected(side,state.selected.row);
}
function markSelected(side,r){
  for(const other of ['A','B'])state.highlights[other]?.removeAll();
  const layer=state.highlights[side];if(!layer||r.lat===null||r.lon===null)return;
  const offset=state.pointOffsets[side]?.get(r.cct)||{xoffset:0,yoffset:0};
  layer.add(new state.Graphic({geometry:geometry(r),symbol:{type:'simple-marker',style:'circle',size:20,xoffset:offset.xoffset,yoffset:offset.yoffset,color:[0,0,0,0],outline:{color:'#a57f2c',width:3}}}));
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
  for(const id of ['nivel','alcaldia','sostenimiento','metric','grado','minimum','search'])el(side,id).value=id==='metric'||id==='grado'?'total':id==='minimum'?'0':'';
  $('status').textContent='';populateCycleFilters(side);refresh(side);resetView(side);
}
function handleMapClick(side,event){
  const view=state.views[side],layer=state.points[side];if(!layer)return;
  view.hitTest(event,{include:[layer]}).then(result=>{
    const hits=result.results.filter(x=>x.graphic?.attributes?.kind);
    if(!hits.length)return;
    // Si dos símbolos se solapan parcialmente, ofrecer ambos CCT en la ficha.
    const schoolIds=[...new Set(hits.filter(x=>x.graphic.attributes.kind==='school').map(x=>x.graphic.attributes.cct))];
    if(schoolIds.length>1){
      const rows=schoolIds.map(id=>state.rows[side].find(r=>r.cct===id)).filter(Boolean);
      if(rows.length>1){renderClusterDetail(rows,side);return}
    }
    const hit=hits[0];
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
    view.watch('stationary',stable=>{
      if(stable){redrawClusters(side);scheduleHeat(side)}
      else{clearTimeout(state.heatRebuildTimers[side]);followHeatMap(side)}
    });
    // ArcGIS actualiza extent durante el arrastre/zoom: mover solo la imagen
    // anterior con GPU; recalcular densidades únicamente al detenerse.
    view.watch('extent',()=>followHeatMap(side));
    view.watch('width',()=>{followHeatMap(side);redrawClusters(side);scheduleHeat(side)});
    view.watch('height',()=>{followHeatMap(side);scheduleHeat(side)});
  }).catch(e=>showError('No se pudo iniciar el mapa Esri: '+e.message));
  view.on('click',event=>handleMapClick(side,event));
}
function showError(message){$('status').textContent=message;console.error(message)}
function bind(){
  for(const side of ['A','B']){
    for(const id of ['cycle','nivel','alcaldia','sostenimiento','metric','grado','minimum','search']){
      const input=el(side,id);
      input.addEventListener(id==='search'||id==='minimum'?'input':'change',()=>{
        if(id==='metric')refreshGradeOptions(side);
        refresh(side,{cycleChanged:id==='cycle'||id==='nivel'});
        if(id==='alcaldia'||id==='sostenimiento'||id==='nivel')fillSchoolSelect(side);
        if(id==='alcaldia'||id==='sostenimiento')renderComparison();
      });
      if(id==='search')input.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();locateSchool(side)}
        if(event.key==='Escape'){input.value='';refresh(side)}
      });
    }
    for(const [id,type] of [['showSchools','points'],['showClusters','clusters'],['showHeat','heat']]){
      el(side,id).addEventListener('click',()=>setToggle(side,type,!state.toggles[side][type]));
    }
    el(side,'clear').addEventListener('click',()=>clearFilters(side));
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
