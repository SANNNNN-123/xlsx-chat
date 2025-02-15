import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl(path: string): string {
  // Use environment variable for API URL, fallback to localhost for development
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return cleanPath ? `${cleanBaseUrl}/${cleanPath}` : cleanBaseUrl;
}
