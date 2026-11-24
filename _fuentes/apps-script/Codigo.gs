/**
 * ARCHIFF · Fichas de matrícula
 * Recibe la ficha desde la web, genera el PDF, lo guarda en Drive,
 * lo envía al alumno, avisa al equipo, lo anota en HubSpot y en la hoja de registro.
 *
 * Se ejecuta con la cuenta de vferrer@archiff.com (aplicación web: "Ejecutar como: yo").
 *
 * Propiedades del script (Configuración del proyecto › Propiedades del script):
 *   SECRET          código secreto que también está en la web
 *   HUBSPOT_TOKEN   clave de servicio de HubSpot (contactos: leer y escribir)
 *   CARPETA_ID      17MrVklqVubL08mYmZx9ACR6EiFYrBxE8  (MATRÍCULAS 2027)
 *   AVISO_ERRORES   julieta@archiff.com
 */

var ZONA = 'Europe/Madrid';
var LOGO_URL = 'https://formularios.archiff.com/assets/logo-archiff.png';
var AZUL = '#2222C2';
var HOJA_REGISTRO = 'Registro de fichas de matrícula';
var COPIA_AVISOS = 'info@archiff.com';

// Carpeta de cada máster dentro de MATRÍCULAS 2027: "<nombre> (<convocatoria>)"
var MASTERS = {
  mba:        { nombre: 'MBA en Gestión de Estudios de Arquitectura e Interiorismo', carpeta: 'MBA 3º Ed.', convs: ["Abril 2027"] },
  mia:        { nombre: 'MIA – Máster en Interiorismo Aplicado, Prácticas Creativas e IA', carpeta: 'MIA', convs: ["Octubre 2027"] },
  da:         { nombre: 'Máster en Dirección de Arte', carpeta: 'Dirección de Arte', convs: ["Abril 2027", "Octubre 2027"] },
  branding:   { nombre: 'Máster en Branding y Estrategia de Marca', carpeta: 'Branding y Estrategia de Marca', convs: ["Abril 2027", "Octubre 2027"] },
  dg:         { nombre: 'Máster en Diseño Gráfico', carpeta: 'Diseño Gráfico', convs: ["Abril 2027", "Octubre 2027"] },
  mobiliario: { nombre: 'Máster en Diseño de Mobiliario', carpeta: 'Diseño de Mobiliario', convs: ["Octubre 2027"] },
  retail:     { nombre: 'Máster en Retail Design y Experiencia Espacial', carpeta: 'Retail Design', convs: ["Abril 2027", "Octubre 2027"] },
  decoracion: { nombre: 'Máster en Decoración de Interiores', carpeta: 'Decoración de Interiores', convs: ["Octubre 2027"] },
  uxui:       { nombre: 'Máster en UX/UI', carpeta: 'UX-UI', convs: ["Octubre 2027"] },
  motion:     { nombre: 'Máster en Motion Graphics', carpeta: 'Motion Graphics', convs: ["Octubre 2027"] },
  eventos:    { nombre: 'Máster en Dirección y Creación de Eventos', carpeta: 'Eventos', convs: ["Octubre 2027"] },
  marketing:  { nombre: 'Máster en Marketing para Creativos', carpeta: 'Marketing para Creativos', convs: ["Octubre 2027"] },
  packaging:  { nombre: 'Máster en Packaging e Identidad de Marca', carpeta: 'Packaging e Identidad de Marca', convs: ["Octubre 2027"] },
  dc:         { nombre: 'Máster en Dirección Creativa', carpeta: 'Dirección Creativa', convs: ["Octubre 2027"] }
};
var BANCO = [['Banco', 'BANKINTER'], ['IBAN', 'ES11 0128 0625 0601 0004 6592'], ['BIC/SWIFT', 'BKBKESMMXXX'], ['Titular', 'ARCHIFF INTERNATIONAL TECHNOLOGY SL']];

/* =====================================================================
 * Entrada desde la web
 * ===================================================================== */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return responder(false, 'Datos no válidos'); }
  if (!body || body.secret !== props.getProperty('SECRET')) return responder(false, 'Código no válido');

  var d = body.data || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(60000);
  var errores = [];
  try {
    procesarFicha(d, errores);
  } catch (err) {
    errores.push('Error general: ' + err);
  } finally {
    lock.releaseLock();
  }
  if (errores.length) avisarErrores(d, errores);
  return responder(errores.length === 0, errores.join(' | '));
}

function doGet() { return responder(true, 'Fichas de matrícula Archiff: en marcha'); }

