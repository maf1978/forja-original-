import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error El CLI publicado es ESM JavaScript y no distribuye declaraciones TypeScript.
import { installBotSkills, readSuperpoderesSkill } from "../../cli/bin/cli.js";

describe("forjabot instala /superpoderes", () => {
  it("copia el skill completo dentro de cada bot", () => {
    const botDir = mkdtempSync(join(tmpdir(), "forja-superpoderes-"));

    expect(installBotSkills(botDir)).toBe(true);
    const installed = readFileSync(join(botDir, "skill", "superpoderes.md"), "utf8");

    expect(installed).toBe(readSuperpoderesSkill());
    expect(installed).toContain("¿Tu base de conocimiento ya está completa");
    expect(installed).toContain("handoffHuman");
  });

  it("mantiene sincronizadas la plantilla del repo y la copia publicada por el CLI", () => {
    const source = readFileSync(join(process.cwd(), "skill", "superpoderes.md"), "utf8");
    expect(readSuperpoderesSkill()).toBe(source);
  });
});
