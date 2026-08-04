# Exercise illustrations

Every catalog entry's line-art thumb starts here. One PNG per id from an image
model, then `trace.ts` turns it into the `static/illustrations/<id>.svg` the app
ships. This file is the model's half: the style block that makes the set look
like one set, and one `Subject:` line per catalog id.

## Hard rules

- **Every image comes from the image model.** Never hand-author an SVG, never
  draw one programmatically, never substitute generated geometry for a render.
  An image that fails verification gets regenerated, not patched by hand. A
  slug that keeps failing is reported as failed and left without art — a
  missing illustration is a state the app already handles, a wrong one is a lie
  about how the movement is performed.
- **The style block is passed verbatim**, followed by that id's `Subject:` line,
  also verbatim. Do not paraphrase, shorten, merge or rewrite either half. The
  45 illustrations that shipped first were made this way; the block is the only
  thing holding the set together across separate runs and separate models.
- **Attach references.** The set was originally drawn by a different model than
  the one running now, so words alone no longer guarantee the match. Pass two
  or three existing PNGs — `squat`, `cable-fly`, `plank` cover a standing lift,
  a machine and a floor hold — as style references alongside the prompt.
- **Never tune `trace.ts` to rescue a bad PNG.** Its options define the whole
  catalog's look; a threshold nudged for one drawing re-renders every other.
  Fix the drawing.

## Running it

Generation is Codex's built-in `image_gen` tool (gpt-image-2) — the same tool
that made the original set. It needs no `OPENAI_API_KEY`; the CLI fallback in
Codex's imagegen skill is a different, older model and is not what this set was
drawn with.

For each id: generate 3 attempts, run the verification list below against each,
copy the best into `raw/<id>.png`. Then `bun run illustrations:trace`, which
converts everything sitting in `raw/` and writes the SVGs.

`raw/` is not committed — the PNGs are megabytes each and the model can make
them again. The SVGs are the artefact; this file is how you get back to them.

### Verification

Check each attempt in this order, and regenerate any that fails (up to 2
retries):

1. The figure is a full-bodied human silhouette with volumetric, natural limbs
   and torso. A stick figure — single-line limbs, circle-outline head — or any
   abstract geometric blob fails.
2. The movement is identifiable at a glance and the equipment is correct for
   that exercise.
3. Pure black strokes on a pure white background: no gray, no shading, no
   gradients, no fill textures, no shadow. A simple face, short hair and light
   muscle-contour lines are allowed and do not fail this check.
4. No text, labels, watermarks or background scenery.

## Style block

Passed verbatim, identical for every id:

> Clean black line-art illustration, bold uniform stroke weight, pure solid black
> lines on a pure white background, coloring-book style. A single full-bodied human
> figure with volumetric, anatomically natural limbs and torso, NOT a stick figure.
> A simple neutral face and short or no hair are fine; light muscle-contour lines on
> the body are fine. No shading, no gray tones, no gradients, no cross-hatching or
> fill textures, no background, no floor line, no shadow, no text, no labels, no
> watermark. Only the figure and the equipment needed for the exercise, with the
> equipment drawn simply and not over-detailed. Composition centered with generous
> white margin, square 1024x1024.

## Subjects

One line per catalog id, in catalog order. Two ids deliberately share another's
drawing rather than getting their own, because the movement is the same one:
`wide-grip-lat-pulldown` ships a copy of `lat-pulldown`, and `leg-curl` ships a
copy of `lying-leg-curl`. Their lines below are the shared source's.

### Chest

- `bench-press`: Subject: a person performing a barbell bench press, lying flat on a bench with feet on the floor, pressing the barbell straight up above the chest with arms nearly extended, side view.
- `close-grip-bench-press`: Subject: a person performing a close-grip barbell bench press, lying on a flat bench, hands close together on the bar and elbows tucked along the torso, side view.
- `incline-bench-press`: Subject: a person performing an incline barbell bench press, lying on a bench inclined about 40 degrees, pressing the barbell up above the upper chest, side view.
- `dumbbell-bench-press`: Subject: a person performing a dumbbell bench press, lying flat on a bench, pressing a dumbbell in each hand straight up above the chest, front three-quarter view.
- `incline-dumbbell-press`: Subject: a person performing an incline dumbbell bench press, lying on an inclined bench, pressing two dumbbells up above the upper chest, front three-quarter view.
- `machine-chest-press`: Subject: a person performing a machine chest press, seated upright at a simplified chest press machine, pressing the horizontal handles forward, side view.
- `smith-machine-bench-press`: Subject: a person performing a Smith machine bench press, lying flat on a bench set inside a simplified Smith machine, pressing the fixed bar straight up along the vertical guide rails above the chest, side view.
- `cable-fly`: Subject: a person performing a cable fly, standing between two tall cable pulley towers, leaning slightly forward, bringing the two handles together in front of the chest in a wide arc, front view.
- `dumbbell-fly`: Subject: a person performing a dumbbell fly, lying on a flat bench, arms open wide to the sides with slightly bent elbows holding a dumbbell in each hand, viewed from the head end of the bench.
- `pec-deck`: Subject: a person performing a pec deck fly, seated at a simplified pec deck machine, forearms on the vertical pads, bringing the arms together in front of the chest, front view.
- `push-up`: Subject: a person performing a push-up, body rigid and straight, palms on the floor, elbows bent halfway through the rep, side view.

