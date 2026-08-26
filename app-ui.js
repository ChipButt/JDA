function setView(v){view=v;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#fab').hidden=false;if(v==='home')home();if(v==='dogs')allDogs();if(v==='walks')walkingSchedule();if(v==='sitting')sittingCalendar();if(v==='route')route();scrollTo(0,0)}
function addSlot(box,x={day:'Monday',time:''}){const r=$('#schedule-row-template').content.firstElementChild.cloneNode(true);r.querySelector('.slot-day').value=x.day||'Monday';r.querySelector('.slot-time').value=x.time||'';r.querySelector('.remove-slot').onclick=()=>r.remove();box.append(r)}
function readSlots(box){return [...box.querySelectorAll('.schedule-row')].map(r=>({day:r.querySelector('.slot-day').value,time:r.querySelector('.slot-time').value})).filter(x=>x.time)}
function addSitDateRow(x={id:'',date:'',time:''}){const r=$('#sit-date-row-template').content.firstElementChild.cloneNode(true);r.dataset.id=x.id||uid();r.querySelector('.sit-date').value=x.date||'';r.querySelector('.sit-date-time').value=x.time||'';r.querySelector('.remove-sit-date').onclick=()=>r.remove();sitDateRows.append(r)}
function readSitDates(){return [...sitDateRows.querySelectorAll('.sit-date-row')].map(r=>({id:r.dataset.id||uid(),date:r.querySelector('.sit-date').value,time:r.querySelector('.sit-date-time').value})).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99'))}
function photo(src=''){const img=$('#photo-preview'),ph=$('#photo-placeholder');$('#photo-data').value=src;if(src){img.src=src;img.hidden=false;ph.hidden=true}else{img.hidden=true;ph.hidden=false;img.removeAttribute('src')}}
function editDog(d=null){
  $('#dog-form').reset();walkSlots.innerHTML='';sitSlots.innerHTML='';sitDateRows.innerHTML='';
  $('#dog-id').value=d?.id||'';$('#dog-form-title').textContent=d?'Edit dog':'Add dog';$('#delete-dog').hidden=!d;
  $('#name').value=d?.name||'';$('#breed').value=d?.breed||'';$('#age').value=d?.age||'';$('#owner').value=d?.owner||'';$('#address-line1').value=d?.addressLine1||'';$('#address-town').value=d?.addressTown||'';$('#address-county').value=d?.addressCounty||'';$('#address-postcode').value=d?.addressPostcode||'';$('#key-info').value=d?.keyInfo||'';$('#special').value=d?.special||'';$('#other').value=d?.other||'';
  walkOn.checked=!!d?.walking;sitOn.checked=!!d?.sitting;walkEditor.hidden=!walkOn.checked;sitEditor.hidden=!sitOn.checked;
  $('#good-with-dogs').checked=!!d?.goodWithDogs;$('#off-lead').checked=!!d?.offLead;$('#allowed-furniture').checked=!!d?.allowedFurniture;
  (d?.walkSchedule||[]).forEach(x=>addSlot(walkSlots,x));(d?.sitSchedule||[]).forEach(x=>addSlot(sitSlots,x));(d?.sitDates||[]).forEach(x=>addSitDateRow(x));
  photo(d?.photo||'');dogDlg.showModal();
}
async function saveDog(){
  const name=$('#name').value.trim();if(!name){$('#name').focus();return toast('Please add the dog’s name')}
  const id=$('#dog-id').value||uid(),dog={id,photo:$('#photo-data').value,name,breed:$('#breed').value.trim(),age:$('#age').value.trim(),owner:$('#owner').value.trim(),addressLine1:$('#address-line1').value.trim(),addressTown:$('#address-town').value.trim(),addressCounty:$('#address-county').value.trim(),addressPostcode:cleanPostcode($('#address-postcode').value),keyInfo:$('#key-info').value.trim(),special:$('#special').value.trim(),other:$('#other').value.trim(),walking:walkOn.checked,walkSchedule:walkOn.checked?readSlots(walkSlots):[],sitting:sitOn.checked,sitSchedule:sitOn.checked?readSlots(sitSlots):[],sitDates:readSitDates(),goodWithDogs:$('#good-with-dogs').checked,offLead:$('#off-lead').checked,allowedFurniture:$('#allowed-furniture').checked};
  const exists=dogs.some(x=>x.id===id);await saveDogRecord(dog);dogDlg.close();routeDraft=null;setView(view==='route'?'home':view);toast(exists?'Dog updated':'Dog added');
}
function detail(id){
  const d=dogs.find(x=>x.id===id);if(!d)return;
  const fmt=s=>s?.length?s.map(x=>`${x.day} · ${x.time||'Any time'}`).join('\n'):'No times saved';
  const fmtDates=s=>s?.length?s.map(x=>`${prettyDate(x.date,{day:'numeric',month:'short',year:'numeric'})}${x.time?` · ${x.time}`:''}`).join('\n'):'No one-off dates saved';
  const sittingPrefs=d.sitting?`<div class="info-box wide"><small>Sitting preferences</small><div class="preference-summary"><span class="${d.goodWithDogs?'yes':'no'}">Good with other dogs: ${d.goodWithDogs?'Yes':'No'}</span><span class="${d.offLead?'yes':'no'}">Off lead: ${d.offLead?'Yes':'No'}</span><span class="${d.allowedFurniture?'yes':'no'}">Allowed on furniture: ${d.allowedFurniture?'Yes':'No'}</span></div></div>`:'';
  detailDlg.innerHTML=`<div class="sheet-head"><p class="eyebrow">DOG PROFILE</p><button class="close-button" data-close-detail>×</button></div><div class="detail-hero">${avatar(d)}<h2>${esc(d.name)}</h2><p>${esc([d.breed,d.age].filter(Boolean).join(' · ')||'Dog profile')}</p><div class="tag-row" style="justify-content:center">${tags(d)}</div></div><div class="detail-grid"><div class="info-box"><small>Owner</small><p>${esc(d.owner||'—')}</p></div><div class="info-box"><small>Entry instructions</small><p>${esc(d.keyInfo||'—')}</p></div><div class="info-box wide"><small>Address</small><p>${esc(fullAddress(d)||'—')}</p></div>${d.walking?`<div class="info-box wide"><small>Walk schedule</small><p>${esc(fmt(d.walkSchedule))}</p></div>`:''}${d.sitting?`<div class="info-box wide"><small>Regular sitting</small><p>${esc(fmt(d.sitSchedule))}</p></div><div class="info-box wide"><small>One-off sitting dates</small><p>${esc(fmtDates(d.sitDates))}</p></div>${sittingPrefs}`:''}<div class="info-box wide"><small>Special requirements</small><p>${esc(d.special||'—')}</p></div><div class="info-box wide"><small>Other info</small><p>${esc(d.other||'—')}</p></div></div><div class="detail-actions">${hasAddress(d)?'<button class="secondary-button" data-map>Open address</button>':''}<button class="primary-button ${hasAddress(d)?'':'full'}" data-edit>Edit dog</button></div>`;
  detailDlg.querySelector('[data-close-detail]').onclick=()=>detailDlg.close();detailDlg.querySelector('[data-edit]').onclick=()=>{detailDlg.close();editDog(d)};detailDlg.querySelector('[data-map]')?.addEventListener('click',()=>map(fullAddress(d)));detailDlg.showModal();
}
function map(a){open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`,'_blank','noopener')}
function resetLocationForm(){$('#location-form').reset();$('#location-id').value='';$('#location-mode').value='';$('#delete-location').hidden=true}
function editLocation(mode='destination',id=''){
  resetLocationForm();$('#location-mode').value=mode;
  if(mode==='start'){const loc=settings.start||{};$('#location-form-title').textContent='Jess’s starting location';$('#location-name-label span').textContent='Location name';$('#location-name').placeholder='e.g. Home';$('#delete-location').hidden=true;$('#location-id').value='start';$('#location-name').value=loc.name||'';$('#location-line1').value=loc.line1||'';$('#location-town').value=loc.town||'';$('#location-county').value=loc.county||'';$('#location-postcode').value=loc.postcode||''}
  else{const loc=settings.destinations.find(x=>x.id===id)||{};$('#location-form-title').textContent=id?'Edit walking location':'Add walking location';$('#location-name-label span').textContent='Location name *';$('#location-name').placeholder='e.g. Oakfield Dog Walking Field';$('#delete-location').hidden=!id;$('#location-id').value=id||'';$('#location-name').value=loc.name||'';$('#location-line1').value=loc.line1||'';$('#location-town').value=loc.town||'';$('#location-county').value=loc.county||'';$('#location-postcode').value=loc.postcode||''}
  locationDlg.showModal();
}
async function saveLocation(){const mode=$('#location-mode').value,name=$('#location-name').value.trim(),postcode=cleanPostcode($('#location-postcode').value);if(mode!=='start'&&!name)return toast('Please add a location name');if(!postcode)return toast('Please add a postcode');const loc=normalizeLocation({id:mode==='start'?'start':($('#location-id').value||uid()),name:name||'Starting location',line1:$('#location-line1').value.trim(),town:$('#location-town').value.trim(),county:$('#location-county').value.trim(),postcode});if(mode==='start')settings.start=loc;else{const i=settings.destinations.findIndex(x=>x.id===loc.id);if(i<0)settings.destinations.push(loc);else settings.destinations[i]=loc;settings.destinations.sort((a,b)=>a.name.localeCompare(b.name))}await saveSettings();locationDlg.close();routeDraft=null;setView(view==='route'?'home':view);toast(mode==='start'?'Starting location saved':'Location saved')}
async function deleteLocation(){const mode=$('#location-mode').value;if(mode!=='destination')return;const id=$('#location-id').value,loc=settings.destinations.find(x=>x.id===id);if(!loc||!confirm(`Delete ${loc.name}?`))return;settings.destinations=settings.destinations.filter(x=>x.id!==id);await saveSettings();locationDlg.close();routeDraft=null;setView(view==='route'?'home':view);toast('Location deleted')}
async function usePhotoFile(file){if(!file)return;try{photo(await shrink(file))}catch{toast('Could not use that photo')}}
function shrink(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('Image load failed'));image.onload=()=>{const max=1200,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',0.82))};image.src=reader.result};reader.readAsDataURL(file)})}
async function backup(){const payload={version:3,storage:'IndexedDB',exportedAt:new Date().toISOString(),settings,dogs},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`jess-dog-organiser-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup exported')}
async function restore(file){if(!file)return;try{const parsed=JSON.parse(await file.text()),list=(Array.isArray(parsed)?parsed:parsed.dogs)||[];if(!Array.isArray(list))throw new Error('Bad file');const nextDogs=list.map(migrateDog),nextSettings=normalizeSettings(parsed.settings||{});if(!confirm(`Restore ${nextDogs.length} dog profile${nextDogs.length===1?'':'s'}? This replaces the data on this device.`))return;await dbClear(DOG_STORE);for(const dog of nextDogs)await dbPut(DOG_STORE,dog);dogs=nextDogs.sort((a,b)=>a.name.localeCompare(b.name));settings=nextSettings;postcodeCache={};await saveSettings();await savePostcodeCache();routeDraft=null;dataDlg.close();setView(view);toast('Backup restored')}catch{toast('That backup file could not be read')}}
async function del(){const id=$('#dog-id').value,d=dogs.find(x=>x.id===id);if(!d||!confirm(`Delete ${d.name}? This cannot be undone.`))return;await removeDogRecord(id);routeDraft=null;dogDlg.close();setView(view);toast('Dog deleted')}
function toast(m){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.append(t)}t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}

document.addEventListener('click',e=>{
  const d=e.target.closest('[data-dog]');if(d)return detail(d.dataset.dog);
  if(e.target.closest('[data-add]'))return editDog();
  const g=e.target.closest('[data-go]');if(g)return setView(g.dataset.go);
  if(e.target.closest('[data-route]')){routeDraft=null;return setView('route')}
  if(e.target.closest('[data-back]'))return setView('home');
  if(e.target.closest('[data-add-location]'))return editLocation('destination');
  if(e.target.closest('[data-edit-start]'))return editLocation('start');
  const l=e.target.closest('[data-edit-location]');if(l)return editLocation(l.dataset.locationKind==='start'?'start':'destination',l.dataset.editLocation==='start'?'':l.dataset.editLocation);
  if(e.target.closest('[data-calendar-prev]'))return changeSittingMonth(-1);
  if(e.target.closest('[data-calendar-next]'))return changeSittingMonth(1);
  const cal=e.target.closest('[data-calendar-date]');if(cal){sittingSelectedDate=cal.dataset.calendarDate;return sittingCalendar()}
  if(e.target.closest('[data-add-sitting-booking]'))return openSittingBooking(sittingSelectedDate);
});

document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{routeDraft=null;setView(b.dataset.view)});
$('#fab').onclick=()=>editDog();
$('#save-dog').onclick=()=>saveDog();
$('#delete-dog').onclick=()=>del();
$('#add-walk-slot').onclick=()=>addSlot(walkSlots);
$('#add-sit-slot').onclick=()=>addSlot(sitSlots);
$('#add-sit-date').onclick=()=>addSitDateRow({date:sittingSelectedDate||localISO(),time:''});
walkOn.onchange=()=>{walkEditor.hidden=!walkOn.checked};
sitOn.onchange=()=>{sitEditor.hidden=!sitOn.checked};
$('#take-photo-button').onclick=()=>$('#camera-input').click();
$('#choose-photo-button').onclick=()=>$('#photo-input').click();
$('#camera-input').onchange=e=>usePhotoFile(e.target.files[0]);
$('#photo-input').onchange=e=>usePhotoFile(e.target.files[0]);
$('#save-location').onclick=()=>saveLocation();
$('#delete-location').onclick=()=>deleteLocation();
$('#save-sitting-booking').onclick=()=>saveSittingBooking();
$('#backup-button').onclick=()=>dataDlg.showModal();
$('[data-close-dialog="data-dialog"]').onclick=()=>dataDlg.close();
$('#export-data').onclick=()=>backup();
$('#import-data').onchange=e=>restore(e.target.files[0]);

async function init(){try{db=await openDb();await maybeImportLegacy();await loadState();if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));setView('home')}catch(err){console.error(err);app.innerHTML='<div class="planner-status error">The app could not open its local storage. Please try reloading the page.</div>'}}
init();
