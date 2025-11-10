import type { FastifyRequest, FastifyReply } from 'fastify';
import { faqsRepository } from '../repos/faqs.repo.js';

// Simple functions for FAQ operations - no need for a class
export async function getAllFaqs(request: FastifyRequest, reply: FastifyReply) {
  try {
    const faqs = faqsRepository.list();
    reply.send(faqs);
  } catch (error) {
    request.log.error({ error }, 'Error getting all FAQs');
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve FAQs',
      statusCode: 500
    });
  }
}

export async function getFaqById(
  request: FastifyRequest<{ Params: { id: string } }>, 
  reply: FastifyReply
) {
  try {
    const id = request.params.id;
    const faq = faqsRepository.findById(id);
    
    if (!faq) {
      reply.status(404).send({
        error: 'Not Found',
        message: `FAQ with ID ${id} not found`,
        statusCode: 404
      });
      return;
    }

    reply.send(faq);
  } catch (error) {
    request.log.error({ error }, 'Error getting FAQ by ID');
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve FAQ',
      statusCode: 500
    });
  }
}

export async function createFaq(
  request: FastifyRequest<{ 
    Body: { 
      title: string;
      question_variants: string[];
      answer: string;
      product_tags: string[];
    } 
  }>, 
  reply: FastifyReply
) {
  try {
    const { title, question_variants, answer, product_tags } = request.body;
    
    const newFaq = faqsRepository.create({
      title,
      question_variants,
      answer,
      product_tags,
      last_reviewed: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    });

    reply.status(201).send(newFaq);
  } catch (error) {
    request.log.error({ error }, 'Error creating FAQ');
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create FAQ',
      statusCode: 500
    });
  }
}

export async function updateFaq(
  request: FastifyRequest<{ 
    Params: { id: string };
    Body: { 
      title?: string;
      question_variants?: string[];
      answer?: string; 
      product_tags?: string[];
    } 
  }>, 
  reply: FastifyReply
) {
  try {
    const id = request.params.id;
    const { title, question_variants, answer, product_tags } = request.body;
    
    const updatedFaq = faqsRepository.update(id, {
      ...(title && { title }),
      ...(question_variants && { question_variants }),
      ...(answer && { answer }),
      ...(product_tags && { product_tags }),
      last_reviewed: new Date().toISOString().split('T')[0] // Update review date
    });

    if (!updatedFaq) {
      reply.status(404).send({
        error: 'Not Found',
        message: `FAQ with ID ${id} not found`,
        statusCode: 404
      });
      return;
    }

    reply.send(updatedFaq);
  } catch (error) {
    request.log.error({ error }, 'Error updating FAQ');
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to update FAQ',
      statusCode: 500
    });
  }
}

export async function deleteFaq(
  request: FastifyRequest<{ Params: { id: string } }>, 
  reply: FastifyReply
) {
  try {
    const id = request.params.id;
    const deleted = faqsRepository.delete(id);
    
    if (!deleted) {
      reply.status(404).send({
        error: 'Not Found',
        message: `FAQ with ID ${id} not found`,
        statusCode: 404
      });
      return;
    }

    reply.status(204).send(); // No content response for successful deletion
  } catch (error) {
    request.log.error({ error }, 'Error deleting FAQ');
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to delete FAQ',
      statusCode: 500
    });
  }
}