### Back

- `deadlift`: Subject: a person performing a conventional barbell deadlift at mid-pull, barbell at knee height, hips hinged low, back flat, arms straight, side view.
- `sumo-deadlift`: Subject: a person performing a sumo deadlift at mid-pull, feet set very wide with the toes turned out, hands gripping the barbell inside the knees, hips low, back flat, torso upright, front view.
- `pull-up`: Subject: a person performing a pull-up, hanging from a straight overhead bar with a wide overhand grip, chin near bar height, knees slightly bent, front view.
- `chin-up`: Subject: a person performing a chin-up, hanging from a straight overhead bar with a narrow underhand grip, palms facing the body, chin at bar height, front view.
- `lat-pulldown`: Subject: a person performing a lat pulldown, seated at a simplified lat pulldown machine with thighs under the pads, pulling a wide bar down toward the upper chest with the cable running up to the overhead pulley, side view.
- `close-grip-lat-pulldown`: Subject: a person performing a close-grip lat pulldown, seated at a simplified lat pulldown machine, pulling a narrow neutral-grip handle down to the chest, side view.
- `wide-grip-lat-pulldown`: Subject: a person performing a lat pulldown, seated at a simplified lat pulldown machine with thighs under the pads, pulling a wide bar down toward the upper chest with the cable running up to the overhead pulley, side view.
- `barbell-row`: Subject: a person performing a bent-over barbell row, torso bent forward near parallel to the floor with a flat back, rowing the barbell up to the lower chest, side view.
- `seated-cable-row`: Subject: a person performing a seated cable row, seated on the machine bench with knees slightly bent, feet on the platform, pulling the cable handle to the torso, simplified cable row machine, side view.
- `dumbbell-row`: Subject: a person performing a one-arm dumbbell row, one knee and one hand supported on a flat bench, the other arm rowing a dumbbell up to the hip, back flat, side view.
- `pendlay-row`: Subject: a person performing a Pendlay row, torso bent forward parallel to the floor with a flat back, rowing the barbell explosively from the floor up to the lower chest, side view.
- `t-bar-row`: Subject: a person performing a T-bar row, standing astride the handle anchored at the floor, torso hinged forward, pulling the handle up to the chest, side view.
- `machine-row`: Subject: a person performing a chest-supported machine row, seated with chest against the pad, pulling the handles back with bent elbows, side view.
- `barbell-shrug`: Subject: a person performing a barbell shrug, standing holding a barbell at thigh height with straight arms, shoulders shrugged up toward the ears, front view.
- `back-extension`: Subject: a person performing a back extension on a simplified 45-degree hyperextension bench, hips against the pad and ankles under the rollers, torso raised to a straight line with the legs and hands crossed on the chest, side view.

### Shoulders

- `overhead-press`: Subject: a person performing a standing barbell overhead press, the bar just above the head with arms almost extended, side view.
- `machine-shoulder-press`: Subject: a person performing a machine shoulder press, seated at a simplified shoulder press machine, pressing the handles up overhead, side view.
- `seated-dumbbell-press`: Subject: a person performing a seated dumbbell shoulder press, pressing a dumbbell in each hand overhead with palms forward, front view.
- `arnold-press`: Subject: a person performing a seated Arnold press, holding two dumbbells in front of the shoulders with palms facing the body and elbows in front, starting to press upward, front three-quarter view.
- `upright-row`: Subject: a person performing a barbell upright row, standing holding a barbell with a narrow overhand grip, pulling it straight up to chest height with the elbows lifted high and wide above the hands, front view.
- `lateral-raise`: Subject: a person performing a dumbbell lateral raise, standing, both arms raised straight out to the sides at shoulder height holding small dumbbells, front view.
- `cable-lateral-raise`: Subject: a person performing a cable lateral raise, standing beside a low cable pulley, one arm raising the handle out to the side to shoulder height with the cable running diagonally down to the pulley, front view.
- `rear-delt-fly`: Subject: a person performing a bent-over dumbbell rear delt fly, torso bent forward near parallel to the floor with a flat back, raising a dumbbell in each hand out to the sides, side view.
- `reverse-pec-deck`: Subject: a person performing a reverse pec deck fly, seated facing the machine with chest against the pad, arms swept out wide behind the torso gripping the handles, viewed from behind.
- `face-pull`: Subject: a person performing a face pull, standing facing a high cable pulley, pulling a rope attachment toward the face with elbows high and wide, side view.

