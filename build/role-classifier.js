const heuristics = [
    { role: "frontend", patterns: [/dev/, /start/, /serve/, /vite/, /next/, /webpack/, /frontend/] },
    { role: "backend", patterns: [/api/, /server/, /backend/, /express/, /nest/, /fastify/] },
    { role: "test", patterns: [/test/, /jest/, /unit/, /mocha/, /vitest/] },
    { role: "e2e", patterns: [/e2e/, /cypress/, /playwright/] },
];
export function inferRole(nameOrCommand) {
    const lowered = nameOrCommand.toLowerCase();
    for (const h of heuristics) {
        if (h.patterns.some((p) => p.test(lowered)))
            return h.role;
    }
    return "utility";
}
//# sourceMappingURL=role-classifier.js.map