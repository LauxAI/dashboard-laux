import { NewAutomationButton } from "@/components/automations/new-automation-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { categoryLabels, getTrigger } from "@/lib/automations/catalog"
import { templates } from "@/lib/automations/templates"

export function TemplateLibrary() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="flex flex-col">
          <CardHeader className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit font-normal">
              {categoryLabels[template.category]}
            </Badge>
            <CardTitle>{template.name}</CardTitle>
            <CardDescription className="text-pretty">{template.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">Quando: </span>
              {getTrigger(template.triggerType)?.label ?? template.triggerType}
            </p>
            <p className="text-muted-foreground">{template.steps.length} etapas</p>
          </CardContent>
          <CardFooter>
            <NewAutomationButton templateId={template.id} label="Usar modelo" variant="outline" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
