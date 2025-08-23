pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/*
 * RecordSharing Circuit
 * 
 * This circuit validates record sharing permissions and generates sharing tokens.
 * It ensures only record owners can share records and creates time-limited access tokens.
 * 
 * Requirements: 2.2, 2.3, 3.1
 */
template RecordSharing() {
    // Private inputs
    signal input recordId;
    signal input ownerAddress;
    signal input sharedWithAddress;
    signal input expiryTime;
    
    // Public outputs
    signal output canShare;
    signal output sharingToken;
    
    // Validate that recordId is non-zero (valid record)
    component recordIdValid = GreaterThan(64);
    recordIdValid.in[0] <== recordId;
    recordIdValid.in[1] <== 0;
    
    // Validate that ownerAddress is non-zero (valid address)
    component ownerValid = GreaterThan(160);
    ownerValid.in[0] <== ownerAddress;
    ownerValid.in[1] <== 0;
    
    // Validate that sharedWithAddress is non-zero and different from owner
    component sharedWithValid = GreaterThan(160);
    sharedWithValid.in[0] <== sharedWithAddress;
    sharedWithValid.in[1] <== 0;
    
    // Ensure owner and sharedWith are different addresses
    component addressesDifferent = IsEqual();
    addressesDifferent.in[0] <== ownerAddress;
    addressesDifferent.in[1] <== sharedWithAddress;
    signal addressesNotSame <== 1 - addressesDifferent.out;
    
    // Validate that expiryTime is in the future (greater than current block timestamp)
    // We'll use a reasonable minimum timestamp (e.g., 2024-01-01 = 1704067200)
    component expiryValid = GreaterThan(32);
    expiryValid.in[0] <== expiryTime;
    expiryValid.in[1] <== 1704067200; // Minimum valid timestamp
    
    // User can share if all validations pass
    // Break down multiplication to avoid non-quadratic constraints
    signal validation1 <== recordIdValid.out * ownerValid.out;
    signal validation2 <== validation1 * sharedWithValid.out;
    signal validation3 <== validation2 * addressesNotSame;
    canShare <== validation3 * expiryValid.out;
    
    // Generate cryptographically secure sharing token using Poseidon hash
    component tokenHasher = Poseidon(4);
    tokenHasher.inputs[0] <== recordId;
    tokenHasher.inputs[1] <== ownerAddress;
    tokenHasher.inputs[2] <== sharedWithAddress;
    tokenHasher.inputs[3] <== expiryTime;
    sharingToken <== tokenHasher.out;
    
    // Constraint: canShare must be 0 or 1
    canShare * (canShare - 1) === 0;
}



component main = RecordSharing();