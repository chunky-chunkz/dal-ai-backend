# Profile Integration in Answer Service

Diese Erweiterung des `answer.service.ts` unterstützt jetzt Profile-Fakten durch Integration mit dem `profileStore`.

## Features

### 1. Profile-Abfragen
Das System erkennt automatisch Fragen nach Profile-Informationen und antwortet direkt aus dem Profile-Store:

**Unterstützte Patterns:**
- `"Was ist Romans Lieblingsfarbe?"` 
- `"Lieblingsfarbe von Roman"`
- `"Romans Lieblingsfarbe"`
- `"Was arbeitet Maria?"`
- `"Wo wohnt Lisa?"`

### 2. Automatische Profile-Extraktion
Das System erkennt und speichert automatisch neue Profile-Informationen aus natürlichen Aussagen:

**Unterstützte Patterns:**
- `"Romans Lieblingsfarbe ist blau"` → speichert: Roman.lieblingsfarbe = "blau"
- `"Maria mag Pizza"` → speichert: Maria.mag = "Pizza" 
- `"Peter liebt Kaffee"` → speichert: Peter.liebt = "Kaffee"
- `"Anna hasst Spinat"` → speichert: Anna.hasst = "Spinat"
- `"Tom hat einen Hund"` → speichert: Tom.hat = "einen Hund"
- `"Lisa wohnt in Berlin"` → speichert: Lisa.wohnort = "Berlin"
- `"Max arbeitet als Ingenieur"` → speichert: Max.beruf = "Ingenieur"
- `"Sarah ist 25 Jahre alt"` → speichert: Sarah.alter = "25"

### 3. Case-Insensitive Suche
Alle Schlüssel werden automatisch in Kleinbuchstaben normalisiert für konsistente Suche.

## Implementierung

### Profile-Abfragen (vor RAG)
```typescript
// Check for profile queries first (before cache and RAG)
const profileResult = await checkProfileQuery(processedQuestion);
if (profileResult) {
  return profileResult;
}
```

### Profile-Extraktion (nach RAG)
```typescript
// Check if user is providing profile information and extract it
await extractAndStoreProfileInfo(normalizedQuestion, ragResponse.answer);
```

## API-Funktionen

### ProfileStore Integration
- `getProfile(name: string): Record<string,string>` - Alle Profile-Daten für einen User
- `setProfile(name: string, key: string, value: string): Promise<void>` - Setzt einen Profile-Wert
- `findFact(name: string, key: string): Promise<string|null>` - Sucht einen spezifischen Wert

### Answer Service
- `answerQuestion(question: string, sessionId?: string): Promise<AnswerResponse>` - Erweitert um Profile-Support
- `answerQuestionStream(...)` - Streaming-Version mit Profile-Support

## Ablauf

1. **Eingabe validieren** und Guardrails anwenden
2. **Profile-Abfrage prüfen** - Direkte Antwort wenn gefunden
3. **Cache prüfen** - Wie bisher
4. **RAG ausführen** - Wie bisher
5. **Profile-Info extrahieren** - Neue Profile-Daten automatisch speichern
6. **Antwort zurückgeben** - Mit entsprechender Confidence

## Beispiel-Verwendung

```typescript
// Profile-Info speichern
await answerQuestion("Romans Lieblingsfarbe ist blau");
// → "Verstanden, ich merke mir diese Information."

// Profile-Info abfragen  
await answerQuestion("Was ist Romans Lieblingsfarbe?");
// → "Romans lieblingsfarbe ist blau." (Confidence: 0.95)

// Normale RAG-Fragen funktionieren weiterhin
await answerQuestion("Wie richte ich mein Email ein?");
// → RAG-basierte Antwort
```

## Testing

Führen Sie das Test-Script aus:
```bash
cd backend/src
node --loader ts-node/esm test-profile-integration.ts
```

## Persistierung

Alle Profile-Daten werden automatisch in `data/profiles.json` gespeichert und überleben Server-Restarts.
