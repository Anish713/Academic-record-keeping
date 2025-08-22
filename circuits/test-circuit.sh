#!/bin/bash

# Test script for access-control circuit
set -e

echo "🧪 Testing access-control circuit..."

# Check if setup is complete
if [ ! -f "../public/circuits/access-control_0001.zkey" ]; then
    echo "❌ Circuit setup not complete! Run ./setup.sh first."
    exit 1
fi

# Create test input
echo "📝 Creating test input..."
cat > test-input.json << EOF
{
    "userAddress": "123456789",
    "recordId": "1",
    "accessKey": "987654321",
    "timestamp": "1640995200",
    "pathElements": ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    "pathIndices": ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    "recordHash": "456789123",
    "merkleRoot": "111111111"
}
EOF

# Generate witness
echo "🔨 Generating witness..."
cd ../public/circuits/access-control_js
node generate_witness.js access-control.wasm ../../../circuits/test-input.json witness.wtns

# Generate proof
echo "🔐 Generating proof..."
npx snarkjs groth16 prove ../access-control_0001.zkey witness.wtns proof.json public.json

# Verify proof
echo "✅ Verifying proof..."
npx snarkjs groth16 verify ../verification_key.json public.json proof.json

cd ../../../circuits

# Clean up test files
rm -f test-input.json
rm -f ../public/circuits/access-control_js/witness.wtns
rm -f ../public/circuits/access-control_js/proof.json
rm -f ../public/circuits/access-control_js/public.json

echo "🎉 Circuit test completed successfully!"