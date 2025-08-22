#!/bin/bash

# Trusted setup script for access-control circuit
set -e

echo "🔐 Starting trusted setup for access-control circuit..."

# Check if circuit is compiled
if [ ! -f "../public/circuits/access-control.r1cs" ]; then
    echo "❌ Circuit not compiled! Run ./compile.sh first."
    exit 1
fi

# Create output directory
mkdir -p ../public/circuits

# Phase 1: Powers of Tau ceremony (using existing ptau file)
echo "⚡ Using existing Powers of Tau file..."
if [ ! -f "pot14_final.ptau" ]; then
    echo "⚠️  Powers of Tau file not found! Generating new one..."
    echo "🔄 This may take a few minutes..."
    npx snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
    npx snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name='First contribution' -v
    npx snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
    echo "✅ Powers of Tau ceremony completed!"
fi

# Phase 2: Circuit-specific setup
echo "🔑 Generating proving key (zkey)..."
npx snarkjs groth16 setup ../public/circuits/access-control.r1cs pot14_final.ptau ../public/circuits/access-control_0000.zkey

# Apply random beacon (for production, use a real beacon)
echo "🎲 Applying random beacon..."
npx snarkjs zkey beacon ../public/circuits/access-control_0000.zkey ../public/circuits/access-control_0001.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

# Generate verification key
echo "🔍 Generating verification key..."
npx snarkjs zkey export verificationkey ../public/circuits/access-control_0001.zkey ../public/circuits/verification_key.json

# Generate Solidity verifier
echo "📜 Generating Solidity verifier contract..."
npx snarkjs zkey export solidityverifier ../public/circuits/access-control_0001.zkey ../blockchain/contracts/verifier.sol

# Verify the final zkey
echo "✅ Verifying final zkey..."
npx snarkjs zkey verify ../public/circuits/access-control.r1cs pot14_final.ptau ../public/circuits/access-control_0001.zkey

echo "🎉 Trusted setup complete!"
echo "📁 Generated files:"
echo "   - Proving key: ../public/circuits/access-control_0001.zkey"
echo "   - Verification key: ../public/circuits/verification_key.json"
echo "   - Solidity verifier: ../blockchain/contracts/verifier.sol"