function responder(ok, msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, mensaje: msg || '' })).setMimeType(ContentService.MimeType.JSON);
}

/* =====================================================================
 * Proceso principal
 * ===================================================================== */
function procesarFicha(d, errores) {
  validarDatos(d);
  var raiz = carpetaRaiz(); // lanza error claro si no hay acceso
  var m = MASTERS[d.formacionCode];
  var carpeta = carpetaMaster(raiz, d.formacionCode, d.convocatoria);

  // 1. PDF
  var fecha = new Date(d.fecha || new Date());
  var nombreArchivo = 'Ficha matrícula – ' + d.apellidos + ', ' + d.nombre + ' – ' + m.carpeta + ' – ' + Utilities.formatDate(fecha, ZONA, 'yyyy-MM-dd') + '.pdf';
  var pdf = Utilities.newBlob(htmlPdf(d), 'text/html', 'ficha.html').getAs('application/pdf').setName(nombreArchivo);
  var archivo = carpeta.createFile(pdf);
  var enlacePdf = archivo.getUrl();

  // 2. Correo al alumno
  paso(errores, 'Correo al alumno', function () {
    MailApp.sendEmail({
      to: d.email,
      subject: 'Tu matrícula en ' + m.nombre + ' · Archiff',
      name: 'Archiff',
      htmlBody: htmlCorreoAlumno(d),
      body: textoPlano(htmlCorreoAlumno(d)),
      attachments: [archivo.getBlob()]
    });
  });

  // 3. Aviso interno
  paso(errores, 'Aviso interno', function () {
    var para = d.formacionCode === 'mba' ? 'jorge@archiff.com' : 'vferrer@archiff.com';
    MailApp.sendEmail({
      to: para,
      cc: COPIA_AVISOS,
      subject: 'Nueva ficha de matrícula · ' + m.nombre + ' · ' + d.nombre + ' ' + d.apellidos,
      name: 'Archiff · Fichas de matrícula',
      htmlBody: htmlAvisoInterno(d, carpeta.getUrl(), enlacePdf),
      attachments: [archivo.getBlob()]
    });
  });

  // 4. HubSpot: enlace del PDF y nota
  paso(errores, 'HubSpot', function () { anotarHubSpot(d, enlacePdf, fecha); });

  // 5. Hoja de registro
  paso(errores, 'Hoja de registro', function () { anotarRegistro(raiz, d, enlacePdf, fecha); });
}

function paso(errores, nombre, fn) {
  try { fn(); } catch (err) { errores.push(nombre + ': ' + err); }
}

function validarDatos(d) {
  if (!d.email || !d.nombre || !d.apellidos) throw new Error('Faltan nombre, apellidos o correo');
  if (!MASTERS[d.formacionCode]) throw new Error('Formación desconocida: ' + d.formacionCode);
  if (MASTERS[d.formacionCode].convs.indexOf(d.convocatoria) < 0) throw new Error('Convocatoria desconocida: ' + d.convocatoria);
}

/* =====================================================================
 * Drive
 * ===================================================================== */
function carpetaRaiz() {
  var id = PropertiesService.getScriptProperties().getProperty('CARPETA_ID');
  var yo = Session.getEffectiveUser().getEmail();
  try {
    var f = DriveApp.getFolderById(id);
    f.getName();
    return f;
  } catch (err) {
    throw new Error('La cuenta ' + yo + ' no tiene acceso a la carpeta MATRÍCULAS 2027 (ID ' + id + '). Hay que darle acceso de Gestor de contenido en la unidad compartida.');
  }
}

function nombreCarpeta(code, conv) { return MASTERS[code].carpeta + ' (' + conv + ')'; }

function carpetaMaster(raiz, code, conv) {
  var nombre = nombreCarpeta(code, conv);
  var it = raiz.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  return raiz.createFolder(nombre); // solo se crea si no existe
}

function anotarRegistro(raiz, d, enlacePdf, fecha) {
  var it = raiz.getFilesByName(HOJA_REGISTRO), ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else {
    ss = SpreadsheetApp.create(HOJA_REGISTRO);
    DriveApp.getFileById(ss.getId()).moveTo(raiz);
    var h = ss.getSheets()[0];
    h.appendRow(['Fecha', 'Referencia', 'Alumno/a', 'Correo', 'Máster', 'Convocatoria', 'Forma de pago', 'Importe', 'PDF']);
    h.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#F1F1FC');
    h.setFrozenRows(1);
  }
  // Se escribe como texto para que Sheets no convierta "Octubre 2027" en fecha ni los importes en números.
  var hoja = ss.getSheets()[0], fila = hoja.getLastRow() + 1;
  hoja.getRange(fila, 1, 1, 9).setNumberFormat('@').setValues([[
    Utilities.formatDate(fecha, ZONA, 'dd/MM/yyyy HH:mm'), d.referencia, d.apellidos + ', ' + d.nombre, d.email,
    MASTERS[d.formacionCode].nombre, d.convocatoria, d.pagoTexto, d.importeTexto, enlacePdf
  ]]);
}

