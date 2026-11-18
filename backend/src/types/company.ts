// The app's own company shape, independent of the Brreg API format.

export interface CompanyAddress {
  postalCode: string | null;
  city: string | null;
  municipality: string | null;
  municipalityNumber: string | null;
}

export interface Company {
  // Identity
  orgNumber: string;
  name: string;
  organizationForm: string; // e.g. "ENK", "AS"
  organizationFormDescription: string;

  // Location
  address: CompanyAddress | null;

  // Industry
  industryCode: string | null;
  industryDescription: string | null;

  // Employees. null means Brreg has no count; it does not mean zero.
  employees: number | null;
  hasRegisteredEmployees: boolean;

  // Dates (YYYY-MM-DD)
  foundedDate: string | null;
  registrationDate: string | null;

  // Registers: these decide which obligations apply
  vatRegistered: boolean;
  businessRegisterRegistered: boolean;

  // Status flags
  isBankrupt: boolean;
  isUnderLiquidation: boolean;
  isUnderForcedLiquidation: boolean;
}
