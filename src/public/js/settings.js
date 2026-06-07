/**
 * FlightCabin — Settings Frontend
 * Einstellungen werden im LocalStorage + auf dem Server gespeichert
 */

// ─── Standardwerte ───────────────────────────────────────
const DEFAULTS = {
  simbriefId:        '',
  simbriefUsername:  '',
  simbriefAutoload:  false,
  annLanguage:       'de',
  annLanguage2:      'en-gb',
  annBilingual:      false,
  annStyle:          'standard',
  ttsVoice:          'auto',
  ttsRate:           0.85,
  ttsVolume:         1.0,
  ttsPause:          0.5,
  boardBusinessSeats: 12,
  boardAutoAnn:       true,
  boardBusinessFirst: true,
  boardHalfwayAnn:    true,
  boardGsxInterval:   3,
};

// Ansagetexte je Sprache (Vorschau + echter Einsatz)
const ANNOUNCEMENTS = {
  de: {
    WELCOME: (f) => `Meine Damen und Herren, herzlich willkommen an Bord unseres Fluges ${f} nach unserem Ziel. Wir freuen uns, Sie heute als unsere Gäste begrüßen zu dürfen.`,
    BOARDING_COMPLETE: () => `Meine Damen und Herren, das Einsteigen ist nun abgeschlossen. Bitte legen Sie Ihren Sicherheitsgurt an und bringen Sie Ihre Rückenlehne in die aufrechte Position.`,
    SAFETY_DEMO: () => `Meine Damen und Herren, bitte schenken Sie der Sicherheitsdemonstration Ihre Aufmerksamkeit. Dieses Flugzeug ist mit Sicherheitsgurten ausgestattet.`,
    TAKEOFF_PREP: () => `Meine Damen und Herren, wir sind jetzt bereit zum Start. Bitte stellen Sie sicher, dass Ihre Sicherheitsgurte angelegt sind.`,
    CRUISE: () => `Meine Damen und Herren, wir haben unsere Reiseflughöhe erreicht. Der Kapitän hat das Anschnallzeichen ausgeschaltet.`,
    DESCENT: () => `Meine Damen und Herren, wir beginnen unseren Sinkflug. Bitte nehmen Sie Ihren Sitzplatz ein und legen Sie Ihren Sicherheitsgurt an.`,
    LANDING: () => `Meine Damen und Herren, wir landen jetzt. Bitte stellen Sie sicher, dass Ihr Sicherheitsgurt angelegt ist.`,
    AFTER_LANDING: () => `Meine Damen und Herren, herzlich willkommen. Bitte bleiben Sie angeschnallt, bis das Flugzeug vollständig zum Stillstand gekommen ist. Vielen Dank, dass Sie mit uns geflogen sind.`,
    TURBULENCE: () => `Meine Damen und Herren, wir durchfliegen eine Zone mit Turbulenzen. Bitte nehmen Sie Ihren Sitzplatz ein und legen Sie Ihren Sicherheitsgurt an.`,
    DOORS_CLOSING: () => `Meine Damen und Herren, die Türen werden jetzt geschlossen. Bitte überprüfen Sie, ob Ihr Sicherheitsgurt angelegt ist.`,
    DELAY: (m) => `Meine Damen und Herren, leider müssen wir Ihnen mitteilen, dass unser Flug sich um ${m} Minuten verzögert. Wir entschuldigen uns für die Unannehmlichkeiten.`,
  },
  'en-gb': {
    WELCOME: (f) => `Ladies and gentlemen, welcome on board flight ${f}. We are delighted to have you with us today and we hope you enjoy your flight.`,
    BOARDING_COMPLETE: () => `Ladies and gentlemen, boarding is now complete. Please ensure your seatbelt is fastened and your seat back is in the upright position.`,
    SAFETY_DEMO: () => `Ladies and gentlemen, on behalf of the crew, we ask that you please direct your attention to the front of the cabin as we review the emergency procedures.`,
    TAKEOFF_PREP: () => `Ladies and gentlemen, we are now ready for departure. Please ensure your seatbelts are fastened and all electronic devices are switched off or in flight mode.`,
    CRUISE: () => `Ladies and gentlemen, we have now reached our cruising altitude. The captain has turned off the seatbelt sign. You are now free to move about the cabin.`,
    DESCENT: () => `Ladies and gentlemen, we have begun our descent. Please return to your seats and fasten your seatbelts. Stow any items and return your seat to the upright position.`,
    LANDING: () => `Ladies and gentlemen, we are now making our final approach. Please ensure your seatbelt is securely fastened for landing.`,
    AFTER_LANDING: () => `Ladies and gentlemen, welcome. Please remain seated with your seatbelt fastened until the aircraft has come to a complete stop. Thank you for flying with us today.`,
    TURBULENCE: () => `Ladies and gentlemen, we are currently experiencing some turbulence. Please return to your seat and fasten your seatbelt immediately.`,
    DOORS_CLOSING: () => `Ladies and gentlemen, the doors are now closing. Please ensure your seatbelt is fastened and all carry-on luggage is safely stowed.`,
    DELAY: (m) => `Ladies and gentlemen, we regret to inform you that our flight has been delayed by approximately ${m} minutes. We apologise for any inconvenience caused.`,
  },
  'en-us': {
    WELCOME: (f) => `Ladies and gentlemen, welcome aboard flight ${f}. We're happy to have you with us. Sit back, relax, and enjoy the flight.`,
    BOARDING_COMPLETE: () => `Ladies and gentlemen, we have completed boarding. At this time, please make sure your seatbelts are fastened and your seat backs and tray tables are in their full upright and locked position.`,
    SAFETY_DEMO: () => `Ladies and gentlemen, on behalf of the entire crew, we ask that you please direct your attention to the monitors above as we show you the safety features of this aircraft.`,
    TAKEOFF_PREP: () => `Ladies and gentlemen, we are now ready for takeoff. Please make sure your seat belts are securely fastened and all carry-on items are stowed in the overhead bin or under the seat in front of you.`,
    CRUISE: () => `Ladies and gentlemen, we have reached our cruising altitude. The captain has turned off the fasten seatbelt sign. You are free to move about the cabin.`,
    DESCENT: () => `Ladies and gentlemen, we have begun our descent. Please return your seats and tray tables to their full upright and locked position and fasten your seatbelts.`,
    LANDING: () => `Ladies and gentlemen, we are on final approach. Please make sure your seat belt is securely fastened.`,
    AFTER_LANDING: () => `Ladies and gentlemen, welcome! Please remain seated with your seatbelt fastened until the captain has turned off the fasten seatbelt sign. Thank you for flying with us.`,
    TURBULENCE: () => `Ladies and gentlemen, we are currently experiencing turbulence. Please return to your seats and fasten your seatbelts immediately.`,
    DOORS_CLOSING: () => `Ladies and gentlemen, the main cabin door is now closed. Please ensure your seatbelts are fastened and your carry-on items are properly stowed.`,
    DELAY: (m) => `Ladies and gentlemen, we regret to inform you of a delay of approximately ${m} minutes. We apologize for any inconvenience and appreciate your patience.`,
  },
  fr: {
    WELCOME: (f) => `Mesdames et messieurs, bienvenue à bord du vol ${f}. Nous sommes ravis de vous accueillir et vous souhaitons un agréable voyage.`,
    BOARDING_COMPLETE: () => `Mesdames et messieurs, l'embarquement est maintenant terminé. Veuillez attacher votre ceinture de sécurité et redresser votre siège.`,
    SAFETY_DEMO: () => `Mesdames et messieurs, veuillez porter votre attention sur la démonstration de sécurité qui va suivre.`,
    TAKEOFF_PREP: () => `Mesdames et messieurs, nous sommes maintenant prêts pour le décollage. Veuillez vérifier que votre ceinture est attachée.`,
    CRUISE: () => `Mesdames et messieurs, nous avons atteint notre altitude de croisière. Le commandant a éteint le signal d'attache des ceintures.`,
    DESCENT: () => `Mesdames et messieurs, nous amorçons notre descente. Veuillez regagner votre siège et attacher votre ceinture.`,
    LANDING: () => `Mesdames et messieurs, nous approchons de notre destination. Veuillez vous assurer que votre ceinture est bien attachée.`,
    AFTER_LANDING: () => `Mesdames et messieurs, bienvenue. Veuillez rester assis jusqu'à l'arrêt complet de l'appareil. Merci d'avoir voyagé avec nous.`,
    TURBULENCE: () => `Mesdames et messieurs, nous traversons une zone de turbulences. Veuillez regagner votre siège et attacher votre ceinture de sécurité.`,
    DOORS_CLOSING: () => `Mesdames et messieurs, les portes sont maintenant fermées. Veuillez vérifier que votre ceinture est attachée.`,
    DELAY: (m) => `Mesdames et messieurs, nous avons le regret de vous informer d'un retard d'environ ${m} minutes. Nous vous prions de nous excuser pour ce désagrément.`,
  },
  es: {
    WELCOME: (f) => `Damas y caballeros, bienvenidos a bordo del vuelo ${f}. Nos complace tenerlos con nosotros hoy.`,
    BOARDING_COMPLETE: () => `Damas y caballeros, el embarque ha concluido. Por favor, abrochen sus cinturones y coloquen el respaldo en posición vertical.`,
    SAFETY_DEMO: () => `Damas y caballeros, les pedimos que presten atención a la demostración de seguridad que se realizará a continuación.`,
    TAKEOFF_PREP: () => `Damas y caballeros, estamos listos para el despegue. Asegúrense de que sus cinturones estén abrochados.`,
    CRUISE: () => `Damas y caballeros, hemos alcanzado nuestra altitud de crucero. El capitán ha apagado la señal de abrocharse el cinturón.`,
    DESCENT: () => `Damas y caballeros, hemos iniciado el descenso. Por favor, regresen a sus asientos y abrochen sus cinturones.`,
    LANDING: () => `Damas y caballeros, estamos realizando la aproximación final. Asegúrense de que sus cinturones estén abrochados.`,
    AFTER_LANDING: () => `Damas y caballeros, bienvenidos. Por favor, permanezcan sentados hasta que el avión se detenga por completo. Gracias por volar con nosotros.`,
    TURBULENCE: () => `Damas y caballeros, estamos atravesando una zona de turbulencias. Regresen a sus asientos y abrochen sus cinturones inmediatamente.`,
    DOORS_CLOSING: () => `Damas y caballeros, las puertas se están cerrando. Por favor, asegúrense de que sus cinturones estén abrochados.`,
    DELAY: (m) => `Damas y caballeros, lamentamos informarles de un retraso de aproximadamente ${m} minutos. Disculpen las molestias.`,
  },
  it: {
    WELCOME: (f) => `Signore e signori, benvenuti a bordo del volo ${f}. Siamo lieti di avervi con noi oggi.`,
    BOARDING_COMPLETE: () => `Signore e signori, l'imbarco è ora completato. Vi preghiamo di allacciare le cinture di sicurezza e di portare lo schienale in posizione verticale.`,
    SAFETY_DEMO: () => `Signore e signori, vi chiediamo di prestare attenzione alla dimostrazione di sicurezza che seguirà.`,
    TAKEOFF_PREP: () => `Signore e signori, siamo pronti per il decollo. Assicuratevi che le cinture di sicurezza siano allacciate.`,
    CRUISE: () => `Signore e signori, abbiamo raggiunto la quota di crociera. Il comandante ha spento il segnale delle cinture.`,
    DESCENT: () => `Signore e signori, abbiamo iniziato la discesa. Vi preghiamo di tornare ai vostri posti e allacciare le cinture.`,
    LANDING: () => `Signore e signori, stiamo effettuando l'avvicinamento finale. Assicuratevi che le cinture siano allacciate.`,
    AFTER_LANDING: () => `Signore e signori, benvenuti. Vi preghiamo di rimanere seduti fino al completo arresto dell'aeromobile. Grazie per aver viaggiato con noi.`,
    TURBULENCE: () => `Signore e signori, stiamo attraversando una zona di turbolenze. Tornate ai vostri posti e allacciate immediatamente le cinture.`,
    DOORS_CLOSING: () => `Signore e signori, le porte sono ora chiuse. Vi preghiamo di verificare che le vostre cinture siano allacciate.`,
    DELAY: (m) => `Signore e signori, siamo spiacenti di informarvi di un ritardo di circa ${m} minuti. Ci scusiamo per l'inconveniente.`,
  },
  nl: {
    WELCOME: (f) => `Dames en heren, welkom aan boord van vlucht ${f}. Wij zijn blij u vandaag te mogen verwelkomen.`,
    BOARDING_COMPLETE: () => `Dames en heren, het instappen is nu voltooid. Zorg ervoor dat uw veiligheidsgordel is vastgemaakt en uw rugleuning rechtop staat.`,
    SAFETY_DEMO: () => `Dames en heren, wij verzoeken u aandacht te schenken aan de veiligheidsinstructies die nu worden gegeven.`,
    TAKEOFF_PREP: () => `Dames en heren, wij zijn gereed voor vertrek. Zorg ervoor dat uw veiligheidsgordels zijn vastgemaakt.`,
    CRUISE: () => `Dames en heren, wij hebben onze kruishoogte bereikt. De gezagvoerder heeft het gordelplaatje uitgeschakeld.`,
    DESCENT: () => `Dames en heren, wij zijn begonnen met dalen. Ga terug naar uw stoel en maak uw veiligheidsgordel vast.`,
    LANDING: () => `Dames en heren, wij naderen onze bestemming. Zorg ervoor dat uw veiligheidsgordel is vastgemaakt.`,
    AFTER_LANDING: () => `Dames en heren, welkom. Blijft u alstublieft zitten totdat het vliegtuig volledig tot stilstand is gekomen. Bedankt voor het vliegen met ons.`,
    TURBULENCE: () => `Dames en heren, wij vliegen momenteel door een turbulentiegebied. Keer terug naar uw stoel en maak direct uw veiligheidsgordel vast.`,
    DOORS_CLOSING: () => `Dames en heren, de deuren worden nu gesloten. Zorg ervoor dat uw veiligheidsgordel is vastgemaakt.`,
    DELAY: (m) => `Dames en heren, wij moeten u helaas mededelen dat onze vlucht met ongeveer ${m} minuten vertraagd is. Onze excuses voor het ongemak.`,
  },
  tr: {
    WELCOME: (f) => `Bayanlar ve baylar, ${f} sefer sayılı uçuşumuza hoş geldiniz. Bugün sizinle birlikte olmaktan mutluluk duyuyoruz.`,
    BOARDING_COMPLETE: () => `Bayanlar ve baylar, biniş işlemi tamamlanmıştır. Lütfen emniyet kemerlerinizi bağlayınız ve koltuklarınızı dik konuma getiriniz.`,
    SAFETY_DEMO: () => `Bayanlar ve baylar, lütfen güvenlik tanıtımına dikkatinizi veriniz.`,
    TAKEOFF_PREP: () => `Bayanlar ve baylar, kalkışa hazırız. Lütfen emniyet kemerlerinizin bağlı olduğundan emin olunuz.`,
    CRUISE: () => `Bayanlar ve baylar, seyir irtifamıza ulaştık. Kaptan emniyet kemeri işaretini kapattı.`,
    DESCENT: () => `Bayanlar ve baylar, inişe başladık. Lütfen koltuğunuza dönünüz ve emniyet kemerinizi bağlayınız.`,
    LANDING: () => `Bayanlar ve baylar, son yaklaşmayı yapıyoruz. Lütfen emniyet kemerinizin bağlı olduğundan emin olunuz.`,
    AFTER_LANDING: () => `Bayanlar ve baylar, hoş geldiniz. Uçak tamamen durana kadar lütfen koltuğunuzda oturunuz. Bizimle uçtuğunuz için teşekkür ederiz.`,
    TURBULENCE: () => `Bayanlar ve baylar, türbülans bölgesinden geçiyoruz. Lütfen koltuğunuza dönünüz ve emniyet kemerinizi hemen bağlayınız.`,
    DOORS_CLOSING: () => `Bayanlar ve baylar, kapılar şimdi kapatılıyor. Lütfen emniyet kemerinizin bağlı olduğundan emin olunuz.`,
    DELAY: (m) => `Bayanlar ve baylar, uçuşumuzun yaklaşık ${m} dakika gecikeceğini üzülerek bildiririz. Yaşanan rahatsızlık için özür dileriz.`,
  }
};

