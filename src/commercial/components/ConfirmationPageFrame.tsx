import type { ReactNode } from 'react';

type ConfirmationPageFrameProps = {
  children: ReactNode;
  testId: string;
};

export default function ConfirmationPageFrame({
  children,
  testId
}: ConfirmationPageFrameProps) {
  return (
    <div className="container-base site-section" data-testid={testId}>
      <div
        className="mx-auto w-full xl:w-2/3"
        data-confirmation-page-frame
      >
        {children}
      </div>
    </div>
  );
}
