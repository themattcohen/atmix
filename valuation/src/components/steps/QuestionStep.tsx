import { Select } from '../ui/Select';
import { SectionLabel } from '../ui/Card';
import type { Question } from '../../data/questions';
import type { AnswerMap } from '../../state/useWizard';

interface Props {
  stepNumber: number;
  totalSteps: number;
  title: string;
  intro: string;
  questions: Question[];
  answers: AnswerMap;
  onChange: (id: string, value: string | number | null) => void;
}

export function QuestionStep({
  stepNumber,
  totalSteps,
  title,
  intro,
  questions,
  answers,
  onChange,
}: Props) {
  return (
    <div>
      <SectionLabel className="mb-3">
        Step {stepNumber} of {totalSteps}
      </SectionLabel>
      <h2 className="font-display text-display-lg mb-3">{title}</h2>
      <p className="text-someday-slate-mid mb-8 max-w-2xl">{intro}</p>

      <div className="space-y-6 max-w-2xl">
        {questions.map((q) => {
          if (q.id === 'q_sale_price_target') return null; // toggle handled separately if needed

          // SPOF count: text input for numeric SPOF (allows any integer)
          if (q.id === 'q_spof_count') {
            return (
              <div key={q.id}>
                <Select
                  label={q.prompt}
                  helperText={q.helperText}
                  options={q.options.map((o) => ({ label: o.label, value: o.label }))}
                  placeholder="Select an answer"
                  value={(answers[q.id] as string) ?? ''}
                  onChange={(e) => onChange(q.id, e.target.value)}
                />
              </div>
            );
          }

          if (q.id === 'q_shareholder_count') {
            return (
              <Select
                key={q.id}
                label={q.prompt}
                helperText={q.helperText}
                options={q.options.map((o) => ({ label: o.label, value: o.label }))}
                placeholder="Select an answer"
                value={(answers[q.id] as string) ?? ''}
                onChange={(e) => onChange(q.id, e.target.value)}
              />
            );
          }

          return (
            <Select
              key={q.id}
              label={q.prompt}
              helperText={q.helperText}
              options={q.options.map((o) => ({ label: o.label, value: o.label }))}
              placeholder={q.trackingOnly ? 'Choose an option' : 'Select an answer'}
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => onChange(q.id, e.target.value)}
            />
          );
        })}

      </div>
    </div>
  );
}
