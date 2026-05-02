'use client';

import dynamic from 'next/dynamic';

const LazyConfirmDialog = dynamic(() => import('./confirm-dialog'), { ssr: false });

export default LazyConfirmDialog;
