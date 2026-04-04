import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"
import Link from "next/link"

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="flex justify-center mb-8">
          <Image
            src="/le-logo-color.jpg"
            alt="Let's Enterprise"
            width={240}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <Card className="shadow-sm text-center">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <div className="rounded-full bg-blue-50 p-3">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              A magic sign-in link has been sent to your email address.
              Click the link to access the Student Roster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Didn&apos;t receive it?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Try again
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
