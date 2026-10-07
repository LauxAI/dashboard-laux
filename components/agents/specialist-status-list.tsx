import Link from "next/link"
import { SectionCard } from "@/components/shared/section-card"
import {
  specialistConfigHref,
  specialistLabels,
  specialistStateLabels,
  type SpecialistStatus,
} from "@/lib/ai/specialist-status"
import { cn } from "@/lib/utils"

const stateHint: Record<SpecialistStatus["state"], string> = {
  ativo: "O Atendimento pode acioná-lo.",
  desativado: "Não habilitado no Atendimento.",
  inativo: "Habilitado, mas o especialista está inativo.",
  precisa_configurar: "Habilitado, mas precisa ser configurado.",
}

export function SpecialistStatusList({ statuses }: { statuses: SpecialistStatus[] }) {
  return (
    <SectionCard
      title="Especialistas ativos"
      description="Reflete o que está salvo e o que o Atendimento realmente utiliza."
      contentClassName="flex flex-col gap-3"
    >
      <ul className="flex flex-col gap-3">
        {statuses.map(({ key, state }) => (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                state === "ativo" && "bg-primary",
                state === "precisa_configurar" && "bg-destructive",
                (state === "desativado" || state === "inativo") && "bg-muted-foreground/40",
              )}
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">
                {specialistLabels[key]}
                <span className="sr-only">: {specialistStateLabels[state]}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {stateHint[state]}{" "}
                {state === "precisa_configurar" && (
                  <Link
                    href={specialistConfigHref[key]}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Configurar
                  </Link>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
