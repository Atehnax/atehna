import type { HTMLAttributes } from 'react';

type AdminSaveStatusProps = Pick<HTMLAttributes<HTMLSpanElement>, 'className' | 'title'> & {
  dirty:boolean;
  saving?:boolean;
  testId?:string;
};

/** The compact saved-state indicator shared by admin save action groups. */
export function AdminSaveStatus({dirty,saving=false,className,title,testId}:AdminSaveStatusProps) {
  const pending=dirty||saving;
  const label=saving?'Shranjujem …':dirty?'Neshranjeno':'Shranjeno';
  return <span className={"inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-500 "+(className??'')} role="status" aria-live="polite" aria-atomic="true" data-testid={testId} title={title??(saving?'Spremembe se shranjujejo.':dirty?'Spremembe še niso shranjene.':'Vse spremembe so shranjene.')}>
    <span className={'h-1.5 w-1.5 shrink-0 rounded-full '+(pending?'bg-amber-500':'bg-emerald-500')} aria-hidden="true"/>
    {label}
  </span>;
}
