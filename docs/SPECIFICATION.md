# Initial Project Specification Seed

Status: initial project scope only; implementation choices and detailed contracts are not fixed.

## Core responsibility
Create a domain-agnostic web application and knowledge/learning engine that:
1. acquires and structures reliable external domain knowledge with provenance;
2. generates judgment questions with an AI-preselected answer and concise rationale;
3. supports one-action GO approval and optional corrections/annotations;
4. infers KiNoTch.-specific judgments and their scope from the differences;
5. distinguishes hypothesis/verification/approved rule states;
6. evaluates candidate rules on held-out/unknown/conflicting/boundary cases;
7. provides approved applicable knowledge to other AI/development agents.

## Knowledge organization
Separate common knowledge, domain knowledge, personal global judgments, personal domain judgments, cases/responses, evaluation data, and runtime application code. UI/UX is one domain, not the application's overall responsibility.

## Constraints
- Do not mistake GO on an individual answer for approval of every inferred general rule.
- Do not make the public repository a storage target for private answer histories or secrets.
- Do not turn question GO into release/deploy/destructive-operation permission.
- Preserve user/project requirements; no forced Repository Base layout or guessed license.
- AI model fine-tuning is not necessary for the initial system.

The repository-local parent Issue owns the full initial concept, phases, acceptance criteria, and explicit unresolved decisions.