### Biceps


### "ez bar curl" moved off this entry when the EZ-bar curl became its own —


### the leg-curl precedent: the alias lands on the entry that earned it.

- `barbell-curl`: Subject: a person performing a standing barbell curl, elbows pinned at the sides, forearms at ninety degrees, side view.
- `ez-bar-curl`: Subject: a person performing a standing EZ-bar curl, gripping the angled cambered bar with palms up, elbows pinned at the sides, forearms at ninety degrees, front three-quarter view.
- `dumbbell-curl`: Subject: a person performing a standing dumbbell curl, curling a dumbbell in each hand with palms up, halfway through the rep, front view.
- `incline-dumbbell-curl`: Subject: a person performing an incline dumbbell curl, seated leaning back on an inclined bench with upper arms hanging behind the torso line, curling two dumbbells, side view.
- `hammer-curl`: Subject: a person performing a standing hammer curl, curling a dumbbell in each hand with a neutral thumbs-up grip, palms facing each other, front view.
- `preacher-curl`: Subject: a person performing a preacher curl, seated at a preacher bench with upper arms resting on the sloped pad, curling an EZ-bar, side view.
- `cable-curl`: Subject: a person performing a cable curl, standing facing a low cable pulley, elbows at the sides, curling a bar attached to the low cable, side view.

### Triceps

- `triceps-pushdown`: Subject: a person performing a cable triceps pushdown, standing at a high cable with elbows pinned at the sides, pushing a short bar down with forearms near full extension, side view.
- `overhead-triceps-extension`: Subject: a person performing an overhead cable triceps extension, standing facing away from the cable tower and leaning slightly forward, both arms extending a rope attachment forward and overhead, side view.
- `skull-crusher`: Subject: a person performing a skull crusher, lying on a flat bench with upper arms vertical, elbows bent lowering an EZ-bar toward the forehead, side view.
- `dip`: Subject: a person performing a triceps dip on parallel bars, torso upright, elbows bent behind the body, legs hanging straight down, side view.

### Forearms

- `wrist-curl`: Subject: a person performing a seated barbell wrist curl, seated on a bench with the forearms resting on the thighs and the palms up, hands hanging past the knees, curling the barbell up with the wrists only, side view.
- `reverse-curl`: Subject: a person performing a standing reverse curl, gripping an EZ-bar with palms facing down in an overhand grip, elbows pinned at the sides, forearms at ninety degrees, front three-quarter view.

### Logged as weight × reps like everything else — one trip is a rep, and the


### weight is one implement's, hence per-hand.

- `farmers-carry`: Subject: a person performing a farmer's carry, walking upright mid-stride with a heavy dumbbell hanging in each hand at the sides, arms straight, shoulders back, side view.

### Core

- `plank`: Subject: a person holding a plank position on forearms and toes, body in a straight line, side view.
- `side-plank`: Subject: a person holding a side plank position, supported on one forearm and the side of one foot, body in a straight line with the hips lifted, the free arm resting along the side of the body, side view.

### "sit-up" is deliberately not an alias: a sit-up is a different movement,


### and an alias that lands on the wrong entry is search lying.

- `crunch`: Subject: a person performing a crunch, lying on the floor with knees bent and feet flat, hands beside the head, shoulder blades lifted a short way off the floor, side view.
- `ab-wheel-rollout`: Subject: a person performing an ab wheel rollout, kneeling on the floor gripping a small wheel with both hands, arms extended forward and the torso lowered near parallel to the floor with a flat back, side view.
- `russian-twist`: Subject: a person performing a Russian twist, seated on the floor leaning back with knees bent and feet lifted, holding a weight with both hands rotated to one side of the torso, three-quarter view.
- `cable-crunch`: Subject: a person performing a kneeling cable crunch, kneeling below a high cable pulley, holding a rope attachment beside the head, crunching the torso down toward the floor, side view.
- `hanging-leg-raise`: Subject: a person performing a hanging leg raise, hanging from a straight overhead bar with straight arms, both legs raised together straight in front to hip height forming an L shape, side view.

### Quads

