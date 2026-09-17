/**
 * Correos que recibe un trabajador a lo largo de un proceso de selección.
 *
 * Los tres correos comparten el mismo esqueleto visual y, sobre todo, la
 * misma idea: cada uno dice paso a paso qué tiene que hacer la persona a
 * continuación, con los mismos nombres de botones y menús que verá en la
 * plataforma ("Aceptar Invitación", "Mis Postulaciones", "Iniciar Test",
 * "Finalizar"...). Si esos textos cambian en el front, hay que cambiarlos
 * aquí también.
 *
 * Se devuelven subject, text (versión plana) y html, para pasarlos tal cual
 * a EmailHelper.sendEmail.
 */

export interface WorkerEmail {
  subject: string;
  text: string;
  html: string;
}

interface Step {
  titulo: string;
  detalle: string;
}

const COLOR_PRIMARIO = '#0d9488';
const COLOR_PRIMARIO_CLARO = '#14b8a6';

function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FORMATO_FECHA: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

/**
 * Formatea una fecha en español de Chile.
 *
 * Las columnas `date` (sin hora, como end_date del proceso) llegan como
 * 'YYYY-MM-DD' o como Date a medianoche UTC. Si se convirtieran a hora de
 * Santiago se mostrarían un día antes, así que se formatean tal cual, en UTC.
 * Las fechas con hora (expiresAt) sí se muestran en hora de Chile.
 */
function formatearFecha(fecha?: Date | string | null): string | null {
  if (!fecha) return null;

  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-CL', {
      ...FORMATO_FECHA,
      timeZone: 'UTC',
    });
  }

  const dt = new Date(fecha);
  if (Number.isNaN(dt.getTime())) return null;

  const soloFecha =
    dt.getUTCHours() === 0 &&
    dt.getUTCMinutes() === 0 &&
    dt.getUTCSeconds() === 0;

  return dt.toLocaleDateString('es-CL', {
    ...FORMATO_FECHA,
    timeZone: soloFecha ? 'UTC' : 'America/Santiago',
  });
}

/** Lista numerada en texto plano. */
function stepsText(steps: Step[]): string {
  return steps
    .map((s, i) => `${i + 1}. ${s.titulo}\n   ${stripTags(s.detalle)}`)
    .join('\n\n');
}

/** Lista numerada en HTML, con tablas para que se vea igual en Gmail/Outlook. */
function stepsHtml(steps: Step[]): string {
  return steps
    .map(
      (s, i) => `
        <tr>
          <td style="vertical-align: top; padding: 10px 12px 10px 0; width: 36px;">
            <div style="width: 30px; height: 30px; line-height: 30px; border-radius: 15px; background: ${COLOR_PRIMARIO_CLARO}; color: #ffffff; text-align: center; font-weight: bold; font-size: 14px;">${i + 1}</div>
          </td>
          <td style="vertical-align: top; padding: 10px 0;">
            <div style="font-weight: bold; color: #111827; font-size: 15px;">${escapeHtml(s.titulo)}</div>
            <div style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-top: 2px;">${s.detalle}</div>
          </td>
        </tr>`,
    )
    .join('');
}

function bulletsHtml(items: string[]): string {
  return items
    .map(
      (t) =>
        `<li style="margin: 6px 0; color: #4b5563; font-size: 14px; line-height: 1.5;">${t}</li>`,
    )
    .join('');
}

