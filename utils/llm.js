import { InferenceClient } from '@huggingface/inference';
import dotenv from 'dotenv';
dotenv.config();

const inferenceClient = new InferenceClient(process.env.HF_API_KEY);

// const MODEL = 'Qwen/Qwen2.5-72B-Instruct';
// const PROVIDER = 'hf-inference';

// Helper function to estimate token count (rough estimate)
function estimateTokenCount(text) {
	if (!text) return 0;
	const textStr = String(text);
	return textStr.split(/\s+/).length * 1.3; // Rough estimate: words * 1.3
}

// Helper function to truncate context while preserving complete sentences
function truncateContext(context, maxTokens) {
	if (!context) return '';

	// Convert context to string if it's not already
	const textStr =
		typeof context === 'string' ? context : JSON.stringify(context);

	if (estimateTokenCount(textStr) <= maxTokens) {
		return textStr;
	}

	const sentences = textStr.split(/[.!?]+\s+/);
	let result = '';
	let currentTokens = 0;

	for (const sentence of sentences) {
		const sentenceTokens = estimateTokenCount(sentence);
		if (currentTokens + sentenceTokens > maxTokens) {
			break;
		}
		result += sentence + '. ';
		currentTokens += sentenceTokens;
	}

	return result.trim();
}

export async function getAnswerFromLLMWorker(query, context) {
	console.log('Start getting answer from LLM-Qwen/Qwen2.5-72B-Instruct.');

	// Limit context to ~1k tokens to leave room for system prompt and response
	const truncatedContext = truncateContext(context, 1000);

	const prompt = `User question: ${query}
    Context: ${truncatedContext}`;

	/**You are a helpful assistant working at Försäkringskassan that can answer questions based on the provided context.
			If you don't know the answer, just say "I don't know".
			Do not mention any references to the context such as "Based on the context provided" or "According to the context".
			Or references to different sections mentioned in the context.
			Also be very brief but friendly in your answers.
			Answer in the language of the question. */
	const messages = [
		{
			role: 'system',
			content: [
				{
					type: 'text',
					text: `Todays date is ${new Date().toISOString().split('T')[0]}. 
			You are a helpful assistant that provides BRIEF and DIRECT answers.
					
					IMPORTANT RULES:
					1. Be extremely concise - answer in 1-2 sentences only
					2. Focus only on the most relevant information
					3. Answer in the same language as the user's question
					4. If sources conflict, prefer Supabase information
					5. No explanations or additional context - just the direct answer
					6. If amount/numbers are involved, always include them
					
					Available context:
					${truncatedContext}
			`,
				},
			],
		},
		{
			role: 'user',
			content: [
				{
					type: 'text',
					text: prompt,
				},
			],
		},
	];

	const response = await inferenceClient.chatCompletion({
		model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
		// model: 'Qwen/Qwen2.5-72B-Instruct',
		provider: 'hf-inference',
		messages: messages,
		// max_tokens: 512,
		parameters: {
			max_new_tokens: 1024,
			temperature: 0.3,
			top_p: 0.95,
		},
	});

	const responseMessage = response.choices[0].message;

	console.log('Response message content: ', responseMessage.content);
	return responseMessage.content;
}

// -------------  Generate embeddings -----------------------------------
export async function rewriteSearchQuery(query) {
	const chatCompletion = await inferenceClient.chatCompletion({
		provider: 'nebius',
		model: 'google/gemma-3-27b-it',
		messages: [
			{
				role: 'system',
				content: [
					{
						type: 'text',
						text: `Given a question, return a standalone question in the same language as the question..`,
					},
				],
			},
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: query,
					},
				],
			},
		],
		max_tokens: 512, // Very important
	});
	console.log(chatCompletion.model);
	return chatCompletion.choices[0].message.content;
}

// -------------  Utils -----------------------------------

// async function callFunction(name, args) {
// 	if (name === 'retrieveDataBetweenDates') {
// 		console.log('callFunction name: ', name);
// 		return await retrieveDataBetweenDates(args.start_date, args.end_date);
// 	} else if (name === 'addToMemory') {
// 		console.log('callFunction name: ', name);
// 		//Function args:  {
// 		//		memoryText: 'Your favorite coffee is unknown. Please tell me what your favorite coffee is so I can remember it.'
// 		//	  }
// 		return await addToMemory(args.memoryText);
// 	} else {
// 		return 'No function found';
// 	}
// }

// ------------------------- Function schemas-----------------------------------

// const retrieveDataBetweenDatesSchema = {
// 	type: 'function',
// 	function: {
// 		name: 'retrieveDataBetweenDates',
// 		description: 'Retrieves data from Supabase in between two specified dates',
// 		parameters: {
// 			type: 'object',
// 			required: ['start_date', 'end_date'],
// 			properties: {
// 				start_date: {
// 					type: 'string',
// 					description:
// 						'The start date for the data retrieval in ISO 8601 format',
// 				},
// 				end_date: {
// 					type: 'string',
// 					description: 'The end date for the data retrieval in ISO 8601 format',
// 				},
// 			},
// 		},
// 	},
// };

// const addToMemorySchema = {
// 	type: 'function',
// 	function: {
// 		name: 'addToMemory',
// 		description: `When the user tells you something factual about themselves,
//          their life, or their preferences, call this function.

//          Keep the memoryText short and concise.`,
// 		parameters: {
// 			type: 'object',
// 			properties: {
// 				memoryText: {
// 					type: 'string',
// 					description: 'Text to add to the memory bank',
// 				},
// 			},
// 			required: ['memoryText'],
// 		},
// 	},
// };

// ------------------------- Function implementations-----------------------------------

// async function retrieveDataBetweenDates(start_date, end_date) {
// 	const { data, error } = await supabase
// 		.from('notes')
// 		.select('content, created_at')
// 		.lte('created_at', end_date)
// 		.gte('created_at', start_date);

// 	//console.log('The data retrieved: ', data);
// 	return data;
// }

// async function addToMemory(content) {
// 	const { data, error } = await supabase
// 		.from('memories')
// 		.insert({ memory: content });

// 	if (error) {
// 		console.error('Error inserting memory: ', error);
// 		return 'Error inserting memory';
// 	}

// 	console.log('The data inserted: ', content);
// 	return content;
// }
