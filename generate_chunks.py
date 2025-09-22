#!/usr/bin/env python3
"""
Blog Post Embedding Processor

Processes markdown blog posts from Pumpspotting for vector database storage.
Chunks content semantically and prepares for embedding generation.
"""

import json
import re
import hashlib
from pathlib import Path
from typing import Dict, List, Generator, Any
import frontmatter
import tiktoken
from langchain.text_splitter import RecursiveCharacterTextSplitter
from markdown_utils import clean_markdown_text, remove_markdown_links, extract_markdown_links, get_chunk_header_context

# Configuration
BLOG_DIR = Path("../../blog")  # Relative to script location
CHUNKS_OUTPUT_DIR = Path("chunks")  # Where individual chunk files are saved
# Ideal Chunk: 600–800 tokens, 10–17% overlap.
MAX_CHUNK_TOKENS = 625  # Optimal for most embedding models
OVERLAP_TOKENS = 100    # Overlap between chunks
MIN_CHUNK_TOKENS = 50   # Skip chunks smaller than this

def count_tokens(text: str, model: str = "cl100k_base") -> int:
    """Count tokens using tiktoken (OpenAI's tokenizer)"""
    try:
        encoding = tiktoken.get_encoding(model)
        return len(encoding.encode(text))
    except Exception:
        # Fallback: rough estimate (4 chars per token)
        return len(text) // 4


