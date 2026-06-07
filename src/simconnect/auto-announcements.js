/**
 * Automatische Ansagen — gekoppelt an SimConnect-Flugphasen
 * Condor-Airline-Stil
 *
 * Phasen-Erkennung via SimVars:
 *  onGround + parkingBrake + speed==0  → PREFLIGHT / BOARDING
 *  onGround + !parkingBrake            → TAXI
 *  !onGround + speed < 100 + vspeed>0 → TAKEOFF
 *  !onGround + altitude > 5000 + vspeed~0 → CRUISE
 *  !onGround + vspeed < -200           → DESCENT
 *  onGround + speed < 30 (nach Flug)  → LANDED
 *  onGround + parkingBrake (nach Flug)→ PARKED
 */

const WebSocket = require('ws');

// Flugphasen
const PHASES = {
  PREFLIGHT:  'PREFLIGHT',
  BOARDING:   'BOARDING',
  TAXI:       'TAXI',
  TAKEOFF:    'TAKEOFF',
  CLIMB:      'CLIMB',
  CRUISE:     'CRUISE',
  DESCENT:    'DESCENT',
  APPROACH:   'APPROACH',
  LANDED:     'LANDED',
  PARKED:     'PARKED',
};

class AutoAnnouncementService {
  constructor(ttsService, wss) {
    this.tts = ttsService;
    this.wss = wss;
    this.enabled = true;
    this.currentPhase = PHASES.PREFLIGHT;
    this.flightParams = {};

    // Verhindert doppelte Ansagen
    this._played = new Set();
    // Wann der Flug startete (für ETAs etc.)
    this._flightStartTime = null;
    // Letzte bekannte Daten
    this._lastData = {};
    // Hysterese-Zähler (verhindert Flattern)
    this._phaseVotes = {};
    this._votesNeeded = 3;
  }

  // Wird aus SimConnect aufgerufen wenn neue Daten kommen
  async onSimData(data) {
    if (!this.enabled) return;
    this._lastData = data;

    const newPhase = this._detectPhase(data);
    if (newPhase && newPhase !== this.currentPhase) {
      await this._transitionTo(newPhase, data);
    }
  }

  _detectPhase(d) {
    const { onGround, airspeed, altitude, parkingBrake, verticalSpeed } = d;
    const vs = verticalSpeed || 0;

    // Hysterese: Phase muss N-mal hintereinander erkannt werden
    const vote = (phase) => {
      this._phaseVotes[phase] = (this._phaseVotes[phase] || 0) + 1;
      if (this._phaseVotes[phase] >= this._votesNeeded) {
        this._phaseVotes = {};
        return phase;
      }
      return null;
    };

    // Am Boden mit Parkbremse + keine Bewegung
    if (onGround && parkingBrake && airspeed < 2) {
      if (this.currentPhase === PHASES.LANDED || this.currentPhase === PHASES.PARKED) {
        return vote(PHASES.PARKED);
      }
      return null; // Im Preflight/Boarding bleiben
    }

    // Taxiing: am Boden, Bremse weg, langsam
    if (onGround && !parkingBrake && airspeed < 40 &&
        this.currentPhase !== PHASES.LANDED && this.currentPhase !== PHASES.PARKED) {
      return vote(PHASES.TAXI);
    }

    // Takeoff roll: am Boden, hohe Speed
    if (onGround && airspeed > 60) {
      return vote(PHASES.TAKEOFF);
    }

    // In der Luft
    if (!onGround) {
      // Steigflug
      if (vs > 200 && altitude < 8000) return vote(PHASES.CLIMB);

      // Reiseflug: flach und hoch
      if (altitude > 10000 && Math.abs(vs) < 200) return vote(PHASES.CRUISE);

      // Sinkflug
      if (vs < -300 && altitude > 3000) return vote(PHASES.DESCENT);

      // Anflug: niedrig und sinkend
      if (vs < -100 && altitude < 4000) return vote(PHASES.APPROACH);
    }

    // Gelandet: wieder am Boden nach Flug
    if (onGround && airspeed < 40 &&
        [PHASES.APPROACH, PHASES.DESCENT, PHASES.LANDED].includes(this.currentPhase)) {
      return vote(PHASES.LANDED);
    }

    return null;
  }

