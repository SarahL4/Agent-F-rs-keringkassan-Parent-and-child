import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// 验证环境变量
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
	console.error('Missing Supabase configuration. Please check your .env file.');
	console.log('Required environment variables:');
	console.log('- SUPABASE_URL');
	console.log('- SUPABASE_ANON_KEY');
	throw new Error('Missing Supabase configuration');
}

console.log('Supabase URL:', process.env.SUPABASE_URL);
console.log('Supabase Anon Key exists:', !!process.env.SUPABASE_ANON_KEY);

const supabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_ANON_KEY
);

// Validate table structure
async function validateTableStructure() {
	try {
		// Try to get table structure
		const { data, error } = await supabase
			.from('fk2')
			.select('id, text, embedding')
			.limit(1);

		if (error) {
			console.error('Error validating table structure:', error);
			throw new Error(
				'Table structure validation failed. Please ensure the table exists with correct columns.'
			);
		}

		console.log('Table structure validated successfully');
		return true;
	} catch (error) {
		console.error('Table validation error:', error);
		throw error;
	}
}

validateTableStructure().catch((error) => {
	console.error('Initial table validation failed:', error);
	console.log(
		'Please ensure you have created the table in Supabase with the following structure:'
	);
	console.log(`
CREATE TABLE public.FK (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text text NOT NULL,
    embedding vector(1024)
);
    `);
});

// // Test Supabase connection
async function testSupabaseConnection() {
	try {
		const { data, error } = await supabase.from('fk2').select('count').limit(1); //fk
		if (error) throw error;
		console.log('Successfully connected to Supabase: fk2.');
	} catch (error) {
		console.error('Failed to connect to Supabase:', error);
		throw error;
	}
}

testSupabaseConnection().catch(console.error);

export async function performSimilaritySearch({
	queryEmbedding,
	maxResults = 30,
	scoreThreshold = 0.0,
}) {
	console.log('Performing similarity search with parameters:');
	// console.log('queryEmbedding: ', queryEmbedding);
	console.log('Max results:', maxResults);
	console.log('Score threshold:', scoreThreshold);
	// TODO: similarity search via pgvecktor in Supabase
	const { data, error } = await supabase.rpc('similarity_search', {
		query_embedding: queryEmbedding,
		max_num_results: maxResults,
		score_threshold: scoreThreshold,
	});

	if (error) {
		console.error('Error performing similarity search in supabase:', error);
		return [];
	}

	console.log('Successfully performed similarity search in supabase.');
	return data;
}