- `squat`: Subject: a person performing a barbell back squat, at the bottom of the squat, barbell resting behind the neck across the upper traps, hands gripping the bar behind the shoulders, thighs parallel to the ground, chest up, side view.
- `front-squat`: Subject: a person performing a barbell front squat, at the bottom of the squat, barbell racked in front across the front of the shoulders with elbows lifted high, thighs parallel to the ground, side view.
- `goblet-squat`: Subject: a person performing a goblet squat, at the bottom of the squat, holding a single kettlebell against the chest with both hands under the horns, elbows tucked inside the knees, chest up, front three-quarter view.
- `smith-machine-squat`: Subject: a person performing a Smith machine squat, at the bottom of the squat, the fixed bar resting behind the neck across the upper traps and running on the vertical guide rails of a simplified Smith machine, thighs parallel to the ground, strict side view with the figure in full profile facing the edge of the frame, one shoulder and one hip visible, never a three-quarter or angled view.
- `hack-squat`: Subject: a person performing a hack squat on a simplified hack squat machine, back against the angled pad, shoulders under the pads, feet on the inclined platform, knees bent mid-squat, side view.
- `leg-press`: Subject: a person performing a leg press, seated reclined in a simplified leg press machine, feet on the sled plate, knees bent at 90 degrees, side view.
- `leg-extension`: Subject: a person performing a leg extension, seated on a simplified leg extension machine with shins behind the ankle pad, extending both legs straight out, side view.
- `bulgarian-split-squat`: Subject: a person performing a Bulgarian split squat, rear foot resting on a bench behind, front knee bent deep, a dumbbell in each hand at the sides, side view.
- `lunge`: Subject: a person performing a walking lunge mid-step, front knee bent at ninety degrees, rear knee just above the floor, torso upright, a dumbbell in each hand, side view.

### Hamstrings

- `romanian-deadlift`: Subject: a person performing a Romanian deadlift, standing hip hinge with only a slight knee bend, hips pushed far back, flat back, barbell lowered along the thighs to just above the knees, side view.
- `dumbbell-romanian-deadlift`: Subject: a person performing a dumbbell Romanian deadlift, standing hip hinge with only a slight knee bend, hips pushed far back, flat back, a dumbbell in each hand lowered along the front of the thighs to just below the knees, side view.
- `good-morning`: Subject: a person performing a barbell good morning, barbell resting behind the neck across the upper traps, torso hinged forward near parallel to the floor with a flat back and a slight knee bend, side view.

### The parent kept its slug when the bench angles were split out, because a


### slug is never deleted and this one carries every leg curl logged before


### the split. Its positional aliases moved to the entries that earned them:


### "seated leg curl" typed at the search box must land on the seated entry,


### not back here on the row that cannot say which machine it was.

- `leg-curl`: Subject: a person performing a lying leg curl, lying face down on a simplified leg curl machine, heels curling the ankle pad up toward the glutes, side view.
- `seated-leg-curl`: Subject: a person performing a seated leg curl, seated on a simplified leg curl machine with thighs under the top pad, curling the ankle pad down and under with bent knees, side view.
- `lying-leg-curl`: Subject: a person performing a lying leg curl, lying face down on a simplified leg curl machine, heels curling the ankle pad up toward the glutes, side view.

### Glutes

- `hip-thrust`: Subject: a person performing a barbell hip thrust, upper back resting on a flat bench, feet flat on the floor, hips bridged up to full extension with a barbell across the hips, side view.
- `hip-abduction`: Subject: a person performing a seated hip abduction, seated on a simplified abduction machine with knees against the outer pads, pushing both legs apart, front view.
- `kettlebell-swing`: Subject: a person performing a kettlebell swing at the top of the swing, standing tall with the hips fully extended, both arms straight out in front at chest height gripping a single cast-iron kettlebell — a round ball-shaped weight with a flat base and a thick inverted-U loop handle across its top, both hands side by side inside the loop, the ball hanging below the hands — side view.
- `glute-kickback`: Subject: a person performing a cable glute kickback, standing facing a low cable pulley and leaning slightly forward with both hands on the machine frame, an ankle strap on one foot driving that leg straight back and up behind the body, side view.

### Calves

- `standing-calf-raise`: Subject: a person performing a standing calf raise, standing on the edge of a raised block with shoulders under machine pads, heels lifted high on the toes, side view.
- `seated-calf-raise`: Subject: a person performing a seated calf raise on a simplified machine, pads on the lower thighs, balls of the feet on the platform, heels raised high, side view.
- `calf-press`: Subject: a person performing a calf press on a simplified leg press machine, seated reclined with the legs straight and locked out, only the balls of the feet touching the sled plate with the heels dropped well below the toes and the ankles pushed hard into a pointed-toe position, side view.
