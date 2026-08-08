const GROQ_KEY = process.env.GROQ_API_KEY;

const SYSTEM = `Sos un generador de títulos para tickets de soporte técnico.
Creá un título MUY corto (máximo 60 caracteres) que resuma el problema técnico.
Usá sustantivos concretos: "Mouse sin funcionar", "Impresora atascada", "No hay internet".
Respondé ÚNICAMENTE con el título. Sin comillas, sin explicaciones, sin viñetas.`;

export async function generarTituloTicket(descripcion: string, ubicacion: string): Promise<string> {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY no configurada');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Problema: ${descripcion}\nUbicación: ${ubicacion}` },
        ],
        temperature: 0.1,
        max_tokens: 30,
      }),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}`);

    const data = await res.json();
    const titulo = data.choices?.[0]?.message?.content?.trim();

    if (!titulo || titulo.length < 3) throw new Error('Título vacío');
    return titulo.substring(0, 60);
  } finally {
    clearTimeout(timeout);
  }
}