def chunk_content_with_langchain(content: str, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Chunk content using LangChain's RecursiveCharacterTextSplitter optimized for markdown
    """
    # Create splitter optimized for markdown with header-priority separators
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=MAX_CHUNK_TOKENS,     # Use token count directly
        chunk_overlap=OVERLAP_TOKENS,    # Use token count directly
        length_function=count_tokens,    # This measures tokens, not characters
        separators=[
            "\n## ",     # H2 headers - primary split points
            "\n### ",    # H3 headers
            "\n#### ",   # H4 headers
            "\n##### ",  # H5 headers
            "\n###### ", # H6 headers
            "\n\n",      # Double newlines (paragraph breaks)
            "\n",        # Single newlines
            ". ",        # Sentence endings
            "! ",        # Exclamation sentences
            "? ",        # Question sentences
            " ",         # Spaces
            ""           # Characters (last resort)
        ],
        keep_separator=True,
    )
    
    # Split the content
    text_chunks = text_splitter.split_text(content)
    
    # Convert to our chunk format (first pass - create chunks without prev/next)
    temp_chunks = []
    for i, chunk_text in enumerate(text_chunks):
        cleaned_text = clean_markdown_text(chunk_text)
        
        # Skip chunks that are too small after cleaning
        if count_tokens(cleaned_text) < MIN_CHUNK_TOKENS:
            continue
            
        # Find the most relevant heading for this chunk
        heading = extract_heading_from_chunk(chunk_text)
        
        temp_chunks.append({
            'content': cleaned_text,
            'markdown_content': chunk_text,  # Preserve original LangChain content for display and offsets
            'heading': heading,
            'chunk_num': len(temp_chunks)  # Use length as index for valid chunks
        })
    
    # Second pass - create final chunks with prev/next links and header context
    chunks = []
    parent_id = f"post:{metadata['slug']}"
    
    for i, temp_chunk in enumerate(temp_chunks):
        # Calculate prev/next IDs
        prev_id = f"{parent_id}::ch{i-1}" if i > 0 else None
        next_id = f"{parent_id}::ch{i+1}" if i < len(temp_chunks) - 1 else None
        
        chunk = create_chunk(
            temp_chunk['content'],         # Cleaned content for embeddings 
            temp_chunk['heading'], 
            metadata, 
            temp_chunk['chunk_num'],
            "post",
            prev_id,
            next_id,
            content,                       # Pass full content for header context
            temp_chunk['markdown_content'] # Pass original LangChain content for display and offset calculation
        )
        chunks.append(chunk)
    
    return chunks

def extract_heading_from_chunk(chunk_text: str) -> str:
    """Extract the most relevant heading from a chunk"""
    lines = chunk_text.split('\n')
    
    # Look for the first heading in the chunk
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#'):
            return stripped
    
    return ""

def calculate_char_offsets(chunk_content: str, full_content: str) -> Dict[str, Any]:
    """Calculate character offsets for a chunk within the full content
    
    Returns:
        {
            'char_start': int,
            'char_end': int, 
            'source_length': int,
            'confidence': float  # 1.0 = exact match, 0.0 = no match found
        }
    """
    if not full_content or not chunk_content:
        return {
            'char_start': -1,
            'char_end': -1,
            'source_length': len(full_content) if full_content else 0,
            'confidence': 0.0
        }
    
    chunk_stripped = chunk_content.strip()
    
    # Try exact match first
    char_start = full_content.find(chunk_stripped)
    if char_start != -1:
        return {
            'char_start': char_start,
            'char_end': char_start + len(chunk_stripped),
            'source_length': len(full_content),
            'confidence': 1.0
        }
    
    # Fallback: try to find a substantial portion of the chunk (first 100 chars)
    search_portion = chunk_stripped[:100] if len(chunk_stripped) > 100 else chunk_stripped
    partial_start = full_content.find(search_portion)
    if partial_start != -1:
        # Estimate end position based on chunk length
        estimated_end = partial_start + len(chunk_stripped)
        return {
            'char_start': partial_start,
            'char_end': min(estimated_end, len(full_content)),
            'source_length': len(full_content),
            'confidence': 0.8  # Partial match
        }
    
    # No match found
    return {
        'char_start': -1,
        'char_end': -1,
        'source_length': len(full_content),
        'confidence': 0.0
    }

def create_chunk(content: str, heading: str, metadata: Dict[str, Any], chunk_num: int, content_type: str = "post", prev_id: str = None, next_id: str = None, full_content: str = None, markdown_chunk_content: str = None) -> Dict[str, Any]:
    """Create a standardized chunk with metadata and header context"""
    # Extract links before cleaning the content
    chunk_links = extract_markdown_links(content)
    
    # Get header context if full content is provided
    header_context = {}
    if full_content:
        header_context = get_chunk_header_context(full_content, content)
    
    # Calculate character offsets using the original markdown chunk content
    # Use markdown_chunk_content if available, otherwise fall back to cleaned content
    offset_content = markdown_chunk_content if markdown_chunk_content else content
    char_offsets = calculate_char_offsets(offset_content, full_content) if full_content else {
        'char_start': -1,
        'char_end': -1,
        'source_length': 0,
        'confidence': 0.0
    }
    
    # Generate content hash of processed content for change detection
    # Note: source_content_sha256 is for processed content, original_file_sha256 is for the raw markdown file
    source_content_sha256 = hashlib.sha256(full_content.encode('utf-8')).hexdigest() if full_content else None
    
    # Clean the content AFTER calculating offsets
    cleaned_content = clean_markdown_text(content)
    
    # Include context in chunk for better embeddings with consistent title prefix
    title_prefix = f"Title: {metadata['title']}\n"
    
    # Add header hierarchy to context if available
    if header_context.get('header_hierarchy'):
        hierarchy_prefix = f"Section: {header_context['header_hierarchy']}\n"
        context_content = f"{title_prefix}{hierarchy_prefix}\n{cleaned_content}"
    elif heading and not heading.startswith(metadata['title']):
        context_content = f"{title_prefix}{heading}\n\n{cleaned_content}"
    else:
        context_content = f"{title_prefix}\n{cleaned_content}"
    
    # Generate parent ID and chunk ID
    parent_id = f"{content_type}:{metadata['slug']}"
    chunk_id = f"{parent_id}::ch{chunk_num}"
    
    return {
        "id": chunk_id,
        "parent_id": parent_id,
        "prev_id": prev_id,
        "next_id": next_id,
        "embed_text": context_content,
        "display_markdown": markdown_chunk_content if markdown_chunk_content else content,  # Preserve markdown formatting for human display
        "chunk_number": chunk_num,
        "content_type": content_type,
        "heading": heading,
        "header_path": header_context.get('header_path', []),
        "header_hierarchy": header_context.get('header_hierarchy', ''),
        "token_count": count_tokens(context_content),
        "links": chunk_links,
        "char_offsets": char_offsets,
        "source_content_sha256": source_content_sha256,
        "original_file_sha256": metadata.get("original_file_sha256", ""),
        "metadata": {
            "title": metadata["title"],
            "date": metadata["date"],
            "slug": metadata["slug"],
            "tags": metadata["tags"],
            "source_url": metadata["source_url"],
            "post_path": str(metadata["post_path"]),
            "image_alt_texts": [img.get("alt", "") for img in metadata.get("images", []) if img.get("alt")]
        }
    }

# Import from process_blog module
from process_blog import process_blog_posts

def save_chunks_as_individual_files():
    """Process all blog posts and save each chunk as an individual JSON file"""
    chunks_saved = 0
    
    print("Processing blog posts for embeddings...")
    print(f"Blog directory: {BLOG_DIR.absolute()}")
    print(f"Chunks output directory: {CHUNKS_OUTPUT_DIR.absolute()}")
    print(f"Max tokens per chunk: {MAX_CHUNK_TOKENS}")
    print("-" * 50)
    
    # Create chunks output directory
    chunks_dir = Path(__file__).parent / CHUNKS_OUTPUT_DIR
    chunks_dir.mkdir(exist_ok=True)
    
    # Clean existing chunk files
    for existing_file in chunks_dir.glob("post_*.json"):
        existing_file.unlink()
    
    token_counts = []
    sample_chunk = None
    
    for chunk in process_blog_posts(BLOG_DIR):
        # Generate filename from ID: post:slug::ch0 -> post_slug__ch0.json
        safe_filename = chunk['id'].replace(':', '_').replace('::', '__') + '.json'
        chunk_file_path = chunks_dir / safe_filename
        
        # Save chunk to individual file
        with open(chunk_file_path, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, indent=2, default=str)
        
        chunks_saved += 1
        token_counts.append(chunk['token_count'])
        
        # Keep first chunk as sample
        if not sample_chunk:
            sample_chunk = chunk
    
    print("-" * 50)
    print(f"✅ Saved {chunks_saved} chunks to {chunks_dir}")
    
    # Print statistics
    if token_counts:
        avg_tokens = sum(token_counts) / len(token_counts)
        
        print(f"📊 Statistics:")
        print(f"   Total chunks: {len(token_counts)}")
        print(f"   Average tokens per chunk: {avg_tokens:.1f}")
        print(f"   Min tokens: {min(token_counts)}")
        print(f"   Max tokens: {max(token_counts)}")
        
        # Show sample chunk
        if sample_chunk:
            print(f"\n📄 Sample chunk:")
            print(f"   ID: {sample_chunk['id']}")
            print(f"   Content Type: {sample_chunk['content_type']}")
            print(f"   Title: {sample_chunk['metadata']['title']}")
            print(f"   Tokens: {sample_chunk['token_count']}")
            print(f"   File: {sample_chunk['id'].replace(':', '_').replace('::', '__')}.json")
            print(f"   Embed text preview: {sample_chunk['embed_text'][:150]}...")

def check_companion_script():
    """Check if companion script exists, create if missing"""
    script_path = Path(__file__).parent / "generate_embeddings.py"
    
    if not script_path.exists():
        print(f"⚠️  Companion script not found at {script_path}")
        print("   Please ensure generate_embeddings.py exists in the same directory")
        return False
    
    print(f"✅ Found companion script: {script_path}")
    return True

if __name__ == "__main__":
    # Install required packages if not available
    try:
        import frontmatter
        import tiktoken
        from langchain.text_splitter import RecursiveCharacterTextSplitter
    except ImportError as e:
        print("❌ Missing required packages. Install with:")
        print("pip install python-frontmatter tiktoken langchain")
        exit(1)
    
    # Process blog posts
    save_chunks_as_individual_files()
    
    # Check companion embedding script exists
    check_companion_script()
    
    print("\n🎉 Done! Next steps:")
    print("1. Review the generated chunk files in chunks/ directory")
    print("2. Set OPENAI_API_KEY environment variable")
    print("3. Run: python generate_embeddings.py")
    print("4. Implement vector database storage in generate_embeddings.py")