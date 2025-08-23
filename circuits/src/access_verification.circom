pragma circom 2.0.0;

/*
 * AccessVerification Circuit
 * 
 * This circuit verifies that a user has permission to access a specific record.
 * It takes private inputs about the record and user, and outputs a public proof
 * that access is authorized without revealing sensitive information.
 */
template AccessVerification() {
    // Private inputs
    signal input recordId;
    signal input userAddress;
    signal input issuerAddress;
    signal input studentAddress;
    signal input accessType; // 0=OWNER, 1=SHARED, 2=ADMIN, 3=EMERGENCY
    signal input timestamp;
    signal input accessSecret; // Secret known only to authorized parties
    
    // Public outputs
    signal output hasAccess;
    signal output proofHash;
    
    // Check if user is the issuer (university)
    component isIssuer = IsEqual();
    isIssuer.in[0] <== userAddress;
    isIssuer.in[1] <== issuerAddress;
    
    // Check if user is the student
    component isStudent = IsEqual();
    isStudent.in[0] <== userAddress;
    isStudent.in[1] <== studentAddress;
    
    // Check if user has admin access (accessType >= 2)
    // For simplicity, we'll check if accessType is exactly 2 or 3
    component isAdmin2 = IsEqual();
    isAdmin2.in[0] <== accessType;
    isAdmin2.in[1] <== 2;
    
    component isAdmin3 = IsEqual();
    isAdmin3.in[0] <== accessType;
    isAdmin3.in[1] <== 3;
    
    // Check if access is shared (accessType == 1)
    component isShared = IsEqual();
    isShared.in[0] <== accessType;
    isShared.in[1] <== 1;
    
    // User has access if they are issuer, student, admin, or have shared access
    hasAccess <== isIssuer.out + isStudent.out + isAdmin2.out + isAdmin3.out + isShared.out;
    
    // Generate proof hash (simplified - just sum of inputs for now)
    proofHash <== recordId + userAddress + issuerAddress + studentAddress + accessType + timestamp;
    
    // Constraint: hasAccess must be 0 or 1
    hasAccess * (hasAccess - 1) === 0;
}

template IsEqual() {
    signal input in[2];
    signal output out;
    
    component eq = IsZero();
    eq.in <== in[0] - in[1];
    out <== eq.out;
}

template IsZero() {
    signal input in;
    signal output out;
    
    signal inv;
    inv <-- in != 0 ? 1/in : 0;
    out <== -in*inv + 1;
    in*out === 0;
}

component main = AccessVerification();