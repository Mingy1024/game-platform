import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NickSettings } from "@/components/account/NickSettings";
import { Container } from "@/components/layout/Container";
import { Icon } from "@/components/ui/Icon";
import { FLAGS } from "@/lib/flags";
import { t } from "@/lib/i18n/zh-TW";

export const metadata: Metadata = {
  title: "帳號設定",
  description: "修改在排行榜和成績圖上顯示的暱稱。",
  robots: { index: false },
};

/** 帳號設定：只有改暱稱（登出、刪除帳號在我的紀錄頁） */
export default function SettingsPage() {
  if (!FLAGS.login) notFound();
  return (
    <Container className="py-6 sm:py-10">
      <div className="flex max-w-xl flex-col gap-4">
        <Link href="/me" className="flex min-h-11 items-center gap-1 self-start font-bold text-sign">
          <Icon name="left" size={18} />
          我的紀錄
        </Link>
        <h1 className="-mt-1.5 text-[32px] font-black text-sign">帳號設定</h1>
        <NickSettings labels={t.account} />
      </div>
    </Container>
  );
}
