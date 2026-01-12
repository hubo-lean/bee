"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function EmptyInbox() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
      >
        <Inbox className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
      </motion.div>
      <h2 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
        All caught up!
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        Your inbox is empty. Great job staying on top of things.
      </p>
      <Button variant="outline" asChild>
        <Link href="/capture">Capture something new</Link>
      </Button>
    </motion.div>
  );
}
