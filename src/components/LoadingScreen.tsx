import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RAINBOW_LOGO_PATH } from '../types';
import { useApp } from '../contexts/AppContext';

interface LoadingScreenProps {
  visible: boolean;
  progress?: number | null;
  label?: string;
  fullscreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  visible,
  progress = null,
  label,
  fullscreen = true,
}) => {
  const { t } = useApp();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={
            fullscreen
              ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md'
              : 'flex flex-col items-center justify-center py-16 w-full'
          }
          role="status"
          aria-live="polite"
        >
          <motion.div
            animate={{ opacity: [0.65, 1, 0.65], scale: [0.97, 1.02, 0.97] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-20 h-20 rounded-full p-1 rainbow-ring-border shadow-lg"
          >
            <img
              src={RAINBOW_LOGO_PATH}
              alt="Rainbow Logo"
              className="w-full h-full object-cover rounded-full bg-white"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <div className="mt-6 w-48">
            <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              {typeof progress === 'number' ? (
                <div
                  className="h-full rainbow-bar transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
                />
              ) : (
                <motion.div
                  className="h-full w-1/2 rainbow-bar rounded-full"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
            {label && (
              <p className="mt-2.5 text-center text-xs font-medium text-neutral-600 dark:text-neutral-400">
                {label}
                {typeof progress === 'number' ? ` (${Math.round(progress)}%)` : ''}
              </p>
            )}
          </div>

          <p className="mt-6 text-xs font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">
            {t.fromNk}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
