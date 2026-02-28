import { redirect } from "next/navigation"

type SignUpPageProps = {
  params: Promise<{ locale: string }>
}

export default async function SignUp({ params }: SignUpPageProps) {
  const { locale } = await params
  redirect(`/${locale}/auth/signin`)
}
