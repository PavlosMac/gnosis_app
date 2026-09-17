/**
 * Date validation utilities for birth date input
 */

export interface DateParts {
  day: number;
  month: number;
  year: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Check if a date is actually valid (handles Feb 30, etc.)
 */
export const isValidDate = (day: number, month: number, year: number): boolean => {
  // Create a date object and check if it matches the input
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

/**
 * Validate date parts with detailed error messages
 */
export const validateDateParts = (day: number, month: number, year: number): ValidationResult => {
  // Check for NaN
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { isValid: false, error: "Please enter valid numbers for day, month, and year" };
  }

  // Check basic ranges
  if (year < 1900 || year > 2100) {
    return { isValid: false, error: "Year must be between 1900 and 2100" };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: "Month must be between 1 and 12" };
  }

  if (day < 1 || day > 31) {
    return { isValid: false, error: "Day must be between 1 and 31" };
  }

  // Check actual date validity (handles Feb 30, etc.)
  if (!isValidDate(day, month, year)) {
    return { isValid: false, error: `${day}/${month}/${year} is not a valid date` };
  }

  return { isValid: true };
};

/**
 * Parse string inputs to date parts
 */
export const parseDateInputs = (
  dayStr: string,
  monthStr: string,
  yearStr: string
): DateParts | null => {
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  return { day, month, year };
};

/**
 * Combined parse and validate
 */
export const parseAndValidateDate = (
  dayStr: string,
  monthStr: string,
  yearStr: string
): { dateParts: DateParts | null; validation: ValidationResult } => {
  const dateParts = parseDateInputs(dayStr, monthStr, yearStr);

  if (!dateParts) {
    return {
      dateParts: null,
      validation: { isValid: false, error: "Please enter valid numbers" },
    };
  }

  const validation = validateDateParts(dateParts.day, dateParts.month, dateParts.year);

  return { dateParts, validation };
};
