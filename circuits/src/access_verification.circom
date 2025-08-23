pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/*
 * AccessVerification Circuit
 * 
 * This circuit verifies that a user has permission to access a specific record.
 * It takes private inputs about the record and user, and outputs a public proof
 * that access is authorized without revealing sensitive information.
 * 
 * Requirements: 1.1, 1.2, 2.1, 2.2
 */
template AccessVerification() {
    // Private inputs
    signal input recordId;
    signal input userAddress;
    signal input issuerAddress;
    signal input studentAddress;
    signal input accessType; // 0=OWNER, 1=SHARED, 2=ADMIN, 3=EMERGENCY
    
    // Public outputs
    signal output hasAccess;
    signal output proofHash;
    
    // Check if user is the issuer (university)
    component isIssuer = IsEqual();
    isIssuer.in[0] <== userAddress;
    isIssuer.in[1] <== issuerAddress;
    
    // Check if user is the student (record owner)
    component isStudent = IsEqual();
    isStudent.in[0] <== userAddress;
    isStudent.in[1] <== studentAddress;
    
    // Check if user has admin access (accessType == 2)
    component isAdmin = IsEqual();
    isAdmin.in[0] <== accessType;
    isAdmin.in[1] <== 2;
    
    // Check if user has emergency access (accessType == 3)
    component isEmergency = IsEqual();
    isEmergency.in[0] <== accessType;
    isEmergency.in[1] <== 3;
    
    // Check if access is shared (accessType == 1)
    component isShared = IsEqual();
    isShared.in[0] <== accessType;
    isShared.in[1] <== 1;
    
    // User has access if they are issuer, student, admin, or have shared/emergency access
    // Using OR logic: if any condition is true (1), hasAccess should be 1
    signal accessConditions[5];
    accessConditions[0] <== isIssuer.out;
    accessConditions[1] <== isStudent.out;
    accessConditions[2] <== isAdmin.out;
    accessConditions[3] <== isEmergency.out;
    accessConditions[4] <== isShared.out;
    
    // Sum all conditions - if any is 1, sum will be >= 1
    signal accessSum <== accessConditions[0] + accessConditions[1] + accessConditions[2] + accessConditions[3] + accessConditions[4];
    
    // Convert sum to boolean (0 or 1)
    component hasAccessBool = GreaterThan(3);
    hasAccessBool.in[0] <== accessSum;
    hasAccessBool.in[1] <== 0;
    hasAccess <== hasAccessBool.out;
    
    // Generate cryptographically secure proof hash using Poseidon
    component proofHasher = Poseidon(4);
    proofHasher.inputs[0] <== recordId;
    proofHasher.inputs[1] <== userAddress;
    proofHasher.inputs[2] <== issuerAddress;
    proofHasher.inputs[3] <== studentAddress;
    proofHash <== proofHasher.out;
    
    // Constraint: hasAccess must be 0 or 1
    hasAccess * (hasAccess - 1) === 0;
}



component main = AccessVerification();