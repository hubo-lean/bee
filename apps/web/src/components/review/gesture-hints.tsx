"use client";

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GestureHintsProps {
  showHints: boolean;
}

export function GestureHints({ showHints }: GestureHintsProps) {
  return (
    <AnimatePresence>
      {showHints && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="grid grid-cols-4 gap-2 text-center text-xs text-gray-500 dark:text-gray-400 py-4 px-4"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <ArrowUp className="h-4 w-4 text-orange-500" />
            </div>
            <span>Urgent</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <ArrowLeft className="h-4 w-4 text-red-500" />
            </div>
            <span>Disagree</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <ArrowRight className="h-4 w-4 text-green-500" />
            </div>
            <span>Agree</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
              <ArrowDown className="h-4 w-4 text-gray-500" />
            </div>
            <span>Hide</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
