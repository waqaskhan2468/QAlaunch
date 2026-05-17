import type {
	ProgrammaticFinding,
	ProgrammaticPayload,
	ProgrammaticRollup,
} from '../types/scan.types';
import { PROGRAMMATIC_RULESET_VERSION } from '../constants/programmatic';

function countBySeverity(
	findings: ProgrammaticFinding[],
): ProgrammaticRollup['bySeverity'] {
	const by = { critical: 0, major: 0, minor: 0, info: 0 };
	for (const f of findings) {
		if (f.severity in by) {
			by[f.severity as keyof typeof by] += 1;
		}
	}
	return by;
}

export function buildProgrammaticRollup(
	brokenStates?: ProgrammaticPayload,
): ProgrammaticRollup {
	const all: ProgrammaticFinding[] = [...(brokenStates?.findings ?? [])];

	const rulesetVersion =
		brokenStates?.stats.rulesetVersion ?? PROGRAMMATIC_RULESET_VERSION;

	return {
		rulesetVersion,
		totalFindings: all.length,
		bySeverity: countBySeverity(all),
		topFindings: all.slice(0, 16),
	};
}
