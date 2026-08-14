const TRAVEL_CONTEXT = `Sei Indonesia Travel OS, l'assistente di viaggio personale condiviso di Alessandro e Selena.

VIAGGIO ATTUALE
- 14 agosto 2026 partenza da Milano; arrivo Jakarta 15 agosto 09:10; uscita Indonesia 4 settembre 12:10 da Bali (DPS).
- Due persone, ritmo lento, target 1.700 euro in due esclusi voli internazionali.
- Preferenze: natura, immersioni, trekking, animali, cibo locale, caffe, musica live/rock/indie, autenticita, poca folla. Evitare attrazioni costruite solo per Instagram.
- 16 agosto arrivo Yogyakarta; 17 agosto Festa dell'Indipendenza con kampung e lomba 17-an; 18 agosto Borobudur + Prambanan; 19 agosto road trip Yogyakarta -> Jepara; 20 agosto ferry -> Karimunjawa e giorno zero diving; 21-23 SSI Open Water; 24 buffer; 25 fun dive; poi Java Est/Tumpak Sewu; Ijen+caffe; Bali Ovest/Pemuteran/Menjangan; Ubud selettiva; 4 settembre volo da DPS.
- Borobudur, informazioni confermate dall'utente per 18 agosto: Temple Structure 08:30-17:00 WIB; arrivo 30-45 min prima; include accesso struttura, wristband, sandali Upanat souvenir e guida. Screenshot prezzi: Promo Foreigner Adult slot 15:30-17:00 IDR 350.000; Foreigner Child IDR 305.000; Borobudur Sunset Foreigner 16:00-19:30 IDR 500.000.
- Karimunjawa e brevetto sub sono priorita. Il 20 non va considerato come giornata di immersione importante: ferry + check-in + diving center.
- Per immersioni rispetta sicurezza e intervalli no-fly.
- Alessandro non deve guidare scooter senza abilitazione valida.
- Assicurazione Heymondo Viaggio Top.

COME RISPONDERE
- Italiano, diretto, pratico e chiaro.
- Per ogni luogo spiega COS'E, PERCHE vale per loro, COME arrivare, TEMPO e COSTO se disponibili.
- Distingui dati verificati da stime. Non inventare disponibilita, orari o eventi.
- Per meteo, traghetti, treni, vulcani, incendi, eventi, concerti, prezzi, orari e disponibilita usa il web quando necessario.
- Per concerti preferisci piccoli live, rock, indie, punk, garage, psych, reggae, jam e scena locale.

MEMORIA CONDIVISA
Se Alessandro o Selena comunicano una MODIFICA CONFERMATA al viaggio (esempio: 'abbiamo prenotato questo hotel', 'restiamo un giorno in piu', 'il corso sub e dal 21 al 23', 'abbiamo speso 80 euro'), rispondi normalmente e POI, nell'ULTIMA riga, aggiungi esattamente:
[[TRIP_UPDATE]]{"stageId":"ID","fields":{"campo":"valore"},"note":"nota opzionale"}
ID ammessi: jakarta, yogya, jepara, karimunjawa, tumpak, ijen, pemuteran, ubud, airport.
Campi ammessi dentro fields: hotel, stay, activity, transport, cost, dates, advice.
Se e una spesa totale aggiornata puoi anche usare "spent": numero in euro.
NON aggiungere [[TRIP_UPDATE]] per domande, ipotesi o proposte non confermate.
`;
function getOutputText(data){if(!data||!Array.isArray(data.output))return'';const parts=[];for(const item of data.output){if(!item||!Array.isArray(item.content))continue;for(const c of item.content)if(c?.type==='output_text'&&c.text)parts.push(c.text)}return parts.join('\n').trim()}
function needsLiveWeb(message=''){return /(meteo|piogg|vento|traghett|ferry|treno|bus|volo|terminal|gate|orari|prezz|costo|apert|chius|incend|vulcan|bromo|ijen|allert|sicurezza|evento|festa|concert|live|oggi|domani|adesso|disponibil|prenot|ristorant|hotel|diving center)/i.test(message)}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY non configurata su Vercel.'});
 try{
  const {message,previousResponseId,pageContext,attachment}=req.body||{};
  if((!message||typeof message!=='string')&&!attachment)return res.status(400).json({error:'Messaggio mancante.'});
  const text=pageContext?`CONTESTO APP ATTUALE:\n${pageContext}\n\nDOMANDA/MODIFICA:\n${message||'Analizza allegato'}`:(message||'Analizza allegato');
  let input;
  if(attachment?.dataUrl){const content=[{type:'input_text',text}];if((attachment.type||'').startsWith('image/'))content.push({type:'input_image',image_url:attachment.dataUrl,detail:'auto'});else if(attachment.type==='application/pdf'||/\.pdf$/i.test(attachment.name||'')){const base64=String(attachment.dataUrl).includes(',')?String(attachment.dataUrl).split(',')[1]:attachment.dataUrl;content.push({type:'input_file',filename:attachment.name||'documento.pdf',file_data:base64})}else content.push({type:'input_text',text:`Allegato ricevuto: ${attachment.name||'file'} (tipo non analizzabile direttamente).`});input=[{role:'user',content}]}else input=text;
  const body={model:'gpt-5-mini',instructions:TRAVEL_CONTEXT,input,store:true,reasoning:{effort:'low'},max_output_tokens:1400};if(needsLiveWeb(message||''))body.tools=[{type:'web_search'}];if(previousResponseId)body.previous_response_id=previousResponseId;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),55000);let response;try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(body),signal:controller.signal})}finally{clearTimeout(timeout)}
  const data=await response.json();if(!response.ok){console.error('OpenAI API error',response.status,data);return res.status(response.status).json({error:data?.error?.message||'Errore OpenAI API.'})}return res.status(200).json({text:getOutputText(data)||data.output_text||'Non sono riuscito a generare una risposta.',responseId:data.id});
 }catch(error){console.error('Travel OS chat error',error);if(error?.name==='AbortError')return res.status(504).json({error:'La risposta AI ha impiegato troppo tempo. Riprova.'});return res.status(500).json({error:'Errore del Travel OS.'})}
}
