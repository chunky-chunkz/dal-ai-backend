# Prisma Removal - Migration zu JSON-basiertem User Storage

**Datum:** 13. Oktober 2025

## Was wurde geändert?

Prisma wurde vollständig aus dem Projekt entfernt und durch ein einfaches JSON-basiertes User Storage System ersetzt.

## Gründe für die Migration

1. **Einfachheit**: Keine komplexe Datenbank-Setup erforderlich
2. **Wartbarkeit**: Einfacher zu debuggen und zu verstehen
3. **Konsistenz**: Passt zu den anderen Daten-Stores (FAQs, Profiles, Memory)
4. **Portabilität**: Keine Datenbank-Abhängigkeiten mehr
5. **Windows-Kompatibilität**: Keine Probleme mehr mit Prisma Query Engine unter Windows

## Gelöschte Dateien

- `/prisma/` - Gesamtes Prisma-Verzeichnis mit Schema und Migrations
- `dev.db` - SQLite Datenbank-Datei
- `migrate-users.js` - Altes Migrations-Skript
- `test-registration.js` - Altes Test-Skript mit Prisma
- `/node_modules/.prisma/` - Generierte Prisma-Dateien

## Geänderte Dateien

### `src/users/user.repo.ts`
- **Vorher**: Verwendete PrismaClient für Datenbankzugriff
- **Nachher**: Verwendet fs/promises für JSON-Dateizugriff
- Alle Funktionen beibehalten (findByEmail, findById, createUser, updateUser, findByMsOid)
- User Interface exportiert (war vorher von Prisma generiert)

### `src/users/index.ts`
- **Vorher**: Exportierte sowohl user.store als auch user.repo mit dynamischer Auswahl
- **Nachher**: Exportiert nur noch user.repo (JSON-basiert)

### `src/tests/user.repo.test.ts`
- **Vorher**: Verwendete PrismaClient für Test-Setup
- **Nachher**: Verwendet fs/promises für Test-Cleanup mit Backup/Restore

### `package.json`
- Entfernt: `@prisma/client`, `prisma` Dependencies
- Entfernt: Alle `db:*` Scripts (generate, migrate, reset, studio, push, seed)

### `.env`
- Entfernt: `DATABASE_URL` Konfiguration

## Neue Dateien

### `data/users.json`
Neue Datei für User-Storage mit folgendem Format:
```json
[
  {
    "id": "hex-string",
    "email": "user@example.com",
    "passwordHash": "bcrypt-hash",
    "displayName": "Display Name",
    "msOid": "microsoft-oid-optional",
    "createdAt": "ISO-8601-timestamp"
  }
]
```

## User Interface

```typescript
interface User {
  id: string;
  email: string;
  passwordHash?: string;
  displayName?: string;
  msOid?: string;
  createdAt: string;
}
```

## Migration von bestehenden Daten

Falls du bereits User in einer Prisma-Datenbank hattest, musst du diese manuell nach `data/users.json` migrieren. Format siehe oben.

## Vorteile der neuen Lösung

✅ Keine Datenbank-Setup erforderlich  
✅ Einfaches Backup (Datei kopieren)  
✅ Lesbare Daten (JSON statt Binär-DB)  
✅ Keine Build-Probleme mit Prisma Query Engine  
✅ Konsistent mit anderen Data Stores im Projekt  
✅ Funktioniert out-of-the-box unter Windows  

## Testing

Alle Tests wurden angepasst und funktionieren weiterhin:
```bash
npm test
```

## Authentifizierung

Beide Authentifizierungs-Methoden funktionieren weiterhin unverändert:
- ✅ Lokale Authentifizierung (Email/Password)
- ✅ Microsoft OAuth Authentifizierung

## Rückgängig machen

Falls du Prisma wieder einführen möchtest:
1. `npm install prisma @prisma/client`
2. Prisma Schema neu erstellen in `/prisma/schema.prisma`
3. `npx prisma generate`
4. `npx prisma migrate dev`
5. `src/users/user.repo.ts` wieder auf Prisma umstellen

---

**Server läuft jetzt erfolgreich ohne Prisma auf Port 8081** 🚀
