# Scope

v1 = workout logging + body weight. Nothing else.

Two rules gate every future feature:

1. **In-gym rule.** Nothing may add friction to the logging loop. The workout screen answers to this rule alone.
2. **Data-domain rule.** A new data domain (nutrition, measurements, sleep…) enters only as a self-contained module: own screen, own model, minimal UI, full export, and it never touches the workout loop. New domains need a written doc before code.

A feature enters only if it makes logging a set faster or the next session smarter.

Out forever: social features, feeds, sharing, exercise content library (videos, tutorials, courses), gamification (streaks, badges), nutrition databases as a v1 concern, wearables, heart rate, cardio tracking. AI only ever in service of "next session smarter", and never in v1.
