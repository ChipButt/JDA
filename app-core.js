'use strict';

const LEGACY_DOG_KEY='jda-dogs-v1';
const LEGACY_SETTINGS_KEY='jda-settings-v2';
const LEGACY_POSTCODE_CACHE_KEY='jda-postcode-cache-v1';
const DB_NAME='jda-dog-organiser-db';
const DB_VERSION=1;
const DOG_STORE='dogs';
const APP_STORE='app';
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const $=s=>document.querySelector(s);
const app=$('#app');
const pageTitle=$('#page-title');
const dogDlg=$('#dog-dialog');
const locationDlg=$('#location-dialog');
const detailDlg=$('#detail-dialog');
const dataDlg=$('#data-dialog');
const sittingBookingDlg=$('#sitting-booking-dialog');
const walkSlots=$('#walk-slots');
const sitSlots=$('#sit-slots');
const sitDateRows=$('#sit-date-rows');
const walkOn=$('#walking-enabled');
const sitOn=$('#sitting-enabled');
const walkEditor=$('#walking-editor');
const sitEditor=$('#sitting-editor');

let db;
let dogs=[];
let settings={start:null,destinations:[]};
let postcodeCache={};
let view='home';
let routeDraft=null;
const now=new Date();
let sittingMonthStart=new Date(now.getFullYear(),now.getMonth(),1);
let sittingSelectedDate=localISO(now);

function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cleanPostcode(v=''){return String(v).toUpperCase().replace(/\s+/g,' ').trim()}
function today(){return new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(new Date())}
function dateLabel(){return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
function localISO(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseISO(v){const [y,m,d]=String(v||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d,12):null}
function dayNameForISO(v){const d=parseISO(v);return d?new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(d):''}
function prettyDate(v,opts={weekday:'long',day:'numeric',month:'long',year:'numeric'}){const d=parseISO(v);return d?new Intl.DateTimeFormat('en-GB',opts).format(d):v}
function minToTime(m){m=Math.max(0,Math.round(m));const h=Math.floor(m/60)%24;const mins=m%60;return `${String(h).padStart(2,'0')}:${String(mins).padStart(2,'0')}`}
function timeToMin(v){if(!v)return null;const [h,m]=String(v).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null}
function clampNumber(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}

function migrateDog(d={}){
  return {
    id:d.id||uid(),
    photo:d.photo||'',
    name:d.name||'',
    breed:d.breed||'',
    age:d.age||'',
    owner:d.owner||'',
    addressLine1:d.addressLine1??d.address??'',
    addressTown:d.addressTown||'',
    addressCounty:d.addressCounty||'',
    addressPostcode:cleanPostcode(d.addressPostcode||''),
    keyInfo:d.keyInfo??(d.hasKey?'Key held':''),
    special:d.special||'',
    other:d.other||'',
    walking:!!d.walking,
    walkSchedule:Array.isArray(d.walkSchedule)?d.walkSchedule:[],
    sitting:!!d.sitting,
    sitSchedule:Array.isArray(d.sitSchedule)?d.sitSchedule:[],
    sitDates:Array.isArray(d.sitDates)?d.sitDates.filter(x=>x&&x.date).map(x=>({id:x.id||uid(),date:x.date,time:x.time||''})):[],
    goodWithDogs:!!d.goodWithDogs,
    offLead:!!d.offLead,
    allowedFurniture:!!d.allowedFurniture
  };
}
function normalizeLocation(loc={}){
  return {id:loc.id||uid(),name:loc.name||'',line1:loc.line1||loc.addressLine1||'',town:loc.town||loc.addressTown||'',county:loc.county||loc.addressCounty||'',postcode:cleanPostcode(loc.postcode||loc.addressPostcode||'')};
}
function normalizeSettings(raw={}){return {start:raw?.start?normalizeLocation(raw.start):null,destinations:Array.isArray(raw?.destinations)?raw.destinations.map(normalizeLocation):[]}}
function addressParts(x){if(!x)return[];return [x.addressLine1??x.line1,x.addressTown??x.town,x.addressCounty??x.county,x.addressPostcode??x.postcode].map(v=>(v||'').trim()).filter(Boolean)}
function fullAddress(x){return addressParts(x).join(', ')}
function firstAddressLine(x){return (x?.addressLine1??x?.line1??'').trim()}
function postcodeOf(x){return cleanPostcode(x?.addressPostcode??x?.postcode??'')}
function hasAddress(x){return addressParts(x).length>0}
function avatar(d){return d.photo?`<img class="dog-avatar" src="${d.photo}" alt="${esc(d.name)}">`:`<div class="avatar-fallback">${esc((d.name||'?')[0].toUpperCase())}</div>`}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const database=req.result;if(!database.objectStoreNames.contains(DOG_STORE))database.createObjectStore(DOG_STORE,{keyPath:'id'});if(!database.objectStoreNames.contains(APP_STORE))database.createObjectStore(APP_STORE,{keyPath:'key'})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open database'));
  });
}
function tx(storeName,mode='readonly'){return db.transaction(storeName,mode).objectStore(storeName)}
function requestAsPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbGet(storeName,key){return requestAsPromise(tx(storeName).get(key))}
async function dbGetAll(storeName){return requestAsPromise(tx(storeName).getAll())}
async function dbPut(storeName,value){return requestAsPromise(tx(storeName,'readwrite').put(value))}
async function dbDelete(storeName,key){return requestAsPromise(tx(storeName,'readwrite').delete(key))}
async function dbClear(storeName){return requestAsPromise(tx(storeName,'readwrite').clear())}

