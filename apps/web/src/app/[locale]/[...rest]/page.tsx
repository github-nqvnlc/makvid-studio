import { notFound } from "next/navigation";

// Any URL no page claims ends in the themed 404 (both locales).
export default function CatchAll() {
  notFound();
}
