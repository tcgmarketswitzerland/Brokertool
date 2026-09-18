# Umgebungen: Stage und Produktion

Stand: 2026-09-17

Ziel: auf **Stage** ausprobieren, und wenn es taugt, dieselbe Änderung nach **Produktion** heben —
ohne dass jemand von Hand SQL einfügt.

---

## 1. Wie es zusammenhängt

```
  Zweig  stage   ──push──▶  Vercel Preview  ──▶  Supabase Stage
                            (Testdaten)          (Migration läuft automatisch)

  Zweig  main    ──push──▶  Vercel Produktion ──▶  Supabase Produktion
                            (echte Kunden)         (Migration von Hand, mit Freigabe)
```

Zwei Dinge sind bewusst verschieden:

| | Stage | Produktion |
|---|---|---|
| Migration | läuft automatisch beim Push | nur von Hand, mit Bestätigung |
| Daten | erfunden | echt |
| Fehler | kostet nichts | kostet einen Kunden |

**Warum die Produktion nicht automatisch migriert:** Code lässt sich zurückrollen, eine gelöschte
Spalte nicht. Der Handgriff ist kein Misstrauen gegen die Automatik, sondern der Punkt, an dem
jemand hinschaut.

---

## 2. Einrichten — einmalig

### 2.1 Zweite Supabase-Instanz für Stage

- [ ] Neues Supabase-Projekt anlegen, Name z. B. `brokertool-stage`, **Region Zürich**
- [ ] Denselben Access-Token-Hook aktivieren: Authentication → Hooks → Customize Access Token
      (JWT) Claims → `public.custom_access_token_hook`

Der kostenlose Tarif genügt für Stage.

### 2.2 Die zwei Verbindungszeichenfolgen holen

Je Projekt: Supabase → Project Settings → Database → **Connection string** → *Direct connection*
(nicht der Pooler — Migrationen brauchen eine echte Sitzung).

Die Zeichenfolge sieht so aus und enthält das Datenbankpasswort:
`postgresql://postgres:<passwort>@db.<ref>.supabase.co:5432/postgres`

> **Das ist der Generalschlüssel zur Datenbank.** Er umgeht sämtliche Sicherheitsregeln. Er gehört
> ausschliesslich in die GitHub-Secrets und in keine Datei, keine Nachricht, keinen Screenshot.

### 2.3 GitHub-Umgebungen

GitHub → Repository → Settings → **Environments**

- [ ] Umgebung **`stage`** anlegen
      → Secret `DATABASE_URL` = Verbindung zur Stage-Datenbank
- [ ] Umgebung **`production`** anlegen
      → Secret `DATABASE_URL` = Verbindung zur produktiven Datenbank
      → **Required reviewers**: dich selbst eintragen

Beide Secrets heissen gleich. Dadurch kann kein Lauf versehentlich auf der falschen Datenbank
landen: welcher Wert gilt, entscheidet allein die gewählte Umgebung.

Der Haken bei *Required reviewers* bewirkt, dass jede produktive Migration auf deine Freigabe
wartet — du bekommst eine Mail und klickst.

### 2.4 Die bestehende produktive Datenbank übernehmen

Auf ihr wurde bisher von Hand migriert; es gibt noch kein Verzeichnis. Einmalig:

- [ ] GitHub → Actions → **Datenbankmigration** → Run workflow
      → Umgebung `produktion`, Aktion `status`

Zeigt die Liste alles Ausstehenden an, ohne etwas zu tun. Stehen dort **alle 23** Migrationen,
obwohl 0001–0017 längst laufen, muss zuerst der Baseline-Befehl gesetzt werden — melde dich dann,
das mache ich mit dir zusammen in einem Durchgang.

### 2.5 Zweig `stage`

- [ ] In GitHub aus dem Hauptzweig einen Zweig `stage` erzeugen
- [ ] Vercel → Settings → Git → `stage` als Preview-Zweig führen (passiert meist von selbst)

---

## 3. Der Ablauf danach

**Etwas Neues ausprobieren**

1. Ich pushe auf `stage`.
2. GitHub spielt die Migrationen auf der Stage-Datenbank ein — automatisch.
3. Vercel baut die Preview. Du testest dort mit erfundenen Daten.

**Nach Produktion heben**

4. Der Stand wird in den Hauptzweig übernommen. Vercel baut die Produktion.
5. GitHub → Actions → **Datenbankmigration** → Run workflow
   → Umgebung `produktion`, Aktion `status` — was steht an?
6. Derselbe Aufruf mit Aktion `up` und `migrieren` im Bestätigungsfeld.
7. Du gibst frei, der Lauf spielt ein.

---

## 4. Was der Läufer verhindert

`scripts/migrate.mjs` führt ein Verzeichnis im eigenen Schema `migrations`. Daraus folgt:

- **Jede Migration läuft genau einmal.** Zweimal ausführen ist folgenlos.
- **Eine eingespielte Migration darf sich nicht mehr ändern.** Der Läufer merkt sich eine Prüfsumme
  je Datei. Wird eine alte Datei nachträglich bearbeitet, bricht er ab — sonst stünde in der
  Datenbank etwas anderes als im Projekt, und niemand merkte es.
- **Jede Migration läuft in einer eigenen Transaktion.** Schlägt eine fehl, bleibt der Stand davor
  vollständig.
- **Jede Migration prüft sich selbst.** Am Ende jeder Datei stehen `apply_tenant_rls()` und
  `assert_rls_complete()`. Eine Migration, die eine Mandantentabelle anlegt und sie nicht
  absichert, bricht den Lauf ab — in jeder Umgebung.

Die CI spielt bei jedem Push zusätzlich alle Migrationen von Null gegen eine leere Datenbank ein
und danach ein zweites Mal. Der zweite Lauf muss folgenlos bleiben.

---

## 5. Von Hand, wenn es sein muss

```bash
export DATABASE_URL="postgresql://..."
pnpm migrate:status     # was steht an
pnpm migrate            # einspielen
```

Der SQL Editor und die Bündel unter `supabase/bundles/` werden damit überflüssig. Sie bleiben
vorerst liegen, bis die Umstellung durch ist.

Ein neues Bündel entsteht mit:

```bash
node scripts/bundle-migrations.mjs 0018 0025
```

Wer ein Bündel von Hand einspielt, setzt danach `node scripts/migrate.mjs baseline 0025` —
sonst will die Action dieselben Schritte ein zweites Mal fahren.
