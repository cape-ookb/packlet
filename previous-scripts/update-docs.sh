#!/usr/bin/env bash

# Documentation sources - add new docs here
declare -a DOCS=(
    "https://svelte.dev/llms-full.txt svelte"
    "https://www.skeleton.dev/llms-svelte.txt skeleton"
    "https://tailwindcss.com/llms.txt tailwind"
    "https://vitejs.dev/llms.txt vite"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create docs directory if it doesn't exist
DOCS_DIR="./docs"
if [ ! -d "$DOCS_DIR" ]; then
    echo -e "${BLUE}Creating docs directory...${NC}"
    mkdir -p "$DOCS_DIR"
fi

echo -e "${BLUE}Updating documentation files...${NC}\n"

# Download each documentation file
for doc in "${DOCS[@]}"; do
    # Split the string into URL and name
    URL=$(echo $doc | cut -d' ' -f1)
    NAME=$(echo $doc | cut -d' ' -f2)
    OUTPUT_FILE="$DOCS_DIR/${NAME}.txt"

    echo -e "${BLUE}Downloading ${NAME} documentation...${NC}"

    # Download with curl, following redirects
    if curl -sL "$URL" -o "$OUTPUT_FILE"; then
        # Check if file has content
        if [ -s "$OUTPUT_FILE" ]; then
            SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
            echo -e "${GREEN}✓ ${NAME}.txt downloaded successfully (${SIZE})${NC}"
        else
            echo -e "${RED}✗ ${NAME}.txt is empty, removing...${NC}"
            rm "$OUTPUT_FILE"
        fi
    else
        echo -e "${RED}✗ Failed to download ${NAME} documentation${NC}"
    fi

    echo ""
done

# Show summary
echo -e "${BLUE}Documentation update complete!${NC}"
echo -e "${BLUE}Files in docs directory:${NC}"
ls -lh "$DOCS_DIR"/*.txt 2>/dev/null | awk '{print "  • " $9 " (" $5 ")"}'