  async _transitionTo(newPhase, data) {
    console.log(`[AutoAnn] Phase: ${this.currentPhase} → ${newPhase}`);
    this.currentPhase = newPhase;

    this._broadcast({ type: 'FLIGHT_PHASE', payload: { phase: newPhase } });

    const p = this.flightParams;
    const key = newPhase;

    // Keine doppelten Ansagen pro Phase
    if (this._played.has(key)) return;
    this._played.add(key);

    switch (newPhase) {
      case PHASES.TAXI:
        await this._delay(8000); // 8s nach Brake-Release warten
        await this.tts.makeAnnouncement('TAXI', p);
        await this._delay(5000);
        await this.tts.makeAnnouncement('TAKEOFF_PREP', p);
        break;

      case PHASES.CLIMB:
        // Kurz nach Abheben: Sicherheitsgurt-Ansage
        await this._delay(30000); // 30s nach Takeoff
        await this.tts.makeAnnouncement('CLIMB', p);
        break;

      case PHASES.CRUISE:
        await this._delay(5000);
        await this.tts.makeAnnouncement('CRUISE', {
          ...p,
          altitude: Math.round((data.altitude || 0) / 100) * 100
        });
        break;

      case PHASES.DESCENT:
        await this.tts.makeAnnouncement('DESCENT', p);
        break;

      case PHASES.APPROACH:
        await this._delay(3000);
        await this.tts.makeAnnouncement('LANDING', p);
        break;

      case PHASES.LANDED:
        await this._delay(20000); // 20s nach Touchdown
        await this.tts.makeAnnouncement('AFTER_LANDING', p);
        break;

      case PHASES.PARKED:
        // Reset für nächsten Flug
        if (this._played.has('AFTER_LANDING')) {
          setTimeout(() => this._reset(), 60000);
        }
        break;
    }
  }

  // Boarding-Start von außen auslösen (GSX-Event)
  async triggerBoarding(params = {}) {
    if (this._played.has('BOARDING')) return;
    this._played.add('BOARDING');
    this.flightParams = { ...this.flightParams, ...params };
    this.currentPhase = PHASES.BOARDING;

    await this.tts.makeAnnouncement('WELCOME', this.flightParams);
    await this._delay(4000);
    await this.tts.makeAnnouncement('BOARDING_START', this.flightParams);

    if (this.tts.boardingBusinessFirst !== false) {
      await this._delay(3000);
      await this.tts.makeAnnouncement('BOARDING_BUSINESS', this.flightParams);
    }
  }

  // 50%-Boarding
  async triggerHalfway() {
    if (!this._played.has('HALFWAY')) {
      this._played.add('HALFWAY');
      await this.tts.makeAnnouncement('BOARDING_HALFWAY', this.flightParams);
    }
  }

  // Boarding abgeschlossen
  async triggerBoardingComplete() {
    if (!this._played.has('BOARDING_COMPLETE')) {
      this._played.add('BOARDING_COMPLETE');
      await this.tts.makeAnnouncement('BOARDING_COMPLETE', this.flightParams);
      await this._delay(3000);
      await this.tts.makeAnnouncement('SAFETY_DEMO', this.flightParams);
      await this._delay(4000);
      await this.tts.makeAnnouncement('DOORS_CLOSING', this.flightParams);
    }
  }

  setFlightParams(params) {
    this.flightParams = { ...this.flightParams, ...params };
  }

  _reset() {
    this._played.clear();
    this._phaseVotes = {};
    this.currentPhase = PHASES.PREFLIGHT;
    this._flightStartTime = null;
    console.log('[AutoAnn] Zurückgesetzt für nächsten Flug');
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  _broadcast(data) {
    const json = JSON.stringify(data);
    this.wss?.clients?.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(json);
    });
  }
}

module.exports = AutoAnnouncementService;
