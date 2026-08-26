const DOG_PLACEHOLDER='./assets/dog-placeholder.svg';

function avatar(d){
  const hasPhoto=!!d?.photo;
  const src=hasPhoto?d.photo:DOG_PLACEHOLDER;
  const name=esc(d?.name||'Dog');
  return `<img class="dog-avatar${hasPhoto?'':' placeholder-avatar'}" src="${src}" alt="${name}">`;
}

function photo(src=''){
  const img=$('#photo-preview');
  const ph=$('#photo-placeholder');
  const remove=$('#remove-photo-button');
  $('#photo-data').value=src||'';
  img.src=src||DOG_PLACEHOLDER;
  img.hidden=false;
  img.classList.toggle('placeholder-photo',!src);
  if(ph)ph.hidden=true;
  if(remove)remove.hidden=!src;
}

(function setupPhotoRemoval(){
  const box=$('.photo-preview-box');
  if(!box)return;

  let remove=$('#remove-photo-button');
  if(!remove){
    remove=document.createElement('button');
    remove.id='remove-photo-button';
    remove.className='remove-photo-button';
    remove.type='button';
    remove.setAttribute('aria-label','Remove dog photo');
    remove.title='Remove photo';
    remove.textContent='×';
    remove.hidden=true;
    box.append(remove);
  }

  let dlg=$('#remove-photo-dialog');
  if(!dlg){
    dlg=document.createElement('dialog');
    dlg.id='remove-photo-dialog';
    dlg.className='confirm-dialog';
    dlg.innerHTML=`<div class="confirm-card"><h2>Remove photo?</h2><p>Are you sure you want to remove this dog’s photo?</p><div class="confirm-actions"><button id="keep-photo" class="secondary-button" type="button">No</button><button id="confirm-remove-photo" class="danger-button" type="button">Yes</button></div></div>`;
    document.body.append(dlg);
  }

  remove.addEventListener('click',()=>{
    if(!$('#photo-data').value)return;
    dlg.showModal();
  });
  dlg.querySelector('#keep-photo').addEventListener('click',()=>dlg.close());
  dlg.querySelector('#confirm-remove-photo').addEventListener('click',()=>{
    photo('');
    $('#camera-input').value='';
    $('#photo-input').value='';
    dlg.close();
    toast('Photo removed');
  });
  dlg.addEventListener('click',e=>{
    if(e.target===dlg)dlg.close();
  });
})();
