# Generate 65 exercise illustration images for a workout app

## Hard rules (read first)

- You MUST generate every image with the image-generation model. NEVER hand-code
  SVGs, NEVER use a programmatic drawing script, and NEVER substitute generated
  geometry for a real model render. If an image is wrong, regenerate it with the
  model — do not fall back to any other technique.
- The reference look is the existing set in `model-sources/` (the chest and
  shoulder slugs). Match that style exactly: clean black line-art, full-bodied
  figure, coloring-book feel. Those images are the target, not a failure.

## Output

- Working directory: /home/yasso/Development/projects/kilorep/scripts/illustrations
- This is a CONTINUATION of a stalled run. 38 of the 65 slugs are already done and
  must NOT be touched: do not regenerate or overwrite any image that already exists
  in `raw/`, and keep all existing `model-sources/` attempts.
- Generate ONLY the 27 remaining slugs listed under "Remaining slugs to generate"
  below. For each, generate 3 attempts and write them to
  `model-sources/<slug>-attempt1.png`, `-attempt2.png`, `-attempt3.png`, then pick
  the best attempt and copy it to `raw/<slug>.png`. `raw/` is the final,
  one-image-per-exercise set.
- Size 1024x1024, PNG. Match the style of the existing `model-sources/` images
  exactly so the new 27 are indistinguishable from the 38 already done.

## Remaining slugs to generate (27)

back-squat, bulgarian-split-squat, cable-crunch, cable-curl, cable-triceps-pushdown,
close-grip-bench-press, front-squat, hack-squat, hanging-leg-raise, hip-abduction,
hip-thrust, incline-dumbbell-curl, leg-extension, leg-press, lying-leg-curl,
overhead-cable-triceps-extension, overhead-dumbbell-triceps-extension, plank,
preacher-curl, romanian-deadlift, russian-twist, seated-calf-raise, seated-leg-curl,
skull-crusher, standing-calf-raise, triceps-dip, walking-lunge

Use each slug's Subject line from the full list below to build its prompt, but only
generate the 27 slugs named here.

## How to build each image prompt

Each image prompt is the style block below, followed by that exercise's Subject line,
both passed VERBATIM to the image model. Do not paraphrase, shorten, merge, or rewrite
either part.

## Style block (identical for all)

Clean black line-art illustration, bold uniform stroke weight, pure solid black
lines on a pure white background, coloring-book style. A single full-bodied human
figure with volumetric, anatomically natural limbs and torso, NOT a stick figure.
A simple neutral face and short or no hair are fine; light muscle-contour lines on
the body are fine. No shading, no gray tones, no gradients, no cross-hatching or
fill textures, no background, no floor line, no shadow, no text, no labels, no
watermark. Only the figure and the equipment needed for the exercise, with the
equipment drawn simply and not over-detailed. Composition centered with generous
white margin, square 1024x1024.

## Exercises (slug, then Subject line)

