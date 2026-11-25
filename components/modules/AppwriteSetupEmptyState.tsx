import { Button } from "@/components/ui/button";

export default function AppwriteSetupEmptyState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">尚未設定 Appwrite</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          請先在設定中連接 Appwrite 資料庫，即可查看和管理資料。若要使用媒體功能，請一併設定儲存空間。
        </p>
      </div>
      <Button onClick={onNavigate} className="min-h-11 shrink-0">前往鋒兄設定</Button>
    </div>
  );
}