// ─── Hilfsfunktionen ─────────────────────────────────────
function el(id) { return document.getElementById(id); }

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('flightcabin_settings') || '{}');
  } catch { return {}; }
}

function mergeSettings(s) {
  return { ...DEFAULTS, ...s };
}

// ─── Laden ───────────────────────────────────────────────
function loadSettings() {
  const s = mergeSettings(getSettings());

  el('simbrief-id').value         = s.simbriefId;
  el('simbrief-username').value   = s.simbriefUsername;
  el('simbrief-autoload').checked = s.simbriefAutoload;
  el('ann-language').value        = s.annLanguage;
  el('ann-language-2').value      = s.annLanguage2;
  el('ann-bilingual').checked     = s.annBilingual;
  el('ann-style').value           = s.annStyle;
  el('tts-voice').value           = s.ttsVoice;
  el('tts-rate').value            = s.ttsRate;
  el('tts-rate-val').textContent  = s.ttsRate;
  
  
  
  
  el('board-business-seats').value = s.boardBusinessSeats;
  el('board-auto-ann').checked    = s.boardAutoAnn;
  el('board-business-first').checked = s.boardBusinessFirst;
  el('board-halfway-ann').checked = s.boardHalfwayAnn;
  el('board-gsx-interval').value  = s.boardGsxInterval;
  el('board-gsx-val').textContent = s.boardGsxInterval + 's';

  updateSecondaryLangRow();
  updatePreview();
}

