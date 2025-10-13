#!/bin/bash
# Test-Skript zur Verifikation des Deployments
# Dieses Skript kann auf dem Server ausgeführt werden um zu prüfen ob alles funktioniert

echo "================================================"
echo "  DAL-AI-Backend Deployment Verification"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Test 1: Check if Node.js is installed
echo -n "1. Checking Node.js installation... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    ERRORS=$((ERRORS+1))
fi

# Test 2: Check if npm is installed
echo -n "2. Checking npm installation... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    ERRORS=$((ERRORS+1))
fi

# Test 3: Check if package.json exists
echo -n "3. Checking package.json... "
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} Found"
else
    echo -e "${RED}✗${NC} Not found"
    ERRORS=$((ERRORS+1))
fi

# Test 4: Run npm install
echo -n "4. Running npm install... "
npm install > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Success"
else
    echo -e "${RED}✗${NC} Failed"
    ERRORS=$((ERRORS+1))
fi

# Test 5: Run build
echo -n "5. Running npm run build... "
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Success (no TypeScript errors)"
else
    echo -e "${RED}✗${NC} Failed (TypeScript errors found)"
    echo ""
    echo "TypeScript errors:"
    npm run build 2>&1 | grep "error TS"
    ERRORS=$((ERRORS+1))
fi

# Test 6: Check if dist/server.js was created
echo -n "6. Checking dist/server.js... "
if [ -f "dist/server.js" ]; then
    echo -e "${GREEN}✓${NC} Found"
else
    echo -e "${RED}✗${NC} Not found"
    ERRORS=$((ERRORS+1))
fi

# Test 7: Check if data/faqs.json exists
echo -n "7. Checking data/faqs.json... "
if [ -f "data/faqs.json" ]; then
    FAQ_COUNT=$(cat data/faqs.json | grep -o '"question"' | wc -l)
    echo -e "${GREEN}✓${NC} Found ($FAQ_COUNT FAQs)"
else
    echo -e "${YELLOW}⚠${NC} Not found (optional)"
fi

# Test 8: Check .env file
echo -n "8. Checking .env configuration... "
if [ -f ".env" ]; then
    if grep -q "SESSION_SECRET=change_me" .env 2>/dev/null; then
        echo -e "${YELLOW}⚠${NC} Using default SESSION_SECRET (change in production!)"
    else
        echo -e "${GREEN}✓${NC} Found"
    fi
else
    echo -e "${YELLOW}⚠${NC} Not found (using defaults)"
fi

# Test 9: Check port availability
echo -n "9. Checking if port 3022 is available... "
if command -v lsof &> /dev/null; then
    if lsof -Pi :3022 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠${NC} Port 3022 already in use"
    else
        echo -e "${GREEN}✓${NC} Available"
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot check (lsof not installed)"
fi

# Test 10: Start server in test mode (5 seconds)
echo -n "10. Testing server startup... "
timeout 5 node dist/server.js > /tmp/server-test.log 2>&1 &
SERVER_PID=$!
sleep 2

if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server started successfully"
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
else
    echo -e "${RED}✗${NC} Server failed to start"
    echo ""
    echo "Server log:"
    cat /tmp/server-test.log
    ERRORS=$((ERRORS+1))
fi

# Summary
echo ""
echo "================================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo ""
    echo "The application is ready to deploy!"
    echo ""
    echo "To start the server:"
    echo "  sudo systemctl start dal-ai-backend"
    echo ""
    echo "To view logs:"
    echo "  tail -f /var/www/dal-ai-backend/dal-ai-backend.log"
    exit 0
else
    echo -e "${RED}✗ $ERRORS CHECKS FAILED${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
fi
