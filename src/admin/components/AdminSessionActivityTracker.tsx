"use client";

import { useEffect } from 'react';
import { startAdminSessionActivityTracking } from './adminSessionActivity';

export default function AdminSessionActivityTracker() {
  useEffect(() => startAdminSessionActivityTracking(), []);
  return null;
}
