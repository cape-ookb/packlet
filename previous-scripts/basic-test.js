#!/usr/bin/env node

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

async function basicTest() {
  console.log('🧪 Testing RecursiveCharacterTextSplitter...');

  const testText = `# Header 1

Some content here.

## Header 2

More content here with multiple sentences. This is getting longer.

---

### Header 3

Final section with content.`;

  console.log('Test text:');
  console.log(testText);
  console.log(`\nText length: ${testText.length} characters`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 20,
    separators: ["\n---\n", "\n# ", "\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""],
    keepSeparator: true
  });

  console.log('\n🔄 Splitting...');

  try {
    const result = splitter.splitText(testText);
    console.log('Raw result:', result);
    console.log('Result type:', typeof result);
    console.log('Is array:', Array.isArray(result));

    if (Array.isArray(result)) {
      console.log(`\n✅ Generated ${result.length} chunks:`);
      result.forEach((chunk, i) => {
        console.log(`  ${i}: "${chunk}" (${chunk.length} chars)`);
      });
    } else {
      console.log('❌ Result is not an array!');
    }
  } catch (error) {
    console.error('Error during splitting:', error);
  }

  // Try async version
  console.log('\n🔄 Trying async version...');
  try {
    const asyncResult = await splitter.splitText(testText);
    console.log('Async result:', asyncResult);
    console.log('Async result type:', typeof asyncResult);
  } catch (error) {
    console.error('Error during async splitting:', error);
  }
}

basicTest();