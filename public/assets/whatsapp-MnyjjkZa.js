const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/maps-Brdr0nWp.js","assets/rolldown-runtime-WNZMJCWm.js","assets/api-MlggCwql.js"])))=>i.map(i=>d[i]);
import{t as e}from"./rolldown-runtime-WNZMJCWm.js";import{t}from"./api-MlggCwql.js";import{n,t as r}from"./preload-helper-B--W30Oa.js";var i=e({cambiarEstadoReporte:()=>g,cerrarReporteModal:()=>v,checkWspConnection:()=>m,currentWspGroup:()=>o,eliminarReporte:()=>w,filtrarReportes:()=>y,getPhotoUrls:()=>a,getWspFeeds:()=>l,guardarUbicacion:()=>C,loadReportes:()=>h,refreshReportes:()=>b,refreshWspStats:()=>f,renderWspFeed:()=>u,startAutoRefresh:()=>S,switchWspGroup:()=>d,switchWspTab:()=>p,verReporte:()=>_});function a(e){if(!e||e.length<5)return[];if(e.trim().startsWith(`[`))try{return JSON.parse(e)}catch(e){console.warn(`Failed to parse fotoUrl as JSON array, falling back:`,e)}return[e]}var o=`municipal`,s={municipal:[],seguridad:[],ambiental:[],rentas:[],urbano:[],humano:[],participacion:[],opc:[],demuna:[],ciam:[],omaped:[],otros:[],fiscalizacion:[],transporte:[],serenazgo:[],fiscalizacion_transporte:[]},c=null;function l(){return s}async function u(e,n=!1){if(c)try{c.abort()}catch{}c=new AbortController;let i=c.signal;o=e,f(i);let l=document.getElementById(`wsp-feed`),u=document.getElementById(`wsp-feed-title`);if(!l)return;document.querySelectorAll(`.wsp-card`).forEach(e=>e.style.borderColor=``);let d=document.getElementById(`wsp-btn-${e}`);d&&(d.style.borderColor=`var(--blue)`),document.querySelectorAll(`#sidebar-gerencias-container .nav-item`).forEach(e=>{e.classList.remove(`active`)});let p=document.querySelector(`#sidebar-gerencias-container [onclick*="'${e}'"]`);if(p&&p.classList.add(`active`),window.allGerencias){let t=window.allGerencias.find(t=>t.clave===e);if(t&&t.esSubArea&&t.parentClave){let e=document.getElementById(`subgerencias-${t.parentClave}`),n=document.getElementById(`arrow-${t.parentClave}`);e&&e.classList.contains(`collapsed`)&&(e.classList.remove(`collapsed`),n&&(n.style.transform=`rotate(90deg)`))}}u.textContent=`Feed — ${window.gerenciasNombres&&window.gerenciasNombres[e]||{municipal:`Gerencia Municipal`,seguridad:`Seguridad Ciudadana`,fiscalizacion_transporte:`Fiscalización y Transporte`,ambiental:`Desarrollo Ambiental`,rentas:`Rentas`,urbano:`Desarrollo Urbano`,humano:`Desarrollo Humano`,participacion:`Participación Vecinal`,opc:`OPC`,demuna:`DEMUNA`,ciam:`CIAM`,omaped:`OMAPED`,otros:`Otros`,fiscalizacion:`Fiscalización y Sanciones`,transporte:`Transporte y Vialidad`,serenazgo:`Serenazgo`}[e]||e}`;let m=document.getElementById(`filter-from`)?.value,h=document.getElementById(`filter-to`)?.value;try{let o=l?l.parentElement:null,c=o?o.scrollTop:0,u={};m&&(u.from=m),h&&(u.to=h);let d=t.getUser(),f=!1,p=e;if(window.allGerencias){let t=window.allGerencias.find(t=>t.clave===e);t&&t.esSubArea&&(f=!0,d&&d.gerencia&&d.rol===`gerente`&&(p=d.gerencia))}else (e===`fiscalizacion`||e===`transporte`)&&(f=!0,d&&d.gerencia===`fiscalizacion_transporte`&&d.rol===`gerente`&&(p=`fiscalizacion_transporte`));if(!n&&(l.innerHTML=`
        <div style="text-align:center;padding:40px;color:var(--text-dim)">
          <div style="display:inline-block; width: 24px; height: 24px; border: 3px solid rgba(59,125,212,0.2); border-top-color: var(--blue); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
          <div>Cargando feed...</div>
        </div>
      `,!document.getElementById(`spin-keyframes-style`))){let e=document.createElement(`style`);e.id=`spin-keyframes-style`,e.innerHTML=`@keyframes spin { to { transform: rotate(360deg); } }`,document.head.appendChild(e)}let g=await t.getWhatsappFeed(p,u,{signal:i}),_=g&&g.feed?g.feed:[];if(f){let t=e.toLowerCase();_=_.filter(e=>(e.category||``).toLowerCase()===t||e.areasDerivadas&&e.areasDerivadas.some(e=>e.toLowerCase()===t))}s[e]=_,window.savedScrollTop=c;let v=document.getElementById(`feed-filtro-subarea`);if(v)if(d&&(d.rol===`admin`||d.rol===`gerente`)){v.style.display=`inline-block`;let n=[];try{n=await t.getGerencias()}catch(e){console.warn(`No se pudo obtener las gerencias para el filtro:`,e)}(!n||n.length===0)&&(n=[{clave:`serenazgo`,nombre:`Serenazgo`,esSubArea:!0,parentClave:`seguridad`},{clave:`fiscalizacion`,nombre:`Fiscalización`,esSubArea:!0,parentClave:`fiscalizacion_transporte`},{clave:`transporte`,nombre:`Transporte`,esSubArea:!0,parentClave:`fiscalizacion_transporte`}]);let r=n.filter(t=>t.esSubArea&&t.parentClave===e);if(r.length>0){let t=r[0].clave;if(!v.querySelector(`option[value="${t}"]`)||window.lastWspGroupFiltered!==e){window.lastWspGroupFiltered=e;let t=``;r.length>1&&(t+=`<option value="todos">Todas las áreas</option>`),r.forEach(e=>{t+=`<option value="${e.clave}">${e.nombre}</option>`}),v.innerHTML=t,v.value=r.length>1?`todos`:r[0].clave}}else v.style.display=`none`,v.innerHTML=`<option value="todos">Todas las áreas</option>`,v.value=`todos`}else v.style.display=`none`,v.innerHTML=`<option value="todos">Todas las áreas</option>`,v.value=`todos`;let y=v?.value||`todos`,b=s[e];if(y!==`todos`){let e=y.toLowerCase();b=b.filter(t=>(t.category||``).toLowerCase()===e||t.areasDerivadas&&t.areasDerivadas.some(t=>t.toLowerCase()===e))}let x=document.getElementById(`filter-sector`)?.value||`all`;if(x!==`all`&&x!==`todos`){let e=x.trim().toLowerCase();b=b.filter(t=>(t.sector||``).trim().toLowerCase()===e)}let S=document.getElementById(`filter-area`)?.value||`all`;if(S!==`all`&&S!==`todos`){let e=S.trim().toLowerCase();b=b.filter(t=>t.grupo===e||t.areasDerivadas&&t.areasDerivadas.some(t=>t.trim().toLowerCase()===e))}let C=JSON.stringify(b),w=`rendered_feed_${e}`,T=sessionStorage.getItem(w),E=window.lastWspGroupRendered!==e;if(T===C&&l.children.length>0&&!E)return;window.lastWspGroupRendered=e,sessionStorage.setItem(w,C),l.innerHTML=``,b.length===0?l.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-dim)">No hay mensajes recientes que coincidan con el filtro</div>`:b.forEach(e=>{console.log(`📸 [FEED IMG DEBUG] ID: ${e.id}, FotoUrl starts with: ${e.fotoUrl?e.fotoUrl.substring(0,30):`NULL`}, Length: ${e.fotoUrl?e.fotoUrl.length:0}`);let t=document.createElement(`div`);t.className=`feed-item`,t.innerHTML=`
        <div class="fi-header">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="fi-avatar">${(e.sender||`?`).charAt(0)}</div>
            <div>
              <div class="fi-user">${e.sender} <span style="font-size:9px; color:var(--text-muted); font-weight:normal; text-transform:uppercase;"> — ${e.category||``}</span></div>
              <div class="fi-time">${e.time}</div>
            </div>
          </div>
          <span class="badge ${e.sentiment===`positivo`?`badge-green`:e.sentiment===`negativo`?`badge-red`:`badge-amber`}">${e.category}</span>
        </div>
        <div class="fi-body">${e.body}</div>
        ${(()=>{let t=e.fotos&&e.fotos.length>0?e.fotos:a(e.fotoUrl);return t.length===0?``:`
            <div class="fi-img-wrap" style="margin-top:10px; margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap;">
              ${t.map(e=>{let t=e.startsWith(`data:video/`)||e.endsWith(`.mp4`)||e.endsWith(`.mov`)||e.endsWith(`.avi`)||e.endsWith(`.webm`)||e.includes(`/video/`)||e.includes(`.mp4`)||e.includes(`.mov`),n=e.startsWith(`http`)||e.startsWith(`data:`)||e.startsWith(`/uploads/`)?e:t?`data:video/mp4;base64,`+e:`data:image/jpeg;base64,`+e;return t?`
                    <video src="${n}" 
                           style="width:140px; height:110px; object-fit:cover; border-radius:12px; cursor:zoom-in; border:2px solid var(--blue); box-shadow: 0 4px 15px rgba(0,0,0,0.2)"
                           onclick="
                             const overlay = document.createElement('div');
                             overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:999999; display:flex; justify-content:center; align-items:center; cursor:zoom-out;';
                             const vid = document.createElement('video');
                             vid.src = this.src;
                             vid.controls = true;
                             vid.autoplay = true;
                             vid.style.cssText = 'max-width:95%; max-height:95%; object-fit:contain; border-radius:8px; box-shadow:0 10px 50px rgba(0,0,0,0.8);';
                             overlay.appendChild(vid);
                             document.body.appendChild(overlay);
                             overlay.onclick = (e) => {
                               if (e.target === overlay || e.target === vid) {
                                 vid.pause();
                                 overlay.remove();
                               }
                             };
                           "></video>
                  `:`
                    <img src="${n}" 
                         style="width:90px; height:90px; object-fit:cover; border-radius:12px; cursor:zoom-in; border:2px solid var(--blue); box-shadow: 0 4px 15px rgba(0,0,0,0.2)" 
                         onclick="
                           const overlay = document.createElement('div');
                           overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:999999; display:flex; justify-content:center; align-items:center; cursor:zoom-out;';
                           const img = document.createElement('img');
                           img.src = this.src;
                           img.style.cssText = 'max-width:95%; max-height:95%; object-fit:contain; border-radius:8px; box-shadow:0 10px 50px rgba(0,0,0,0.8);';
                           overlay.appendChild(img);
                           document.body.appendChild(overlay);
                           overlay.onclick = () => overlay.remove();
                         ">
                  `}).join(``)}
            </div>`})()}
        ${e.ubicacion?`<div class="fi-loc" style="font-size:11px; color:var(--blue); margin-top:6px;">📍 ${e.ubicacion}</div>`:e.body.includes(`📍`)?`<div class="fi-loc">${e.body.split(`📍`)[1]}</div>`:``}
        <div class="fi-actions">
           <button class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="verReporte('${e.id}')">Gestionar →</button>
        </div>
      `,l.appendChild(t)}),o&&typeof window.savedScrollTop==`number`&&setTimeout(()=>{o.scrollTop=window.savedScrollTop},50),r(()=>import(`./maps-Brdr0nWp.js`).then(e=>e.a).then(t=>t.updateWspMapMarkers(e,{[e]:b})),__vite__mapDeps([0,1,2])).catch(()=>{})}catch(e){if(e.name===`AbortError`){console.log(`Carga del feed cancelada (nueva petición en curso).`);return}console.error(`Error al cargar el feed:`,e),l.innerHTML=`<div style="text-align:center;padding:40px;color:var(--red)">Error cargando feed<br><span style="font-size:11px;color:var(--text-muted)">${e.message||e}</span></div>`}}function d(e){u(e)}window.switchWspGroup=d;async function f(e){try{let n=await t.getWhatsappStats(e?{signal:e}:{});if(n&&n.porGerencia){let e=[];try{e=await t.getGerencias()}catch(e){console.warn(`No se pudo obtener listado de gerencias para consolidar en wsp stats:`,e)}let r={},i={};e&&e.length>0?e.forEach(e=>{e.esSubArea&&e.parentClave&&(r[e.clave]=e.parentClave)}):(r.fiscalizacion=`fiscalizacion_transporte`,r.transporte=`fiscalizacion_transporte`,r.serenazgo=`seguridad`),n.porGerencia.forEach(e=>{let t=r[e.area];t&&(i[t]=(i[t]||0)+(e.total||0)),i[e.area]=(i[e.area]||0)+(e.total||0)}),Object.entries(i).forEach(([e,t])=>{let n=document.getElementById(`wsp-count-${e}`);n&&(n.textContent=`${t||0} reportes`)}),document.querySelectorAll(`.wsp-card-info`).forEach(e=>{let t=e.getAttribute(`id`)||``;t.startsWith(`wsp-count-`)&&i[t.replace(`wsp-count-`,``)]===void 0&&(e.textContent=`0 reportes`)})}let r=document.getElementById(`wsp-trending`);r&&n.tendencias&&(r.innerHTML=``,n.tendencias.length===0?r.innerHTML=`<div style="font-size:10px;color:var(--text-muted)">No hay suficientes reportes hoy para marcar tendencias</div>`:n.tendencias.forEach(e=>{let t=document.createElement(`div`);t.className=`trending-tag`,t.innerHTML=`${e.tema} <span class="tt-count">${e.total}</span>`,r.appendChild(t)}))}catch(e){if(e.name===`AbortError`)return;console.error(`Error actualizando stats wsp:`,e)}}function p(e){document.querySelectorAll(`#tabs-whatsapp .tab`).forEach(e=>e.classList.remove(`active`)),document.querySelectorAll(`#view-whatsapp .tab-content`).forEach(e=>e.classList.remove(`active`));let t=document.querySelector(`#tabs-whatsapp .tab[onclick*="'${e}'"]`),n=document.getElementById(`wsp-tab-${e}`);t&&t.classList.add(`active`),n&&n.classList.add(`active`),e===`feed`&&f(),e===`reportes`&&b(),r(()=>import(`./maps-Brdr0nWp.js`).then(e=>e.a).then(e=>e.initMapWsp()),__vite__mapDeps([0,1,2])).catch(()=>{})}window.switchWspTab=p;async function m(){let e=document.getElementById(`wsp-status-container`);if(!e)return;let n=e.querySelector(`.group-mgmt-list`),r=n?n.scrollTop:0;try{let n=await t.getWhatsappStatus();if(n.isAuthenticated){e.innerHTML=`
        <div style="color:var(--green);margin-bottom:16px">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h4 style="font-size:20px;margin-bottom:8px">Conectado con Éxito</h4>
        <p style="color:var(--text-dim)">El bot está activo y procesando mensajes en tiempo real.</p>
        
        <div style="margin-top:24px; font-size:12px; padding:16px; background:rgba(255,255,255,0.05); border-radius:12px; text-align:left;">
           <div style="margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; font-weight:bold; color:var(--blue); display:flex; justify-content:space-between; align-items:center;">
             <span>📊 Gestión de Grupos Detectados (${n.totalGroups||0})</span>
             <span style="font-size:10px; font-weight:normal; color:var(--text-dim)">${n.monitoredCount||0} activos</span>
           </div>
           <div class="group-mgmt-list" style="max-height:300px; overflow-y:auto; padding-right:8px;">
             ${n.connectedGroups&&n.connectedGroups.length>0?n.connectedGroups.map(e=>`
                  <div class="group-mgmt-item" style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:8px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid ${e.isMonitored?`rgba(52,211,153,0.2)`:`rgba(255,255,255,0.05)`}">
                    <div style="flex:1">
                      <div style="font-weight:600; font-size:12px; color:var(--text-bright); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${e.name}">${e.name}</div>
                      <div style="font-size:9px; color:var(--text-dim); font-family:monospace;">${e.id}</div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:8px">
                      <select class="filter-select" style="font-size:10px; padding:4px 8px; height:auto; width:130px" onchange="cambiarAreaGrupo('${e.id}', '${e.name}', this.value)">
                        ${(window.allGerencias||[]).map(t=>`
                          <option value="${t.clave}" ${e.area===t.clave?`selected`:``}>${t.nombre}</option>
                        `).join(``)}
                        <option value="otros" ${e.area===`otros`||!e.area?`selected`:``}>Otros / Sin Vinc.</option>
                      </select>
                      
                      <button class="btn ${e.isMonitored?`btn-primary`:`btn-ghost`}" 
                              style="font-size:9px; padding:4px 10px; height:auto; min-width:70px; ${e.isMonitored?`background:var(--green); border-color:var(--green)`:``}" 
                              onclick="toggleGrupoMonitoreo('${e.id}', '${e.name}', ${!e.isMonitored})">
                        ${e.isMonitored?`ACTIVO`:`IGNORAR`}
                      </button>
                    </div>
                  </div>
                 `).join(``):`<div style="color:var(--text-dim);text-align:center;padding:20px;">No se detectaron grupos aún. Asegúrate de que el bot esté en grupos de WhatsApp.</div>`}
           </div>
           <div style="margin-top:12px; font-size:9px; color:var(--text-muted); text-align:center;">
             💡 Cambia la gerencia para clasificar reportes o usa el botón para habilitar/deshabilitar el monitoreo.
           </div>
        </div>

        <button class="btn btn-ghost" style="margin-top:24px;color:var(--red)" onclick="desconectarWsp()">Desconectar</button>
      `;let t=e.querySelector(`.group-mgmt-list`);t&&(t.scrollTop=r)}else n.qrCode?e.innerHTML=`
        <div style="background:white;padding:16px;border-radius:12px;margin-bottom:16px; display:inline-block">
          <img src="${n.qrCode}" alt="QR Code" style="display:block;width:200px;height:200px">
        </div>
        <h4 style="font-size:18px;margin-bottom:8px">Escanea el código QR</h4>
        <p style="color:var(--text-dim);font-size:13px">Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular un dispositivo.</p>
        <div style="margin-top:16px;font-size:11px;color:var(--amber); animation: pulse 2s infinite">● Esperando escaneo...</div>
      `:e.innerHTML=`
        <div class="spinner" style="margin-bottom:16px"></div>
        <h4 style="font-size:18px;margin-bottom:8px">Iniciando Servidor...</h4>
        <p style="color:var(--text-dim); margin-bottom: 8px;">Generando nueva sesión de conexión o cargando recursos.</p>
        <div style="font-size:11px; color:var(--blue); background:rgba(79,143,247,0.1); padding:8px 12px; border-radius:6px; display:inline-block; border:1px solid rgba(79,143,247,0.2)">
          🤖 <b>Log del Bot:</b> ${n.lastLog||`Iniciando...`}
        </div>
      `}catch{e.innerHTML=`<div style="color:var(--red)">Error al conectar con el servidor de WhatsApp</div>`}}window.desconectarWsp=async()=>{confirm(`¿Deseas cerrar la sesión de WhatsApp?`)&&(await t.request(`/whatsapp/logout`,{method:`POST`}),m())},window.cambiarAreaGrupo=async(e,n,r)=>{try{await t.vincularGrupo({remoteId:e,nombre:n,areaId:r}),m()}catch{alert(`Error al vincular grupo`)}},window.toggleGrupoMonitoreo=async(e,n,r)=>{try{await t.vincularGrupo({remoteId:e,nombre:n,monitoreado:r}),m()}catch{alert(`Error al cambiar estado de monitoreo`)}};async function h(){let e=document.getElementById(`reportes-lista`),n=document.getElementById(`reportes-kpis`);if(e)try{let r=document.getElementById(`rpt-filtro-grupo`),i=t.getUser();r&&(i&&i.rol===`admin`?r.style.display=`inline-block`:(r.style.display=`none`,r.value=`todos`));let a=document.getElementById(`rpt-filtro-estado`)?.value||`todos`,o=r?.value||`todos`,s=document.getElementById(`rpt-filtro-prioridad`)?.value||`todas`,c=(document.getElementById(`rpt-filtro-personal`)?.value||``).toLowerCase(),l=document.getElementById(`filter-from`)?.value,u=document.getElementById(`filter-to`)?.value,{reportes:d,stats:f}=await t.getWhatsappReportes({estado:a,grupo:o,prioridad:s,from:l,to:u}),p=document.getElementById(`filter-sector`)?.value||`all`;if(p!==`all`&&p!==`todos`){let e=p.trim().toLowerCase();d=d.filter(t=>(t.sector||``).trim().toLowerCase()===e)}let m=document.getElementById(`filter-area`)?.value||`all`;if(m!==`all`&&m!==`todos`){let e=m.trim().toLowerCase();d=d.filter(t=>t.grupo===e||t.areasDerivadas&&t.areasDerivadas.some(t=>t.trim().toLowerCase()===e))}c&&(d=d.filter(e=>(e.reportadoPor||``).toLowerCase().includes(c)));let h=f?f.nuevo:d.filter(e=>e.estado===`nuevo`).length,g=document.getElementById(`reportes-badge`);if(g&&(g.textContent=h,g.style.display=h>0?`inline-block`:`none`),n&&f&&(n.innerHTML=`
        <div class="card card-accent" style="border-left-color:var(--red)"><div class="card-label">Nuevos</div><div class="card-value">${f.nuevo||0}</div></div>
        <div class="card card-accent" style="border-left-color:var(--amber)"><div class="card-label">En Proceso</div><div class="card-value">${f.en_proceso||0}</div></div>
        <div class="card card-accent" style="border-left-color:var(--green)"><div class="card-label">Atendidos</div><div class="card-value">${f.atendido||0}</div></div>
        <div class="card card-accent" style="border-left-color:var(--blue)"><div class="card-label">Total</div><div class="card-value">${f.total||0}</div></div>
      `),d.length===0){e.innerHTML=`<div style="text-align:center;padding:60px;background:var(--glass);border-radius:12px;color:var(--text-dim)">No se encontraron reportes con los filtros seleccionados</div>`;return}e.innerHTML=`
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Detalle de Incidencia</th>
              <th>Enviado Por</th>
              <th>Área / Categoría</th>
              <th>Prioridad</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${d.map(e=>`
              <tr class="${e.estado===`nuevo`?`row-new`:``}" onclick="verReporte('${e.id}')" style="cursor:pointer">
                <td style="font-family:monospace;font-size:10px">${e.idString||e.id}</td>
                <td><div style="font-size:11px">${new Date(e.fecha).toLocaleDateString()}</div><div style="font-size:9px;color:var(--text-dim)">${new Date(e.fecha).toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`})}</div></td>
                <td><div style="font-size:11px; max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--blue)" title="${e.mensaje}">${e.mensaje}</div></td>
                <td>
                  <div style="font-size:11px; font-weight:600; color:var(--text-color)">${e.reportadoPor||`Usuario Móvil`}</div>
                  ${(()=>{let t=e.mensaje||``,n=``;return t.includes(`[MOTORIZADO]`)?n=`MOTORIZADO`:t.includes(`[SCOOTER]`)?n=`SCOOTER`:t.includes(`[CICLISTA]`)?n=`CICLISTA`:t.includes(`[A PIE]`)?n=`A PIE`:t.includes(`[SUPERVISOR]`)?n=`SUPERVISOR`:t.includes(`[COORDINADOR]`)?n=`COORDINADOR`:(t.includes(`[MÓVIL]`)||t.includes(`[MOVIL]`))&&(n=`MÓVIL`),n?`<span class="badge badge-gray" style="font-size:9px; margin-top:2px; background:rgba(6, 182, 212, 0.15); color:#06b6d4; border:1px solid rgba(6, 182, 212, 0.3)">${n}</span>`:``})()}
                </td>
                <td>
                  <span class="badge badge-gray" style="font-size:9px">${(e.grupo||`otros`).toUpperCase()}</span>
                  <div style="font-weight:600;font-size:10px;margin-top:2px">${e.categoria||`Sin Clasificar`}</div>
                </td>
                <td><span class="badge ${e.prioridad===`Alta`?`badge-red`:e.prioridad===`Media`?`badge-amber`:`badge-green`}">${e.prioridad}</span></td>
                <td><span class="status-pill status-${e.estado}">${e.estado.replace(`_`,` `)}</span></td>
              </tr>
            `).join(``)}
          </tbody>
        </table>
      </div>
    `}catch{e.innerHTML=`<div style="color:var(--red)">Error cargando reportes</div>`}}window.loadReportes=h;async function g(e,r){try{await t.updateReporte(e,{estado:r}),n(`Reporte ${e}: estado cambiado a ${r}`),b()}catch{alert(`Error al actualizar estado`)}}window.cambiarEstadoReporte=g;async function _(e){let r=document.getElementById(`reporte-modal`),i=document.getElementById(`reporte-modal-content`);if(!(!r||!i))try{let o=await t.getWhatsappReporte(e),s=o.grupo,c=``,l=(window.allGerencias||[]).find(e=>e.clave===o.grupo);if(l&&l.esSubArea&&l.parentClave)s=l.parentClave,c=l.clave;else{let e=(o.areasDerivadas||[]).find(e=>{let t=(window.allGerencias||[]).find(t=>t.clave===e);return t&&t.esSubArea});e&&(c=e)}i.innerHTML=`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h2 style="font-size:18px;margin-bottom:2px">Reporte ${o.idString||o.id}</h2>
          <div style="font-size:11px;color:var(--text-dim)">${new Date(o.fecha).toLocaleString()}</div>
        </div>
        <span class="status-pill status-${o.estado}" id="modal-status-badge" style="font-size:11px;padding:5px 10px">${o.estado.replace(`_`,` `).toUpperCase()}</span>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="card" style="padding:10px; background:rgba(255,255,255,0.02)">
          <div style="font-size:9px; color:var(--text-muted); font-weight:700; margin-bottom:4px;">DATOS DEL CIUDADANO</div>
          <div style="font-size:12px; margin-bottom:2px">👤 ${o.reportadoPor}</div>
          <div style="font-size:11px; color:var(--blue)">📱 ${o.telefono||`No disponible`}</div>
        </div>
        <div class="card" style="padding:10px; background:rgba(255,255,255,0.02)">
          <div style="font-size:9px; color:var(--text-muted); font-weight:700; margin-bottom:4px;">CLASIFICACIÓN</div>
          <div style="font-size:12px; margin-bottom:2px">📁 Area: ${(o.grupo||`otros`).toUpperCase()}</div>
          <div style="font-size:11px; font-weight:600">🏷️ ${o.categoria||`Sin Clasificar`}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: ${a(o.fotoUrl).length>0?`1fr 200px`:`1fr`}; gap:12px; margin-bottom:12px;">
        <div>
          <div style="font-size:9px; color:var(--text-muted); font-weight:700; margin-bottom:4px;">MENSAJE RECIBIDO</div>
          <textarea id="edit-mensaje-${o.id}" style="width:100%; padding:10px; background:var(--glass); border-radius:8px; font-size:12px; line-height:1.4; border-left:3px solid var(--blue); border-top:none; border-right:none; border-bottom:none; height:100%; min-height:60px; resize:vertical; outline:none;">${o.mensaje}</textarea>
        </div>
        ${(()=>{let e=o.fotos&&o.fotos.length>0?o.fotos:a(o.fotoUrl);return e.length===0?``:`
          <div>
            <div style="font-size:9px; color:var(--text-muted); font-weight:700; margin-bottom:4px;">EVIDENCIAS</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:6px; background:rgba(0,0,0,0.1); border-radius:8px; padding:6px; border:1px solid rgba(255,255,255,0.05)">
              ${e.map(e=>{let t=e.startsWith(`data:video/`)||e.endsWith(`.mp4`)||e.endsWith(`.mov`)||e.endsWith(`.avi`)||e.endsWith(`.webm`)||e.includes(`/video/`)||e.includes(`.mp4`)||e.includes(`.mov`),n=e.startsWith(`http`)||e.startsWith(`data:`)||e.startsWith(`/uploads/`)?e:t?`data:video/mp4;base64,`+e:`data:image/jpeg;base64,`+e;return t?`
                    <video src="${n}" 
                           style="width:100%; height:80px; object-fit:cover; border-radius:6px; cursor:zoom-in; box-shadow:0 6px 20px rgba(0,0,0,0.4)"
                           onclick="
                             const overlay = document.createElement('div');
                             overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:999999; display:flex; justify-content:center; align-items:center; cursor:zoom-out;';
                             const vid = document.createElement('video');
                             vid.src = this.src;
                             vid.controls = true;
                             vid.autoplay = true;
                             vid.style.cssText = 'max-width:95%; max-height:95%; object-fit:contain; border-radius:8px; box-shadow:0 10px 50px rgba(0,0,0,0.8);';
                             overlay.appendChild(vid);
                             document.body.appendChild(overlay);
                             overlay.onclick = (e) => {
                               if (e.target === overlay || e.target === vid) {
                                 vid.pause();
                                 overlay.remove();
                               }
                             };
                           "></video>
                  `:`
                    <img src="${n}" 
                         style="width:100%; height:80px; object-fit:cover; border-radius:6px; cursor:zoom-in; box-shadow:0 6px 20px rgba(0,0,0,0.4)" 
                         onclick="
                           const overlay = document.createElement('div');
                           overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:999999; display:flex; justify-content:center; align-items:center; cursor:zoom-out;';
                           const img = document.createElement('img');
                           img.src = this.src;
                           img.style.cssText = 'max-width:95%; max-height:95%; object-fit:contain; border-radius:8px; box-shadow:0 10px 50px rgba(0,0,0,0.8);';
                           overlay.appendChild(img);
                           document.body.appendChild(overlay);
                           overlay.onclick = () => overlay.remove();
                         ">
                  `}).join(``)}
            </div>
          </div>`})()}
      </div>

      <div style="margin-bottom:12px; padding:12px; background:rgba(79,143,247,0.05); border-radius:10px; border:1px solid rgba(79,143,247,0.2)">
        <div style="font-size:9px; color:var(--blue); font-weight:800; margin-bottom:8px;">📍 UBICACIÓN Y GESTIÓN</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
           <div>
             <label style="display:block;font-size:9px;margin-bottom:2px">Dirección:</label>
             <input type="text" class="filter-select" id="edit-ubicacion-${o.id}" value="${o.ubicacion||``}" style="width:100%" placeholder="Ej: Av. Central 123">
           </div>
           <div>
             <label style="display:block;font-size:9px;margin-bottom:2px">Estado del Reporte:</label>
             <select class="filter-select" id="edit-estado-${o.id}" style="width:100%; font-weight:bold; color:var(--blue)">
               <option value="nuevo" ${o.estado===`nuevo`?`selected`:``}>🔴 Nuevo (Sin atender)</option>
               <option value="en_proceso" ${o.estado===`en_proceso`?`selected`:``}>🟡 En Proceso</option>
               <option value="atendido" ${o.estado===`atendido`?`selected`:``}>🟢 Atendido / Finalizado</option>
             </select>
           </div>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
           <div>
             <label style="display:block;font-size:9px;margin-bottom:2px">Gerencia Responsable:</label>
             <select class="filter-select" id="edit-grupo-${o.id}" style="width:100%" onchange="window.onParentGerenciaChange('${o.id}', this.value)">
               ${(window.allGerencias||[]).filter(e=>!e.esSubArea).map(e=>`
                 <option value="${e.clave}" ${s===e.clave?`selected`:``}>${e.nombre}</option>
               `).join(``)}
               <option value="otros" ${s===`otros`?`selected`:``}>Otros</option>
             </select>
           </div>
           <div>
             <label style="display:block;font-size:9px;margin-bottom:2px;color:var(--text-dim)">Coordenadas (Lat/Lng):</label>
             <div style="display:flex; gap:4px">
               <input type="number" step="any" class="filter-select" id="edit-lat-${o.id}" value="${o.lat||``}" style="width:100%" placeholder="Latitud">
               <input type="number" step="any" class="filter-select" id="edit-lng-${o.id}" value="${o.lng||``}" style="width:100%" placeholder="Longitud">
             </div>
           </div>
        </div>

        <div id="edit-subgerencia-wrap-${o.id}" style="margin-top:8px; display:none;">
          <label style="display:block;font-size:9px;margin-bottom:2px">Subgerencia Responsable:</label>
          <select class="filter-select" id="edit-subgerencia-${o.id}" style="width:100%">
            <option value="">(Seleccionar Subgerencia)</option>
          </select>
        </div>
        
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-primary" style="flex:2; height:36px; font-weight:bold; font-size:11px" onclick="guardarUbicacion('${o.id}')">GUARDAR CAMBIOS</button>
          <button class="btn btn-ghost" style="flex:1; height:36px; font-size:10px; border-color:var(--green); color:var(--green)" onclick="autolocalizarGps('${o.id}')">Autolocalizar GPS</button>
          <button class="btn btn-ghost" style="flex:1; height:36px; font-size:10px; border-color:var(--red); color:var(--red)" onclick="eliminarReporte('${o.id}')">Eliminar</button>
        </div>
      </div>

      <div style="font-size:9px; color:var(--text-dim); margin-bottom:3px">Mapa Interactivo (Haz clic para señalar lugar exacto y obtener dirección)</div>
      <div id="mini-map-${o.id}" style="height:220px; border-radius:10px; margin-bottom:6px; border:1px solid var(--border-light); cursor:crosshair; box-shadow: inset 0 0 10px rgba(0,0,0,0.5)"></div>
    `,r.classList.add(`show`),setTimeout(()=>{let e=parseFloat(o.lat)||-12.0435,t=parseFloat(o.lng)||-77.0955;if(!document.getElementById(`mini-map-${o.id}`))return;let r=L.map(`mini-map-${o.id}`).setView([e,t],17);L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`,{attribution:`&copy; CARTO`}).addTo(r);let i=null;o.lat&&o.lng&&(i=L.marker([e,t]).addTo(r)),window._currentMiniMap=r,window._currentMarker=i,r.on(`click`,async e=>{await a(o.id,e.latlng.lat,e.latlng.lng,r)});async function a(e,t,n,r){document.getElementById(`edit-lat-${e}`).value=t.toFixed(6),document.getElementById(`edit-lng-${e}`).value=n.toFixed(6),window._currentMarker?window._currentMarker.setLatLng([t,n]):window._currentMarker=L.marker([t,n]).addTo(r);try{let r=new AbortController,i=setTimeout(()=>r.abort(),4e3),a=await(await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${t}&lon=${n}&format=json&accept-language=es`,{signal:r.signal})).json();if(clearTimeout(i),a&&a.address){let t=a.address,n=``;t.road?(n=t.road,t.house_number&&(n+=` `+t.house_number)):n=t.amenity||t.building||t.pedestrian?t.amenity||t.building||t.pedestrian:a.display_name.split(`,`)[0];let r=t.suburb||t.neighbourhood||t.city_district;r&&!n.includes(r)&&(n+=`, `+r),document.getElementById(`edit-ubicacion-${e}`).value=n}}catch{console.warn(`No se pudo obtener la dirección automática`)}}window.autolocalizarGps=e=>{if(!navigator.geolocation){alert(`Tu navegador no soporta geolocalización`);return}let t=event.target,r=t.textContent;t.textContent=`⌛ Localizando...`,t.disabled=!0,navigator.geolocation.getCurrentPosition(async i=>{let{latitude:o,longitude:s}=i.coords;await a(e,o,s,window._currentMiniMap),window._currentMiniMap.setView([o,s],17),t.textContent=r,t.disabled=!1,n(`GPS: Ubicación capturada para reporte `+e)},e=>{alert(`Error al obtener GPS: `+e.message),t.textContent=r,t.disabled=!1},{enableHighAccuracy:!0,timeout:5e3})},setTimeout(()=>r.invalidateSize(),300)},50),setTimeout(()=>{if(window.onParentGerenciaChange(o.id,s),c){let e=document.getElementById(`edit-subgerencia-${o.id}`);e&&(e.value=c)}},80),n(`Detalle reporte: ${o.id}`)}catch(e){console.error(`Error cargando detalle:`,e),alert(`No se pudo cargar el detalle del reporte.`)}}window.verReporte=_,window.onParentGerenciaChange=(e,t)=>{let n=document.getElementById(`edit-subgerencia-wrap-${e}`),r=document.getElementById(`edit-subgerencia-${e}`);if(!n||!r)return;let i=(window.allGerencias||[]).filter(e=>e.esSubArea&&e.parentClave===t);i.length>0?(n.style.display=`block`,r.innerHTML=`
      <option value="">(Seleccionar Subgerencia)</option>
      ${i.map(e=>`<option value="${e.clave}">${e.nombre}</option>`).join(``)}
    `):(n.style.display=`none`,r.innerHTML=`<option value="">(No aplica)</option>`,r.value=``)};function v(){document.getElementById(`reporte-modal`).classList.remove(`show`)}window.cerrarReporteModal=v;function y(){h()}window.filtrarReportes=y;async function b(){n(`Reportes: actualización automática/manual`),await h(),o&&await u(o,!0),window.reloadMapReportes&&window.reloadMapReportes().catch(()=>{})}window.refreshReportes=b;var x=!1;function S(){x||(x=!0,setInterval(()=>{b(),window.loadNotifications&&window.loadNotifications()},1e4))}async function C(e){try{let i=document.getElementById(`edit-lat-${e}`).value,a=document.getElementById(`edit-lng-${e}`).value,c=document.getElementById(`edit-ubicacion-${e}`).value,l=document.getElementById(`edit-grupo-${e}`).value,u=document.getElementById(`edit-subgerencia-${e}`),d=u?u.value:``,f=document.getElementById(`edit-estado-${e}`).value,p=document.getElementById(`edit-mensaje-${e}`).value,m=[l];d&&m.push(d),await t.updateReporte(e,{lat:i?parseFloat(i):null,lng:a?parseFloat(a):null,ubicacion:c,grupo:l,estado:f,mensaje:p,areasDerivadas:m}),n(`Reporte ${e}: mensaje, ubicación y estado (${f}) actualizados.`),v(),await b(),r(()=>import(`./maps-Brdr0nWp.js`).then(e=>e.a).then(e=>{e.updateWspMapMarkers(o,s)}),__vite__mapDeps([0,1,2])).catch(()=>{})}catch(e){console.error(`Error guardando ubicacion:`,e),alert(`Error al guardar los cambios.`)}}window.guardarUbicacion=C,window.exportarMantenimiento=async function(e=`todos`){let r=e===`todos`,i=r?`-global`:`-${e}`,a=document.getElementById(`mnt-mes${i}`).value,o=document.getElementById(`mnt-anio${i}`).value,s=`/api/whatsapp/export/${o}/${a}?grupo=${e}&format=json`;try{let i=await fetch(s,{headers:{Authorization:`Bearer ${t.getToken()}`}});if(!i.ok)throw Error(`No hay datos para este periodo o error en servidor`);let c=await i.json();if(!c||c.length===0)throw Error(`No hay datos para este periodo`);let l=c.map(e=>{let t=new Date;if(e.fecha){let n=new Date(e.fecha);isNaN(n.getTime())||(t=n)}let n=[`domingo`,`lunes`,`martes`,`miércoles`,`jueves`,`viernes`,`sábado`][t.getDay()],r=t.getHours(),i=t.getMinutes().toString().padStart(2,`0`),a=`${r.toString().padStart(2,`0`)}:${i}`,o=e.lat&&e.lng?`${e.lat}, ${e.lng}`:``;return{"ID REPORTE":e.idString||e.id,FECHA:t.toLocaleDateString(`es-PE`),DÍA:n.toUpperCase(),HORA:a,GERENCIA:(e.grupo||``).toUpperCase(),CATEGORÍA:(e.categoria||``).toUpperCase(),"MENSAJE / NOVEDAD":e.mensaje||``,PRIORIDAD:(e.prioridad||``).toUpperCase(),ESTADO:(e.estado||`NUEVO`).toUpperCase(),"SECTOR / ZONA":(e.sector||``).toUpperCase(),DIRECCIÓN:(e.ubicacion||``).toUpperCase(),COORDENADAS:o,"REPORTADO POR":(e.reportadoPor||``).toUpperCase(),TELÉFONO:e.telefono||``}}),u=XLSX.utils.book_new(),d=XLSX.utils.json_to_sheet(l);d[`!cols`]=Object.keys(l[0]||{}).map(e=>{let t=e.length;return l.forEach(n=>{let r=n[e]?n[e].toString():``;r.length>t&&(t=r.length)}),{wch:Math.min(t+3,50)}});let f=r?`Global`:e.toUpperCase();XLSX.utils.book_append_sheet(u,d,`Respaldo_`+f),XLSX.writeFile(u,`Respaldo_SGTI_${f}_${o}_${a}.xlsx`),n(`Respaldo descargado en Excel (${f}): ${a}/${o}`)}catch(e){alert(e.message)}},window.limpiarMantenimiento=async function(e=`todos`){let r=e===`todos`,i=r?`-global`:`-${e}`,a=document.getElementById(`mnt-mes${i}`).value,o=document.getElementById(`mnt-anio${i}`).value,s=r?`Toda la Municipalidad`:window.gerenciasNombres[e]||e;if(confirm(`¿ESTÁS SEGURO? Esta acción eliminará PERMANENTEMENTE todas las incidencias de ${a}/${o} asociadas a la gerencia: "${s.toUpperCase()}".`))try{let r=await t.deleteWhatsappPurge(o,a,e);alert(r.message),n(`Limpieza de base de datos ejecutada para ${s}: ${a}/${o}`),b()}catch(e){alert(`Error al limpiar: `+e.message)}},window.limpiarDemo=async function(){if(confirm(`¿Deseas eliminar los reportes de prueba antiguos y limpiar las tablas de demostración?

Solo se mantendrán los reportes generados hoy.`))try{let e=await t.request(`/whatsapp/cleanup-demo`,{method:`DELETE`});alert(e.message),n(`Limpieza de datos demo ejecutada`),b()}catch(e){alert(`Error al limpiar demo: `+e.message)}};async function w(e){if(confirm(`¿Estás seguro de que deseas eliminar este reporte de forma permanente?`))try{await t.deleteReporte(e),n(`Reporte ${e} eliminado por el usuario`),v(),b()}catch(e){alert(`Error al eliminar reporte: `+e.message)}}window.eliminarReporte=w;export{l as a,S as c,_ as d,i as f,y as i,d as l,v as n,b as o,o as r,u as s,g as t,p as u};