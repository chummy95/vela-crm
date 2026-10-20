import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { STEP_TYPES, stageSteps } from '../utils/workflow';
import { progress } from '../utils/questionnaires';
import { reviewNeedsLook } from '../hooks/useQuestionnaireAlerts';
import { formatDate, formatMoney } from '../utils/format';

const short = (value) => (value ? formatDate(value, { day: 'numeric', month: 'short' }) : '');

function studioLine(item, prevLabel, currency) {
  const { step, state, review, response, invoice, locked } = item;
  if (locked) return { text: `Opens once ${prevLabel.toLowerCase()} is done` };
  if (step.type === 'questionnaire') {
    if (!response) return { text: 'Not sent yet' };
    if (response.status === 'submitted') return { text: `Submitted ${short(response.submitted_at)}` };
    const pr = progress(response.questions, response.answers);
    return { text: response.status === 'in_progress' ? `Sent, ${pr.done} of ${pr.total} answered` : `Sent ${short(response.sent_at)}, not started yet` };
  }
  if (step.type === 'invoice') {
    if (!invoice) return { text: 'Not issued yet' };
    const amount = formatMoney(invoice.amount, currency);
    return { text: invoice.status === 'paid' ? `${amount} paid` : `${amount} issued, waiting for payment${invoice.due_date ? `, due ${short(invoice.due_date)}` : ''}` };
  }
  if (step.type === 'files') {
    if (!review) return { text: 'Ready to hand over' };
    return { text: `Delivered ${short(review.sent_at)}` };
  }
  if (!review) return { text: step.help || 'Nothing shared yet' };
  const round = review.round > 1 ? `Version ${review.round}` : 'Sent';
  if (state === 'done') return { text: `Approved ${short(review.decided_at || review.updated_at)}${review.round > 1 ? ` (version ${review.round})` : ''}` };
  if (state === 'changes') return { text: `Changes requested ${short(review.decided_at)}`, tone: 'changes' };
  return { text: `${round} ${short(review.sent_at)}, waiting for approval` };
}

function clientLine(item, prevLabel, studio) {
  const { step, state, review, response, invoice, locked } = item;
  if (step.type === 'files') {
    if (review) return { text: `Ready ${short(review.sent_at)}` };
    if (locked) return { text: 'Unlocks once the final invoice is paid' };
    return { text: `${studio} is preparing your files` };
  }
  if (locked) return { text: 'Coming up' };
  if (step.type === 'questionnaire') {
    if (!response) return { text: 'Coming up' };
    if (response.status === 'submitted') return { text: 'Thank you, sent to the studio' };
    const pr = progress(response.questions, response.answers);
    return { text: response.status === 'in_progress' ? `${pr.done} of ${pr.total} answered` : 'Waiting for your answers' };
  }
  if (step.type === 'invoice') {
    if (!invoice) return { text: 'Coming up' };
    return { text: invoice.status === 'paid' ? 'Paid, thank you' : `Due ${invoice.due_date ? short(invoice.due_date) : 'now'}` };
  }
  if (!review) return { text: `${studio} is working on this` };
  if (state === 'done') return { text: `You approved this ${short(review.decided_at || review.updated_at)}` };
  if (state === 'changes') return { text: 'You asked for changes, a new version is on its way' };
  return { text: 'Ready for your review', tone: 'waiting' };
}

