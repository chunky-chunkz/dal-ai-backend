/**
 * Demo für das aktualisierte FAQ-Schema
 * Felder: id:string, title:string, synonyms?:string[], answer:string
 */

import { FaqSchema, Faq } from './src/models/faq.model.js';

// Beispiel 1: FAQ mit synonyms
const faqWithSynonyms: Faq = {
  id: "1",
  title: "Wie funktioniert KI?",
  synonyms: ["AI", "Künstliche Intelligenz", "Machine Learning"],
  answer: "KI basiert auf Algorithmen, die Muster in Daten erkennen..."
};

// Beispiel 2: FAQ ohne synonyms (optional)
const faqWithoutSynonyms: Faq = {
  id: "2", 
  title: "Was kostet der Service?",
  answer: "Unser Service kostet 29€ pro Monat..."
};

// Validierung mit Zod
try {
  const validated1 = FaqSchema.parse(faqWithSynonyms);
  console.log("✅ FAQ mit synonyms validiert:", validated1);
  
  const validated2 = FaqSchema.parse(faqWithoutSynonyms);
  console.log("✅ FAQ ohne synonyms validiert:", validated2);
  
} catch (error) {
  console.error("❌ Validierungsfehler:", error);
}

export { faqWithSynonyms, faqWithoutSynonyms };
