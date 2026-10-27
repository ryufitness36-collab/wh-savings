import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="text-sm text-muted-foreground">URLが間違っているか、削除された記録の可能性があります。</p>
      <Button asChild>
        <Link href="/">ホームへ</Link>
      </Button>
    </div>
  );
}
