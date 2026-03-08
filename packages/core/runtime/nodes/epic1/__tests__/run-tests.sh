#!/bin/bash

# Epic 1 Test Runner with Coverage
# Run all Epic 1 tests and generate coverage report

echo "Running Epic 1 tests with coverage..."
echo "=================================="

# Navigate to project root
cd ../../../../../

# Run tests with coverage for Epic 1 nodes
npx jest packages/core/runtime/nodes/epic1/__tests__ \
  --coverage \
  --collectCoverageFrom="packages/core/runtime/nodes/epic1/**/*.ts" \
  --collectCoverageFrom="!packages/core/runtime/nodes/epic1/**/*.test.ts" \
  --collectCoverageFrom="!packages/core/runtime/nodes/epic1/__tests__/**" \
  --collectCoverageFrom="!packages/core/runtime/nodes/epic1/examples/**" \
  --coverageDirectory="coverage/epic1" \
  --coverageReporters="text" \
  --coverageReporters="lcov" \
  --coverageReporters="html" \
  --verbose

# Check if tests passed
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
  echo ""
  echo "Coverage report generated at: coverage/epic1/index.html"
  echo ""
  
  # Display coverage summary
  echo "Coverage Summary:"
  echo "-----------------"
  cat coverage/epic1/lcov-report/index.html | grep -A 20 "Coverage summary" || true
else
  echo ""
  echo "❌ Tests failed!"
  exit 1
fi