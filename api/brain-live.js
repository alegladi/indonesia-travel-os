const PERSONAL='personal';
const ARREDO='arredo_service';

async function refreshAccessToken(refreshToken){
  if(!refreshToken) return null;
  const body=new URLSearchParams({
    client_id:process.env.GOOGLE_CLIENT_ID||'',
    client_secret:process.env.GOOGLE_CLIENT_SECRET||'',
    refresh_token:refreshToken,
    grant_type:'refresh_token'
  });
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!r.ok) throw new Error(`Google OAuth ${r.status}`);
  return (await r.json()).access_token;
}

function decodeB64(s=''){
  try{return Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch{return ''}
}

function header(headers,name){return headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||''}

function classify(text,account){
  const t=(text||'').toLowerCase();
  if(account===ARREDO) return 'ARREDO SERVICE';
  if(/da nialtri|nialtri|sesciala|ristorante|zaccagnini|guinzaglio/.test(t)) return 'DA NIALTRI';
  if(/pierdominici|abitativo|arredo academy|arredo service|showroom|cucine|arredamento|simone pierdominici/.test(t)) return 'ARREDO SERVICE';
  return 'VITA PRIVATA';
}

function importanceScore(m,account){
  const t=`${m.from} ${m.subject} ${m.snippet}`.toLowerCase();
  let s=0;
  if(/sicurezza|security|scaden|pagamento|fattura|carta|cofidis|agenzia entrate|assicurazione|rimborso|annullato|urgente|azione richiesta|action required|lead|cliente|preventivo|appuntamento|ordine/.test(t)) s+=4;
  if(/google|apple|paypal|banca|cofidis|generali|cafsic|booking|moneygram|tim|meta/.test(t)) s+=2;
  if(/newsletter|recensione|survey|aggiornati automaticamente|promozione|offerta luce|weekly summary/.test(t)) s-=3;
  if(account===ARREDO && /lead|cliente|showroom|abitativo|pierdominici|academy|campagna|meta|google ads|preventivo|simone/.test(t)) s+=4;
  return s;
}

async function gmailUnread(accessToken,account){
  if(!accessToken) return [];
  const q=encodeURIComponent('is:unread in:inbox newer_than:14d -category:promotions -category:social');
  const list=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${q}`,{headers:{authorization:`Bearer ${accessToken}`}});
  if(!list.ok) throw new Error(`Gmail ${account} ${list.status}`);
  const ids=(await list.json()).messages||[];
  const messages=[];
  for(const x of ids.slice(0,20)){
    const r=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${x.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,{headers:{authorization:`Bearer ${accessToken}`}});
    if(!r.ok) continue;
    const j=await r.json();
    const m={id:j.id,threadId:j.threadId,from:header(j.payload?.headers,'From'),subject:header(j.payload?.headers,'Subject'),date:header(j.payload?.headers,'Date'),snippet:j.snippet||'',account};
    m.score=importanceScore(m,account);
    m.area=classify(`${m.from} ${m.subject} ${m.snippet}`,account);
    m.url=`https://mail.google.com/mail/u/0/#all/${j.id}`;
    messages.push(m);
  }
  return messages.filter(x=>x.score>=3).sort((a,b)=>b.score-a.score).slice(0,8);
}

async function calendarUpcoming(accessToken,account){
  if(!accessToken) return [];
  const now=new Date(); const max=new Date(now.getTime()+7*86400000);
  const url=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('singleEvents','true'); url.searchParams.set('orderBy','startTime');
  url.searchParams.set('timeMin',now.toISOString()); url.searchParams.set('timeMax',max.toISOString()); url.searchParams.set('maxResults','30');
  const r=await fetch(url,{headers:{authorization:`Bearer ${accessToken}`}});
  if(!r.ok) throw new Error(`Calendar ${account} ${r.status}`);
  const items=(await r.json()).items||[];
  return items.map(e=>({
    id:e.id, title:e.summary||'(senza titolo)', start:e.start?.dateTime||e.start?.date,
    end:e.end?.dateTime||e.end?.date, account, area:classify(`${e.summary||''} ${e.description||''}`,account),
    url:e.htmlLink||'', allDay:!!e.start?.date
  })).slice(0,20);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  try{
    const [personalToken,workToken]=await Promise.all([
      refreshAccessToken(process.env.GOOGLE_PERSONAL_REFRESH_TOKEN),
      refreshAccessToken(process.env.GOOGLE_WORK_REFRESH_TOKEN)
    ]);
    const [pMail,wMail,pCal,wCal]=await Promise.all([
      gmailUnread(personalToken,PERSONAL), gmailUnread(workToken,ARREDO),
      calendarUpcoming(personalToken,PERSONAL), calendarUpcoming(workToken,ARREDO)
    ]);
    const now=new Date();
    res.status(200).json({
      live:true, generatedAt:now.toISOString(), refreshAfterSeconds:30,
      unreadImportant:{personal:pMail,arredoService:wMail},
      events:{personal:pCal,arredoService:wCal},
      areas:{personal:'VITA PRIVATA',daNialtri:'DA NIALTRI',arredoService:'ARREDO SERVICE'},
      classificationRule:'Pierdominici Casa include Pierdominici Casa, Abitativo, Arredo Academy, Simone Pierdominici e mondo arredamento.'
    });
  }catch(err){
    res.status(500).json({live:false,error:err.message,generatedAt:new Date().toISOString()});
  }
}
