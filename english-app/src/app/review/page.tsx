import type { Metadata } from "next";
import { ReviewClient } from "./review-client";

export const metadata: Metadata = { title: "復習" };

export default function ReviewPage() {
  return <ReviewClient />;
}
