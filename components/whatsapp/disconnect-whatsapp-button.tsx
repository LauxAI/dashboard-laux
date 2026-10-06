"use client"

import { useState, useTransition } from "react"
import { Unplug } from "lucide-react"
import { toast } from "sonner"
import { disconnectWhatsApp } from "@/app/(dashboard)/whatsapp/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export function DisconnectWhatsAppButton({ connectionId }: { connectionId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDisconnect = () => {
    startTransition(async () => {
      try {
        const result = await disconnectWhatsApp(connectionId)
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        setOpen(false)
        toast.success("WhatsApp desconectado.")
      } catch {
        toast.error("Não foi possível desconectar o WhatsApp. Tente novamente.")
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Unplug data-icon="inline-start" />
        Desconectar WhatsApp
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconectar o WhatsApp?</AlertDialogTitle>
          <AlertDialogDescription>
            Os agentes deixam de receber e responder mensagens deste número e as credenciais salvas são removidas.
            O histórico de conversas e mensagens é mantido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDisconnect} disabled={isPending}>
            {isPending ? "Desconectando..." : "Desconectar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
