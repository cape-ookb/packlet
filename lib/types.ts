// types.ts (essentials only)
export type ChunkOptions = {
	minTokens: number;  // e.g., 200
	maxTokens: number;  // e.g., 800
	overlapSentences: number; // e.g., 1..3
	strictMode?: boolean;
	targetTokens?: number; // for estimates
};

// AST types for markdown parsing
export type AstNode = {
	type: string;
	value?: string;
	children?: AstNode[];
	depth?: number; // for headings
	lang?: string; // for code blocks
	meta?: string; // for code block metadata
	position?: {
		start: { line: number; column: number; offset: number };
		end: { line: number; column: number; offset: number };
	};
};

export type AstRoot = {
	type: 'root';
	children: AstNode[];
};

// Chunk types
export type Chunk = {
	content: string;
	tokens: number;
	metadata?: Record<string, any>;
};

// Enhanced chunk type matching ../docs/chunk-format-documentation.md
export type EnhancedChunk = {
	// Core identifiers
	id: string;
	parentId: string;
	prevId: string | null;
	nextId: string | null;

	// Content fields
	embedText: string;
	displayMarkdown: string;

	// Structural information
	chunkNumber: number;
	contentType: string;
	heading: string;
	headerPath: string[];

	// Position tracking
	charOffsets: {
		charStart: number;
		charEnd: number;
		sourceLength: number;
	};

	// Metadata
	metadata: {
		source: string;
		fileName: string;
		timestamp: string;
		nodeTypes: string[];
		tokenCount: number;
		[key: string]: any;
	};
};
