# Försäkringskassan Intelligent Agent System

This is an AI-based intelligent agent system designed to handle queries and document processing related to Försäkringskassan (Swedish Social Insurance Agency).

## Features

- Intelligent document processing and analysis
- Multi-model AI integration
- Real-time query response
- PDF document parsing
- Data storage and management

## Installation

1. Clone the repository:

```bash
git clone [repository-url]
cd [project-directory]
```

2. Install dependencies:

```bash
npm install
```

## Project Dependencies

Main dependencies include:

```bash
# AI and Machine Learning
npm i @huggingface/inference
npm i @google/generative-ai
npm i @huggingface/transformers

# Database and Storage
npm i @supabase/supabase-js

# Document Processing
npm i pdf-parse

# Environment Configuration
npm i dotenv

# Web Services
npm i express
npm i cors

# Utility Packages
npm i path
npm i @tavily/core
```

## Environment Configuration

Create a `.env` file in the project root directory and supabase foler and configure the following environment variables:

```env
HUGGINGFACE_API_KEY=your_huggingface_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
HF_TOKEN=your_huggingface_token
HF_API_KEY=your_huggingface_key
GEMINI_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
PORT=3000
```

## Project Structure

```
├── src/                # Source code directory
├── utils/             # Utility functions
├── public/            # Static resources
├── LLM/              # Language model related code
├── supabase/         # Database related code
└── orchestrator-agent.js  # Main program entry
```

## Usage Instructions

1. Ensure all dependencies are properly installed
2. Configure environment variables
3. Run the main program:

```bash
node orchestrator-agent.js
```

Open: http://localhost:3000/query.html

## Important Notes

- Please ensure all necessary API keys are properly configured before use
- It is recommended to thoroughly test in a development environment
- Please comply with relevant data protection regulations
