function walkingCalendar(){
  pageTitle.textContent='Walking';
  const y=walkingMonthStart.getFullYear(),m=walkingMonthStart.getMonth();
  const monthName=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(walkingMonthStart);
  const firstOffset=(new Date(y,m,1).getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const cells=[];
  for(let i=0;i<firstOffset;i++)cells.push('<div class="calendar-blank"></div>');
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(y,m,day,12),iso=localISO(d),entries=walkingEntriesForDate(iso),names=entries.slice(0,2).map(x=>esc(x.d.name));
    const classes=['calendar-day'];if(iso===localISO())classes.push('today');if(iso===walkingSelectedDate)classes.push('selected');
    cells.push(`<button class="${classes.join(' ')}" data-walk-calendar-date="${iso}" type="button"><span class="calendar-number">${day}</span>${entries.length?`<span class="calendar-dogs">${names.map(n=>`<i>${n}</i>`).join('')}${entries.length>2?`<i>+${entries.length-2}</i>`:''}</span>`:''}</button>`);
  }
  const monthOneOff=dogs.reduce((n,d)=>n+(d.walkDates||[]).filter(x=>x.date.startsWith(monthKey(walkingMonthStart))).length,0);
  const selectedEntries=walkingEntriesForDate(walkingSelectedDate);
  const selectedTitle=prettyDate(walkingSelectedDate,{weekday:'long',day:'numeric',month:'long'});
  const routeReady=dogs.some(d=>d.walking&&postcodeOf(d));
  app.innerHTML=`
    <section class="calendar-shell">
      <div class="calendar-head"><button class="calendar-arrow" data-walk-calendar-prev type="button" aria-label="Previous month">‹</button><div><h2>${esc(monthName)}</h2><small>${monthOneOff} one-off ${monthOneOff===1?'walk':'walks'} this month</small></div><button class="calendar-arrow" data-walk-calendar-next type="button" aria-label="Next month">›</button></div>
      <div class="calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="calendar-grid">${cells.join('')}</div>
      <button class="primary-button calendar-add" data-add-walking-booking type="button">+ Add one-off walking date</button>
    </section>
    <section class="section selected-day-section"><div class="section-title-row"><h2>${esc(selectedTitle)}</h2><button class="text-button" data-add-walking-booking type="button">+ Add</button></div>${selectedEntries.length?`<div class="list">${selectedEntries.map(walkingCalendarCard).join('')}</div>`:`<div class="info-card"><p>No walks are booked for this date.</p><button class="secondary-button" data-add-walking-booking type="button">Add a walking date</button></div>`}</section>
    <section class="section"><div class="info-card"><strong>Regular + one-off in one view</strong><p>The calendar shows each dog’s normal weekly walks as well as individual dates you add for extra or non-regular walks.</p></div></section>
    ${routeReady?'<section class="section"><button class="primary-button" style="width:100%" data-route>Plan a pickup route</button></section>':''}`;
}
function walkingCalendarCard(x){
  const address=hasAddress(x.d)?firstAddressLine(x.d)||postcodeOf(x.d):'';
  return `<button class="schedule-card calendar-job" data-dog="${x.d.id}"><span class="schedule-time">${esc(x.slot.time||'—')}</span>${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${x.oneOff?'One-off walk':'Regular weekly walk'}${address?' · '+esc(address):''}</small></span><span class="booking-kind ${x.oneOff?'one-off':'regular'}">${x.oneOff?'One-off':'Regular'}</span></button>`;
}
function changeWalkingMonth(delta){walkingMonthStart=new Date(walkingMonthStart.getFullYear(),walkingMonthStart.getMonth()+delta,1);const todayDate=new Date();if(todayDate.getFullYear()===walkingMonthStart.getFullYear()&&todayDate.getMonth()===walkingMonthStart.getMonth())walkingSelectedDate=localISO(todayDate);else walkingSelectedDate=localISO(walkingMonthStart);walkingCalendar()}
function openWalkingBooking(date=walkingSelectedDate){
  if(!dogs.length)return toast('Add a dog first');
  $('#walking-booking-form').reset();
  $('#walking-booking-dog').innerHTML=dogs.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('#walking-booking-date').value=date||localISO();
  $('#walking-booking-time').value='';
  walkingBookingDlg.showModal();
}
async function saveWalkingBooking(){
  const id=$('#walking-booking-dog').value,date=$('#walking-booking-date').value,time=$('#walking-booking-time').value;
  if(!id||!date)return toast('Choose a dog and date');
  const dog=dogs.find(d=>d.id===id);if(!dog)return;
  dog.walking=true;
  dog.walkDates=Array.isArray(dog.walkDates)?dog.walkDates:[];
  if(dog.walkDates.some(x=>x.date===date&&(x.time||'')===time))return toast('That walking date is already saved');
  dog.walkDates.push({id:uid(),date,time});
  dog.walkDates.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99'));
  await saveDogRecord(dog);
  walkingBookingDlg.close();
  walkingSelectedDate=date;
  const parsed=parseISO(date);walkingMonthStart=new Date(parsed.getFullYear(),parsed.getMonth(),1);
  if(view==='walks')walkingCalendar();else setView(view);
  toast('Walking date added');
}
