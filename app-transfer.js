(function(){
'use strict';

const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const hasSavedData=()=>dogs.length>0||!!settings?.start||(settings?.destinations?.length||0)>0;
const transferFileName=()=>`jda-home-screen-transfer-${new Date().toISOString().slice(0,10)}.json`;

function addTransferStyles(){
  if(document.getElementById('jda-transfer-styles'))return;
  const style=document.createElement('style');
  style.id='jda-transfer-styles';
  style.textContent=`
    .home-transfer-card{margin-top:14px;padding:18px;border-radius:24px;background:linear-gradient(135deg,#fff4ea,#fff);border:1px solid rgba(58,48,43,.10);box-shadow:0 8px 22px rgba(90,66,47,.05)}
    .home-transfer-card h2{font-size:20px;margin-bottom:8px}
    .home-transfer-card p{color:var(--muted);line-height:1.45;margin-bottom:12px}
    .transfer-actions{display:grid;gap:9px}
    .transfer-tools{margin:16px 0;padding:15px;border-radius:20px;background:var(--surface-soft);border:1px solid var(--line)}
    .transfer-tools h3{margin:0 0 7px;font-size:17px}
    .transfer-tools p{margin:0 0 12px;color:var(--muted);line-height:1.45}
    .transfer-file-label{position:relative;overflow:hidden}
    .transfer-file-label input{position:absolute;opacity:0;pointer-events:none}
    .transfer-note{font-size:12px;color:var(--muted);margin-top:9px;line-height:1.4}
  `;
  document.head.append(style);
}

function payload(){
  return {
    version:5,
    kind:'jda-home-screen-transfer',
    exportedAt:new Date().toISOString(),
    settings,
    postcodeCache,
    dogs
  };
}

function downloadTransfer(){
  if(!hasSavedData())return toast('There is no saved data to transfer yet');
  const blob=new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=transferFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Home Screen transfer file created');
}

async function importTransfer(file){
  if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    const list=(Array.isArray(parsed)?parsed:parsed.dogs)||[];
    if(!Array.isArray(list))throw new Error('Invalid transfer');
    const nextDogs=list.map(migrateDog);
    const nextSettings=normalizeSettings(parsed.settings||{});
    const nextPostcodes=parsed.postcodeCache&&typeof parsed.postcodeCache==='object'?parsed.postcodeCache:{};

    if(hasSavedData()){
      const ok=confirm(`Import ${nextDogs.length} dog profile${nextDogs.length===1?'':'s'}? This will replace the data currently stored in this copy of the app.`);
      if(!ok)return;
    }

    await dbClear(DOG_STORE);
    for(const dog of nextDogs)await dbPut(DOG_STORE,dog);
    dogs=nextDogs.sort((a,b)=>a.name.localeCompare(b.name));
    settings=nextSettings;
    postcodeCache=nextPostcodes;
    await saveSettings();
    await savePostcodeCache();
    await dbPut(APP_STORE,{key:'homeScreenTransferComplete',value:{at:new Date().toISOString(),count:dogs.length}});
    routeDraft=null;

    try{await navigator.storage?.persist?.()}catch{}
    if(dataDlg?.open)dataDlg.close();
    setView('home');
    toast(`${dogs.length} dog profile${dogs.length===1?'':'s'} brought into the Home Screen app`);
  }catch(err){
    console.error(err);
    toast('That transfer file could not be read');
  }
}

function transferTools(){
  if(document.getElementById('home-screen-transfer-tools'))return;
  const tools=document.createElement('section');
  tools.id='home-screen-transfer-tools';
  tools.className='transfer-tools';
  if(isStandalone()){
    tools.innerHTML=`
      <h3>Bring over existing Safari data</h3>
      <p>Apple keeps the Home Screen app’s storage separate from Safari. If you already added dogs in Safari, create a transfer file there, then import it here once.</p>
      <div class="transfer-actions">
        <label class="primary-button transfer-file-label">Import Home Screen transfer<input id="transfer-import-data" type="file" accept="application/json,.json"></label>
      </div>
      <div class="transfer-note">After the import, use the Home Screen app as the main copy so new changes stay together.</div>
    `;
  }else{
    tools.innerHTML=`
      <h3>Move this data to the Home Screen app</h3>
      <p>If you are about to add JDA to your iPhone or iPad Home Screen, download this transfer file first. Then open the Home Screen app and import it once.</p>
      <div class="transfer-actions">
        <button id="transfer-export-data" class="primary-button" type="button">Create Home Screen transfer file</button>
      </div>
      <div class="transfer-note">The file includes dog profiles, schedules, locations and dog photos.</div>
    `;
  }
  const anchor=dataDlg?.querySelector('.stack-actions');
  if(anchor)anchor.before(tools); else dataDlg?.append(tools);
  tools.querySelector('#transfer-export-data')?.addEventListener('click',downloadTransfer);
  tools.querySelector('#transfer-import-data')?.addEventListener('change',e=>importTransfer(e.target.files?.[0]));
}

function emptyStandaloneCard(){
  if(!isStandalone()||hasSavedData()||document.querySelector('.home-transfer-card'))return;
  const card=document.createElement('section');
  card.className='home-transfer-card';
  card.innerHTML=`
    <h2>Already added dogs in Safari?</h2>
    <p>Your saved information has not been deleted. iPhone/iPad keeps a Home Screen web app’s storage separate from Safari. Bring the existing data into this copy once, then keep using the Home Screen app.</p>
    <div class="transfer-actions">
      <label class="primary-button transfer-file-label">Import existing data<input id="quick-transfer-import" type="file" accept="application/json,.json"></label>
      <button id="show-transfer-help" class="secondary-button" type="button">How do I get the transfer file?</button>
    </div>
  `;
  const hero=app.querySelector('.hero');
  if(hero)hero.after(card); else app.prepend(card);
  card.querySelector('#quick-transfer-import')?.addEventListener('change',e=>importTransfer(e.target.files?.[0]));
  card.querySelector('#show-transfer-help')?.addEventListener('click',()=>{
    if(!dataDlg.open)dataDlg.showModal();
  });
}

addTransferStyles();
transferTools();

if(typeof home==='function'){
  const renderHome=home;
  home=function(){
    renderHome();
    emptyStandaloneCard();
  };
}

setTimeout(()=>{
  if(view==='home')emptyStandaloneCard();
  if(isStandalone())navigator.storage?.persist?.().catch?.(()=>{});
},0);

window.JDATransfer={download:downloadTransfer,importFile:importTransfer,isStandalone};
})();