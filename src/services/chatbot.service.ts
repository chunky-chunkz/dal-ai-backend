import { faqsRepository } from '../repos/faqs.repo.js';
import { AnswerRequest, AnswerResponse } from '../models/faq.model.js';
import fs from 'fs';
import path from 'path';

interface Expert {
  id: string;
  name: string;
  dept?: string;
  email?: string;
  languages: string[];
  products: string[];
  skills: string[];
  load?: number;
  success?: number;
}

export class ChatbotService {
  private experts: Expert[] = [];

  constructor() {
    // Load experts data
    this.loadExperts();
  }

  /**
   * Load experts from JSON file
   */
  private loadExperts(): void {
    try {
      const expertsPath = path.join(process.cwd(), '..', 'src', 'data', 'experts.json');
      console.log('🔍 Trying to load experts from:', expertsPath);
      const data = fs.readFileSync(expertsPath, 'utf-8');
      this.experts = JSON.parse(data);
      console.log('✅ Loaded', this.experts.length, 'experts');
    } catch (error) {
      console.error('❌ Error loading experts:', error);
      console.log('🔍 Trying alternative path...');
      try {
        // Try alternative path
        const altPath = path.join(process.cwd(), 'src', 'data', 'experts.json');
        console.log('🔍 Alternative path:', altPath);
        const data = fs.readFileSync(altPath, 'utf-8');
        this.experts = JSON.parse(data);
        console.log('✅ Loaded', this.experts.length, 'experts from alternative path');
      } catch (altError) {
        console.error('❌ Alternative path also failed:', altError);
        this.experts = [];
      }
    }
  }

  /**
   * Process a question and return the best answer
   */
  async getAnswer(request: AnswerRequest): Promise<AnswerResponse> {
    try {
      const { question } = request;

      // First check if this is a request for expert help
      if (this.isExpertRequest(question)) {
        return await this.getExpertRecommendations(question);
      }

      // Search for matching FAQs using new repository
      const searchResults = faqsRepository.findByQuery(question);

      if (searchResults.length === 0) {
        // Try to provide expert recommendations for technical questions
        if (this.isTechnicalQuestion(question)) {
          return await this.getExpertRecommendations(question);
        }

        return {
          answer: "Entschuldigung, ich konnte keine passende Antwort auf deine Frage finden. Kannst du die Frage anders formulieren? Bei technischen Fragen kann ich dir passende Experten empfehlen!",
          confidence: 0
        };
      }

      // For technical questions, prioritize expert recommendations over generic FAQs
      if (this.isTechnicalQuestion(question) && this.shouldRecommendExpert(question)) {
        return await this.getExpertRecommendations(question);
      }

      // Return the best match
      const bestMatch = searchResults[0];
      
      return {
        answer: bestMatch.answer,
        confidence: 0.9, // Higher confidence for matched FAQs
        sourceId: bestMatch.id
      };

    } catch (error) {
      console.error('Error processing question:', error);
      return {
        answer: "Es gab ein technisches Problem. Bitte versuche es später noch einmal.",
        confidence: 0
      };
    }
  }

  /**
   * Check if this is explicitly a request for expert help
   */
  private isExpertRequest(question: string): boolean {
    const expertKeywords = [
      'kann mir helfen', 'brauche hilfe', 'wer kann mir helfen', 'spezialist', 
      'experte', 'expert', 'fachmann', 'kontakt', 'ansprechpartner',
      'wer ist zuständig', 'ich will einen spezialisten fragen',
      'ich brauche einen experten', 'können sie mir jemanden empfehlen'
    ];
    const lowerQuestion = question.toLowerCase();
    const isExpertReq = expertKeywords.some(keyword => lowerQuestion.includes(keyword));
    console.log('🤔 isExpertRequest:', question, '→', isExpertReq);
    return isExpertReq;
  }

  /**
   * Check if question is technical and needs expert recommendation
   */
  private isTechnicalQuestion(question: string): boolean {
    const technicalKeywords = [
      'react', 'javascript', 'typescript', 'node.js', 'python', 'java', 'go',
      'jsx', 'component', 'hook', 'state', 'props', 'useeffect', 'usestate',
      'frontend', 'backend', 'database', 'api', 'microservices', 'cloud',
      'aws', 'docker', 'kubernetes', 'terraform', 'jenkins', 'monitoring',
      'machine learning', 'ai', 'chatbot', 'analytics', 'scoring',
      'problem', 'fehler', 'error', 'bug', 'issue', 'projekt'
    ];
    const lowerQuestion = question.toLowerCase();
    return technicalKeywords.some(keyword => lowerQuestion.includes(keyword));
  }

  /**
   * Check if we should recommend an expert instead of giving generic FAQ answer
   */
  private shouldRecommendExpert(question: string): boolean {
    const expertTriggers = [
      'projekt', 'project', 'entwicklung', 'development', 'hilfe', 'help',
      'problem', 'issue', 'bug', 'fehler', 'unterstützung', 'support',
      'beratung', 'consulting', 'implementation', 'implementierung'
    ];
    const lowerQuestion = question.toLowerCase();
    return expertTriggers.some(trigger => lowerQuestion.includes(trigger));
  }