// ─── Speichern ───────────────────────────────────────────
async function saveSettings() {
  const s = {
    simbriefId:        el('simbrief-id').value.trim(),
    simbriefUsername:  el('simbrief-username').value.trim(),
    simbriefAutoload:  el('simbrief-autoload').checked,
    annLanguage:       el('ann-language').value,
    annLanguage2:      el('ann-language-2').value,
    annBilingual:      el('ann-bilingual').checked,
    annStyle:          el('ann-style').value,
    ttsVoice:          el('tts-voice').value,
    ttsRate:           parseFloat(el('tts-rate').value),
    
    
    boardBusinessSeats: parseInt(el('board-business-seats').value),
    boardAutoAnn:      el('board-auto-ann').checked,
    boardBusinessFirst: el('board-business-first').checked,
    boardHalfwayAnn:   el('board-halfway-ann').checked,
    boardGsxInterval:  parseInt(el('board-gsx-interval').value),
  };

  localStorage.setItem('flightcabin_settings', JSON.stringify(s));

  // Auch an den Server schicken (für TTS-Service etc.)
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    });
  } catch (e) { /* Server kann offline sein */ }

  // Feedback
  const ind = el('save-indicator');
  ind.textContent = '✓ Gespeichert';
  ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), 2500);
}

// ─── UI-Logik ────────────────────────────────────────────
function onLanguageChange() {
  updateSecondaryLangRow();
  updatePreview();
}

