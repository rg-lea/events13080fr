/* =====================================================================
   Passerelle entre la caisse centrale et l'app équipe (actualités, objets trouvés)
   Les deux pages chargent ce fichier : l'adresse du flux n'est écrite qu'ici.

   Le flux Power Automate « Téléthon équipe » (déclencheur HTTP) garde un seul fichier JSON :
     {"actus":[...], "objets":[...], "maj":"..."}
   Requêtes (corps JSON, envoyé en text/plain) :
     {"action":"lire"}                          → 200 + le contenu du fichier
     {"action":"ecrire","code":"…","doc":{…}}   → 200 si le code caisse est bon, 403 sinon
   ===================================================================== */
window.TELETHON_EQUIPE_API = "";

window.equipeApi = {
  actif() { return !!window.TELETHON_EQUIPE_API; },
  async appel(corps, ms = 20000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try {
      return await fetch(window.TELETHON_EQUIPE_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(corps), signal: c.signal });
    } finally { clearTimeout(t); }
  },
  async lire() {
    const r = await this.appel({ action: "lire" });
    if (!r.ok) throw new Error("lecture " + r.status);
    let d = {};
    try { d = await r.json(); } catch (_) {}
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (_) { d = {}; } }
    return { actus: Array.isArray(d.actus) ? d.actus : [], objets: Array.isArray(d.objets) ? d.objets : [], maj: d.maj || "" };
  },
  async ecrire(code, doc) {
    doc.maj = new Date().toISOString();
    const r = await this.appel({ action: "ecrire", code, doc });
    if (r.status === 403) throw new Error("code");
    if (!r.ok) throw new Error("ecriture " + r.status);
    return true;
  },
  /* relit le fichier juste avant d'écrire : deux caisses peuvent travailler en même temps sans s'écraser */
  async modifier(code, fn) { const d = await this.lire(); fn(d); await this.ecrire(code, d); return d; },
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
};
