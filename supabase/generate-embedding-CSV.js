//npm i @huggingface/inference dotenv @supabase/supabase-js
//npm i pdf-parse

// ------------------------------------------------------------
// Parse the PDF file and return the text
// ------------------------------------------------------------

const dotenv = require('dotenv');
const { InferenceClient } = require('@huggingface/inference');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');

dotenv.config();

const inferenceClient = new InferenceClient(process.env.HF_TOKEN);

const supbabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_ANON_KEY
);

//const pdfParse = require('pdf-parse');

async function parsePdf(pdfPath) {
	console.log('Parsing PDF...');
	const pdf = await pdfParse(pdfPath);
	return pdf.text;
}

// ------------------------------------------------------------
// Split the text into chunks of 3200 characters with 1600 characters overlap
// This is taken from OpenAIs chunking strategy of 800 tokens and approximately half of that as overlap
// OpenAI uses an embedding dimension of 256 in their vector store. So we could probably use a larger chunk size
// for a larger embedding dimension.
// ------------------------------------------------------------

function splitText(text, chunkSize = 1500, overlapSize = 750) {
	console.log('Splitting text...');
	const chunks = [];
	let startIndex = 0;

	while (startIndex < text.length) {
		// Get chunk of specified size
		const chunk = text.slice(startIndex, startIndex + chunkSize);
		chunks.push(chunk);

		// Move start index forward by chunkSize - overlapSize
		startIndex += chunkSize - overlapSize;
	}

	// Filter out any empty chunks
	return chunks.filter((chunk) => chunk.length > 0);
}

// ------------------------------------------------------------
// Skappa embeddings av chunks
// ------------------------------------------------------------
async function generateEmbeddings(chunks, prefix = '') {
	console.log('Generating embeddings...');
	const inputChunks = chunks.map((chunk) => prefix + ' ' + chunk);
	const embeddings = await inferenceClient.featureExtraction({
		//model: 'sentence-transformers/all-MiniLM-L6-v2',
		model: 'intfloat/multilingual-e5-large',
		inputs: inputChunks,
		provider: 'hf-inference',
	});

	return embeddings;
}

// ------------------------------------------------------------
// Store embeddings and chunks in a CSV file
// ------------------------------------------------------------

const fs = require('fs');
const path = require('path');

async function storeEmbeddingsToCSV(
	chunks,
	embeddings,
	outputPath = 'FK_parent_child.csv'
) {
	// Create CSV header
	let csvContent = 'text,embedding\n';

	// Add each chunk and its corresponding embedding
	for (let i = 0; i < chunks.length; i++) {
		// Escape quotes in text and convert embedding array to string
		const escapedText = chunks[i].replace(/"/g, '""');
		const embeddingStr = JSON.stringify(embeddings[i]);

		// Add row to CSV
		csvContent += `"${escapedText}","${embeddingStr}"\n`;
	}

	// Write to file
	await fs.promises.writeFile(outputPath, csvContent);
	console.log(`Embeddings stored in ${outputPath}`);
}

// ------------------------------------------------------------
// Main function
// ------------------------------------------------------------
async function main() {
	console.log('Starting...');
	const pdfPath = './FK.pdf';
	const text = await parsePdf(pdfPath);
	console.log('Text parsed');
	const chunks = splitText(text, 1500, 750);
	console.log('Text split');

	const embeddings = await generateEmbeddings(chunks, 'passage:');
	console.log('Embeddings generated');
	await storeEmbeddingsToCSV(chunks, embeddings);
	console.log('embeddings stored to csv');
}

main();
