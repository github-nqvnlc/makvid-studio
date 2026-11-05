"use client";

import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Info,
  Server,
  Layers,
  Database,
  ExternalLink,
  Code2,
  FileCode2,
  Activity,
  CheckCircle2,
  Users,
  Video,
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
import { AppLayout } from "@/components/layout";
import { PageHeader, StatCard, StatusBadge } from "@/components/common";

export default function Home() {
  return (
    <AppLayout>
      <div className="max-w-6xl w-full mx-auto space-y-8">
        {/* Page Header Component */}
        <PageHeader
          title="Chào mừng đến với Makvid Studio"
          description="Nền tảng Fullstack tích hợp Next.js 16, NestJS Enterprise API và cơ sở dữ liệu PostgreSQL 16 trên Docker."
          badge={
            <StatusBadge
              status="Hệ thống sẵn sàng"
              variant="success"
              pulse
            />
          }
          actions={
            <div className="flex items-center gap-2">
              <Link href="/infor">
                <Button size="sm" className="gap-1.5 cursor-pointer">
                  <Info className="size-3.5" />
                  Xem thông tin hệ thống
                </Button>
              </Link>
              <a
                href="http://localhost:3001/api/docs"
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 cursor-pointer"
                >
                  <FileCode2 className="size-3.5 text-[#D97841]" />
                  Swagger Docs
                  <ExternalLink className="size-3 opacity-60" />
                </Button>
              </a>
            </div>
          }
        />

        {/* Quick Stats Grid using StatCard Common Component */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Frontend Service"
            value="Port 3002"
            icon={Layers}
            change={{
              value: "Next.js 16",
              trend: "up",
              label: "Turbopack",
            }}
            description="Tailwind CSS v4 & Inter Font"
          />

          <StatCard
            title="Backend Service"
            value="Port 3001"
            icon={Server}
            change={{
              value: "NestJS 12",
              trend: "up",
              label: "TypeORM",
            }}
            description="Swagger Documentation sẵn sàng"
          />

          <StatCard
            title="Database Service"
            value="Port 5432"
            icon={Database}
            change={{
              value: "Postgres 16",
              trend: "up",
              label: "Docker",
            }}
            description="pgAdmin UI tại port 5050"
          />

          <StatCard
            title="UI Components"
            value="60+"
            icon={Sparkles}
            change={{
              value: "shadcn/ui",
              trend: "neutral",
              label: "clo.nz theme",
            }}
            description="Đã cài đặt trọn bộ thư viện"
          />
        </div>

        {/* 3 Pillars Overview Section */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="size-4 text-[#D97841]" />
            Dịch vụ kiến trúc cốt lõi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Frontend Card */}
            <Link href="/infor" className="group">
              <Card className="h-full transition-all group-hover:border-[#D97841]/50 group-hover:shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-muted text-foreground">
                      <Layers className="size-5" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      frontend/
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">
                    Frontend Web (Port 3002)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Next.js 16, Tailwind v4, 60+ shadcn &amp; font Inter
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Giao diện hoàn chỉnh với theme warm clo.nz và hỗ trợ Dark/Light mode linh hoạt.
                </CardContent>
                <CardFooter className="pt-2 text-xs text-[#D97841] font-medium inline-flex items-center gap-1">
                  Xem chi tiết{" "}
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </CardFooter>
              </Card>
            </Link>

            {/* Backend Card */}
            <a
              href="http://localhost:3001/api/docs"
              target="_blank"
              rel="noreferrer"
              className="group"
            >
              <Card className="h-full transition-all group-hover:border-[#D97841]/50 group-hover:shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-muted text-foreground">
                      <Server className="size-5" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      backend/
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">
                    Backend API (Port 3001)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    NestJS 12, TypeORM &amp; Swagger UI
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Máy chủ API chuẩn TypeScript ESM, tài liệu OpenAPI tương tác trực tiếp tại /api/docs.
                </CardContent>
                <CardFooter className="pt-2 text-xs text-[#D97841] font-medium inline-flex items-center gap-1">
                  Mở Swagger Docs <ExternalLink className="size-3" />
                </CardFooter>
              </Card>
            </a>

            {/* Database Card */}
            <Link href="/infor" className="group">
              <Card className="h-full transition-all group-hover:border-[#D97841]/50 group-hover:shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-muted text-foreground">
                      <Database className="size-5" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      database/
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">
                    Database Host (Port 5432)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    PostgreSQL 16 &amp; pgAdmin 4
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Host tách riêng trong folder database/ chạy qua Docker với volume dữ liệu bền vững.
                </CardContent>
                <CardFooter className="pt-2 text-xs text-[#D97841] font-medium inline-flex items-center gap-1">
                  Kiểm tra kết nối DB{" "}
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </CardFooter>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
