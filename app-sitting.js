function home(){
  pageTitle.textContent='Today';
  const w=jobs('walk'),s=jobs('sit'),all=[...w,...s].sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'));
  const destinations=settings.destinations||[];
  app.innerHTML=`
    <section class="hero"><p class="date">${esc(dateLabel())}</p><div class="hero-count"><strong>${all.length}</strong><span>${all.length===1?'job today':'jobs today'}</span></div><p class="hero-sub">${dogs.length?`${dogs.length} ${dogs.length===1?'dog':'dogs'} saved and ready.`:'Add your first dog to get started.'}</p></section>
    <section class="quick-grid">
      <button class="quick-card" data-go="dogs"><span class="quick-symbol">🐾</span><strong>${dogs.length}</strong><small>All dogs</small></button>
      <button class="quick-card" data-go="walks"><span class="quick-symbol">↗</span><strong>${w.length}</strong><small>Walks today</small></button>
      <button class="quick-card" data-go="sitting"><span class="quick-symbol">❤</span><strong>${s.length}</strong><small>Sitting today</small></button>
      <button class="quick-card" data-route><span class="quick-symbol">⌖</span><strong>${dogs.filter(d=>d.walking&&postcodeOf(d)).length}</strong><small>Route-ready</small></button>
    </section>
    <section class="section"><div class="section-title-row"><h2>Jess's starting point</h2>${settings.start?'<button class="text-button" data-edit-start>Edit</button>':'<button class="text-button" data-edit-start>Add</button>'}</div><div class="info-card">${settings.start?`<strong>${esc(settings.start.name||'Starting location')}</strong><p>${esc(fullAddress(settings.start)||'No address saved')}</p>`:`<p>Add Jess’s normal starting location so the route planner can work out when she needs to leave.</p><button class="primary-button" data-edit-start type="button">Add starting location</button>`}</div></section>
    <section class="section"><div class="section-title-row"><h2>Walking fields & destinations</h2><button class="text-button" data-add-location type="button">+ Add field</button></div>${destinations.length?`<div class="location-list">${destinations.map(l=>`<div class="location-card"><div class="location-card-top"><div><strong>${esc(l.name)}</strong><p>${esc(fullAddress(l))}</p></div><button class="text-button" data-edit-location="${l.id}" data-location-kind="destination">Edit</button></div><span class="location-chip">Destination field</span></div>`).join('')}</div>`:`<div class="info-card"><p>Save the walking fields or other destinations Jess uses, then pick one during route planning.</p></div>`}</section>
    <section class="section"><div class="section-title-row"><h2>Today's schedule</h2></div><div class="list">${all.length?all.map(jobCard).join(''):empty('Nothing scheduled today',dogs.length?'There are no walks or sitting times saved for today.':'Add a dog and its schedule to see today’s jobs here.')}</div></section>
    <section class="section"><div class="home-plan-card"><div class="section-title-row"><h2>Need a walking route?</h2><button class="text-button" data-route type="button">Open planner</button></div><p>Pick the dogs, choose the field, set the arrival time, and the app will suggest the most logical order plus a leave-by time.</p></div></section>`;
}

function allDogs(q=''){
  pageTitle.textContent='All Dogs';
  const term=q.trim().toLowerCase();
  const filtered=dogs.filter(d=>[d.name,d.breed,d.owner,d.addressLine1,d.addressTown,d.addressCounty,d.addressPostcode,d.keyInfo].some(v=>(v||'').toLowerCase().includes(term)));
  app.innerHTML=`<div class="search-wrap"><input id="dog-search" type="search" placeholder="Search dogs, owners or addresses" value="${esc(q)}"></div><div class="list">${filtered.length?filtered.map(dogCard).join(''):dogs.length?empty('No matches','Try a different search.','Clear search'):empty('No dogs yet','Add Jess’s first dog profile.')}</div>`;
  $('#dog-search').oninput=e=>allDogs(e.target.value);if(dogs.length&&!filtered.length)$('[data-add]').onclick=()=>allDogs('');
}