function updateSecondaryLangRow() {
  const bilingual = el('ann-bilingual').checked;
  el('secondary-lang-row').style.display = bilingual ? 'flex' : 'none';
}

el('ann-bilingual').addEventListener('change', updateSecondaryLangRow);

function updatePreview() {
  const lang = el('ann-language').value;
  const texts = ANNOUNCEMENTS[lang] || ANNOUNCEMENTS['de'];
  el('ann-preview').textContent = texts.WELCOME('FC001');
}

el('ann-language').addEventListener('change', updatePreview);

// ─── SimBrief testen ────────────────────────────────────
async function testSimbrief() {
  const id = el('simbrief-id').value.trim();
  const username = el('simbrief-username').value.trim();
  const result = el('simbrief-test-result');

  if (!id && !username) {
    result.textContent = '⚠ Bitte Pilot ID oder Benutzername eingeben';
    result.className = 'test-result err';
    return;
  }

  result.textContent = 'Verbinde...';
  result.className = 'test-result';

  try {
    const param = id ? `?id=${encodeURIComponent(id)}` : `?username=${encodeURIComponent(username)}`;
    const res = await fetch(`/api/simbrief/ofp${param}`);
    const data = await res.json();

    if (data.success && data.ofp?.flightNr) {
      result.textContent = `✓ Verbunden — Letzter OFP: ${data.ofp.flightNr} (${data.ofp.origin}→${data.ofp.destination})`;
      result.className = 'test-result ok';
    } else {
      result.textContent = `✗ ${data.error || 'Kein aktiver OFP gefunden'}`;
      result.className = 'test-result err';
    }
  } catch (e) {
    result.textContent = `✗ Verbindungsfehler: ${e.message}`;
    result.className = 'test-result err';
  }
}

