#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Claude Code API - Quick Start${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo -e "${YELLOW}Please install Node.js v16 or higher${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo -e "${YELLOW}⚠ Claude Code CLI not found${NC}"
    echo -e "${YELLOW}Installing Claude Code...${NC}"
    npm install -g @anthropic-ai/claude-code
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Claude Code installed${NC}"
        echo -e "${YELLOW}Please run: claude setup-token${NC}"
        echo -e "${YELLOW}Then run this script again${NC}"
        exit 0
    else
        echo -e "${RED}✗ Failed to install Claude Code${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Claude Code found${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}Please edit .env file and update credentials${NC}"
fi

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed${NC}"
    else
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Start the server
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Starting Claude Code API...${NC}"
echo -e "${BLUE}========================================${NC}\n"

npm start
