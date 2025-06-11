import dotenv from 'dotenv';
import { InferenceClient } from '@huggingface/inference';

dotenv.config();

const inferenceClient = new InferenceClient(process.env.HF_API_KEY);

export async function generateSingleEmbedding(text, prefix = '') {
	console.log('Starting embedding generation for text:', text);

	const inputText = prefix ? `${prefix} ${text}` : text;
	const embeddingArr = await inferenceClient.featureExtraction({
		model: 'intfloat/multilingual-e5-large',
		inputs: [inputText],
		provider: 'hf-inference',
	});

	// embeddingArr is a 2D array, take the first item
	const embedding = embeddingArr[0];
	console.log('Embedding generation completed.');
	return embedding;
}
