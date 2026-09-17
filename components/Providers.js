'use client';

import { ToastProvider } from '@/context/ToastContext';
import ToastViewport from './ui/Toast';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}
