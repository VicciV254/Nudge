import Icon from '../common/Icon.jsx';
import { PRESETS, describeRecurrence } from '../../utils/recurrence.js';

/**
 * Repeat selector.
 *
 * Presets only, by design. A full RRULE builder ("every 3rd Tuesday except
 * December") is a large amount of UI for a case that is vanishingly rare in a
 * to-do app — and the six presets below cover what people actually create.
 * The backend accepts arbitrary RRULEs, so a custom rule arriving from Google
 * still round-trips; it just renders as a read-only description here.
 */
export default function RepeatPicker({ value, onChange, dueDate, disabled }) {
  const isCustom = value && !PRESETS.some((p) => p.rrule === value);

  return (
    <div className="field">
      <span className="field__label">Repeat</span>

      {isCustom ? (
        <div className="repeat-custom">
          <Icon name="sync" size={14} />
          <span>{describeRecurrence(value, dueDate) || value}</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="segs" role="radiogroup" aria-label="Repeat">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={(value || null) === p.rrule}
              className={`seg ${(value || null) === p.rrule ? 'seg--on' : ''}`}
              onClick={() => onChange(p.rrule)}
              disabled={disabled}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {value && !isCustom && (
        <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
          {describeRecurrence(value, dueDate)}
          {!dueDate && ' — pick a date to start the series'}
        </p>
      )}
    </div>
  );
}
