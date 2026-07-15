const API_VERSION = 'v25.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function getToken() { return process.env.META_ACCESS_TOKEN || ''; }
function getPhoneId() { return process.env.META_PHONE_NUMBER_ID || ''; }

function formatearNumero(telefono: string): string {
  let num = telefono.replace(/[^\d]/g, '');
  if (num.startsWith('549')) {
    num = '54' + num.slice(3);
  }
  if (!num.startsWith('+')) {
    num = '+' + num;
  }
  return num;
}

interface Button {
  id: string;
  title: string;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export async function enviarTexto(to: string, texto: string): Promise<boolean> {
  const token = getToken();
  const phoneId = getPhoneId();
  if (!token || !phoneId) { console.error('   ❌ Token o Phone ID no configurado'); return false; }
  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formatearNumero(to),
      type: 'text',
      text: { body: texto },
    }),
  });
  return res.ok;
}

export async function enviarBotones(to: string, texto: string, buttons: Button[]): Promise<boolean> {
  const token = getToken();
  const phoneId = getPhoneId();
  if (!token || !phoneId) { console.error('   ❌ Token o Phone ID no configurado'); return false; }
  if (buttons.length > 3) {
    return enviarLista(to, texto, 'Ver opciones', buttons.map(b => ({ id: b.id, title: b.title })));
  }
  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formatearNumero(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  });
  return res.ok;
}

export async function enviarLista(to: string, texto: string, botonLabel: string, rows: ListRow[]): Promise<boolean> {
  const token = getToken();
  const phoneId = getPhoneId();
  if (!token || !phoneId) { console.error('   ❌ Token o Phone ID no configurado'); return false; }
  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formatearNumero(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: texto },
        action: {
          button: botonLabel,
          sections: [{ title: 'Opciones', rows }],
        },
      },
    }),
  });
  return res.ok;
}
