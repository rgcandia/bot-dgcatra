const GROQ_KEY = process.env.GROQ_API_KEY;

const SYSTEM = `Sos un asistente que resume problemas en títulos cortos para tickets de soporte.
Reglas:
- Máximo 60 caracteres.
- NO inventes detalles que el usuario no mencionó.
- Reformulá a lenguaje técnico solo si es obvio: "no prende la pc" → "PC no enciende".
- Si el mensaje no describe un problema técnico de IT (saludos, quejas personales, pedidos genéricos como "ayuda", "necesito ayuda", chistes, emociones), respondé EXACTAMENTE "Consulta general".
- Respondé ÚNICAMENTE con el título. Sin comillas, sin explicaciones, sin viñetas.`;

export async function generarTituloTicket(descripcion: string, ubicacion: string): Promise<string> {
  if (!GROQ_KEY) {
    return (descripcion || '').trim().substring(0, 60) || 'Ticket de soporte';
  }

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
  } catch (e: any) {
    console.log('🤖 IA título falló, usando fallback:', e?.message || e);
    return descripcion.trim().substring(0, 60);
  } finally {
    clearTimeout(timeout);
  }
}
