import { requireSession } from '../lib/brain-session.js';
import { getDb } from '../lib/brain-db.js';
import { decryptSecret, encryptSecret } from '../lib/token-vault.js';

const PERSONAL = 'personal';
const ARREDO = 'arredo_service';
const TIMEOUT_MS = 6500;

function areaFromText(text, account) {
  const t = (text || '').toLowerCase();
  if (account === ARREDO) return 'ARREDO SERVICE';
  if (/da nialtri|nialtri|sesciala|ristorante|zaccagnini|guinzaglio|moscioli|mandracchio/.test(t)) return 'DA NIALTRI';
  if (/pierdominici|abitativo|arredo academy|arredo service|showroom|cucine|arredamento|simone pierdominici|arredo3/.test(t)) return 'ARREDO SERVICE';
  return 'VITA PRIVATA';
}

function importanceScore(message, account) {
  const t = `${message.from} ${message.subject} ${message.snippet}`.toLowerCase();
  let score = 0;
  if (/sicurezza|security|scaden|pagamento|fattura|carta|cofidis|agenzia entrate|assicurazione|rimborso|annullato|urgente|azione richiesta|action required|lead|cliente|preventivo|appuntamento|ordine|contratto|documento/.test(t)) score += 4;
  if (/google|apple|paypal|banca|cofidis|generali|cafsic|booking|moneygram|tim|meta|stripe/.test(t)) score += 2;
  if (/newsletter|recensione|survey|aggiornati automaticamente|promozione|offerta luce|weekly summary|valuta il tuo soggiorno/.test(t)) score -= 4;
  if (account === ARREDO && /lead|cliente|showroom|abitativo|pierdominici|academy|campagna|meta|google ads|preventivo|simone|appuntamento|visita/.test(t)) score += 4;
  return score;
}

function header(headers, name) {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

async function fetchWithRetry(url, options = {}, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) return response;
      if (![429, 500, 502, 503, 504].includes(response.status) || i === attempts - 1) throw new Error(`HTTP_${response.status}`);
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    } catch (error) {
      lastError = error;
      if (i === attempts - 1) throw error;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastError || new Error('FETCH_FAILED');
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) return null;
  const body = new URLSearchParams({client_id: process.env.GOOGLE_CLIENT_ID || '',client_secret: process.env.GOOGLE_CLIENT_SECRET || '',refresh_token: refreshToken,grant_type: 'refresh_token'});
  const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {method: 'POST',headers: { 'content-type': 'application/x-www-form-urlencoded' },body});
  const json = await response.json();
  return {accessToken: json.access_token,expiresAt: new Date(Date.now() + (Number(json.expires_in || 3600) * 1000))};
}

async function integrationToken(accountKey) {
  const sql = getDb();
  const rows = await sql`SELECT id, encrypted_refresh_token, encrypted_access_token, access_token_expires_at, status FROM brain_integrations WHERE provider='google' AND account_key=${accountKey} LIMIT 1`;
  const row = rows[0];
  if (!row || row.status !== 'connected') return null;
  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (row.encrypted_access_token && expiresAt > Date.now() + 60_000) return decryptSecret(row.encrypted_access_token);
  const refreshToken = decryptSecret(row.encrypted_refresh_token);
  if (!refreshToken) return null;
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed?.accessToken) return null;
  await sql`UPDATE brain_integrations SET encrypted_access_token=${encryptSecret(refreshed.accessToken)}, access_token_expires_at=${refreshed.expiresAt}, updated_at=now(), last_error=NULL, status='connected' WHERE id=${row.id}`;
  return refreshed.accessToken;
}

