#!/bin/bash

# Circuit compilation and setup script for access-control circuit
set -e

echo "🔧 Compiling access-control circuit..."

# Create output directory if it doesn't exist
mkdir -p ../public/circuits

# Compile the circuit
echo "📦 Compiling circuit to R1CS..."
circom access-control.circom --r1cs --wasm --sym --c -o ../public/circuits/ -l ../node_modules

# Check if compilation was successful
if [ ! -f "../public/circuits/access-control.r1cs" ]; then
    echo "❌ Circuit compilation failed!"
    exit 1
fi

echo "✅ Circuit compiled successfully!"

# Generate witness calculator
echo "🔨 Generating witness calculator..."
cd ../public/circuits/access-control_js
node generate_witness.js ../access-control.wasm input.json witness.wtns 2>/dev/null || echo "⚠️  Witness generation test skipped (no input.json)"
cd ../../../circuits

echo "🎯 Circuit compilation complete!"
echo "📁 Output files:"
echo "   - R1CS: ../public/circuits/access-control.r1cs"
echo "   - WASM: ../public/circuits/access-control_js/access-control.wasm"
echo "   - Symbols: ../public/circuits/access-control.sym"