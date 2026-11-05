"use client";

import { useState } from "react";
import {
  Server,
  Layers,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Code2,
  FolderGit2,
  Component,
  Boxes,
  Bell,
  Sliders,
  Check,
  Database,
  Plus,
  Palette,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { PageHeader, StatusBadge } from "@/components/common";

interface ProjectItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
}

interface BackendStatus {
  status: string;
  service: string;
  framework: string;
  database?: {
    type: string;
    status: string;
    projectsCount: number;
  };
  timestamp: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function InforPage() {
  const [loading, setLoading] = useState(false);
  const [backendData, setBackendData] = useState<BackendStatus | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchState, setSwitchState] = useState(true);
  const [sliderValue, setSliderValue] = useState<number[]>([75]);

  const testBackendConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/status`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: BackendStatus = await res.json();
      setBackendData(data);

      const projRes = await fetch(`${API_BASE_URL}/api/projects`);
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(
          err.message +
            ` (Đảm bảo backend đang chạy ở port 3001 và Database Docker trong folder database/ đang bật)`
        );
      } else {
        setError("Không thể kết nối tới Backend");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAddingProject(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: "Tạo từ Frontend port 3002 lưu vào PostgreSQL port 5432",
        }),
      });
      if (res.ok) {
        setNewTitle("");
        await testBackendConnection();
      }
    } catch {
      setError("Không thể tạo project vào PostgreSQL");
    } finally {
      setAddingProject(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl w-full mx-auto space-y-8">
        {/* Page Header Component */}
        <PageHeader
          title="Thông tin hệ thống &amp; Kiểm tra kết nối"
          description="Kiểm tra tương tác thực tế giữa Frontend (Next.js 16), Backend (NestJS 12) và Database (PostgreSQL 16)."
          breadcrumbs={[
            { label: "Trang chủ", href: "/" },
            { label: "Thông tin hệ thống" },
          ]}
          badge={
            <StatusBadge
              status="Route: /infor"
              variant="info"
            />
          }
        />

        {/* Theme Palette Preview Strip */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1.5">
              <Palette className="size-3.5 text-[#D97841]" /> Bảng màu chủ đạo của Theme (clo.nz):
            </span>
            <span className="text-muted-foreground font-mono text-[11px]">
              Light: #F6F1E8 &bull; Dark: #191A1E &bull; Accent: #D97841
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-lg bg-background border border-border flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Background</span>
              <span className="font-mono text-xs font-medium">var(--background)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Card / Popover</span>
              <span className="font-mono text-xs font-medium">var(--card)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-primary text-primary-foreground border border-border flex flex-col justify-between">
              <span className="text-[11px] opacity-80">Primary</span>
              <span className="font-mono text-xs font-medium">#191A1E</span>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary text-secondary-foreground border border-border flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Secondary</span>
              <span className="font-mono text-xs font-medium">#E9DED0</span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground border border-border flex flex-col justify-between">
              <span className="text-[11px]">Muted</span>
              <span className="font-mono text-xs font-medium">#EEE6D9</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#D97841] text-white border border-border flex flex-col justify-between">
              <span className="text-[11px] opacity-90">Ring / Accent</span>
              <span className="font-mono text-xs font-medium">#D97841</span>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid - 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Frontend Tech Stack */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-muted text-foreground border border-border">
                  <Layers className="size-5" />
                </div>
                <Badge variant="secondary">frontend/</Badge>
              </div>
              <CardTitle className="text-base font-semibold mt-2">
                Next.js 16 (Port 3002)
              </CardTitle>
              <CardDescription className="text-xs">
                Tailwind v4, 60+ shadcn &amp; font Inter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">Host:</span>
                <span className="font-mono font-medium">http://localhost:3002</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">Theme:</span>
                <span className="font-mono font-medium text-[#D97841]">clo.nz (Warm Minimal)</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">Components:</span>
                <span className="font-mono font-semibold">60+ shadcn/ui</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-border flex justify-between">
              <span className="text-xs text-muted-foreground font-mono">PORT=3002</span>
              <a
                href="http://localhost:3002"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-foreground hover:text-[#D97841] transition-colors inline-flex items-center gap-1 font-medium"
              >
                Mở FE <ExternalLink className="size-3" />
              </a>
            </CardFooter>
          </Card>

          {/* Backend Tech Stack */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-muted text-foreground border border-border">
                  <Server className="size-5" />
                </div>
                <Badge variant="secondary">backend/</Badge>
              </div>
              <CardTitle className="text-base font-semibold mt-2">
                NestJS 12 (Port 3001)
              </CardTitle>
              <CardDescription className="text-xs">
                TypeScript ESM API Server + TypeORM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">Host:</span>
                <span className="font-mono font-medium">http://localhost:3001</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">ORM:</span>
                <span className="font-mono font-medium">TypeORM + pg</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">CORS:</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">Port 3002 Allowed</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-mono">PORT=3001</span>
              <a
                href="http://localhost:3001/api/docs"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#D97841] hover:underline transition-colors inline-flex items-center gap-1 font-medium"
              >
                Swagger Docs <ExternalLink className="size-3" />
              </a>
            </CardFooter>
          </Card>

          {/* Database Tech Stack */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-muted text-foreground border border-border">
                  <Database className="size-5" />
                </div>
                <Badge variant="secondary">database/</Badge>
              </div>
              <CardTitle className="text-base font-semibold mt-2">
                PostgreSQL (Port 5432)
              </CardTitle>
              <CardDescription className="text-xs">
                Docker Container + pgAdmin 4
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">DB Port:</span>
                <span className="font-mono font-medium">5432</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">DB Name:</span>
                <span className="font-mono font-medium">makvid_studio_db</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 border border-border/60">
                <span className="text-muted-foreground">pgAdmin UI:</span>
                <span className="font-mono font-medium">Port 5050</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-border flex justify-between">
              <span className="text-xs text-muted-foreground font-mono">User: postgres</span>
              <a
                href="http://localhost:5050"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-foreground hover:text-[#D97841] transition-colors inline-flex items-center gap-1 font-medium"
              >
                Mở pgAdmin <ExternalLink className="size-3" />
              </a>
            </CardFooter>
          </Card>
        </div>

        {/* Live Connectivity Test Card */}
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Terminal className="size-4 text-[#D97841]" />
              Kiểm tra kết nối: FE (3002) &rarr; BE (3001) &rarr; Database (5432)
            </CardTitle>
            <CardDescription className="text-xs">
              Gọi endpoint <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">{API_BASE_URL}/api/status</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={testBackendConnection}
                disabled={loading}
                variant="default"
                className="cursor-pointer"
              >
                <RefreshCw
                  className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Đang truy vấn API & Database..." : "Gửi Request Kiểm Tra Kết Nối"}
              </Button>
            </div>

            {backendData && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/60 border border-border text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      Kết nối NestJS Backend và PostgreSQL thành công!
                    </span>
                    <Badge variant="outline" className="border-border">
                      DB Status: {backendData.database?.status ?? "connected"}
                    </Badge>
                  </div>
                  <pre className="text-muted-foreground overflow-x-auto mt-2 p-2 bg-background rounded border border-border">
                    {JSON.stringify(backendData, null, 2)}
                  </pre>
                </div>

                {/* Database Records List & Quick Form */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <Database className="size-3.5 text-[#D97841]" /> Dữ liệu bảng `projects` trong PostgreSQL:
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Tổng: {projects.length} bản ghi
                    </span>
                  </div>

                  <form onSubmit={handleCreateProject} className="flex gap-2">
                    <Input
                      placeholder="Nhập tên project mới..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Button
                      type="submit"
                      disabled={addingProject || !newTitle.trim()}
                      size="sm"
                      className="cursor-pointer shrink-0"
                    >
                      <Plus className="size-3.5 mr-1" />
                      {addingProject ? "Đang lưu..." : "Thêm vào DB"}
                    </Button>
                  </form>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {projects.map((proj) => (
                      <div
                        key={proj.id}
                        className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-medium text-foreground">{proj.title}</p>
                          {proj.description && (
                            <p className="text-[11px] text-muted-foreground">
                              {proj.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-border"
                        >
                          {proj.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="size-4" /> {error}
                </div>
                <p className="text-muted-foreground text-[11px]">
                  1. Khởi động DB trong thư mục database: <code className="bg-muted px-1 rounded text-foreground">cd database; docker compose up -d</code><br />
                  2. Khởi động backend: <code className="bg-muted px-1 rounded text-foreground">cd backend; npm run start:dev</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* shadcn UI Showcase Section */}
        <Card className="shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Boxes className="size-4 text-[#D97841]" />
                Showcase các shadcn Component với theme clo.nz
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                Demo Trực Quan
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Các component hiển thị theo đúng bảng màu ấm áp, bo góc 0.5rem và font Inter của clo.nz:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="interactive" className="w-full">
              <TabsList className="bg-muted border border-border p-1">
                <TabsTrigger
                  value="interactive"
                  className="text-xs"
                >
                  Tương tác (Dialog, Tooltip, Switch, Slider)
                </TabsTrigger>
                <TabsTrigger
                  value="components-list"
                  className="text-xs"
                >
                  Danh mục 60+ Components
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Interactive components */}
              <TabsContent value="interactive" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Dialog Demo */}
                  <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <Component className="size-3.5 text-[#D97841]" /> Dialog / Modal
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Modal cửa sổ với theme clo.nz
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full cursor-pointer"
                          />
                        }
                      >
                        Mở Dialog
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border text-card-foreground">
                        <DialogHeader>
                          <DialogTitle>shadcn/ui Dialog</DialogTitle>
                          <DialogDescription className="text-muted-foreground text-xs">
                            Dialog hiển thị đúng tông màu warm background và border của theme clo.nz.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-3 text-xs text-muted-foreground">
                          Bạn có thể dùng nút chuyển đổi theme (Sun/Moon) ở góc phải header để xem theme thay đổi tức thì!
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Tooltip & Avatar */}
                  <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <Bell className="size-3.5 text-[#D97841]" /> Avatar &amp; Tooltip
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Rê chuột lên avatar để xem tooltip
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger render={<div className="cursor-pointer" />}>
                          <Avatar className="size-9 border border-border">
                            <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&q=80" />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                              MS
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-primary-foreground border-border">
                          Makvid Studio Member
                        </TooltipContent>
                      </Tooltip>
                      <div className="text-xs">
                        <p className="font-medium text-foreground">Makvid Studio</p>
                        <p className="text-muted-foreground text-[10px]">admin@admin.com</p>
                      </div>
                    </div>
                  </div>

                  {/* Switch & Slider */}
                  <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <Sliders className="size-3.5 text-[#D97841]" /> Switch &amp; Slider
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Giá trị: {sliderValue[0]}%
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Bật tính năng:</span>
                        <Switch
                          checked={switchState}
                          onCheckedChange={setSwitchState}
                        />
                      </div>
                      <Slider
                        value={sliderValue}
                        onValueChange={(val) => {
                          if (Array.isArray(val)) setSliderValue(val);
                        }}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Full List */}
              <TabsContent value="components-list" className="mt-4">
                <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Toàn bộ danh sách 60+ components nằm trong thư mục{" "}
                    <code className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono">src/components/ui/</code>:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "accordion", "alert", "alert-dialog", "aspect-ratio", "avatar", "badge",
                      "breadcrumb", "button", "button-group", "calendar", "card", "carousel",
                      "chart", "checkbox", "collapsible", "combobox", "command", "context-menu",
                      "dialog", "drawer", "dropdown-menu", "empty", "hover-card", "input",
                      "input-otp", "kbd", "label", "menubar", "navigation-menu", "pagination",
                      "popover", "progress", "radio-group", "resizable", "scroll-area", "select",
                      "separator", "sheet", "sidebar", "skeleton", "slider", "switch", "table",
                      "tabs", "textarea", "toast", "toggle", "toggle-group", "tooltip"
                    ].map((comp) => (
                      <span
                        key={comp}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted border border-border text-foreground"
                      >
                        <Check className="size-3 text-[#D97841]" /> {comp}
                      </span>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
