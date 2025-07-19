import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges multiple class names into a single string, resolving Tailwind CSS class conflicts.
 *
 * @returns The merged class name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a Date object or date string into a human-readable string in the format "Month day, year" (e.g., "January 1, 2024").
 *
 * @param date - The date to format, as a Date object or a string parseable by the Date constructor
 * @returns The formatted date string in US English locale
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Shortens a string to the specified length and appends an ellipsis if truncation occurs.
 *
 * @param str - The string to be truncated
 * @param length - The maximum allowed length before truncation
 * @returns The original string if its length is within the limit, or a truncated version with an ellipsis
 */
export function truncateString(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.substring(0, length)}...`;
}

/**
 * Shortens an Ethereum address by displaying the first 6 and last 4 characters separated by an ellipsis.
 *
 * Returns an empty string if the input address is falsy.
 *
 * @param address - The Ethereum address to truncate
 * @returns The truncated address in the format `0x1234...abcd`, or an empty string if no address is provided
 */
export function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}