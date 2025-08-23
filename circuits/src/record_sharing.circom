pragma circom 2.0.0;

/*
 * RecordSharing Circuit
 * 
 * This circuit validates record sharing permissions and generates sharing tokens.
 * It ensures only record owners can share records and creates time-limited access tokens.
 */
template RecordSharing() {
    // Private inputs
    signal input recordId;
    signal input ownerAddress;
    signal input sharedWithAddress;
    signal input expiryTime;
    signal input currentTime;
    signal input shareSecret; // Secret for generating sharing token
    signal input userAddress; // Address of the user requesting to share
    
    // Public outputs
    signal output canShare;
    signal output sharingToken;
    
    // Check if user is the owner of the record
    component isOwner = IsEqual();
    isOwner.in[0] <== userAddress;
    isOwner.in[1] <== ownerAddress;
    
    // Check if sharing hasn't expired (currentTime < expiryTime)
    component isNotExpired = LessThan(64);
    isNotExpired.in[0] <== currentTime;
    isNotExpired.in[1] <== expiryTime;
    
    // User can share if they are the owner and sharing hasn't expired
    canShare <== isOwner.out * isNotExpired.out;
    
    // Generate sharing token (simplified - sum of relevant inputs)
    sharingToken <== recordId + ownerAddress + sharedWithAddress + expiryTime + shareSecret;
    
    // Constraint: canShare must be 0 or 1
    canShare * (canShare - 1) === 0;
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

template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;

    component lt = Num2Bits(n+1);
    lt.in <== in[0]+ (1<<n) - in[1];

    out <== 1-lt.out[n];
}

template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1=0;

    var e2=1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] -1 ) === 0;
        lc1 += out[i] * e2;
        e2 = e2+e2;
    }

    lc1 === in;
}

component main = RecordSharing();