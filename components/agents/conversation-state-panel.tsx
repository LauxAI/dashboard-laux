import { Badge } from "@/components/ui/badge";
import type {
  ConversationIntent,
  SchedulingConversationState,
  SchedulingNextAction,
} from "@/lib/ai/agents/scheduling-conversation";
import type { SchedulingAgentBehavior } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const INTENT_LABELS: Record<ConversationIntent, string> = {
  schedule: "Agendamento",
  cancel: "Cancelamento",
  reschedule: "Reagendamento",
};

const NEXT_ACTION_LABELS: Record<SchedulingNextAction, string> = {
  identify_intent: "Identificar o que o cliente precisa",
  collect_name: "Solicitar nome",
  collect_phone: "Solicitar telefone",
  collect_email: "Solicitar e-mail",
  check_availability: "Consultar disponibilidade (agenda não conectada)",
  lookup_appointment: "Consultar agendamentos (agenda não conectada)",
  handoff_to_team: "Encaminhar para a equipe",
};

export function ConversationStatePanel({
  state,
  nextAction,
  behavior,
}: {
  state: SchedulingConversationState;
  nextAction: SchedulingNextAction | null;
  behavior: SchedulingAgentBehavior;
}) {
  const fields = [
    behavior.askName && { label: "Nome", value: state.customer.name },
    behavior.askPhone && { label: "Telefone", value: state.customer.phone },
    behavior.askEmail && { label: "E-mail", value: state.customer.email },
  ].filter(Boolean) as { label: string; value: string | null }[];

  return (
    <section
      aria-label="Dados capturados na conversa"
      className="flex flex-col gap-3 rounded-lg border bg-card p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">
          Dados do cliente
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Intenção:</span>
          {state.intent ? (
            <Badge variant="secondary">{INTENT_LABELS[state.intent]}</Badge>
          ) : (
            <span>Não identificada</span>
          )}
        </div>
      </div>

      {fields.length > 0 ? (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {fields.map((field) => (
            <div key={field.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd
                className={cn(
                  "truncate text-sm",
                  field.value ? "text-foreground" : "text-muted-foreground",
                )}
                title={field.value ?? undefined}
              >
                {field.value ?? "Não informado"}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          A coleta de dados do cliente está desativada nesta configuração.
        </p>
      )}

      {nextAction && (
        <p className="text-xs text-muted-foreground">
          Próximo passo:{" "}
          <span className="text-foreground">
            {NEXT_ACTION_LABELS[nextAction]}
          </span>
        </p>
      )}
    </section>
  );
}