  /**
   * Get expert recommendations based on the question
   */
  private async getExpertRecommendations(question: string): Promise<AnswerResponse> {
    try {
      console.log('🔍 Getting expert recommendations for:', question);
      console.log('📊 Available experts:', this.experts.length);
      
      // Extract technologies and skills from the question
      const languages = this.extractProgrammingLanguages(question);
      console.log('🔤 Extracted languages:', languages);
      
      // Find matching experts
      const experts = this.findMatchingExperts(question, languages);
      console.log('👥 Found matching experts:', experts.length);

      if (experts.length === 0) {
        return {
          answer: "Ich konnte leider keine passenden Experten für deine Anfrage finden. Versuche es mit spezifischeren Technologie-Begriffen oder kontaktiere unseren Support.",
          confidence: 0.3
        };
      }

      // Build expert recommendation response
      let answer = "Hier sind passende Experten für deine Anfrage:\n\n";
      
      experts.forEach((expert, index) => {
        answer += `**${expert.name}**\n`;
        answer += `📧 ${expert.email || 'E-Mail nicht verfügbar'}\n`;
        answer += `🎯 Expertise: ${expert.reason.join(', ')}\n`;
        answer += `⭐ Matching-Score: ${Math.round(expert.confidence * 100)}%\n`;
        if (index < experts.length - 1) answer += "\n";
      });

      answer += "\n💡 Du kannst diese Experten direkt kontaktieren oder über Teams erreichen.";

      return {
        answer,
        confidence: 0.9,
        sourceId: 'expert-recommendations'
      };

    } catch (error) {
      console.error('Error getting expert recommendations:', error);
      return {
        answer: "Es gab ein Problem bei der Expertensuche. Bitte versuche es später noch einmal oder kontaktiere direkt unseren Support.",
        confidence: 0.2
      };
    }
  }



  /**
   * Extract programming languages from question
   */
  private extractProgrammingLanguages(question: string): string[] {
    const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'HTML', 'CSS', 'SQL'];
    const lowerQuestion = question.toLowerCase();
    
    return languages.filter(lang => 
      lowerQuestion.includes(lang.toLowerCase()) ||
      (lang === 'JavaScript' && lowerQuestion.includes('react'))
    );
  }

  /**
   * Find matching experts based on question and technologies
   */
  private findMatchingExperts(question: string, languages: string[]): Array<{
    id: string;
    name: string;
    email?: string;
    confidence: number;
    reason: string[];
  }> {
    const lowerQuestion = question.toLowerCase();
    const matchedExperts = [];

    for (const expert of this.experts) {
      let score = 0;
      const reasons: string[] = [];

      // Check language matches
      for (const lang of languages) {
        if (expert.languages.some(expertLang => expertLang.toLowerCase().includes(lang.toLowerCase()))) {
          score += 3;
          reasons.push(`${lang} Expertise`);
        }
      }

      // Check skill matches
      if (lowerQuestion.includes('react')) {
        if (expert.skills.some(skill => skill.toLowerCase().includes('react'))) {
          score += 4;
          reasons.push('React Spezialist');
        }
      }

      // Check for Node.js
      if (lowerQuestion.includes('node')) {
        if (expert.skills.some(skill => skill.toLowerCase().includes('node'))) {
          score += 3;
          reasons.push('Node.js Expertise');
        }
      }

      // Check for frontend
      if (lowerQuestion.includes('frontend') || lowerQuestion.includes('ui') || lowerQuestion.includes('interface')) {
        if (expert.skills.some(skill => ['react', 'frontend', 'ui', 'css', 'html'].some(s => skill.toLowerCase().includes(s)))) {
          score += 3;
          reasons.push('Frontend Entwicklung');
        }
      }

      // Check for AWS/Cloud
      if (lowerQuestion.includes('aws') || lowerQuestion.includes('cloud')) {
        if (expert.skills.some(skill => skill.toLowerCase().includes('aws'))) {
          score += 3;
          reasons.push('AWS/Cloud Expertise');
        }
      }

      // Bonus for low workload
      if (expert.load && expert.load < 80) {
        score += 1;
        reasons.push('Verfügbar');
      }

      // Bonus for high success rate
      if (expert.success && expert.success > 85) {
        score += 1;
        reasons.push('Hohe Erfolgsrate');
      }

      if (score > 0) {
        matchedExperts.push({
          id: expert.id,
          name: expert.name,
          email: expert.email,
          confidence: Math.min(score / 10, 1), // Normalize to 0-1
          reason: reasons
        });
      }
    }

    // Sort by score and return top 3
    return matchedExperts
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }



  /**
   * Initialize the service (load data)
   */
  async initialize(): Promise<void> {
    // Repository loads data automatically, no initialization needed
  }
}
