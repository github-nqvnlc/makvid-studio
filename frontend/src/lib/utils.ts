import { cn as baseCn } from "cn";

/**
 * Merge class names with Tailwind support
 */
export function cn(...inputs: Parameters<typeof baseCn>) {
  return baseCn(...inputs);
}

/**
 * Format a date object or string into localized readable format (e.g., "05/11/2026")
 */
export function formatDate(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  };

  return new Intl.DateTimeFormat("vi-VN", defaultOptions).format(d);
}

/**
 * Format date with time (e.g., "14:30 - 05/11/2026")
 */
export function formatDateTime(date: string | number | Date): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Format a relative time string (e.g., "Vừa xong", "5 phút trước", "2 ngày trước")
 */
export function formatRelativeTime(date: string | number | Date): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 30) return "Vừa xong";
  if (diffInSeconds < 60) return `${diffInSeconds} giây trước`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} ngày trước`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} tháng trước`;

  return `${Math.floor(diffInMonths / 12)} năm trước`;
}

/**
 * Format standard number with thousand separators (e.g., 1,500,000)
 */
export function formatNumber(value: number): string {
  if (typeof value !== "number" || isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

/**
 * Format currency in VND or specified currency (e.g., "150.000 ₫" or "$150")
 */
export function formatCurrency(
  amount: number,
  currency: "VND" | "USD" | "EUR" = "VND"
): string {
  if (typeof amount !== "number" || isNaN(amount)) return "0 ₫";

  return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(amount);
}

/**
 * Format compact numbers (e.g., 1.5K, 2.3M)
 */
export function formatCompactNumber(value: number): string {
  if (typeof value !== "number" || isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

/**
 * Truncate long strings with ellipsis
 */
export function truncate(text: string, length = 35): string {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

/**
 * Generate URL-friendly slug from string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/**
 * Extract avatar initials from name (e.g., "Makvid Studio" -> "MS")
 */
export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Safely copy text to clipboard with browser check
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator?.clipboard) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep / delay helper for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
