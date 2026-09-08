"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { ClipboardPaste, ImagePlus, Lightbulb, Loader2, MessageCircleQuestion, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { type ChangeEvent, type ClipboardEvent, type DragEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTranslations } from "@/i18n/T";
import {
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  SUPPORT_EVIDENCE_MIME_TYPES,
  type SupportReportType,
  type SupportTechnicalContext,
} from "@/lib/support/report";
import { createSupportReport } from "@/hooks/supportService";
import { OPEN_SUPPORT_REPORTER_EVENT } from "@/lib/support/client-events";

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const REPORT_TYPES: Array<{ value: SupportReportType; icon: typeof TriangleAlert }> = [
  { value: "bug", icon: TriangleAlert },
  { value: "support", icon: MessageCircleQuestion },
  { value: "feature", icon: Lightbulb },
];

const REPORT_ERROR_KEYS = new Set([
  "description_too_short", "title_required", "invalid_payload", "invalid_client_request_id",
  "invalid_technical_context", "too_many_attachments", "empty_file", "file_too_large",
  "invalid_file_name", "unsupported_file_type", "file_type_mismatch", "invalid_image_dimensions",
  "daily_attachment_quota_exceeded", "support_report_failed",
]);

function describeBrowser(userAgent: string) {
  const candidates: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  for (const [pattern, name] of candidates) {
    const match = userAgent.match(pattern);
    if (match) return `${name} ${match[1]}`;
  }
  return "Navegador não identificado";
}

