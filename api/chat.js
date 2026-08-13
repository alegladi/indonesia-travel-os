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
- Se la domanda riguarda meteo, trasporti, traghetti, aperture, vulcani, incendi, sicurezza, eventi, prezzi, orari o informazioni che possono cambiare, usa la ricerca web prima di rispondere.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY non configurata su Vercel.' });
  }

  try {
    const { message, previousResponseId, pageContext } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Messaggio mancante.' });

    const body = {
      model: 'gpt-5',
      instructions: TRAVEL_CONTEXT,
      input: pageContext ? `CONTESTO APP ATTUALE:\n${pageContext}\n\nDOMANDA:\n${message}` : message,
      tools: [{ type: 'web_search' }],
      store: true,
      reasoning: { effort: 'medium' }
    };
    if (previousResponseId) body.previous_response_id = previousResponseId;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI API error', data);
      return res.status(response.status).json({ error: data?.error?.message || 'Errore OpenAI API.' });
    }

    const text = getOutputText(data) || 'Non sono riuscito a generare una risposta.';
    return res.status(200).json({ text, responseId: data.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Errore del Travel OS.' });
  }
}