async function gmailUnread(accessToken, account) {
  if (!accessToken) return [];
  const q = encodeURIComponent('is:unread in:inbox newer_than:14d -category:promotions -category:social');
  const list = await fetchWithRetry(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${q}`, {headers: { authorization: `Bearer ${accessToken}` }});
  const ids = (await list.json()).messages || [];
  const results = await Promise.allSettled(ids.slice(0, 20).map(async item => {
    const response = await fetchWithRetry(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {headers: { authorization: `Bearer ${accessToken}` }});
    const json = await response.json();
    const message = {id: json.id,threadId: json.threadId,from: header(json.payload?.headers, 'From'),subject: header(json.payload?.headers, 'Subject'),date: header(json.payload?.headers, 'Date'),snippet: json.snippet || '',account};
    message.score = importanceScore(message, account);
    message.area = areaFromText(`${message.from} ${message.subject} ${message.snippet}`, account);
    message.url = `https://mail.google.com/mail/u/0/#all/${json.id}`;
    return message;
  }));
  return results.filter(x => x.status === 'fulfilled').map(x => x.value).filter(x => x.score >= 3).sort((a, b) => b.score - a.score).slice(0, 8);
}

async function calendarUpcoming(accessToken, account) {
  if (!accessToken) return [];
  const now = new Date(); const max = new Date(now.getTime() + 7 * 86400000);
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('singleEvents', 'true'); url.searchParams.set('orderBy', 'startTime'); url.searchParams.set('timeMin', now.toISOString()); url.searchParams.set('timeMax', max.toISOString()); url.searchParams.set('maxResults', '30');
  const response = await fetchWithRetry(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const items = (await response.json()).items || [];
  return items.map(event => ({id: event.id,title: event.summary || '(senza titolo)',start: event.start?.dateTime || event.start?.date,end: event.end?.dateTime || event.end?.date,account,area: areaFromText(`${event.summary || ''} ${event.description || ''}`, account),url: event.htmlLink || '',allDay: Boolean(event.start?.date)})).slice(0, 20);
}

async function source(name, fn) {
  const started = Date.now();
  try { const data = await fn(); return { ok: true, data, latencyMs: Date.now() - started }; }
  catch (error) { console.error(`brain source ${name}`, error); return { ok: false, data: [], error: error.message, latencyMs: Date.now() - started }; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!await requireSession(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const tokenResults = await Promise.allSettled([integrationToken(PERSONAL),integrationToken(ARREDO)]);
  const personalToken = tokenResults[0].status === 'fulfilled' ? tokenResults[0].value : null;
  const workToken = tokenResults[1].status === 'fulfilled' ? tokenResults[1].value : null;
  const [personalMail, workMail, personalCalendar, workCalendar] = await Promise.all([
    source('gmail_personal', () => gmailUnread(personalToken, PERSONAL)),
    source('gmail_work', () => gmailUnread(workToken, ARREDO)),
    source('calendar_personal', () => calendarUpcoming(personalToken, PERSONAL)),
    source('calendar_work', () => calendarUpcoming(workToken, ARREDO))
  ]);
  const sourceHealth = {
    gmailPersonal: { ok: personalMail.ok && Boolean(personalToken), latencyMs: personalMail.latencyMs, error: personalToken ? (personalMail.error || null) : 'NOT_CONNECTED' },
    gmailWork: { ok: workMail.ok && Boolean(workToken), latencyMs: workMail.latencyMs, error: workToken ? (workMail.error || null) : 'NOT_CONNECTED' },
    calendarPersonal: { ok: personalCalendar.ok && Boolean(personalToken), latencyMs: personalCalendar.latencyMs, error: personalToken ? (personalCalendar.error || null) : 'NOT_CONNECTED' },
    calendarWork: { ok: workCalendar.ok && Boolean(workToken), latencyMs: workCalendar.latencyMs, error: workToken ? (workCalendar.error || null) : 'NOT_CONNECTED' }
  };
  const connectedSources = Object.values(sourceHealth).filter(x => x.ok).length;
  return res.status(200).json({
    live: connectedSources > 0,
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds: 30,
    sourceHealth,
    unreadImportant: {personal: personalMail.data,arredoService: workMail.data},
    events: {personal: personalCalendar.data,arredoService: workCalendar.data},
    areas: {personal: 'VITA PRIVATA',daNialtri: 'DA NIALTRI',arredoService: 'ARREDO SERVICE'},
    classificationRule: 'Pierdominici Casa include Pierdominici Casa, Abitativo, Arredo Academy, Simone Pierdominici e il mondo arredamento.'
  });
}