async function maybeImportLegacy(){
  const migrated=await dbGet(APP_STORE,'migratedLegacy');
  if(migrated?.value)return;
  let imported=false;
  try{const legacyDogs=JSON.parse(localStorage.getItem(LEGACY_DOG_KEY)||'[]');if(Array.isArray(legacyDogs)&&legacyDogs.length){for(const dog of legacyDogs)await dbPut(DOG_STORE,migrateDog(dog));imported=true}}catch{}
  try{
    const legacySettings=JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY)||'{}');
    const legacyCache=JSON.parse(localStorage.getItem(LEGACY_POSTCODE_CACHE_KEY)||'{}');
    const nextSettings=normalizeSettings(legacySettings);
    if(nextSettings.start||nextSettings.destinations.length){await dbPut(APP_STORE,{key:'settings',value:nextSettings});imported=true}
    if(legacyCache&&typeof legacyCache==='object'&&Object.keys(legacyCache).length){await dbPut(APP_STORE,{key:'postcodeCache',value:legacyCache});imported=true}
  }catch{}
  await dbPut(APP_STORE,{key:'migratedLegacy',value:true});
  if(imported)toast('Previous app data was moved into the new IndexedDB storage');
}
async function loadState(){dogs=(await dbGetAll(DOG_STORE)).map(migrateDog);dogs.sort((a,b)=>a.name.localeCompare(b.name));settings=normalizeSettings((await dbGet(APP_STORE,'settings'))?.value||{});postcodeCache=(await dbGet(APP_STORE,'postcodeCache'))?.value||{}}
async function saveDogRecord(dog){const clean=migrateDog(dog);await dbPut(DOG_STORE,clean);const i=dogs.findIndex(x=>x.id===clean.id);if(i<0)dogs.push(clean);else dogs[i]=clean;dogs.sort((a,b)=>a.name.localeCompare(b.name))}
async function removeDogRecord(id){await dbDelete(DOG_STORE,id);dogs=dogs.filter(d=>d.id!==id)}
async function saveSettings(){await dbPut(APP_STORE,{key:'settings',value:settings})}
async function savePostcodeCache(){await dbPut(APP_STORE,{key:'postcodeCache',value:postcodeCache})}

function sittingEntriesForDate(dateISO){
  const day=dayNameForISO(dateISO);
  const out=[];
  for(const d of dogs){
    if(!d.sitting)continue;
    const seen=new Set();
    for(const item of (d.sitDates||[]).filter(x=>x.date===dateISO)){
      const key=item.time||'';seen.add(key);out.push({d,slot:{time:item.time||''},type:'sit',oneOff:true,date:item.date,bookingId:item.id});
    }
    for(const slot of (d.sitSchedule||[]).filter(x=>x.day===day)){
      const key=slot.time||'';if(seen.has(key))continue;out.push({d,slot,type:'sit',oneOff:false,date:dateISO});
    }
  }
  return out.sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99')||a.d.name.localeCompare(b.d.name));
}
function jobs(type,day=today(),dateISO=localISO()){
  if(type==='sit')return sittingEntriesForDate(dateISO);
  return dogs.flatMap(d=>d.walking?(d.walkSchedule||[]).filter(x=>x.day===day).map(slot=>({d,slot,type:'walk'})):[]).sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'));
}
function pickupForDay(d,day){return (d.walkSchedule||[]).find(x=>x.day===day)?.time||''}
function tags(d){return `${d.walking?'<span class="tag">Walking</span>':''}${d.sitting?'<span class="tag sit">Sitting</span>':''}${d.keyInfo?'<span class="tag key">Entry info</span>':''}`}
function dogCard(d){return `<button class="dog-card" data-dog="${d.id}">${avatar(d)}<span class="card-main"><strong>${esc(d.name)}</strong><small>${esc([d.breed,d.owner&&`Owner: ${d.owner}`].filter(Boolean).join(' · ')||'No extra details yet')}</small><span class="tag-row">${tags(d)}</span></span><span class="card-chevron">›</span></button>`}
function jobCard(x){const label=x.type==='walk'?'Walk':x.oneOff?'One-off sitting':'Sitting';return `<button class="job-card" data-dog="${x.d.id}">${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${label}${hasAddress(x.d)?' · '+esc(firstAddressLine(x.d)||postcodeOf(x.d)):''}</small></span><strong>${esc(x.slot.time||'Any time')}</strong></button>`}
function empty(h,p,b='Add a dog'){return `<div class="empty-state"><div class="empty-icon">🐾</div><h3>${esc(h)}</h3><p>${esc(p)}</p><button class="primary-button" data-add>${esc(b)}</button></div>`}