function walkingSchedule(){
  const active=dogs.filter(d=>d.walking);
  const slots=active.flatMap(d=>(d.walkSchedule||[]).map(slot=>({d,slot})));
  const groups=DAYS.map(day=>({day,list:slots.filter(x=>x.slot.day===day).sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'))})).filter(g=>g.list.length);
  pageTitle.textContent='Walking';
  app.innerHTML=`${active.length?`<section class="section" style="margin-top:0"><div class="section-title-row"><h2>${active.length} ${active.length===1?'dog':'dogs'}</h2><span class="muted">Weekly schedule</span></div></section>`:''}${groups.length?groups.map(g=>`<section class="schedule-day"><h3>${g.day}</h3><div class="list">${g.list.map(x=>`<button class="schedule-card" data-dog="${x.d.id}"><span class="schedule-time">${esc(x.slot.time||'—')}</span>${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${esc(hasAddress(x.d)?firstAddressLine(x.d)||postcodeOf(x.d):x.d.breed||'')}</small></span><span class="card-chevron">›</span></button>`).join('')}</div></section>`).join(''):empty('No walking schedule yet','Turn on Walking in a dog profile and add the days and times.')}${active.some(d=>postcodeOf(d))?'<section class="section"><button class="primary-button" style="width:100%" data-route>Plan a pickup route</button></section>':''}`;
}

function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function sittingCalendar(){
  pageTitle.textContent='Sitting';
  const y=sittingMonthStart.getFullYear(),m=sittingMonthStart.getMonth();
  const monthName=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(sittingMonthStart);
  const firstOffset=(new Date(y,m,1).getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const cells=[];
  for(let i=0;i<firstOffset;i++)cells.push('<div class="calendar-blank"></div>');
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(y,m,day,12),iso=localISO(d),entries=sittingEntriesForDate(iso),names=entries.slice(0,2).map(x=>esc(x.d.name));
    const classes=['calendar-day'];if(iso===localISO())classes.push('today');if(iso===sittingSelectedDate)classes.push('selected');
    cells.push(`<button class="${classes.join(' ')}" data-calendar-date="${iso}" type="button"><span class="calendar-number">${day}</span>${entries.length?`<span class="calendar-dogs">${names.map(n=>`<i>${n}</i>`).join('')}${entries.length>2?`<i>+${entries.length-2}</i>`:''}</span>`:''}</button>`);
  }
  const monthOneOff=dogs.reduce((n,d)=>n+(d.sitDates||[]).filter(x=>x.date.startsWith(monthKey(sittingMonthStart))).length,0);
  const selectedEntries=sittingEntriesForDate(sittingSelectedDate);
  const selectedTitle=prettyDate(sittingSelectedDate,{weekday:'long',day:'numeric',month:'long'});
  app.innerHTML=`
    <section class="calendar-shell">
      <div class="calendar-head"><button class="calendar-arrow" data-calendar-prev type="button" aria-label="Previous month">‹</button><div><h2>${esc(monthName)}</h2><small>${monthOneOff} one-off ${monthOneOff===1?'booking':'bookings'} this month</small></div><button class="calendar-arrow" data-calendar-next type="button" aria-label="Next month">›</button></div>
      <div class="calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="calendar-grid">${cells.join('')}</div>
      <button class="primary-button calendar-add" data-add-sitting-booking type="button">+ Add one-off sitting date</button>
    </section>
    <section class="section selected-day-section"><div class="section-title-row"><h2>${esc(selectedTitle)}</h2><button class="text-button" data-add-sitting-booking type="button">+ Add</button></div>${selectedEntries.length?`<div class="list">${selectedEntries.map(sittingCalendarCard).join('')}</div>`:`<div class="info-card"><p>No sitting is booked for this date.</p><button class="secondary-button" data-add-sitting-booking type="button">Add a sitting date</button></div>`}</section>
    <section class="section"><div class="info-card"><strong>Regular + one-off in one view</strong><p>The calendar shows the dog’s normal weekly sitting schedule as well as individual dates you add for holidays, weekends or other non-regular bookings.</p></div></section>`;
}
function sittingCalendarCard(x){
  const prefs=[x.d.goodWithDogs?'Good with dogs':null,x.d.offLead?'Off lead':null,x.d.allowedFurniture?'Furniture OK':null].filter(Boolean);
  return `<button class="schedule-card calendar-job" data-dog="${x.d.id}"><span class="schedule-time">${esc(x.slot.time||'—')}</span>${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${x.oneOff?'One-off booking':'Regular weekly sitting'}${prefs.length?' · '+esc(prefs.join(' · ')):''}</small></span><span class="booking-kind ${x.oneOff?'one-off':'regular'}">${x.oneOff?'One-off':'Regular'}</span></button>`;
}
function changeSittingMonth(delta){sittingMonthStart=new Date(sittingMonthStart.getFullYear(),sittingMonthStart.getMonth()+delta,1);const todayDate=new Date();if(todayDate.getFullYear()===sittingMonthStart.getFullYear()&&todayDate.getMonth()===sittingMonthStart.getMonth())sittingSelectedDate=localISO(todayDate);else sittingSelectedDate=localISO(sittingMonthStart);sittingCalendar()}
function openSittingBooking(date=sittingSelectedDate){
  if(!dogs.length)return toast('Add a dog first');
  $('#sitting-booking-form').reset();
  $('#booking-dog').innerHTML=dogs.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('#booking-date').value=date||localISO();
  $('#booking-time').value='';
  sittingBookingDlg.showModal();
}
async function saveSittingBooking(){
  const id=$('#booking-dog').value,date=$('#booking-date').value,time=$('#booking-time').value;
  if(!id||!date)return toast('Choose a dog and date');
  const dog=dogs.find(d=>d.id===id);if(!dog)return;
  dog.sitting=true;
  dog.sitDates=Array.isArray(dog.sitDates)?dog.sitDates:[];
  if(dog.sitDates.some(x=>x.date===date&&(x.time||'')===time))return toast('That sitting date is already saved');
  dog.sitDates.push({id:uid(),date,time});
  dog.sitDates.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99'));
  await saveDogRecord(dog);
  sittingBookingDlg.close();
  sittingSelectedDate=date;
  const parsed=parseISO(date);sittingMonthStart=new Date(parsed.getFullYear(),parsed.getMonth(),1);
  if(view==='sitting')sittingCalendar();else setView(view);
  toast('Sitting date added');
}