/* =====================================================================
 * HubSpot
 * ===================================================================== */
function hubspot(method, path, payload) {
  var token = PropertiesService.getScriptProperties().getProperty('HUBSPOT_TOKEN');
  var res = UrlFetchApp.fetch('https://api.hubapi.com' + path, {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: payload ? JSON.stringify(payload) : undefined
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('HubSpot ' + method + ' ' + path + ' → ' + code + ': ' + res.getContentText().slice(0, 300));
  return res.getContentText() ? JSON.parse(res.getContentText()) : {};
}

function anotarHubSpot(d, enlacePdf, fecha) {
  // El envío del formulario puede tardar unos segundos en crear el contacto: reintenta.
  var id = null;
  for (var i = 0; i < 6 && !id; i++) {
    var r = hubspot('post', '/crm/v3/objects/contacts/search', {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: d.email }] }], limit: 1
    });
    if (r.results && r.results.length) id = r.results[0].id;
    else Utilities.sleep(5000);
  }
  if (!id) {
    id = hubspot('post', '/crm/v3/objects/contacts', { properties: { email: d.email, firstname: d.nombre, lastname: d.apellidos } }).id;
  }
  hubspot('patch', '/crm/v3/objects/contacts/' + id, { properties: { matricula_pdf_url: enlacePdf } });
  hubspot('post', '/crm/v3/objects/notes', {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_note_body: 'Ficha de matrícula enviada al alumno el ' + Utilities.formatDate(fecha, ZONA, 'dd/MM/yyyy') +
        ' – ' + d.pagoTexto + ' – PDF: <a href="' + enlacePdf + '">' + enlacePdf + '</a>'
    },
    associations: [{ to: { id: id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }]
  });
}

/* =====================================================================
 * Avisos de error
 * ===================================================================== */
function avisarErrores(d, errores) {
  var para = PropertiesService.getScriptProperties().getProperty('AVISO_ERRORES') || 'julieta@archiff.com';
  var lineas = [
    'Ha fallado algo al procesar una ficha de matrícula. Los datos sí han llegado a HubSpot.', '',
    'Errores:', '- ' + errores.join('\n- '), '',
    'Referencia: ' + (d.referencia || '—'),
    'Alumno/a: ' + (d.nombre || '') + ' ' + (d.apellidos || ''),
    'Correo: ' + (d.email || '—'),
    'Máster: ' + ((MASTERS[d.formacionCode] || {}).nombre || d.formacionCode || '—') + ' · ' + (d.convocatoria || ''),
    'Forma de pago: ' + (d.pagoTexto || '—')
  ];
  try { MailApp.sendEmail(para, 'ERROR ficha de matrícula · ' + (d.referencia || 'sin referencia'), lineas.join('\n')); } catch (err) { console.error(err); }
}

