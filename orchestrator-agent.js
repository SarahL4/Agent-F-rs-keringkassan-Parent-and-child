// node LL/orchestrator-agent.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import DDG from 'duck-duck-scrape';
import { convert } from 'html-to-text';
import dotenv from 'dotenv';
import { tavily } from '@tavily/core';
import { HfInference } from '@huggingface/inference';
import { generateSingleEmbedding } from './utils/generateEmbeddings.js';
import { performSimilaritySearch } from './utils/supabaseUtils.js';
import { rewriteSearchQuery, getAnswerFromLLM } from './utils/llm.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configure CORS
app.use(
	cors({
		origin: ['http://127.0.0.1:3000', 'http://localhost:3000'],
		methods: ['GET', 'POST', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure static file service
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
const inferenceClient = new HfInference(process.env.HF_API_KEY);

const DEFAULT_SYSTEM_PROMPT = `
Instructions:
Today's date is ${new Date().toLocaleDateString()}.
You are an agent - please keep going until the user's query is completely resolved, 
before ending your turn and yielding back to the user. Only terminate your turn 
when you are sure that the problem is solved, or if you need more info from the user to solve the problem.

If you are not sure about anything pertaining to the user's request, use your 
tools to read files, browse the web and visit websites and gather the relevant 
information: do NOT guess or make up an answer.
`.trim();

// 从Supabase获取答案的函数
async function getSupabaseAnswer(query) {
	try {
		if (!query) {
			return res.status(400).json({ error: 'query required' });
		}

		// Rewrite query
		const rewrittenQuery = await rewriteSearchQuery(query);
		console.log('Rewritten query: ', rewrittenQuery);

		// Generate embeddings for query
		const embedding = await generateSingleEmbedding(
			query,
			'Represent this sentence for searching relevant passages: '
		);

		// Perform similarity search
		const results = await performSimilaritySearch({
			queryEmbedding: embedding,
			maxResults: 30,
		});
		// console.log('Results: ', results);

		if (!results || !Array.isArray(results) || results.length === 0) {
			console.error('No results returned from performSimilaritySearch');
			return null;
		}
		console.log(results.length);

		// Find the top 5 highest score results
		const topResults = results.sort((a, b) => b.score - a.score).slice(0, 5);
		console.log('Top 5 highest score results:', topResults);

		// Find the highest score result
		const maxScoreResult = topResults[0];
		console.log('Highest score result:', maxScoreResult);

		const resultsText = [];
		for (const result of results) {
			resultsText.push(result.text);
			// console.log('result text: ', result.text);
		}

		// Call LLM
		const answer = await getAnswerFromLLM(query, resultsText.join('\n\n'));
		return answer;
	} catch (error) {
		console.error('Error getting Supabase answer:', error);
		return null;
	}
}

// 使用Tavily进行网络搜索
async function searchWithTavily(query) {
	try {
		const searchResults = await tavilyClient.search(query, {
			search_depth: 'advanced',
			include_answer: true,
			include_domains: ['forsakringskassan.se'],
			max_results: 5,
		});
		return searchResults;
	} catch (error) {
		console.error('Error searching with Tavily:', error);
		return null;
	}
}

// Function to visit website
async function visitWebsite(url) {
	try {
		const response = await fetch(url);
		const html = await response.text();
		const options = {
			wordwrap: 130,
		};
		return convert(html, options);
	} catch (error) {
		console.error('Error visiting website:', error);
		return null;
	}
}

// Use DeepSeek to generate answer
async function generateResponse(prompt, context) {
	try {
		// Limit context size
		const maxContextLength = 800; // character limit
		let contextStr = JSON.stringify(context, null, 2);
		if (contextStr.length > maxContextLength) {
			contextStr = contextStr.substring(0, maxContextLength) + '...';
		}

		const chatCompletion = await inferenceClient.chatCompletion({
			provider: 'hf-inference',
			model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
			messages: [
				{
					role: 'system',
					content: `Today's date is ${new Date().toLocaleDateString()}.
						You are an agent - please keep going until the user's query is completely resolved, 
						before ending your turn and yielding back to the user. Only terminate your turn 
						when you are sure that the problem is solved, or if you need more info from the user to solve the problem.

						If you are not sure about anything pertaining to the user's request, use your 
						tools to read files, browse the web and visit websites and gather the relevant 
						information: do NOT guess or make up an answer.
						Answer only in the language of the question.
					
					Context:
					${contextStr}
					`,
				},
				{
					role: 'user',
					content: prompt,
				},
			],
			parameters: {
				max_new_tokens: 1024,
				temperature: 0.5,
				top_p: 0.95,
			},
		});

		return chatCompletion.choices[0].message.content;
	} catch (error) {
		console.error('Error generating response with Mistral:', error);
		throw error;
	}
}

// Route for handling queries
app.post('/answerQuery', async (req, res) => {
	const { query = '' } = req.body;
	console.log('Received query:', query);

	if (!query) {
		return res.status(400).json({ error: 'query required' });
	}

	try {
		// Parallel execution of all search tasks
		const [supabaseAnswer, tavilyResults] = await Promise.all([
			getSupabaseAnswer(query),
			searchWithTavily(query),
		]);
		console.log('Supabase answer:', supabaseAnswer);

		// Get website content
		let websiteContents = [];
		if (tavilyResults?.results) {
			const tavilyUrls = tavilyResults.results.map((r) => r.url);
			const tavilyContents = await Promise.all(
				tavilyUrls.map((url) => visitWebsite(url))
			);
			websiteContents.push(...tavilyContents.filter(Boolean));
		}

		// Merge all sources information
		const context = {
			supabase: supabaseAnswer,
			tavily: tavilyResults,
			// websiteContents: websiteContents,
		};

		// Generate final answer
		const finalAnswer = await generateResponse(query, context);
		console.log('Final answer:', finalAnswer);
		res.json({
			answer: finalAnswer,
			sources: context,
		});
	} catch (error) {
		console.error('Error processing query:', error);
		res.status(500).json({
			error: 'Failed to process query',
			details: error.message,
		});
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Orchestrator agent running on http://localhost:${PORT}`);
});

// hur många dagar har jag för föräldrapenning?
/**Du är belåten till max 480 dagar för föräldrapenning i Sverige. Det omfattar max 390 dagar beroende på sjukpenningnivå och max 90 extra skol- och fritidsdagar. En del av dagarna kan vara dubbeldagar där bägge föräldrarna kan ha tillgång till behörigt antal dagar samtidigt. */
//hur mycket pengar får man för barnbidraget?
/**För en barn är barnbidraget 1,250 kronor per månad. Om du har två barn får du 2,500 kronor sammanlagt (1,250 kronor per barn). Du får fortfarande 150 kronor flerbarnstillägg om du har två barn eller fler. Om du har tre barn får du 3,750 kronor sammanlagt (1,250 kronor för den första, 1,250 kronor för den andra, och 1,250 kronor för den tredje barnet). Du får då ytterligare 730 kronor flerbarnstillägg. Det är en viktig stöd för när du tar hand om din barn. Känn dig stödd! */
