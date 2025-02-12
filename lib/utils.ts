import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  // Remove any trailing slashes from baseUrl and leading slashes from path
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanBaseUrl}/${cleanPath}`;
}