/* =====================================================================
 * Textos y diseño
 * ===================================================================== */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function euros(n) {
  var cents = Math.round(Number(n) * 100), e = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return e + ',' + ('0' + (cents % 100)).slice(-2) + ' €';
}
function fechaEs(iso) { if (!iso) return '—'; var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
function ibanBonito(s) { return String(s || '').replace(/(.{4})/g, '$1 ').trim(); }
function textoPlano(html) { return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|tr|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }

var LOGO_CACHE = null;
function logoDataUri() {
  if (LOGO_CACHE) return LOGO_CACHE;
  try {
    var b = UrlFetchApp.fetch(LOGO_URL).getBlob();
    LOGO_CACHE = 'data:image/png;base64,' + Utilities.base64Encode(b.getBytes());
  } catch (err) { LOGO_CACHE = ''; }
  return LOGO_CACHE;
}
// En los correos se usa la imagen publicada (Gmail bloquea las imágenes incrustadas);
// en el PDF se incrusta, porque el conversor no descarga imágenes de internet.
function logoCorreo(alto) {
  return '<img src="' + LOGO_URL + '" alt="Archiff" height="' + alto + '" style="height:' + alto + 'px;width:auto;display:block;border:0">';
}
function logoHtml(alto) {
  var uri = logoDataUri();
  return uri ? '<img src="' + uri + '" alt="Archiff" style="height:' + alto + 'px">' : '<span style="font-size:' + alto + 'px;font-weight:bold;color:#111118">.archiff</span>';
}

function filasResumen(d) {
  var filas = [
    ['Referencia', d.referencia],
    ['Formación', MASTERS[d.formacionCode].nombre],
    ['Convocatoria', d.convocatoria],
    ['Horario', d.horario],
    ['Precio total', euros(d.precio) + (d.earlyBird ? ' (precio promocional)' : '')],
    ['Reserva abonada', '250,00 €'],
    ['Forma de pago', d.pagoTexto]
  ];
  if (d.pago === 'unico') filas.push(['Importe a transferir', d.importeTexto]);
  else filas.push(['Cuota mensual', d.importeTexto + (d.ultimaCuota && d.ultimaCuota !== d.importe ? ' (última cuota: ' + euros(d.ultimaCuota) + ')' : '')]);
  return filas;
}
function tabla(filas) {
  return '<table style="width:100%;border-collapse:collapse;font-size:13px">' + filas.map(function (f) {
    return '<tr><td style="padding:6px 0;border-bottom:1px solid #E4E4EE;color:#5A5A6B;width:42%">' + esc(f[0]) + '</td>' +
      '<td style="padding:6px 0;border-bottom:1px solid #E4E4EE;font-weight:bold;color:#111118">' + esc(f[1]) + '</td></tr>';
  }).join('') + '</table>';
}
function titulo(t) { return '<h3 style="margin:22px 0 6px;font-size:14px;color:' + AZUL + ';text-transform:uppercase;letter-spacing:.04em">' + esc(t) + '</h3>'; }
function filasBanco(d) { return BANCO.concat([['Concepto', d.concepto]]); }

function htmlPdf(d) {
  var personales = [
    ['Nombre y apellidos', d.nombre + ' ' + d.apellidos], ['Fecha de nacimiento', fechaEs(d.nacimiento)],
    ['Correo electrónico', d.email], ['Teléfono', d.telefono], ['País de domicilio', d.pais], ['Nacionalidad', d.nacionalidad],
    ['Documento', d.tipoDocumento + ' ' + d.numeroDocumento]
  ];
  var factura = [['Factura a nombre de empresa', d.facturaEmpresa ? 'Sí' : 'No']];
  if (d.facturaEmpresa) factura.push(['Razón social', d.razonSocial], ['CIF', d.cif]);
  factura.push(['Domicilio', d.domicilio], ['Población', d.poblacion], ['Provincia', d.provincia], ['Código postal', d.codigoPostal]);

  var pago = d.pago === 'unico'
    ? tabla(filasBanco(d)) + '<p style="font-size:12px;margin:8px 0 0">Plazo máximo para la transferencia: 15 días desde el envío de esta ficha.</p>'
    : tabla([['Titular de la cuenta', d.titular], ['IBAN', ibanBonito(d.iban)], ['BIC', d.bic || '—'], ['Número de cuotas', d.numCuotas]]) +
      '<p style="font-size:12px;margin:8px 0 0">El/la titular autoriza a Archiff a cobrar las cuotas de la matrícula en esta cuenta mediante domiciliación bancaria.</p>';

  var hoy = Utilities.formatDate(new Date(d.fecha || new Date()), ZONA, 'dd/MM/yyyy');
  return '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#111118;margin:28px">' +
    '<table style="width:100%;border-collapse:collapse"><tr><td>' + logoHtml(26) + '</td>' +
    '<td style="text-align:right;font-size:12px;color:#5A5A6B">Ficha de matrícula<br>' + esc(d.referencia) + ' · ' + hoy + '</td></tr></table>' +
    '<div style="height:3px;background:' + AZUL + ';margin:14px 0 4px"></div>' +
    '<h1 style="font-size:22px;color:' + AZUL + ';margin:14px 0 2px">Ficha de matrícula</h1>' +
    '<p style="margin:0;font-size:13px;color:#5A5A6B">' + esc(MASTERS[d.formacionCode].nombre) + ' · ' + esc(d.convocatoria) + '</p>' +
    titulo('Formación') + tabla(filasResumen(d)) +
    titulo('Datos personales') + tabla(personales) +
    titulo('Datos de facturación') + tabla(factura) +
    titulo(d.pago === 'unico' ? 'Pago por transferencia' : 'Domiciliación bancaria') + pago +
    titulo('Consentimientos') + tabla([
      ['Condiciones de matrícula y política de privacidad', 'Aceptadas'],
      ['Comunicaciones comerciales', d.comunicaciones ? 'Sí' : 'No']
    ]) +
    '<table style="width:100%;margin-top:34px;border-collapse:collapse"><tr>' +
    '<td style="width:60%;padding-right:20px"><div style="height:70px;border:1px solid #C9C9D8;border-radius:6px"></div><div style="font-size:12px;color:#5A5A6B;margin-top:4px">Firma del alumno/a</div></td>' +
    '<td><div style="height:70px;border:1px solid #C9C9D8;border-radius:6px"></div><div style="font-size:12px;color:#5A5A6B;margin-top:4px">Fecha</div></td>' +
    '</tr></table>' +
    '<p style="font-size:10px;color:#8E8EA3;margin-top:24px">ARCHIFF INTERNATIONAL TECHNOLOGY SL · info@archiff.com · archiff.com</p>' +
    '</body></html>';
}

function htmlCorreoAlumno(d) {
  var m = MASTERS[d.formacionCode];
  var pagoTxt = d.pago === 'unico'
    ? '<p>Has elegido el <strong>pago único</strong>. Haz la transferencia de <strong>' + esc(d.importeTexto) + '</strong> en un plazo máximo de <strong>15 días</strong> con estos datos:</p>' + tabla(filasBanco(d))
    : '<p>Has elegido pagar en <strong>' + esc(d.numCuotas) + ' cuotas</strong> de <strong>' + esc(d.importeTexto) + '</strong>. Las cobraremos por <strong>domiciliación bancaria</strong> en la cuenta que nos has indicado (terminada en ' + esc(String(d.iban || '').slice(-4)) + ').</p>';
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111118;font-size:15px;line-height:1.55;max-width:600px">' +
    '<p>' + logoCorreo(22) + '</p>' +
    '<p>Hola, ' + esc(d.nombre) + ':</p>' +
    '<p>¡Gracias por completar tu matrícula en el <strong>' + esc(m.nombre) + '</strong>! Te adjuntamos tu ficha de matrícula en PDF.</p>' +
    '<h3 style="color:' + AZUL + ';font-size:16px;margin:20px 0 6px">Resumen de tu matrícula</h3>' + tabla(filasResumen(d)) +
    '<div style="margin-top:18px">' + pagoTxt + '</div>' +
    '<p>Si tienes cualquier duda, responde a este correo o escríbenos a info@archiff.com.</p>' +
    '<p>Un abrazo,<br>El equipo de Archiff</p></div>';
}

function htmlAvisoInterno(d, carpetaUrl, pdfUrl) {
  var filas = [['Alumno/a', d.nombre + ' ' + d.apellidos], ['Correo', d.email], ['Teléfono', d.telefono]].concat(filasResumen(d));
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111118;font-size:14px;line-height:1.5;max-width:640px">' +
    '<p>Ha llegado una nueva ficha de matrícula. Va adjunta en PDF.</p>' + tabla(filas) +
    '<p style="margin-top:16px"><a href="' + carpetaUrl + '">Abrir la carpeta del máster</a> · <a href="' + pdfUrl + '">Abrir el PDF en Drive</a></p></div>';
}

/* =====================================================================
 * Comprobación manual (ejecutar desde el editor; no envía nada)
 * ===================================================================== */
function comprobarConfiguracion() {
  var props = PropertiesService.getScriptProperties();
  ['SECRET', 'HUBSPOT_TOKEN', 'CARPETA_ID', 'AVISO_ERRORES'].forEach(function (k) {
    console.log(k + ': ' + (props.getProperty(k) ? 'OK' : 'FALTA'));
  });
  console.log('Cuenta que ejecuta: ' + Session.getEffectiveUser().getEmail());
  var raiz = carpetaRaiz();
  console.log('Acceso a "' + raiz.getName() + '": OK');
  Object.keys(MASTERS).forEach(function (code) {
    MASTERS[code].convs.forEach(function (conv) {
      var n = nombreCarpeta(code, conv);
      console.log((raiz.getFoldersByName(n).hasNext() ? 'EXISTE   ' : 'se creará ') + n);
    });
  });
  hubspot('get', '/crm/v3/objects/contacts?limit=1');
  console.log('HubSpot: OK');
  console.log('Cuota de correos restante hoy: ' + MailApp.getRemainingDailyQuota());
}
