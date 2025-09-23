// types.ts (essentials only)
export type ChunkOptions = {
	minTokens: number;  // e.g., 200
	maxTokens: number;  // e.g., 800
	overlapSentences: number; // e.g., 1..3
	strictMode?: boolean;
	targetTokens?: number; // for estimates
	breadcrumbMode?: "conditional" | "always" | "none";
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

// Unified Chunk type matching ../docs/chunk-output-format.md
export type Chunk = {
	// Legacy fields (for pipeline processing)
	content?: string; // Will be deprecated in favor of originalText
	tokens?: number; // Will be deprecated in favor of tokenStats.tokens

	// Core identifiers (populated by metadata stage)
	id?: string;
	parentId?: string;
	prevId?: string | null;
	nextId?: string | null;

	// Content fields
	embedText?: string;
	originalText?: string;

	// Position tracking (populated by metadata stage)
	sourcePosition?: {
		charStart: number;
		charEnd: number;
		totalChars: number;
	};

	// Token information (populated by metadata stage)
	tokenStats?: {
		tokens: number;
		estimatedTokens: number;
	};

	// Pipeline information (populated by metadata stage)
	pipeline?: {
		version: string;
		processingTimeMs: number;
	};

	// Structural information (populated by metadata stage)
	chunkNumber?: number;

	// Metadata object (for vector database filtering, populated by metadata stage)
	metadata?: {
		contentType?: string;
		sectionTitle?: string;
		headerPath?: string[];
		fileTitle?: string;
		headerBreadcrumb?: string;
		headerDepths?: number[];
		headerSlugs?: string[];
		sectionSlug?: string;
		sourceFile?: string;
		nodeTypes?: string[];
		processedAt?: string;
		chunkingOptions?: object;
		[key: string]: any;
	};
};