function bulletsText(items: string[]): string {
  return items.map((t) => `- ${stripTags(t)}`).join('\n');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

interface LayoutOptions {
  titulo: string;
  subtitulo?: string;
  saludo: string;
  intro: string;
  infoProceso?: { label: string; value: string }[];
  pasosTitulo: string;
  pasos: Step[];
  boton?: { texto: string; url: string };
  recomendaciones?: string[];
  aviso?: string;
  cierre: string;
}

function layoutHtml(o: LayoutOptions): string {
  const info = o.infoProceso?.length
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #ffffff; border-left: 4px solid ${COLOR_PRIMARIO_CLARO}; border-radius: 6px; margin: 20px 0;">
        ${o.infoProceso
          .map(
            (r) => `
        <tr>
          <td style="padding: 6px 16px; color: #6b7280; font-size: 13px; width: 110px;">${escapeHtml(r.label)}</td>
          <td style="padding: 6px 16px 6px 0; color: #111827; font-size: 15px; font-weight: bold;">${escapeHtml(r.value)}</td>
        </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const boton = o.boton
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <a href="${o.boton.url}" style="display: inline-block; background: ${COLOR_PRIMARIO}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">${escapeHtml(o.boton.texto)}</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top: 10px; color: #6b7280; font-size: 12px;">
            Si el botón no funciona, copia este enlace en tu navegador:<br>
            <a href="${o.boton.url}" style="color: ${COLOR_PRIMARIO}; word-break: break-all;">${o.boton.url}</a>
          </td>
        </tr>
      </table>`
    : '';

  const recomendaciones = o.recomendaciones?.length
    ? `
      <div style="background: #ffffff; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
        <div style="font-weight: bold; color: ${COLOR_PRIMARIO}; font-size: 15px; margin-bottom: 6px;">Recomendaciones</div>
        <ul style="margin: 0; padding-left: 20px;">${bulletsHtml(o.recomendaciones)}</ul>
      </div>`
    : '';

  const aviso = o.aviso
    ? `<p style="color: #92400e; background: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 6px; font-size: 14px; line-height: 1.5;">${o.aviso}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(o.titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; color: #333333;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
          <tr>
            <td style="background: ${COLOR_PRIMARIO}; color: #ffffff; padding: 28px 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <div style="font-size: 13px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; margin-bottom: 6px;">Talentree</div>
              <h1 style="margin: 0; font-size: 24px; line-height: 1.3;">${escapeHtml(o.titulo)}</h1>
              ${o.subtitulo ? `<p style="margin: 8px 0 0; font-size: 15px; opacity: 0.9;">${escapeHtml(o.subtitulo)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 28px 30px; border-radius: 0 0 10px 10px; line-height: 1.6;">
              <p style="margin: 0 0 12px; font-size: 16px;">${o.saludo}</p>
              <p style="margin: 0 0 12px; font-size: 15px; color: #374151;">${o.intro}</p>
              ${info}
              <h2 style="font-size: 18px; color: ${COLOR_PRIMARIO}; margin: 24px 0 4px;">${escapeHtml(o.pasosTitulo)}</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #ffffff; border-radius: 8px; padding: 8px 16px;">
                ${stepsHtml(o.pasos)}
              </table>
              ${boton}
              ${recomendaciones}
              ${aviso}
              <p style="margin: 24px 0 0; font-size: 15px; color: #374151;">${o.cierre}</p>
              <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">Equipo Talentree</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 10px; text-align: center; color: #9ca3af; font-size: 12px;">
              Este correo se envió automáticamente desde la plataforma Talentree. Si no esperabas este mensaje, puedes ignorarlo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function layoutText(o: LayoutOptions): string {
  const partes: string[] = [];
  partes.push(stripTags(o.saludo));
  partes.push('');
  partes.push(stripTags(o.intro));
  if (o.infoProceso?.length) {
    partes.push('');
    o.infoProceso.forEach((r) => partes.push(`${r.label}: ${r.value}`));
  }
  partes.push('');
  partes.push(o.pasosTitulo.toUpperCase());
  partes.push('');
  partes.push(stepsText(o.pasos));
  if (o.boton) {
    partes.push('');
    partes.push(`${o.boton.texto}: ${o.boton.url}`);
  }
  if (o.recomendaciones?.length) {
    partes.push('');
    partes.push('RECOMENDACIONES');
    partes.push(bulletsText(o.recomendaciones));
  }
  if (o.aviso) {
    partes.push('');
    partes.push(stripTags(o.aviso));
  }
  partes.push('');
  partes.push(stripTags(o.cierre));
  partes.push('');
  partes.push('Equipo Talentree');
  return partes.join('\n');
}

// ---------------------------------------------------------------------------
// 1. Invitación a un proceso (se envía al crear y al reenviar la invitación)
// ---------------------------------------------------------------------------

export interface ProcessInvitationEmailInput {
  firstName: string;
  lastName: string;
  email: string;
  token: string;
  processName: string;
  position?: string | null;
  companyName?: string | null;
  expiresAt?: Date | null;
  reenvio?: boolean;
}

export function buildProcessInvitationEmail(
  i: ProcessInvitationEmailInput,
): WorkerEmail {
  const url = `${frontendUrl()}/invitations/${i.token}`;
  const nombre = `${i.firstName} ${i.lastName}`.trim();
  const empresa = i.companyName || 'la empresa';
  const vence = formatearFecha(i.expiresAt);

  const pasos: Step[] = [
    {
      titulo: 'Abre el enlace de la invitación',
      detalle:
        'Pulsa el botón <strong>"Aceptar Invitación"</strong> que aparece más abajo. Se abrirá la página de la invitación en la plataforma Talentree con el detalle del proceso.',
    },
    {
      titulo: 'Inicia sesión o crea tu cuenta',
      detalle: `Si ya tienes cuenta en Talentree, pulsa <strong>"Iniciar Sesión para Aceptar"</strong> e ingresa con este mismo correo (<strong>${escapeHtml(i.email)}</strong>). Si es tu primera vez, pulsa <strong>"Regístrate aquí"</strong> y completa el formulario con tus datos: nombre, RUT, teléfono y una contraseña. Usa este mismo correo al registrarte, de lo contrario la invitación no se podrá vincular a tu cuenta.`,
    },
    {
      titulo: 'Confirma la postulación',
      detalle:
        'Al terminar el registro o el inicio de sesión quedarás inscrito automáticamente en el proceso. Verás una pantalla de confirmación y te llevaremos a tu postulación.',
    },
    {
      titulo: 'Revisa el segundo correo',
      detalle:
        'Te enviaremos un correo de bienvenida con las instrucciones para rendir las evaluaciones del proceso. Ese es el siguiente paso.',
    },
  ];

  const recomendaciones = [
    'Guarda tu contraseña: la necesitarás para volver a entrar y rendir las evaluaciones.',
    'Revisa que tus datos de contacto (teléfono y correo) estén correctos. Por ahí te avisaremos de los siguientes pasos.',
    'Si el enlace ya venció o te aparece un error, avisa a la persona que te invitó para que te lo reenvíe.',
  ];

  const aviso = vence
    ? `<strong>Importante:</strong> esta invitación vence el <strong>${escapeHtml(vence)}</strong>. Después de esa fecha el enlace deja de funcionar.`
    : '<strong>Importante:</strong> esta invitación vence en 7 días. Después de esa fecha el enlace deja de funcionar.';

  const opciones: LayoutOptions = {
    titulo: i.reenvio ? 'Te reenviamos tu invitación' : 'Tienes una invitación',
    subtitulo: `Proceso de selección en ${empresa}`,
    saludo: `Hola <strong>${escapeHtml(nombre)}</strong>,`,
    intro: i.reenvio
      ? `Te reenviamos la invitación para postular al proceso de selección de <strong>${escapeHtml(empresa)}</strong>. El enlace anterior ya no sirve, usa el de este correo.`
      : `<strong>${escapeHtml(empresa)}</strong> te invitó a participar en un proceso de selección gestionado a través de Talentree. Para aceptar y comenzar, sigue estos pasos:`,
    infoProceso: [
      { label: 'Proceso', value: i.processName },
      ...(i.position ? [{ label: 'Cargo', value: i.position }] : []),
      { label: 'Empresa', value: empresa },
    ],
    pasosTitulo: 'Qué tienes que hacer',
    pasos,
    boton: { texto: 'Aceptar Invitación', url },
    recomendaciones,
    aviso,
    cierre: 'Si tienes dudas sobre el proceso, responde a este correo o contacta a la persona que te invitó. ¡Mucho éxito!',
  };

  return {
    subject: i.reenvio
      ? `Reenvío: invitación al proceso de selección "${i.processName}"`
      : `Invitación al proceso de selección "${i.processName}" - ${empresa}`,
    text: layoutText(opciones),
    html: layoutHtml(opciones),
  };
}

// ---------------------------------------------------------------------------
// 2. Bienvenida al proceso (se envía cuando el trabajador acepta la invitación)
// ---------------------------------------------------------------------------

export interface WelcomeToProcessEmailInput {
  workerName: string;
  /** Correo con el que el trabajador entra a la plataforma. */
  workerEmail?: string;
  processName: string;
  companyName: string;
  position: string;
  endDate?: Date | string | null;
  /** Id del WorkerProcess: permite enlazar directo a la postulación. */
  workerProcessId?: string;
  /**
   * true cuando fue la empresa o el admin quien inscribió al trabajador
   * (botón "Invitar Trabajadores"), sin que él postulara. Cambia el tono:
   * no "gracias por postular" sino "te inscribieron, esto es lo que sigue".
   */
  inscritoPorEmpresa?: boolean;
}

export function buildWelcomeToProcessEmail(
  i: WelcomeToProcessEmailInput,
): WorkerEmail {
  const base = frontendUrl();
  const urlLogin = `${base}/login`;
  const cierre = formatearFecha(i.endDate);

  // Enlace directo: al iniciar sesión, la página de login respeta ?redirect=
  // y deja al trabajador dentro de su postulación, sin buscarla en el menú.
  const rutaPostulacion = i.workerProcessId
    ? `/trabajador/postulaciones/${i.workerProcessId}`
    : null;
  const urlDirecta = rutaPostulacion
    ? `${urlLogin}?redirect=${encodeURIComponent(rutaPostulacion)}`
    : urlLogin;

  const correoAcceso = i.workerEmail
    ? ` con el correo <strong>${escapeHtml(i.workerEmail)}</strong>`
    : ' con tu correo';

  const pasos: Step[] = [
    {
      titulo: 'Ingresa a la plataforma',
      detalle: i.inscritoPorEmpresa
        ? `Pulsa el botón <strong>"Ir a mi postulación"</strong> de este correo e inicia sesión${correoAcceso} y tu contraseña de Talentree. Si nunca recibiste una contraseña o no la recuerdas, pide una nueva a la persona que te inscribió en el proceso antes de continuar.`
        : `Pulsa el botón <strong>"Ir a mi postulación"</strong> de este correo e inicia sesión${correoAcceso} y la contraseña que creaste al registrarte.`,
    },
    {
      titulo: 'Abre tu postulación',
      detalle: rutaPostulacion
        ? `Después de iniciar sesión llegarás directo a tu postulación <strong>"${escapeHtml(i.processName)}"</strong>. Si entras por otra vía, la encuentras en el menú lateral, en <strong>"Mis Postulaciones"</strong>.`
        : `En el menú lateral pulsa <strong>"Mis Postulaciones"</strong> y luego entra a la postulación <strong>"${escapeHtml(i.processName)}"</strong>.`,
    },
    {
      titulo: 'Revisa las evaluaciones asignadas',
      detalle:
        'Verás la lista de evaluaciones que debes rendir, con la duración y el número de preguntas de cada una. Todas deben quedar completas.',
    },
    {
      titulo: 'Comienza una evaluación',
      detalle:
        'Pulsa <strong>"Iniciar Test"</strong>. Lee las instrucciones con calma antes de responder. Si la evaluación tiene tiempo límite, el cronómetro parte en ese momento y no se detiene aunque cierres la página, así que reserva el tiempo completo antes de empezar.',
    },
    {
      titulo: 'Responde y avanza',
      detalle:
        'Responde cada pregunta y pulsa <strong>"Siguiente"</strong>. Mientras no envíes el test puedes volver con <strong>"Anterior"</strong> para revisar una respuesta.',
    },
    {
      titulo: 'Envía el test',
      detalle:
        'En la última pregunta pulsa <strong>"Finalizar"</strong> y confirma el envío. Una vez enviado, el test no se puede repetir ni modificar, por eso conviene revisar antes que no queden preguntas sin responder.',
    },
    {
      titulo: 'Repite con cada evaluación',
      detalle:
        'Vuelve a tu postulación y rinde las evaluaciones que falten hasta que todas aparezcan como <strong>"Completado"</strong>. Cuando termines la última recibirás un correo de confirmación.',
    },
  ];

  const recomendaciones = [
    'Usa un computador o celular con conexión estable, en un lugar tranquilo y sin interrupciones.',
    'Responde con honestidad y según tu primera impresión. No hay respuestas buenas o malas en las pruebas de personalidad.',
    'Si se corta la conexión, vuelve a entrar a tu postulación y pulsa <strong>"Continuar Test"</strong>. Tus respuestas quedan guardadas en el mismo dispositivo y navegador donde empezaste, así que retoma desde ahí.',
    'No es necesario rendir todas las evaluaciones el mismo día, pero sí antes de la fecha de cierre del proceso.',
  ];

  const opciones: LayoutOptions = {
    titulo: i.inscritoPorEmpresa
      ? 'Te inscribieron en un proceso de selección'
      : 'Bienvenido/a al proceso',
    subtitulo: `${i.position} en ${i.companyName}`,
    saludo: `Hola <strong>${escapeHtml(i.workerName)}</strong>,`,
    intro: i.inscritoPorEmpresa
      ? `<strong>${escapeHtml(i.companyName)}</strong> te inscribió en el proceso de selección <strong>"${escapeHtml(i.processName)}"</strong> a través de Talentree. Para participar tienes que rendir las evaluaciones asignadas en la plataforma. Aquí te explicamos cómo hacerlo, paso a paso:`
      : `Tu postulación al proceso <strong>"${escapeHtml(i.processName)}"</strong> de <strong>${escapeHtml(i.companyName)}</strong> quedó registrada. El siguiente paso es rendir las evaluaciones asignadas. Aquí te explicamos cómo hacerlo:`,
    infoProceso: [
      { label: 'Proceso', value: i.processName },
      { label: 'Cargo', value: i.position },
      { label: 'Empresa', value: i.companyName },
      ...(cierre ? [{ label: 'Cierre', value: cierre }] : []),
    ],
    pasosTitulo: 'Cómo rendir tus evaluaciones',
    pasos,
    boton: { texto: 'Ir a mi postulación', url: urlDirecta },
    recomendaciones,
    aviso: cierre
      ? `<strong>Plazo:</strong> el proceso cierra el <strong>${escapeHtml(cierre)}</strong>. Te recomendamos completar las evaluaciones antes de esa fecha, sin dejarlo para el último día.`
      : '<strong>Plazo:</strong> te recomendamos completar las evaluaciones lo antes posible. Las postulaciones se revisan a medida que van quedando completas.',
    cierre: 'Si tienes algún problema para ingresar o para rendir una evaluación, responde a este correo y te ayudamos. ¡Mucho éxito!',
  };

  return {
    subject: i.inscritoPorEmpresa
      ? `${i.companyName} te inscribió en el proceso "${i.processName}": cómo rendir tus evaluaciones`
      : `Bienvenido/a al proceso "${i.processName}": cómo rendir tus evaluaciones`,
    text: layoutText(opciones),
    html: layoutHtml(opciones),
  };
}

// ---------------------------------------------------------------------------
// 3. Evaluaciones completadas (se envía al terminar la última evaluación)
// ---------------------------------------------------------------------------

export interface TestsCompletedEmailInput {
  workerName: string;
  processName: string;
  companyName: string;
  position: string;
  testsCompleted: number;
}

export function buildTestsCompletedEmail(
  i: TestsCompletedEmailInput,
): WorkerEmail {
  const base = frontendUrl();
  const urlPostulaciones = `${base}/trabajador/postulaciones`;

  const pasos: Step[] = [
    {
      titulo: 'Revisión de tus resultados',
      detalle: `El equipo de selección de <strong>${escapeHtml(i.companyName)}</strong> revisará tus evaluaciones y tu perfil. No tienes que hacer nada más en la plataforma por ahora.`,
    },
    {
      titulo: 'Sigue el estado de tu postulación',
      detalle: `Puedes ver en qué etapa está tu postulación en <strong>"Mis Postulaciones"</strong>, dentro de la plataforma.`,
    },
    {
      titulo: 'Mantén tus datos al día',
      detalle:
        'Si cambias de teléfono o correo, actualízalos en <strong>"Mi Perfil"</strong>. Por esos medios te avisaremos de los siguientes pasos (entrevistas, resultados u otras etapas).',
    },
  ];

  const opciones: LayoutOptions = {
    titulo: 'Evaluaciones completadas',
    subtitulo: `${i.position} en ${i.companyName}`,
    saludo: `Hola <strong>${escapeHtml(i.workerName)}</strong>,`,
    intro: `Completaste las <strong>${i.testsCompleted}</strong> evaluaciones del proceso <strong>"${escapeHtml(i.processName)}"</strong>. Gracias por tu tiempo y dedicación.`,
    infoProceso: [
      { label: 'Proceso', value: i.processName },
      { label: 'Cargo', value: i.position },
      { label: 'Empresa', value: i.companyName },
      { label: 'Evaluaciones', value: `${i.testsCompleted} completadas` },
    ],
    pasosTitulo: 'Qué sigue ahora',
    pasos,
    boton: { texto: 'Ver mis postulaciones', url: urlPostulaciones },
    cierre: 'Te contactaremos cuando haya novedades sobre el proceso. ¡Gracias por participar!',
  };

  return {
    subject: `Completaste las evaluaciones para ${i.position} en ${i.companyName}`,
    text: layoutText(opciones),
    html: layoutHtml(opciones),
  };
}
