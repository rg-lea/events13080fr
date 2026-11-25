/* =====================================================================
   Passerelle entre la caisse centrale et l'app équipe (actualités, objets trouvés)
   Tout reste dans ce dépôt GitHub : les données sont dans un seul fichier,
     /2026/12/telethon/e/infos/equipe.json   →   {"actus":[...], "objets":[...], "maj":"..."}

   Lecture (app équipe, sans clé) : le fichier publié sur le site, relu avec un paramètre anti-cache.
   Écriture (caisse) : l'API GitHub, avec une clé d'accès limitée à ce dépôt, saisie une fois sur l'appareil
   de la caisse et gardée sur cet appareil uniquement. Chaque modification est un petit commit,
   visible dans l'app équipe environ une minute plus tard (temps de publication du site).
   ===================================================================== */
window.equipeApi = {
  depot: "rg-lea/events13080fr",
  chemin: "2026/12/telethon/e/infos/equipe.json",
  cleStockage: "telethon-passerelle-cle",

  cle() { try { return localStorage.getItem(this.cleStockage) || ""; } catch (_) { return ""; } },
  setCle(v) { try { v ? localStorage.setItem(this.cleStockage, v.trim()) : localStorage.removeItem(this.cleStockage); } catch (_) {} },
  actif() { return true; },
  peutEcrire() { return !!this.cle(); },

  normal(d) { return { actus: Array.isArray(d && d.actus) ? d.actus : [], objets: Array.isArray(d && d.objets) ? d.objets : [], maj: (d && d.maj) || "" }; },
  b64dec(b) { const s = atob(String(b).replace(/\s/g, "")); return new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0))); },
  b64enc(t) { const u = new TextEncoder().encode(t); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  async gh(methode, corps, ms = 20000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try {
      return await fetch("https://api.github.com/repos/" + this.depot + "/contents/" + this.chemin + (methode === "GET" ? "?ref=main&t=" + Date.now() : ""), {
        method: methode, signal: c.signal, cache: "no-store",
        headers: { "Authorization": "Bearer " + this.cle(), "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        body: corps ? JSON.stringify(corps) : undefined });
    } finally { clearTimeout(t); }
  },

  /* lecture : par l'API (toujours à jour) quand l'appareil a la clé, sinon le fichier publié */
  async lire() {
    if (this.peutEcrire()) {
      const r = await this.gh("GET");
      if (r.status === 401 || r.status === 403) throw new Error("cle");
      if (r.status === 404) { this._sha = null; return this.normal({}); }
      if (!r.ok) throw new Error("lecture " + r.status);
      const j = await r.json(); this._sha = j.sha;
      return this.normal(JSON.parse(this.b64dec(j.content) || "{}"));
    }
    const r = await fetch("/" + this.chemin + "?v=" + Date.now(), { cache: "no-store" });
    if (r.status === 404) return this.normal({});
    if (!r.ok) throw new Error("lecture " + r.status);
    return this.normal(await r.json());
  },

  /* relit juste avant d'écrire : deux caisses peuvent travailler en même temps sans s'écraser */
  async modifier(fn, essai = 0) {
    if (!this.peutEcrire()) throw new Error("cle");
    const d = await this.lire(); fn(d); d.maj = new Date().toISOString();
    const corps = { message: "Équipe : mise à jour des actualités et objets trouvés", branch: "main", content: this.b64enc(JSON.stringify(d, null, 1)) };
    if (this._sha) corps.sha = this._sha;
    const r = await this.gh("PUT", corps);
    if ((r.status === 409 || r.status === 422) && essai < 2) return this.modifier(fn, essai + 1);
    if (r.status === 401 || r.status === 403) throw new Error("cle");
    if (!r.ok) throw new Error("ecriture " + r.status);
    try { this._sha = (await r.json()).content.sha; } catch (_) {}
    return d;
  },
  id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
};
