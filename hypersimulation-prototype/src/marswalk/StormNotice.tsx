import { Icon } from '../design/icons';
import type { StormMessage, StormState } from './storm';

/** The one storm notice under the compass: alarm colour, labelled scenario, dismissible, with the cancel key. */
export default function StormNotice({ storm, msg, onDismiss, onCancel, onResume }: { storm: StormState; msg: StormMessage; onDismiss: () => void; onCancel: () => void; onResume: () => void }) {
  return <p className="hud-storm" role="status">
    <Icon name="warning" />
    <span className="hud-storm__text"><b>{msg.headline}</b><em>{msg.label}</em></span>
    <span className="sr-only">{msg.text} {msg.advice}</span>
    {storm.returning
      ? <button type="button" className="hud-storm__key" onClick={onCancel}>Cancel return<kbd aria-hidden="true">C</kbd></button>
      : <button type="button" className="hud-storm__key" onClick={onResume}>Way back<kbd aria-hidden="true">C</kbd></button>}
    <button type="button" className="hud-toast__close" aria-label="Dismiss storm notice" onClick={onDismiss}><Icon name="close" /><kbd aria-hidden="true">X</kbd></button>
  </p>;
}