// ─── TTS testen ─────────────────────────────────────────
async function testTts() {
  const lang = el('ann-language').value;
  const texts = ANNOUNCEMENTS[lang] || ANNOUNCEMENTS['de'];
  const text = texts.WELCOME('Testflug');
  const result = el('tts-test-result');

  result.textContent = '▶ Spielt...';
  result.className = 'test-result';

  try {
    const res = await fetch('/api/announcements/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    result.textContent = '✓ Ansage wird abgespielt';
    result.className = 'test-result ok';
    setTimeout(() => { result.textContent = ''; }, 4000);
  } catch (e) {
    result.textContent = `✗ Fehler: ${e.message}`;
    result.className = 'test-result err';
  }
}

// Vorschau abspielen
async function playPreview() {
  const lang = el('ann-language').value;
  const texts = ANNOUNCEMENTS[lang] || ANNOUNCEMENTS['de'];
  const text = texts.WELCOME('FC001');

  await fetch('/api/announcements/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
}

// ─── Zurücksetzen ────────────────────────────────────────
async function resetAll() {
  if (!confirm('Alle Flüge, Passagiere und Einstellungen löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.')) return;
  try {
    await fetch('/api/settings/reset', { method: 'POST' });
    localStorage.removeItem('flightcabin_settings');
    location.href = '/';
  } catch (e) {
    alert('Reset-Fehler: ' + e.message);
  }
}

// Sidebar aktiv markieren beim Scrollen
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.snav-item').forEach(i => i.classList.remove('active'));
  event.target.classList.add('active');
}

// ─── Init ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', loadSettings);
