import type { ImportSpec } from "../blueprint.js";

interface MergedImport {
  default?: string;
  from: string;
  named: Set<string>;
  sideEffect: boolean;
  types: Set<string>;
}

const compare = (left: string, right: string): number =>
  left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });

const isRelative = (from: string): boolean => from.startsWith(".");

const merge = (specs: readonly ImportSpec[]): MergedImport[] => {
  const byModule = new Map<string, MergedImport>();
  for (const spec of specs) {
    const merged = byModule.get(spec.from) ?? {
      from: spec.from,
      named: new Set<string>(),
      sideEffect: false,
      types: new Set<string>(),
    };
    merged.default ??= spec.default;
    merged.sideEffect ||= spec.sideEffect === true;
    for (const name of spec.named ?? []) {
      merged.named.add(name);
    }
    for (const name of spec.types ?? []) {
      merged.types.add(name);
    }
    byModule.set(spec.from, merged);
  }
  return [...byModule.values()].toSorted((left, right) => compare(left.from, right.from));
};

const list = (names: Set<string>): string => [...names].toSorted(compare).join(", ");

const renderValue = (spec: MergedImport): string | undefined => {
  const parts = [spec.default, spec.named.size > 0 ? `{ ${list(spec.named)} }` : undefined].filter(
    (part) => part !== undefined,
  );
  if (parts.length > 0) {
    return `import ${parts.join(", ")} from "${spec.from}";`;
  }
  return spec.sideEffect && spec.types.size === 0 ? `import "${spec.from}";` : undefined;
};

const block = (lines: ReadonlyArray<string | undefined>): string =>
  lines.filter((line) => line !== undefined).join("\n");

/** Renders merged, de-duplicated and grouped import statements (types, packages, local files). */
export const renderImports = (specs: readonly ImportSpec[]): string => {
  const merged = merge(specs);
  const types = merged
    .filter((spec) => spec.types.size > 0)
    .map((spec) => `import type { ${list(spec.types)} } from "${spec.from}";`);
  const external = merged.filter((spec) => !isRelative(spec.from)).map((spec) => renderValue(spec));
  const local = merged.filter((spec) => isRelative(spec.from)).map((spec) => renderValue(spec));
  return [block(types), block(external), block(local)].filter(Boolean).join("\n\n");
};
