import { z } from "zod";

// US States + DC + territories
export const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  // Territories
  { code: "AS", name: "American Samoa" }, { code: "GU", name: "Guam" },
  { code: "MP", name: "Northern Mariana Islands" }, { code: "PR", name: "Puerto Rico" },
  { code: "VI", name: "U.S. Virgin Islands" },
] as const;

export const usAddressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  street2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().length(2, "State is required"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Valid ZIP code required"),
});

export const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleName: z.string().max(100).optional(),
  suffix: z.string().max(10).optional(),
  tin: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Valid SSN or ITIN required"),
  tinType: z.enum(["SSN", "ITIN"]),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date format: YYYY-MM-DD"),
  usAddress: usAddressSchema,
  phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/, "Valid phone number required").optional().or(z.literal("")),
});

export const foreignAccountSchema = z.object({
  institutionName: z.string().min(1, "Institution name is required").max(200),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  accountType: z.enum(["BANK", "SECURITIES", "OTHER"]),
  ownershipType: z.enum(["FINANCIAL_INTEREST", "SIGNATURE_AUTHORITY", "BOTH"]),
  countryCode: z.string().length(2, "Country code must be 2 letters"),
  currencyCode: z.string().length(3, "Currency code must be 3 letters"),
  maxValueLocal: z.number().positive("Maximum value must be positive"),
  isJointAccount: z.boolean(),
  jointOwnerInfo: z.string().max(500).optional(),
  calendarYear: z.number().int().min(2010).max(2030),
  institutionAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

export const thresholdSchema = z.object({
  hadForeignAccounts: z.boolean(),
  aggregateValueExceeded: z.boolean(),
  calendarYear: z.number().int().min(2010).max(2030),
});

export const signatureSchema = z.object({
  filingYearId: z.string().min(1),
  fullName: z.string().min(1, "Full name is required"),
  agreed: z.literal(true, { errorMap: () => ({ message: "You must agree to the certification" }) }),
  signatureData: z.string().min(1, "Signature is required"),
  signatureType: z.enum(["typed", "drawn"]),
});

export const signupSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

// Inferred types
export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;
export type ForeignAccountInput = z.infer<typeof foreignAccountSchema>;
export type ThresholdInput = z.infer<typeof thresholdSchema>;
export type SignatureInput = z.infer<typeof signatureSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type USAddressInput = z.infer<typeof usAddressSchema>;
