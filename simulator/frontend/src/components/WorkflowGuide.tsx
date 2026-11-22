import { X } from 'lucide-react'
import './workflowGuide.css'

export type GuideStep = 'storm' | 'simulate' | 'access' | 'relief'

type Step = { id: GuideStep; title: string; detail: string }

const STEPS: Step[] = [
  { id: 'storm', title: 'Design a storm', detail: 'Choose its path, rainfall, duration and drainage conditions.' },
  { id: 'simulate', title: 'Simulate community impact', detail: 'Watch road segments and buildings change as the scenario builds.' },
  { id: 'access', title: 'Inspect emergency access', detail: 'See which buildings lose modeled access to the selected hospital.' },
  { id: 'relief', title: 'Prioritize relief', detail: 'Compare affected census tracts using social vulnerability indicators.' },
]

type Props = {
  hidden: boolean
  /** Why a step can't run right now, shown in place of its detail. */
  unavailable: Partial<Record<GuideStep, string>>
  onStep: (step: GuideStep) => void
  onDismiss: () => void
}

/** The four-step path through the simulator, shown over the map until dismissed. */
export default function WorkflowGuide({ hidden, unavailable, onStep, onDismiss }: Props) {
  return (
    <section className="sim-guide" aria-labelledby="sim-guide-title" hidden={hidden}>
      <header>
        <h2 id="sim-guide-title">Explore a flood in four steps</h2>
        <button type="button" onClick={onDismiss} aria-label="Hide the four-step guide" title="Hide guide">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <ol>
        {STEPS.map((step, i) => {
          const blocked = unavailable[step.id]
          return (
            <li key={step.id}>
              <button type="button" id={`sim-guide-${step.id}`} disabled={Boolean(blocked)} onClick={() => onStep(step.id)}>
                <span className="sim-guide-n" aria-hidden="true">{i + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{blocked ?? step.detail}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
