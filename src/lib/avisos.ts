export type MensajeAviso = {
  id: string;
  conversationId: string;
  contactName: string | null;
  content: string;
  createdAt: string;
};

export type RespuestaAvisos = { mensajes: MensajeAviso[]; hasta: string };

const SILENCIO_KEY = "piubella:avisos-silenciados";

/** Texto del toast según el spec: un mensaje / varios de una clienta / varias clientas. */
export function textoDelAviso(mensajes: MensajeAviso[]): { texto: string; conversationId: string } {
  const ultimo = mensajes[mensajes.length - 1];
  const nombre = ultimo.contactName || "Sin nombre";
  const conversaciones = new Set(mensajes.map((x) => x.conversationId));
  let texto: string;
  if (mensajes.length === 1) texto = `💬 ${nombre}: ${ultimo.content}`;
  else if (conversaciones.size === 1) texto = `💬 ${mensajes.length} mensajes nuevos de ${nombre}`;
  else texto = `💬 Mensajes nuevos de ${nombre} y ${conversaciones.size - 1} más`;
  return { texto, conversationId: ultimo.conversationId };
}

export function leerSilenciado(): boolean {
  try {
    return localStorage.getItem(SILENCIO_KEY) === "1";
  } catch {
    return false;
  }
}

export function guardarSilenciado(v: boolean): void {
  try {
    localStorage.setItem(SILENCIO_KEY, v ? "1" : "0");
  } catch {
    /* sin storage: el silencio dura hasta recargar */
  }
}

/** "Ding" corto y suave con Web Audio. Si el navegador bloquea el audio, se ignora. */
export function sonarDing(): void {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => { void ctx.close().catch(() => {}); };
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* bloqueado: sin sonido */
  }
}
