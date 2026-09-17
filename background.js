/*
 * Manifest V3 service-worker entry point.
 * Keep the import order: later files use globals defined by earlier files.
 */
importScripts(
    "worker/config.js",
    "worker/page-utils.js",
    "worker/adapters.js",
    "worker/routing.js",
    "worker/llm.js",
    "worker/workflow.js"
);