function describeOperatingSystem(userAgent: string) {
  if (/Windows NT 10/.test(userAgent)) return "Windows";
  if (/Android/.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
  if (/Mac OS X/.test(userAgent)) return "macOS";
  if (/Linux/.test(userAgent)) return "Linux";
  return "Sistema não identificado";
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportReporter() {
  const pathname = usePathname() || "/";
  const { user, userProfile } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const { isImpersonating } = useImpersonation();
  const t = useTranslations("components.supportReporter");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SupportReportType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [clientRequestId, setClientRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState("");
  const [technicalContext, setTechnicalContext] = useState<SupportTechnicalContext>({ route: pathname });

  const authenticated = Boolean(user || userProfile);
  const contextRows = useMemo(() => [
    ["route", t("context.route"), technicalContext.route],
    ["version", t("context.version"), technicalContext.appVersion],
    ["browser", t("context.browser"), technicalContext.browser],
    ["os", t("context.os"), technicalContext.operatingSystem],
    ["viewport", t("context.viewport"), technicalContext.viewport],
    ["locale", t("context.locale"), technicalContext.locale],
    ["timezone", t("context.timezone"), technicalContext.timezone],
    ["workspace", t("context.workspace"), technicalContext.workspaceType],
    ["plan", t("context.plan"), userProfile?.plan],
  ].filter((row): row is [string, string, string] => Boolean(row[2])), [t, technicalContext, userProfile?.plan]);

  const prepareOpen = useCallback(() => {
    const userAgent = navigator.userAgent || "";
    setTechnicalContext({
      route: pathname.split(/[?#]/, 1)[0],
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "web",
      browser: describeBrowser(userAgent),
      operatingSystem: describeOperatingSystem(userAgent),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      workspaceId: activeWorkspace?.id,
      workspaceType: activeWorkspace?.type,
      featureFlags: [],
    });
    setClientRequestId(crypto.randomUUID());
    setProtocol("");
    setError("");
    setOpen(true);
  }, [activeWorkspace?.id, activeWorkspace?.type, pathname]);

  useEffect(() => {
    window.addEventListener(OPEN_SUPPORT_REPORTER_EVENT, prepareOpen);
    return () => window.removeEventListener(OPEN_SUPPORT_REPORTER_EVENT, prepareOpen);
  }, [prepareOpen]);

  const reset = () => {
    for (const image of images) URL.revokeObjectURL(image.previewUrl);
    setImages([]);
    setType("bug");
    setTitle("");
    setDescription("");
    setSteps("");
    setExpected("");
    setActual("");
    setIncludeContext(true);
    setClientRequestId("");
    setProtocol("");
    setError("");
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    setOpen(next);
    if (!next) reset();
  };

  const addFiles = (files: File[]) => {
    setError("");
    const available = MAX_SUPPORT_ATTACHMENTS - images.length;
    if (files.length > available) {
      setError(t("errors.tooMany", { count: MAX_SUPPORT_ATTACHMENTS }));
      return;
    }
    for (const file of files) {
      if (!SUPPORT_EVIDENCE_MIME_TYPES.includes(file.type as (typeof SUPPORT_EVIDENCE_MIME_TYPES)[number])) {
        setError(t("errors.invalidType"));
        return;
      }
      if (file.size <= 0 || file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
        setError(t("errors.tooLarge"));
        return;
      }
    }
    setImages((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!title.trim()) return setError(t("errors.title"));
    if (description.trim().length < 10) return setError(t("errors.description"));
    setSubmitting(true);
    setError("");
    try {
      const result = await createSupportReport({
        type,
        title: title.trim(),
        description: description.trim(),
        stepsToReproduce: type === "bug" ? steps.trim() : undefined,
        expectedResult: type === "bug" ? expected.trim() : undefined,
        actualResult: type === "bug" ? actual.trim() : undefined,
        includeTechnicalContext: includeContext,
        technicalContext: includeContext ? technicalContext : undefined,
        attachments: images.map((image) => image.file),
        clientRequestId,
      });
      setProtocol(result.protocol || "");
    } catch (submissionError) {
      const code = submissionError instanceof Error ? submissionError.message : "support_report_failed";
      setError(t(`errors.${REPORT_ERROR_KEYS.has(code) ? code : "support_report_failed"}`));
    } finally {
      setSubmitting(false);
    }
  };

  if (!authenticated) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1rem)] overflow-y-auto rounded-3xl border border-border/70 bg-card sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{protocol ? t("success.title") : t("title")}</DialogTitle>
            <DialogDescription>{protocol ? t("success.description") : t("description")}</DialogDescription>
          </DialogHeader>

          {protocol ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground">{t("success.protocol")}</p>
              <p className="text-xl font-bold text-foreground">{protocol}</p>
              {isImpersonating ? <p className="text-xs text-amber-600">{t("impersonationNotice")}</p> : null}
            </div>
          ) : (
            <form id="support-report-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("typeLabel")}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {REPORT_TYPES.map((option) => {
                    const Icon = option.icon;
                    const selected = type === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setType(option.value)}
                        className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {t(`types.${option.value}`)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="support-report-title">{t("fields.title")}</Label>
                <Input id="support-report-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} aria-describedby={error ? "support-report-error" : undefined} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-report-description">{t("fields.description")}</Label>
                <Textarea id="support-report-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={5000} aria-describedby={error ? "support-report-error" : undefined} required />
              </div>

              {type === "bug" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="support-report-steps">{t("fields.steps")}</Label>
                    <Textarea id="support-report-steps" value={steps} onChange={(event) => setSteps(event.target.value)} rows={3} maxLength={3000} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-report-expected">{t("fields.expected")}</Label>
                    <Textarea id="support-report-expected" value={expected} onChange={(event) => setExpected(event.target.value)} rows={3} maxLength={2000} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-report-actual">{t("fields.actual")}</Label>
                    <Textarea id="support-report-actual" value={actual} onChange={(event) => setActual(event.target.value)} rows={3} maxLength={2000} />
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{t("attachments.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("attachments.help")}</p>
                </div>
                <div
                  tabIndex={0}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={(event) => event.preventDefault()}
                  className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ClipboardPaste className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("attachments.drop")}</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                    <ImagePlus className="h-4 w-4" />
                    {t("attachments.select")}
                    <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFileInput} />
                  </label>
                </div>
                {images.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {images.map((image) => (
                      <li key={image.id} className="relative overflow-hidden rounded-xl border border-border bg-background">
                        <Image src={image.previewUrl} alt={image.file.name} width={220} height={120} unoptimized className="h-24 w-full object-cover" />
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate text-xs text-muted-foreground">{formatFileSize(image.file.size)}</span>
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeImage(image.id)} aria-label={t("attachments.remove")} className="h-7 w-7 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-amber-600">{t("attachments.privacy")}</p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                  <span>
                    <span className="block text-sm font-medium">{t("context.title")}</span>
                    <span className="block text-xs text-muted-foreground">{t("context.help")}</span>
                  </span>
                </label>
                {includeContext ? (
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 border-t border-border pt-3 text-xs sm:grid-cols-2">
                    {contextRows.map(([id, label, value]) => (
                      <div key={id} className="flex min-w-0 gap-1">
                        <dt className="font-medium text-foreground">{label}:</dt>
                        <dd className="truncate text-muted-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>

              {isImpersonating ? <p className="rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-xs text-amber-700">{t("impersonationNotice")}</p> : null}
              {error ? <p id="support-report-error" role="alert" className="text-sm text-destructive">{error}</p> : null}
            </form>
          )}

          <DialogFooter>
            {protocol ? (
              <Button type="button" onClick={() => handleOpenChange(false)} className="w-full rounded-xl sm:w-auto">{t("close")}</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting} className="w-full rounded-xl sm:w-auto">{t("cancel")}</Button>
                <Button type="submit" form="support-report-form" disabled={submitting} className="w-full rounded-xl sm:w-auto">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? t("sending") : t("send")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
