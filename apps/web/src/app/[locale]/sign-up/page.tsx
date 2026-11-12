import { AuthForm } from "@/components/AuthForm";

export default function SignUpPage() {
  return <AuthForm mode="sign-up" google={!!process.env.GOOGLE_CLIENT_ID} />;
}
