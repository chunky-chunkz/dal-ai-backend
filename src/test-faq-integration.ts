/**
 * Example integration of localLLM with FAQ system
 */

import dotenv from 'dotenv';
import { localLLM } from './ai/localLLM.js';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

interface FAQ {
  id: string;
  title: string;
  question_variants: string[];
  answer: string;
  product_tags: string[];
  last_reviewed: string;
}

async function testFAQIntegration() {
  const model = process.env.LLM_MODEL || 'phi3:mini';
  
  console.log('🔍 Testing FAQ Integration with Local LLM...');
  
  try {
    // Load FAQ data
    const faqData = await fs.readFile(path.join(process.cwd(), 'data', 'faqs.json'), 'utf-8');
    const faqs: FAQ[] = JSON.parse(faqData);
    
    console.log(`📚 Loaded ${faqs.length} FAQs`);

    // Test question: simulate user asking about slow internet
    const userQuestion = "Warum ist mein Internet so langsam?";
    console.log(`\n❓ User Question: "${userQuestion}"`);

    // Find relevant FAQ
    const relevantFAQ = faqs.find(faq => 
      faq.question_variants.some(variant => 
        variant.toLowerCase().includes('internet') && 
        variant.toLowerCase().includes('langsam')
      )
    );

    if (!relevantFAQ) {
      console.log('❌ No relevant FAQ found');
      return;
    }

    console.log(`✅ Found relevant FAQ: ${relevantFAQ.title}`);

    // Use LLM to enhance the answer
    const systemPrompt = `You are a helpful customer service assistant for a German telecommunications company. 
You should provide clear, friendly, and accurate information based on the provided FAQ content. 
Always respond in German. Keep responses concise but comprehensive.`;

    const userPrompt = `A customer asks: "${userQuestion}"

Based on this FAQ information:
Title: ${relevantFAQ.title}
Answer: ${relevantFAQ.answer}

Please provide a personalized, friendly response that addresses their concern.`;

    console.log('\n🤖 Generating enhanced response...');

    // Test regular generation
    const enhancedResponse = await localLLM.generate({
      model,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 300
    });

    console.log('\n💬 Enhanced Response:');
    console.log(enhancedResponse);

    // Test streaming version
    console.log('\n🌊 Testing streaming version...');
    console.log('Stream: ');
    
    await localLLM.stream({
      model,
      prompt: `Customer question: "${userQuestion}". Provide a brief, helpful response in German about checking internet speed.`,
      system: 'You are a friendly German customer service agent. Be concise.',
      temperature: 0.2,
      maxTokens: 150,
      onToken: (chunk) => {
        process.stdout.write(chunk);
      }
    });

    console.log('\n\n✅ FAQ integration test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  }
}

testFAQIntegration().catch(console.error);
