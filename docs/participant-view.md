# Prepared participant view

Researchers may prepare a link such as `/?task=H000136&participant=1` when the research catalogue's task title or description would reveal information that participants must not see beforehand. Existing task-ID resolution accepts the numeric ID without a paradigm-bearing slug.

The exact query `participant=1` omits the researcher launcher and uses a neutral document title while loading. Missing or invalid task selection shows a readable neutral error instead of the catalogue. Other query values and ordinary catalogue browsing retain their existing behavior. Task-provided instructions, registration, consent/safety messages, quit shortcuts and exports are unchanged; task authors must still keep their own participant-facing content appropriate.

This view does not certify participant naivety or prevent participants from opening the public catalogue, repositories, developer tools or other information. Researchers must prepare the participant view before presenting the screen and avoid exposing research descriptions beforehand.
