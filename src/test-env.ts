import dotenv from 'dotenv';

dotenv.config();

console.log('EMBEDDING_MODEL from env:', process.env.EMBEDDING_MODEL);

import { getModelInfo } from './ai/embeddings.js';

const modelInfo = getModelInfo();
console.log('Model info:', modelInfo);