- barbell-bench-press: Subject: a person performing a barbell bench press, lying flat on a bench with feet on the floor, pressing the barbell straight up above the chest with arms nearly extended, side view.
- incline-barbell-bench-press: Subject: a person performing an incline barbell bench press, lying on a bench inclined about 40 degrees, pressing the barbell up above the upper chest, side view.
- dumbbell-bench-press: Subject: a person performing a dumbbell bench press, lying flat on a bench, pressing a dumbbell in each hand straight up above the chest, front three-quarter view.
- incline-dumbbell-bench-press: Subject: a person performing an incline dumbbell bench press, lying on an inclined bench, pressing two dumbbells up above the upper chest, front three-quarter view.
- machine-chest-press: Subject: a person performing a machine chest press, seated upright at a simplified chest press machine, pressing the horizontal handles forward, side view.
- incline-machine-chest-press: Subject: a person performing an incline machine chest press, seated leaning back on a simplified inclined press machine, pressing the handles upward and forward, side view.
- pec-deck-fly: Subject: a person performing a pec deck fly, seated at a simplified pec deck machine, forearms on the vertical pads, bringing the arms together in front of the chest, front view.
- cable-fly: Subject: a person performing a cable fly, standing between two tall cable pulley towers, leaning slightly forward, bringing the two handles together in front of the chest in a wide arc, front view.
- incline-cable-fly: Subject: a person performing a low-to-high cable fly, standing between two low cable pulleys, sweeping the handles upward and together in front of the upper chest, front view.
- dumbbell-fly: Subject: a person performing a dumbbell fly, lying on a flat bench, arms open wide to the sides with slightly bent elbows holding a dumbbell in each hand, viewed from the head end of the bench.
- push-up: Subject: a person performing a push-up, body rigid and straight, palms on the floor, elbows bent halfway through the rep, side view.
- chest-dip: Subject: a person performing a chest dip on parallel bars, torso leaning forward, elbows bent, knees bent with feet crossed behind, side view.
- overhead-press: Subject: a person performing a standing barbell overhead press, the bar just above the head with arms almost extended, side view.
- dumbbell-shoulder-press: Subject: a person performing a seated dumbbell shoulder press, pressing a dumbbell in each hand overhead with palms forward, front view.
- machine-shoulder-press: Subject: a person performing a machine shoulder press, seated at a simplified shoulder press machine, pressing the handles up overhead, side view.
- arnold-press: Subject: a person performing a seated Arnold press, holding two dumbbells in front of the shoulders with palms facing the body and elbows in front, starting to press upward, front three-quarter view.
- dumbbell-lateral-raise: Subject: a person performing a dumbbell lateral raise, standing, both arms raised straight out to the sides at shoulder height holding small dumbbells, front view.
- cable-lateral-raise: Subject: a person performing a cable lateral raise, standing beside a low cable pulley, one arm raising the handle out to the side to shoulder height with the cable running diagonally down to the pulley, front view.
- machine-lateral-raise: Subject: a person performing a machine lateral raise, seated at a simplified lateral raise machine with upper arms under the pads, raising both elbows out to the sides, front view.
- reverse-pec-deck: Subject: a person performing a reverse pec deck fly, seated facing the machine with chest against the pad, arms swept out wide behind the torso gripping the handles, viewed from behind.
- dumbbell-rear-delt-fly: Subject: a person performing a bent-over dumbbell rear delt fly, torso bent forward near parallel to the floor with a flat back, raising a dumbbell in each hand out to the sides, side view.
- face-pull: Subject: a person performing a face pull, standing facing a high cable pulley, pulling a rope attachment toward the face with elbows high and wide, side view.
- barbell-shrug: Subject: a person performing a barbell shrug, standing holding a barbell at thigh height with straight arms, shoulders shrugged up toward the ears, front view.
- dumbbell-shrug: Subject: a person performing a dumbbell shrug, standing with a dumbbell in each hand at the sides, shoulders shrugged up toward the ears, front view.
- deadlift: Subject: a person performing a conventional barbell deadlift at mid-pull, barbell at knee height, hips hinged low, back flat, arms straight, side view.
- pull-up: Subject: a person performing a pull-up, hanging from a straight overhead bar with a wide overhand grip, chin near bar height, knees slightly bent, front view.
- chin-up: Subject: a person performing a chin-up, hanging from a straight overhead bar with a narrow underhand grip, palms facing the body, chin at bar height, front view.
- lat-pulldown: Subject: a person performing a lat pulldown, seated at a simplified lat pulldown machine with thighs under the pads, pulling a wide bar down toward the upper chest with the cable running up to the overhead pulley, side view.
- close-grip-lat-pulldown: Subject: a person performing a close-grip lat pulldown, seated at a simplified lat pulldown machine, pulling a narrow neutral-grip handle down to the chest, side view.
- barbell-row: Subject: a person performing a bent-over barbell row, torso bent forward near parallel to the floor with a flat back, rowing the barbell up to the lower chest, side view.
- dumbbell-row: Subject: a person performing a one-arm dumbbell row, one knee and one hand supported on a flat bench, the other arm rowing a dumbbell up to the hip, back flat, side view.
- seated-cable-row: Subject: a person performing a seated cable row, seated on the machine bench with knees slightly bent, feet on the platform, pulling the cable handle to the torso, simplified cable row machine, side view.
- t-bar-row: Subject: a person performing a T-bar row, standing astride the handle anchored at the floor, torso hinged forward, pulling the handle up to the chest, side view.
- machine-row: Subject: a person performing a chest-supported machine row, seated with chest against the pad, pulling the handles back with bent elbows, side view.
- straight-arm-pulldown: Subject: a person performing a straight-arm cable pulldown, standing facing a high cable, both arms straight, pressing the bar down in an arc from shoulder height toward the thighs, side view.
- barbell-curl: Subject: a person performing a standing barbell curl, elbows pinned at the sides, forearms at ninety degrees, side view.
- dumbbell-curl: Subject: a person performing a standing dumbbell curl, curling a dumbbell in each hand with palms up, halfway through the rep, front view.
- hammer-curl: Subject: a person performing a standing hammer curl, curling a dumbbell in each hand with a neutral thumbs-up grip, palms facing each other, front view.
- incline-dumbbell-curl: Subject: a person performing an incline dumbbell curl, seated leaning back on an inclined bench with upper arms hanging behind the torso line, curling two dumbbells, side view.
- preacher-curl: Subject: a person performing a preacher curl, seated at a preacher bench with upper arms resting on the sloped pad, curling an EZ-bar, side view.
- cable-curl: Subject: a person performing a cable curl, standing facing a low cable pulley, elbows at the sides, curling a bar attached to the low cable, side view.
- close-grip-bench-press: Subject: a person performing a close-grip barbell bench press, lying on a flat bench, hands close together on the bar and elbows tucked along the torso, side view.
- triceps-dip: Subject: a person performing a triceps dip on parallel bars, torso upright, elbows bent behind the body, legs hanging straight down, side view.
- cable-triceps-pushdown: Subject: a person performing a cable triceps pushdown, standing at a high cable with elbows pinned at the sides, pushing a short bar down with forearms near full extension, side view.
- overhead-cable-triceps-extension: Subject: a person performing an overhead cable triceps extension, standing facing away from the cable tower and leaning slightly forward, both arms extending a rope attachment forward and overhead, side view.
- overhead-dumbbell-triceps-extension: Subject: a person performing an overhead dumbbell triceps extension, standing and holding a single dumbbell with both hands overhead, elbows bent so the dumbbell hangs behind the head, side view.
- skull-crusher: Subject: a person performing a skull crusher, lying on a flat bench with upper arms vertical, elbows bent lowering an EZ-bar toward the forehead, side view.
- back-squat: Subject: a person performing a barbell back squat, at the bottom of the squat, barbell resting behind the neck across the upper traps, hands gripping the bar behind the shoulders, thighs parallel to the ground, chest up, side view.
- front-squat: Subject: a person performing a barbell front squat, at the bottom of the squat, barbell racked in front across the front of the shoulders with elbows lifted high, thighs parallel to the ground, side view.
- hack-squat: Subject: a person performing a hack squat on a simplified hack squat machine, back against the angled pad, shoulders under the pads, feet on the inclined platform, knees bent mid-squat, side view.
- leg-press: Subject: a person performing a leg press, seated reclined in a simplified leg press machine, feet on the sled plate, knees bent at 90 degrees, side view.
- bulgarian-split-squat: Subject: a person performing a Bulgarian split squat, rear foot resting on a bench behind, front knee bent deep, a dumbbell in each hand at the sides, side view.
- walking-lunge: Subject: a person performing a walking lunge mid-step, front knee bent at ninety degrees, rear knee just above the floor, torso upright, a dumbbell in each hand, side view.
- leg-extension: Subject: a person performing a leg extension, seated on a simplified leg extension machine with shins behind the ankle pad, extending both legs straight out, side view.
- romanian-deadlift: Subject: a person performing a Romanian deadlift, standing hip hinge with only a slight knee bend, hips pushed far back, flat back, barbell lowered along the thighs to just above the knees, side view.
- seated-leg-curl: Subject: a person performing a seated leg curl, seated on a simplified leg curl machine with thighs under the top pad, curling the ankle pad down and under with bent knees, side view.
- lying-leg-curl: Subject: a person performing a lying leg curl, lying face down on a simplified leg curl machine, heels curling the ankle pad up toward the glutes, side view.
- hip-thrust: Subject: a person performing a barbell hip thrust, upper back resting on a flat bench, feet flat on the floor, hips bridged up to full extension with a barbell across the hips, side view.
- hip-abduction: Subject: a person performing a seated hip abduction, seated on a simplified abduction machine with knees against the outer pads, pushing both legs apart, front view.
- standing-calf-raise: Subject: a person performing a standing calf raise, standing on the edge of a raised block with shoulders under machine pads, heels lifted high on the toes, side view.
- seated-calf-raise: Subject: a person performing a seated calf raise on a simplified machine, pads on the lower thighs, balls of the feet on the platform, heels raised high, side view.
- hanging-leg-raise: Subject: a person performing a hanging leg raise, hanging from a straight overhead bar with straight arms, both legs raised together straight in front to hip height forming an L shape, side view.
- cable-crunch: Subject: a person performing a kneeling cable crunch, kneeling below a high cable pulley, holding a rope attachment beside the head, crunching the torso down toward the floor, side view.
- plank: Subject: a person holding a plank position on forearms and toes, body in a straight line, side view.
- russian-twist: Subject: a person performing a Russian twist, seated on the floor leaning back with knees bent and feet lifted, holding a weight with both hands rotated to one side of the torso, three-quarter view.

## Verification (do this before finishing)

After generating each image, open it and check, in this order:

1. The figure is a full-bodied human silhouette with volumetric, natural limbs and
   torso. A stick figure (single-line limbs, circle-outline head) or any abstract
   geometric blob FAILS this check.
2. The movement is identifiable at a glance and the equipment is correct for that
   exercise.
3. Pure black strokes on a pure white background only: no gray, no shading, no
   gradients, no fill textures, no shadow. (A simple face, short hair, and light
   muscle-contour lines are allowed and do NOT fail this check.)
4. No text, labels, watermarks, or background scenery.

Regenerate any image that fails a check with the image model (up to 2 retries per
image). At the end, list the slugs that still failed verification, if any, so they
can be redone manually.
