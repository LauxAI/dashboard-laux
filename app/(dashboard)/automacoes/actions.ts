"use server"

import { revalidatePath } from "next/cache"
import { getTemplate } from "@/lib/automations/templates"
import { getAutomation, getReadiness, isUuid, listRunSteps } from "@/lib/automations/queries"
import { stepsToRpcPayload } from "@/lib/automations/serialize"
import { getSessionContext } from "@/lib/automations/session"
import type { AutomationCategory, AutomationDefinition, AutomationStatus } from "@/lib/automations/types"
import { hasBlockingIssues, parseCategory, parseSteps, validateDefinition } from "@/lib/automations/validation"

type ActionResult = { error: string } | { success: true; id?: string; warnings?: string[] }

type SaveInput = {
  name: string
  description: string
  category: string
  triggerType: string
  steps: unknown
}

const STATUSES: AutomationStatus[] = ["active", "paused", "draft"]

function revalidateAutomationPages(id?: string) {
  revalidatePath("/automacoes")
  if (id) revalidatePath(`/automacoes/${id}`)
}

function messageOf(issues: ReturnType<typeof validateDefinition>): string {
  return issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message)
    .slice(0, 3)
    .join(" ")
}

export async function createAutomation(templateId: string | null): Promise<ActionResult> {
  const context = await getSessionContext()
  if (context.error !== undefined) return { error: context.error }

  const template = templateId ? getTemplate(templateId) : undefined
  if (templateId && !template) return { error: "Modelo não encontrado." }

  const { data, error } = await context.supabase
    .from("automations")
    .insert({
      company_id: context.companyId,
      name: template?.name ?? "Nova automação",
      description: template?.description ?? null,
      category: template?.category ?? "geral",
      trigger_type: template?.triggerType ?? null,
      status: "draft",
    })
    .select("id")
    .single<{ id: string }>()
  if (error || !data) return { error: "Não foi possível criar a automação." }

  if (template && template.steps.length > 0) {
    const steps = await context.supabase.rpc("replace_automation_steps", {
      p_automation_id: data.id,
      p_steps: stepsToRpcPayload(template.steps),
    })
    if (steps.error) {
      await context.supabase.from("automations").delete().eq("id", data.id).eq("company_id", context.companyId)
      return { error: "Não foi possível criar as etapas do modelo." }
    }
  }

  revalidateAutomationPages()
  return { success: true, id: data.id }
}

export async function saveAutomation(id: string, input: SaveInput): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Automação inválida." }

  const parsed = parseSteps(input.steps)
  if (!parsed.ok) return { error: parsed.error }

  const category = parseCategory(input.category) ?? ("geral" as AutomationCategory)
  const definition: AutomationDefinition = {
    name: String(input.name ?? "").trim(),
    description: String(input.description ?? "").trim().slice(0, 500),
    category,
    triggerType: String(input.triggerType ?? "").trim(),
    steps: parsed.steps,
  }

  const draftIssues = validateDefinition(definition, { strict: false })
  if (hasBlockingIssues(draftIssues)) return { error: messageOf(draftIssues) }

  const current = await getAutomation(id)
  if (current.error !== null) return { error: current.error }
  if (!current.data) return { error: "Automação não encontrada." }

  if (current.data.status === "active") {
    const strictIssues = validateDefinition(definition, { strict: true, readiness: await getReadiness() })
    if (hasBlockingIssues(strictIssues)) {
      return { error: `Pause a automação para salvar um rascunho incompleto. ${messageOf(strictIssues)}` }
    }
  }

  const context = await getSessionContext()
  if (context.error !== undefined) return { error: context.error }

  const { data: updated, error } = await context.supabase
    .from("automations")
    .update({
      name: definition.name,
      description: definition.description || null,
      category: definition.category,
      trigger_type: definition.triggerType,
    })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
  if (error || !updated || updated.length === 0) return { error: "Não foi possível salvar a automação." }

  const steps = await context.supabase.rpc("replace_automation_steps", {
    p_automation_id: id,
    p_steps: stepsToRpcPayload(definition.steps),
  })
  if (steps.error) return { error: "Não foi possível salvar as etapas." }

  revalidateAutomationPages(id)
  return { success: true, id }
}

export async function setAutomationStatus(id: string, status: AutomationStatus): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Automação inválida." }
  if (!STATUSES.includes(status)) return { error: "Status inválido." }

  const current = await getAutomation(id)
  if (current.error !== null) return { error: current.error }
  if (!current.data) return { error: "Automação não encontrada." }

  let warnings: string[] | undefined
  if (status === "active") {
    const automation = current.data
    const issues = validateDefinition(
      {
        name: automation.name,
        description: automation.description ?? "",
        category: automation.category ?? "geral",
        triggerType: automation.triggerType ?? "",
        steps: automation.steps,
      },
      { strict: true, readiness: await getReadiness() },
    )
    if (hasBlockingIssues(issues)) return { error: messageOf(issues) }
    warnings = issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message)
  }

  const context = await getSessionContext()
  if (context.error !== undefined) return { error: context.error }

  const { data, error } = await context.supabase
    .from("automations")
    .update({ status })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
  if (error || !data || data.length === 0) return { error: "Não foi possível alterar o status." }

  revalidateAutomationPages(id)
  return { success: true, id, warnings }
}

export async function loadRunSteps(runId: string) {
  return listRunSteps(runId)
}

export async function deleteAutomation(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Automação inválida." }
  const context = await getSessionContext()
  if (context.error !== undefined) return { error: context.error }

  const { data, error } = await context.supabase
    .from("automations")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
  if (error) return { error: "Não foi possível excluir a automação." }
  if (!data || data.length === 0) return { error: "Automação não encontrada." }

  revalidateAutomationPages()
  return { success: true }
}
