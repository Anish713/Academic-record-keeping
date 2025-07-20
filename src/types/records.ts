/**
 * Centralized type definitions for records across the application.
 * Based on the RecordType enum in blockchain/contracts/interfaces/IAcademicRecords.sol
 */

// Enum values matching the blockchain contract
export enum RecordType {
  // === Academic Records ===
  TRANSCRIPT = 0,
  DEGREE = 1,
  MARKSHEET = 2,
  DIPLOMA = 3,
  CERTIFICATE = 4,
  PROVISIONAL_CERTIFICATE = 5,

  // === Identity & Personal Verification ===
  BIRTH_CERTIFICATE = 6,
  CITIZENSHIP = 7,
  NATIONAL_ID = 8,
  PASSPORT_COPY = 9,
  CHARACTER_CERTIFICATE = 10,

  // === Admission & Examination Documents ===
  ENTRANCE_RESULTS = 11,
  ADMIT_CARD = 12,
  COUNSELING_LETTER = 13,
  SEAT_ALLOTMENT_LETTER = 14,
  MIGRATION_CERTIFICATE = 15,
  TRANSFER_CERTIFICATE = 16,

  // === Administrative & Financial Records ===
  BILLS = 17,
  FEE_RECEIPT = 18,
  SCHOLARSHIP_LETTER = 19,
  LOAN_DOCUMENT = 20,
  HOSTEL_CLEARANCE = 21,

  // === Academic Schedules & Communications ===
  ROUTINE = 22,
  NOTICE = 23,
  CIRCULAR = 24,
  NEWS = 25,

  // === Miscellaneous & Supporting Documents ===
  RECOMMENDATION_LETTER = 26,
  INTERNSHIP_CERTIFICATE = 27,
  EXPERIENCE_LETTER = 28,
  BONAFIDE_CERTIFICATE = 29,
  NO_OBJECTION_CERTIFICATE = 30,

  // === Fallback ===
  OTHER = 31,
}

// Map from RecordType enum values to human-readable strings
export const RECORD_TYPE_NAMES: string[] = [
  // Academic Records
  "Transcript",
  "Degree",
  "Marksheet",
  "Diploma",
  "Certificate",
  "Provisional Certificate",
  // Identity & Personal Verification
  "Birth Certificate",
  "Citizenship",
  "National ID",
  "Passport Copy",
  "Character Certificate",
  // Admission & Examination Documents
  "Entrance Results",
  "Admit Card",
  "Counseling Letter",
  "Seat Allotment Letter",
  "Migration Certificate",
  "Transfer Certificate",
  // Administrative & Financial Records
  "Bills",
  "Fee Receipt",
  "Scholarship Letter",
  "Loan Document",
  "Hostel Clearance",
  // Academic Schedules & Communications
  "Routine",
  "Notice",
  "Circular",
  "News",
  // Miscellaneous & Supporting Documents
  "Recommendation Letter",
  "Internship Certificate",
  "Experience Letter",
  "Bonafide Certificate",
  "No Objection Certificate",
  // Fallback
  "Other",
];

// Helper function to get a record type name from its ID
export function getRecordTypeName(typeId: number): string {
  if (typeId >= 0 && typeId < RECORD_TYPE_NAMES.length) {
    return RECORD_TYPE_NAMES[typeId];
  }
  return "Unknown";
}

// Record interface matching the blockchain contract
export interface Record {
  id: number;
  studentName: string;
  studentId: string;
  studentAddress: string;
  universityName: string;
  recordType: number;
  ipfsHash: string;
  timestamp: number;
  university: string;
  isValid: boolean;
}

// Type used in UI components for displaying record items
export interface RecordItem {
  id: string;
  studentName: string;
  type: string;
  dateIssued: string;
  universityName?: string;
}

// Custom record type interface
export interface CustomRecordType {
  id: number;
  name: string;
  description: string;
  creator: string;
  timestamp: number;
  isActive: boolean;
}
