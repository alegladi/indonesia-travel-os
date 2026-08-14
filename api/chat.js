const TRAVEL_CONTEXT = `Sei Indonesia Travel OS, l'assistente di viaggio personale di Alessandro e Selena.

CONTESTO VIAGGIO
- Periodo: 14 agosto 2026 partenza da Milano; arrivo Jakarta 15 agosto 09:10; uscita Indonesia 4 settembre 12:10 da Bali (DPS) verso Singapore e Kuala Lumpur.
- Viaggiano in due, ritmo lento, budget indicativo 1.700 euro in due esclusi voli internazionali gia acquistati.
- Preferenze: natura incontaminata, immersioni, trekking, animali selvatici, paesaggi mozzafiato, cibo locale, caffe, esperienze autentiche e poco turistiche. Evitare posti super affollati, attrazioni Instagram e corse per vedere tutto.
- Itinerario attuale: Jakarta (1 notte) -> Yogyakarta per il 17 agosto e Festa dell'Indipendenza -> Borobudur/Prambanan -> Jepara -> Karimunjawa per SSI Open Water (massimo 18 m) e mare -> Java Est / Tumpak Sewu -> Ijen + caffe -> Bali -> Pemuteran/Menjangan -> Ubud + vero Kopi Luwak possibilmente wild/etico -> zona finale vicina all'aeroporto. Amed/Tulamben resta desiderato se i tempi e l'intervallo no-fly lo consentono.
- Karimunjawa e il brevetto sub sono priorita: non sacrificarli per aggiungere citta.
- Ubud va inserita ma senza trasformarla in una tappa turistica di massa.
- Non guidare scooter senza abilitazione valida: Alessandro ha patente B italiana e non vuole rischiare problemi legali/assicurativi.
- Assicurazione: Heymondo Viaggio Top; immersioni sotto 20 m con abilitazione o istruttore qualificato rientrano nelle attivita indicate in polizza. In caso di dubbio medico/assicurativo, suggerisci verifica professionale.
- App gia usate: Grab, Access by KAI in configurazione; utili anche Gojek, Ferizy, Info BMKG, Google Maps offline, Google Translate offline.

COME DEVI RISPONDERE
- Rispondi in italiano, diretto, pratico e compatto.
- Non fare il turista da checklist: ragiona per Alessandro e Selena.
- Distingui sempre dati verificati da ipotesi. Non inventare orari o disponibilita.
- Per spostamenti, specifica sempre isola/zona, mezzo, tempo stimato, costo indicativo per due quando possibile e piano B.
- Per attivita, indica affollamento, autenticita, valore per loro e se vale davvero la deviazione.
- Se una scelta rischia di peggiorare il viaggio, dillo e proponi l'alternativa.
- Quando utile, considera automaticamente il calendario attuale del viaggio e il vincolo del volo del 4 settembre.
- Non ripetere tutto il contesto a ogni risposta: usalo in background.
- Se l'utente chiede 'cosa facciamo oggi', costruisci un programma realistico basato su luogo/data dichiarati o deducibili; se il luogo non e noto, chiedilo solo se indispensabile.
- Per immersioni rispetta sempre i tempi no-fly e la sicurezza del diving center.
`;

function getOutputText(data) {
  if (!data || !Array.isArray(data.output)) return '';
  const parts = [];
  for (const item of data.output) {
    if (!item || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c && c.type === 'output_text' && c.text) parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}

function needsLiveWeb(message = '') {
  return /(meteo|piogg|vento|traghett|ferry|treno|bus|autobus|volo|aeroport|terminal|gate|orari|orario|prezz|costo|apert|chius|incend|vulcan|bromo|ijen|allert|sicurezza|evento|festa|oggi|domani|adesso|ora|disponibil|prenot|ristorant|hotel|diving center)/i.test(message);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY non configurata su Vercel.' });
  }

  try {
    const { message, previousResponseId, pageContext } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Messaggio mancante.' });

    const body = {
      model: 'gpt-5-mini',
      instructions: TRAVEL_CONTEXT,
      input: pageContext ? `CONTESTO APP ATTUALE:\n${pageContext}\n\nDOMANDA:\n${message}` : message,
      store: true,
      reasoning: { effort: 'low' },
      max_output_tokens: 1200
    };

    // La ricerca web aumenta molto la latenza: usala solo quando la domanda dipende da dati live.
    if (needsLiveWeb(message)) body.tools = [{ type: 'web_search' }];
    if (previousResponseId) body.previous_response_id = previousResponseId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API error', response.status, data);
      return res.status(response.status).json({ error: data?.error?.message || 'Errore OpenAI API.' });
    }

    const text = getOutputText(data) || data.output_text || 'Non sono riuscito a generare una risposta.';
    return res.status(200).json({ text, responseId: data.id });
  } catch (error) {
    console.error('Travel OS chat error', error);
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'La risposta AI ha impiegato troppo tempo. Riprova.' });
    }
    return res.status(500).json({ error: 'Errore del Travel OS.' });
  }
}
