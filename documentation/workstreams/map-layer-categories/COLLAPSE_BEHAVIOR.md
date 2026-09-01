# Collapse Invariant

Category disclosure state is presentation state only. It must never dispatch a layer action or mutate URL state. A checked child remains rendered when its category closes, and the category summary continues to report the active child count so the state is not hidden from the user.
