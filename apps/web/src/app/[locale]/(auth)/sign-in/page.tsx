import { AuthForm } from "@/components/AuthForm";

export default function SignInPage() {
  return <AuthForm mode="sign-in" google={!!process.env.GOOGLE_CLIENT_ID} />;
}
