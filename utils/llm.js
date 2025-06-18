import { InferenceClient } from '@huggingface/inference';
import dotenv from 'dotenv';
dotenv.config();

const inferenceClient = new InferenceClient(process.env.HF_API_KEY);

// const MODEL = 'Qwen/Qwen2.5-72B-Instruct';
// const PROVIDER = 'hf-inference';

export async function getAnswerFromLLM(query, context) {
	console.log('Start getting answer from LLM-Qwen/Qwen2.5-72B-Instruct.');
	const prompt = `User question: ${query}
    Context: ${context}`;
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
			You are a helpful assistant that can retrieve by using the tools that are provided.
			When giving the final answer, don't list the dates, 
			answer in a more compelling encouraging way.
			Answer in the language of the question.
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
		max_tokens: 512, //很重要。
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
