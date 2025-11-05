/**
 * Test script to generate document events for statistics
 */

import { logDocumentEvent, now, hashString } from './documents/metrics/logger.js';

async function generateDocumentTestData() {
  console.log('📚 Generating test document events...\n');

  // Simulate document indexing
  console.log('📝 Indexing documents...');
  const documents = [
    { id: 'doc-1', title: 'FAQ: Internet-Tarife', category: 'internet', wordCount: 450 },
    { id: 'doc-2', title: 'Anleitung: Router-Installation', category: 'hardware', wordCount: 820 },
    { id: 'doc-3', title: 'Mobilfunk-Verträge', category: 'mobilfunk', wordCount: 650 },
    { id: 'doc-4', title: 'Störungsbehebung WLAN', category: 'support', wordCount: 390 },
    { id: 'doc-5', title: 'Tarifwechsel durchführen', category: 'verträge', wordCount: 520 },
    { id: 'doc-6', title: 'Kündigungsfristen', category: 'verträge', wordCount: 280 },
    { id: 'doc-7', title: 'Speedtest durchführen', category: 'support', wordCount: 340 },
    { id: 'doc-8', title: 'TV-Angebote', category: 'tv', wordCount: 710 },
  ];

  for (const doc of documents) {
    await logDocumentEvent({
      type: 'index',
      docId: doc.id,
      title: doc.title,
      category: doc.category,
      wordCount: doc.wordCount,
      ts: now()
    });
    console.log(`  ✅ Indexed: ${doc.title}`);
  }

  // Simulate user searches
  console.log('\n🔍 Simulating searches...');
  const searches = [
    { query: 'Internet langsam', results: 3, latency: 45 },
    { query: 'Tarif wechseln', results: 5, latency: 32 },
    { query: 'Router einrichten', results: 4, latency: 28 },
    { query: 'WLAN Probleme', results: 6, latency: 51 },
    { query: 'Kündigungsfrist', results: 2, latency: 19 },
    { query: 'Speedtest', results: 3, latency: 22 },
    { query: 'Internet langsam', results: 3, latency: 41 }, // Duplicate query
    { query: 'Mobilfunk Tarife', results: 4, latency: 38 },
    { query: 'TV Sender', results: 2, latency: 25 },
    { query: 'Router einrichten', results: 4, latency: 31 }, // Duplicate
  ];

  for (const search of searches) {
    const queryHash = hashString(search.query);
    await logDocumentEvent({
      type: 'search',
      userId: 'user-' + Math.floor(Math.random() * 3 + 1),
      query: search.query,
      queryHash,
      resultsCount: search.results,
      latencyMs: search.latency,
      ts: now()
    });
    console.log(`  🔍 Search: "${search.query}" → ${search.results} results (${search.latency}ms)`);
  }

  // Simulate document retrievals
  console.log('\n📖 Simulating document retrievals...');
  const retrievals = [
    { docId: 'doc-4', title: 'Störungsbehebung WLAN', relevance: 0.89, source: 'search' as const },
    { docId: 'doc-5', title: 'Tarifwechsel durchführen', relevance: 0.92, source: 'search' as const },
    { docId: 'doc-2', title: 'Anleitung: Router-Installation', relevance: 0.87, source: 'search' as const },
    { docId: 'doc-4', title: 'Störungsbehebung WLAN', relevance: 0.91, source: 'search' as const },
    { docId: 'doc-6', title: 'Kündigungsfristen', relevance: 0.95, source: 'search' as const },
    { docId: 'doc-7', title: 'Speedtest durchführen', relevance: 0.88, source: 'search' as const },
    { docId: 'doc-4', title: 'Störungsbehebung WLAN', relevance: 0.90, source: 'search' as const },
    { docId: 'doc-3', title: 'Mobilfunk-Verträge', relevance: 0.85, source: 'search' as const },
    { docId: 'doc-8', title: 'TV-Angebote', relevance: 0.82, source: 'search' as const },
    { docId: 'doc-2', title: 'Anleitung: Router-Installation', relevance: 0.86, source: 'related' as const },
  ];

  for (const ret of retrievals) {
    await logDocumentEvent({
      type: 'retrieve',
      userId: 'user-' + Math.floor(Math.random() * 3 + 1),
      docId: ret.docId,
      docTitle: ret.title,
      relevanceScore: ret.relevance,
      source: ret.source,
      ts: now()
    });
    console.log(`  📖 Retrieved: ${ret.title} (relevance: ${ret.relevance})`);
  }

  // Simulate clicks
  console.log('\n👆 Simulating clicks...');
  const clicks = [
    { docId: 'doc-4', position: 1 },
    { docId: 'doc-5', position: 1 },
    { docId: 'doc-2', position: 2 },
    { docId: 'doc-4', position: 1 },
    { docId: 'doc-6', position: 1 },
    { docId: 'doc-7', position: 2 },
    { docId: 'doc-4', position: 1 }, // Popular doc
  ];

  for (const click of clicks) {
    await logDocumentEvent({
      type: 'click',
      userId: 'user-' + Math.floor(Math.random() * 3 + 1),
      docId: click.docId,
      position: click.position,
      ts: now()
    });
  }
  console.log(`  ✅ Logged ${clicks.length} clicks`);

  // Simulate feedback
  console.log('\n⭐ Simulating feedback...');
  const feedbacks = [
    { docId: 'doc-4', query: 'WLAN Probleme', helpful: true },
    { docId: 'doc-5', query: 'Tarif wechseln', helpful: true },
    { docId: 'doc-2', query: 'Router einrichten', helpful: true },
    { docId: 'doc-8', query: 'TV Sender', helpful: false },
    { docId: 'doc-6', query: 'Kündigungsfrist', helpful: true },
  ];

  for (const fb of feedbacks) {
    await logDocumentEvent({
      type: 'feedback',
      userId: 'user-' + Math.floor(Math.random() * 3 + 1),
      docId: fb.docId,
      query: fb.query,
      helpful: fb.helpful,
      ts: now()
    });
    console.log(`  ${fb.helpful ? '👍' : '👎'} Feedback for ${fb.docId}`);
  }

  // Simulate updates and deletes
  console.log('\n🔄 Simulating updates...');
  await logDocumentEvent({
    type: 'update',
    docId: 'doc-1',
    changeType: 'content',
    ts: now()
  });
  console.log('  ✅ Updated doc-1 (content)');

  await logDocumentEvent({
    type: 'delete',
    docId: 'doc-old',
    reason: 'outdated',
    ts: now()
  });
  console.log('  🗑️ Deleted doc-old (outdated)');

  // Simulate an error
  await logDocumentEvent({
    type: 'error',
    where: 'search-endpoint',
    message: 'Query too long',
    ts: now()
  });
  console.log('  ⚠️ Logged error');

  console.log('\n✅ Test data generation complete!');
  console.log('📊 Check: http://localhost:8081/api/stats/documents');
}

generateDocumentTestData().catch(console.error);
