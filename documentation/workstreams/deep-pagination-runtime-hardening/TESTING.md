# Testing

## Unit/fixture evidence

Cursor codec tests cover:

- opaque round trip of backend-native continuation state;
- HMAC signature rejection after token editing;
- rejection when a token is signed by another application secret;
- projection mismatch;
- criteria/page-size mismatch;
- backend mismatch;
- logical page preservation;
- criteria fingerprint invariance to legacy offset page;
- minimum signing-secret validation.

Solr HTTP-fixture tests cover:

- initial `cursorMark=*` request;
- `score desc,id asc` deterministic order;
- absence of `start` in cursor mode;
- advancing continuation mark;
- partial final page termination;
- repeated Solr mark termination;
- preservation of normal result mapping and logical page metadata.

Still required:

- equivalent OpenSearch `search_after` fixture tests;
- public controller/service invalid-cursor HTTP 400 tests;
- offset/cursor compatibility tests on shared bounded criteria;
- Angular state/effect tests for cursor history and filter preservation.

## Browser/accessibility evidence

Add browser coverage for:

- keyboard-only Next/Previous traversal;
- disabled states at traversal boundaries;
- meaningful accessible names;
- polite result-range/status announcement;
- focus behavior after page transitions;
- focus not obscured;
- target-size checks where deterministic;
- 320 px reflow;
- 200% zoom;
- forced colors;
- axe rules tagged through WCAG 2.2 AA where supported.

Automated browser evidence does not replace the repository's dated manual keyboard/NVDA/JAWS/map-equivalence work.

## Live C2 evidence

Use a separate explicit command/evidence path against the exact active C2 projection. Record:

- projection ID;
- engine;
- criteria fingerprint or canonical criteria;
- page size;
- number of pages/IDs measured;
- duplicate-ID count;
- order/gap verification method;
- elapsed/timing context only as diagnostic evidence.

Do not rebuild or walk the full million-record corpus in ordinary pull-request CI.
