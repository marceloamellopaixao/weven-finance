"use client";

import Image from "next/image";
import { Clock3, Download, FileImage, LockKeyhole, MessageSquareReply, RefreshCw, ShieldQuestion, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchSupportActivity,
  getSupportAttachmentUrl,
  postSupportActivity,
  removeSupportAttachment,
  type SupportActivity,
  type SupportTicket,
} from "@/hooks/supportService";

type Props = {
  ticket: SupportTicket;
  staff?: boolean;
  onRequestAccess?: () => void | Promise<void>;
  onChanged?: () => void;
};

export function SupportConversation({ ticket, staff = false, onRequestAccess, onChanged }: Props) {
  const [activity, setActivity] = useState<SupportActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"reply" | "internal_note" | "request_info">("reply");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [activityRequestId, setActivityRequestId] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchSupportActivity(ticket.id);
      setActivity(next);
      const signed = await Promise.all(next.attachments.map(async (item) => {
        try { return [item.id, (await getSupportAttachmentUrl(item.id)).url] as const; } catch { return null; }
      }));
      setUrls(Object.fromEntries(signed.filter((item): item is readonly [string, string] => Boolean(item))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o chamado.");
    } finally {
      setLoading(false);
    }
  }, [ticket.id]);

  useEffect(() => { void load(); }, [load]);

  const timeline = useMemo(() => {
    if (!activity) return [];
    return [
      ...activity.events.filter((item) => item.type !== "public_reply" && item.type !== "internal_note").map((item) => ({ ...item, kind: "event" as const })),
      ...activity.messages.map((item) => ({ ...item, kind: "message" as const, type: "message" })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [activity]);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      const clientRequestId = activityRequestId || crypto.randomUUID();
      setActivityRequestId(clientRequestId);
      await postSupportActivity({ ticketId: ticket.id, action: mode, message, attachments: files, clientRequestId });
      setMessage("");
      setFiles([]);
      setActivityRequestId("");
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a resposta.");
    } finally {
      setSending(false);
    }
  };

  const reopen = async () => {
    setSending(true);
    try {
      await postSupportActivity({ ticketId: ticket.id, action: "reopen" });
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reabrir o chamado.");
    } finally { setSending(false); }
  };

  const remove = async (attachmentId: string) => {
    if (!window.confirm("Remover esta evidência do chamado? Esta ação será auditada.")) return;
    try {
      await removeSupportAttachment(attachmentId);
      await load();
      onChanged?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover a evidência."); }
  };

  const download = async (attachmentId: string) => {
    try {
      const signed = await getSupportAttachmentUrl(attachmentId, "download");
      window.open(signed.url, "_blank", "noopener,noreferrer");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível baixar a evidência."); }
  };

  if (loading) return <div className="flex items-center justify-center gap-2 rounded-2xl border p-6 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Carregando histórico…</div>;
  if (!activity) return <div className="rounded-2xl border border-destructive/30 p-4 text-sm text-destructive">{error || "Chamado indisponível."}<Button variant="ghost" size="sm" onClick={() => void load()}>Tentar novamente</Button></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-semibold">Histórico do chamado</h3><p className="text-xs text-muted-foreground">Atualizado em {new Date(activity.updatedAt).toLocaleString("pt-BR")}</p></div>
        {!staff && activity.canReopen ? <Button size="sm" variant="outline" disabled={sending} onClick={() => void reopen()}><RefreshCw className="mr-2 h-4 w-4" />Reabrir chamado</Button> : null}
        {!staff && !activity.canReopen && ["resolved", "implemented", "rejected"].includes(activity.status) ? <p className="text-xs text-muted-foreground">A janela de {activity.reopenWindowDays} dias expirou. Abra um novo chamado relacionado.</p> : null}
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border bg-muted/20 p-3" aria-live="polite">
        {timeline.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há respostas.</p> : timeline.map((item) => item.kind === "message" ? (
          <div key={`message-${item.id}`} className={`rounded-xl border p-3 text-sm ${item.visibility === "internal" ? "border-amber-300/50 bg-amber-500/10" : "bg-background"}`}>
            <div className="mb-1 flex items-center justify-between gap-2"><span className="font-medium">{item.author === "you" ? "Você" : item.author === "client" ? "Cliente" : "Equipe de suporte"}</span>{item.visibility === "internal" ? <Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />Nota interna</Badge> : null}</div>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{item.message}</p>
            <time className="mt-2 block text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString("pt-BR")}</time>
          </div>
        ) : (
          <div key={`event-${item.id}`} className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /><span>{eventLabel(item.type, item.metadata)}</span><time className="ml-auto">{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div>
        ))}
      </div>

      {activity.attachments.length ? <div><p className="mb-2 text-sm font-medium">Evidências</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{activity.attachments.map((attachment) => (
        <div key={attachment.id} className="group relative overflow-hidden rounded-xl border bg-muted/30">
          <button type="button" className="relative block aspect-video w-full" onClick={() => urls[attachment.id] && setLightbox(urls[attachment.id])} title="Ampliar evidência">
            {urls[attachment.id] ? <Image src={urls[attachment.id]} alt="Evidência anexada ao chamado" fill unoptimized className="object-cover" /> : <FileImage className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2" />}
          </button>
          <Button type="button" size="icon" variant="secondary" className="absolute bottom-1 right-1 h-7 w-7" onClick={() => void download(attachment.id)} title="Baixar evidência"><Download className="h-3.5 w-3.5" /></Button>
          {(!staff || activity.canWriteInternal) ? <Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 h-7 w-7 opacity-90" onClick={() => void remove(attachment.id)} title="Remover evidência"><Trash2 className="h-3.5 w-3.5" /></Button> : null}
        </div>
      ))}</div></div> : null}

      {activity.canReply ? <div className="space-y-3 rounded-2xl border p-3">
        {staff && activity.canWriteInternal ? <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mode === "reply" ? "default" : "outline"} onClick={() => setMode("reply")}><MessageSquareReply className="mr-1.5 h-4 w-4" />Responder</Button>
          <Button size="sm" variant={mode === "request_info" ? "default" : "outline"} onClick={() => setMode("request_info")}><ShieldQuestion className="mr-1.5 h-4 w-4" />Solicitar informações</Button>
          <Button size="sm" variant={mode === "internal_note" ? "default" : "outline"} onClick={() => setMode("internal_note")}><LockKeyhole className="mr-1.5 h-4 w-4" />Nota interna</Button>
        </div> : null}
        <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} placeholder={mode === "internal_note" ? "Nota visível somente à equipe…" : "Escreva uma resposta…"} aria-label="Mensagem do chamado" />
        <Input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, Math.max(0, 3 - activity.attachments.length)))} />
        <p className="text-xs text-muted-foreground">Capturas podem conter informações pessoais. Revise cada imagem antes de enviar. PNG, JPEG ou WebP, até 5 MB.</p>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">{staff && activity.canRequestAccess && onRequestAccess ? <Button variant="outline" onClick={() => void onRequestAccess()}>Solicitar acesso temporário</Button> : null}<Button disabled={sending || message.trim().length === 0} onClick={() => void submit()}>{sending ? "Enviando…" : mode === "internal_note" ? "Salvar nota" : "Enviar resposta"}</Button></div>
      </div> : null}

      {lightbox ? <div role="dialog" aria-modal="true" aria-label="Visualização da evidência" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)}><Button size="icon" variant="secondary" className="absolute right-4 top-4" onClick={() => setLightbox(null)}><X /></Button><div className="relative h-[85vh] w-[92vw]"><Image src={lightbox} alt="Evidência ampliada" fill unoptimized className="object-contain" /></div></div> : null}
    </div>
  );
}

function eventLabel(type: string, metadata: Record<string, unknown>) {
  if (type === "created") return "Chamado criado";
  if (type === "status_changed") return `Status alterado de ${String(metadata.from || "-")} para ${String(metadata.to || "-")}`;
  if (type === "assigned") return metadata.assigned ? "Chamado atribuído à equipe" : "Responsável removido";
  if (type === "information_requested") return "Informações adicionais solicitadas";
  if (type === "attachment_added") return "Nova evidência anexada";
  if (type === "attachment_removed") return "Evidência removida";
  if (type === "reopened") return "Chamado reaberto";
  if (type === "internal_note") return "Nota interna adicionada";
  if (type === "priority_changed") return `Prioridade alterada para ${String(metadata.to || "-")}`;
  return "Atividade registrada";
}
