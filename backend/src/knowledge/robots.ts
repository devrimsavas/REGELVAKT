// A small robots.txt reader: the rules for our user agent, or for every
// agent ("*") when there is no group for ours. The longest matching rule
// wins; Allow wins a tie (RFC 9309).

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

export function parseRobots(text: string, agent: string): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match?.[1]) continue;
    const field = match[1].toLowerCase();
    const value = (match[2] ?? "").trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { allow: [], disallow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    // An empty Disallow allows everything
    if (field === "disallow" && value) current.rules.disallow.push(value);
    if (field === "allow" && value) current.rules.allow.push(value);
  }

  const name = agent.toLowerCase();
  const own = groups.filter((group) =>
    group.agents.some((a) => a !== "*" && name.includes(a)),
  );
  const chosen =
    own.length > 0 ? own : groups.filter((g) => g.agents.includes("*"));

  return {
    allow: chosen.flatMap((group) => group.rules.allow),
    disallow: chosen.flatMap((group) => group.rules.disallow),
  };
}

// How long the part of the path a rule matches is, or -1 for no match.
// "*" matches anything and "$" the end of the path.
function matchLength(rule: string, path: string): number {
  const pattern = rule
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${pattern}`);
  return regex.test(path) ? rule.length : -1;
}

export function isAllowed(rules: RobotsRules, path: string): boolean {
  const longest = (list: string[]) =>
    Math.max(-1, ...list.map((rule) => matchLength(rule, path)));
  const allow = longest(rules.allow);
  const disallow = longest(rules.disallow);
  return disallow === -1 || allow >= disallow;
}