// The steps inside one stage, in order, with what to do next on each.
// viewer = 'studio' shows actions for Mayaa; viewer = 'client' shows the client's view.
export default function ProjectSteps({ project, stageIndex, ctx, viewer = 'studio', currency = 'GBP', studioName = 'The studio', actions = {}, disabled = false }) {
  const items = stageSteps(project, stageIndex, ctx);
  if (!items.length) return <p className="muted" style={{ fontSize: 13.5 }}>No steps in this stage.</p>;

  return (
    <ol className="steps">
      {items.map((item, i) => {
        const { step, state, review, response, invoice, locked } = item;
        const prevLabel = items[i - 1]?.step.label || 'the step before';
        const future = stageIndex > Number(project.stage || 0) && state === 'todo';
        const line = viewer === 'client'
          ? (future && step.type !== 'files' ? { text: 'Coming up' } : clientLine(item, prevLabel, studioName))
          : studioLine(item, prevLabel, currency);
        const cls = ['step', locked || (future && viewer === 'client') ? 'locked' : state].join(' ');
        return (
          <li key={step.id} className={cls}>
            <span className="step-mark" aria-hidden="true">{state === 'done' ? <Icon name="check" size={14} /> : i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div className="step-title">{step.label}{viewer === 'studio' && STEP_TYPES[step.type] !== step.label && <span className="step-type">{STEP_TYPES[step.type]}</span>}</div>
              <div className={`step-sub ${line.tone || ''}`}>{line.text}</div>
            </div>
            <div className="step-actions">
              {viewer === 'studio'
                ? (locked ? null : <StudioActions item={item} actions={actions} disabled={disabled} />)
                : <ClientActions step={step} state={state} review={review} response={response} invoice={invoice} locked={locked} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StudioActions({ item, actions, disabled }) {
  const { step, state, review, response, invoice, rounds = [] } = item;
  if (step.type === 'questionnaire') {
    if (response) return (
      <>
        {response.status === 'submitted' && !response.seen_by_studio && <span className="ni-badge" style={{ marginLeft: 0 }}>New</span>}
        <Link to={`/questionnaires/responses/${response.id}`}>{state === 'done' ? 'Read answers' : 'View'}</Link>
      </>
    );
    return <button className="btn bg bsm" type="button" disabled={disabled} onClick={() => actions.sendQuestionnaire?.(step)}><Icon name="clipboard" size={15} />Send</button>;
  }
  if (step.type === 'invoice') {
    if (!invoice) return <button className="btn bg bsm" type="button" disabled={disabled} onClick={() => actions.invoice?.(step)}><Icon name="receipt" size={15} />Create invoice</button>;
    return (
      <>
        <Link to={`/invoices/${invoice.id}`}>View invoice</Link>
        {invoice.status !== 'paid' && <button className="btn bg bsm" type="button" onClick={() => actions.markPaid?.(step, invoice)}><Icon name="check" size={15} />Mark paid</button>}
      </>
    );
  }
  if (step.type === 'files') {
    if (review) return (
      <>
        <Link to={`/reviews/${review.id}`}>Open</Link>
        <button className="btn bq bsm" type="button" onClick={() => actions.share?.(step, 'delivery', rounds.length + 1)}>Send more</button>
      </>
    );
    return <button className="btn bp bsm" type="button" disabled={disabled} onClick={() => actions.share?.(step, 'delivery', 1)}><Icon name="send" size={15} />Upload final files</button>;
  }
  if (!review) return <button className="btn bp bsm" type="button" disabled={disabled} onClick={() => actions.share?.(step, 'review', 1)}><Icon name="plus" size={15} />Upload for review</button>;
  return (
    <>
      {reviewNeedsLook(review) && <span className="ni-badge" style={{ marginLeft: 0 }}>New</span>}
      <Link to={`/reviews/${review.id}`}>Open</Link>
      {state === 'changes' && <button className="btn bp bsm" type="button" onClick={() => actions.share?.(step, 'review', review.round + 1)}><Icon name="send" size={15} />Send revised version</button>}
    </>
  );
}

function ClientActions({ step, state, review, response, invoice, locked }) {
  if (locked) return step.type === 'files' ? <Icon name="lock" size={16} className="ico muted" /> : null;
  if (step.type === 'questionnaire') {
    if (!response) return null;
    if (state === 'done') return <Link to={`/portal/questionnaires/${response.id}`}>View answers</Link>;
    return <Link className="btn bp bsm" to={`/portal/questionnaires/${response.id}`}>{response.status === 'in_progress' ? 'Continue' : 'Start'}</Link>;
  }
  if (step.type === 'invoice') {
    if (!invoice) return null;
    return invoice.status === 'paid' ? <Link to={`/portal/invoices/${invoice.id}`}>View invoice</Link> : <Link className="btn bp bsm" to={`/portal/invoices/${invoice.id}`}>View and pay</Link>;
  }
  if (!review) return null;
  if (step.type === 'files') return <Link className="btn bp bsm" to={`/portal/reviews/${review.id}`}>Download files</Link>;
  if (state === 'waiting') return <Link className="btn bp bsm" to={`/portal/reviews/${review.id}`}>Review and approve</Link>;
  return <Link to={`/portal/reviews/${review.id}`}>View</Link>;
}
