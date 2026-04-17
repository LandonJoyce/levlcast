import { sendActivationEmail } from "@/lib/email";
import { NextResponse } from "next/server";

// One-shot test endpoint — DELETE this file after confirming the email arrives.
export async function GET() {
  await sendActivationEmail("mototoka14@gmail.com", "Landon");
  return NextResponse.json({ ok: true, sent_to: "mototoka14@gmail.com" });
}
