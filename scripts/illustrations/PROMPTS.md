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
  or three existing PNGs — `goblet-squat`, `machine-chest-press`, `side-plank`
  cover a standing lift, a machine and a floor hold — as style references
  alongside the prompt. Those three are named because they are what `raw/` still
  holds: the first batch's PNGs are long gone, so pick the substitutes from the
  directory's contents, never by converting a shipped SVG back to a raster.
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
> The figure is bare-chested and wears only plain shorts and training shoes — never
> a shirt, tank top, vest or singlet. A simple neutral face and short or no hair are
> fine; light muscle-contour lines on the body are fine. No shading, no gray tones,
> no gradients, no cross-hatching or fill textures, no background, no floor line, no
> shadow, no text, no labels, no watermark. Only the figure and the equipment needed
> for the exercise, with the equipment drawn simply and not over-detailed.
> Composition centered with generous white margin, square 1024x1024.

The bare-chested sentence is an addition to the block the first 45 were drawn with.
It changes nothing about the set — those 45 came out bare-chested anyway — it only
stops the coin landing the other way. Twelve illustrations reached the app in a tank
top before this was written down, and the figure's clothing is the one thing a reader
notices across a list of thumbs.

## Subjects

One line per catalog id, in catalog order. One id deliberately shares another's
drawing rather than getting its own, because the movement is the same one:
`leg-curl` ships a copy of `lying-leg-curl`, and its line below is the shared
source's. That case is the only one — a different implement or a different angle
is a different drawing, which is why every band, machine and dumbbell variant
below has a line of its own.

Every grip value other than the axis's default is a drawing too, keyed
`<id>--<grip>` and listed under its exercise: an underhand pull-up drawn
overhand is the same lie as a wrong implement. The default grip is the one the
bare `<id>` line draws.

### Chest

- `bench-press`: Subject: a person performing a barbell bench press, lying flat on a bench with feet on the floor, pressing the barbell straight up above the chest with arms nearly extended, side view.
- `bench-press--close`: Subject: a person performing a close-grip barbell bench press, lying flat on a bench with feet on the floor, hands gripping the barbell about shoulder-width apart with the elbows tucked close to the sides, pressing the bar straight up above the chest with arms nearly extended, front three-quarter view.
- `incline-bench-press`: Subject: a person performing an incline barbell bench press, lying on a bench inclined about 40 degrees, pressing the barbell up above the upper chest, side view.
- `decline-bench-press`: Subject: a person performing a decline barbell bench press, lying on a bench declined about 20 degrees with the head lower than the hips and the ankles hooked under the leg pads at the high end, pressing the barbell straight up above the lower chest with the arms nearly extended, side view.
- `dumbbell-bench-press`: Subject: a person performing a dumbbell bench press, lying flat on a bench, pressing a dumbbell in each hand straight up above the chest, front three-quarter view.
- `incline-dumbbell-press`: Subject: a person performing an incline dumbbell bench press, lying on an inclined bench, pressing two dumbbells up above the upper chest, front three-quarter view.
- `machine-chest-press`: Subject: a person performing a machine chest press, seated upright at a simplified chest press machine, pressing the horizontal handles forward, side view.
- `incline-machine-chest-press`: Subject: a person performing an incline machine chest press, seated on a simplified plate-loaded incline press machine with the seat back reclined, both hands on the handles at chest height, pressing them forward and up, side view.
- `smith-machine-bench-press`: Subject: a person performing a Smith machine bench press, lying flat on a bench set between the two vertical guide rails of a simplified Smith machine, feet on the floor, pressing the fixed bar up off the chest along the rails with the arms nearly extended, side view.
- `machine-bench-press`: Subject: a person performing a lying machine bench press, lying face up on the flat padded bench of a simplified plate-loaded press machine with the feet on the floor, pressing two handles straight up above the chest on the machine's lever arms, side view.
- `incline-smith-machine-press`: Subject: a person performing an incline Smith machine press, lying on a bench inclined about 30 degrees set between the two vertical guide rails of a simplified Smith machine, pressing the fixed bar up above the upper chest along the rails, side view.
- `cable-fly`: Subject: a person performing a cable fly, standing between two tall cable pulley towers, leaning slightly forward, bringing the two handles together in front of the chest in a wide arc, front view.
- `dumbbell-fly`: Subject: a person performing a dumbbell fly, lying on a flat bench, arms open wide to the sides with slightly bent elbows holding a dumbbell in each hand, viewed from the head end of the bench.
- `incline-dumbbell-fly`: Subject: a person performing an incline dumbbell fly, lying on a bench inclined about 30 degrees, arms open wide to the sides with slightly bent elbows holding a dumbbell in each hand, front three-quarter view.
- `pec-deck`: Subject: a person performing a pec deck fly, seated at a simplified pec deck machine, forearms on the vertical pads, bringing the arms together in front of the chest, front view.
- `push-up`: Subject: a person performing a push-up, body rigid and straight, palms on the floor, elbows bent halfway through the rep, side view.

### Back

- `deadlift`: Subject: a person performing a conventional barbell deadlift at mid-pull, barbell at knee height, hips hinged low, back flat, arms straight, side view.
- `sumo-deadlift`: Subject: a person performing a sumo deadlift at mid-pull, feet set very wide with the toes turned out, hands gripping the barbell inside the knees, hips low, back flat, torso upright, front view.
- `trap-bar-deadlift`: Subject: a person performing a trap bar deadlift at mid-pull, standing inside a hexagonal trap bar loaded with plates on both sides, gripping the two side handles with the arms straight at the sides, hips and knees bent, back flat, chest up, side view.
- `rack-pull`: Subject: a person performing a rack pull, standing in a power rack with the loaded barbell just lifted off the safety pins set below knee height, hips hinged with a flat back and straight arms, side view.
- `deficit-deadlift`: Subject: a person performing a deficit deadlift, standing on a low raised platform a few centimetres above the floor with the barbell on the floor in front of the shins, hips hinged low with a flat back and straight arms at the start of the pull, side view.
- `snatch-grip-deadlift`: Subject: a person performing a snatch-grip deadlift at mid-pull, hands gripping the barbell very wide near the plates, barbell at knee height, hips hinged low, back flat, arms straight, front view.
- `pull-up`: Subject: a person performing a pull-up on a tall pull-up bar mounted well overhead, hanging with a wide overhand grip and the feet hanging clear of the floor with the knees bent and the ankles crossed behind, pulled up so the chin is level with the bar, front view.
- `pull-up--underhand`: Subject: a person performing a chin-up, hanging from a straight overhead bar with a narrow underhand grip, palms facing the body, chin at bar height, front view.
- `pull-up--neutral`: Subject: a person performing a neutral-grip pull-up on a tall pull-up bar mounted well overhead, both hands gripping a pair of parallel handles that stick out forward from the bar with the palms facing each other, the feet hanging clear of the floor with the knees bent and the ankles crossed behind, pulled up so the chin is level with the handles, front three-quarter view.
- `lat-pulldown`: Subject: a person performing a lat pulldown, seated at a simplified lat pulldown machine with thighs under the pads, pulling a wide bar down toward the upper chest with the cable running up to the overhead pulley, side view.
- `lat-pulldown--neutral`: Subject: a person performing a neutral-grip lat pulldown, seated at a simplified lat pulldown machine with thighs under the pads, both hands close together on a V-shaped double-D handle with the palms facing each other, pulling it down toward the upper chest with the cable running up to the overhead pulley, side view.
- `lat-pulldown--underhand`: Subject: a person performing an underhand lat pulldown, seated at a simplified lat pulldown machine with thighs under the pads, gripping a straight bar shoulder-width apart in an underhand grip with the palms turned toward the lifter's own face, pulling the bar down toward the upper chest with the elbows driving down in front of the torso and the cable running up to the overhead pulley, viewed from behind the lifter so both open palms and the insides of the forearms face the viewer with the fingers curling over the top of the bar.
- `single-arm-lat-pulldown`: Subject: a person performing a single-arm lat pulldown, seated at a simplified lat pulldown machine with the thighs under the pads, one hand pulling a single D-handle down beside the shoulder with the elbow driving toward the hip, the other hand resting on the thigh, front view.
- `machine-pulldown`: Subject: a person performing a machine pulldown, seated at a simplified plate-loaded pulldown machine with the thighs under the pads, both hands gripping handles on lever arms above the head and pulling them down to shoulder height with the elbows driving down to the sides, side view.
- `straight-arm-pulldown`: Subject: a person performing a straight-arm pulldown, standing and facing a simplified cable machine, hinged forward at the hips with both arms straight, sweeping a straight bar attachment held with an overhand grip down from overhead to the front of the thighs, side view.
- `straight-arm-pulldown--rope`: Subject: a person performing a straight-arm pulldown, standing and facing a simplified cable machine, hinged forward at the hips with both arms straight, sweeping a rope attachment down from overhead to the front of the thighs, side view.
- `dumbbell-pullover`: Subject: a person performing a dumbbell pullover, lying face up on a flat bench, both hands cupping the inner plate of a single dumbbell, arms almost straight and lowered back behind the head, side view.
- `barbell-row`: Subject: a person performing a bent-over barbell row, torso bent forward near parallel to the floor with a flat back, rowing the barbell up to the lower chest, side view.
- `seal-row`: Subject: a person performing a seal row, lying face down on a tall flat bench raised high off the floor, arms hanging straight down and rowing a barbell up to the underside of the bench, side view.
- `seated-cable-row`: Subject: a person performing a seated cable row, seated on the machine bench with knees slightly bent, feet on the platform, pulling the cable handle to the torso, simplified cable row machine, side view.
- `seated-cable-row--wide`: Subject: a person performing a wide-grip seated cable row, seated on the machine bench with knees slightly bent, feet on the platform, gripping a long straight bar attachment with an overhand grip wider than the shoulders, pulling it to the lower chest with the elbows flared out, simplified cable row machine, front three-quarter view.
- `seated-cable-row--rope`: Subject: a person performing a seated cable row with a rope attachment, seated on the machine bench with knees slightly bent, feet on the platform, one end of the rope in each hand, pulling the rope to the torso so the two ends separate beside the ribs, simplified cable row machine, side view.
- `single-arm-cable-row`: Subject: a person performing a single-arm seated cable row, seated on the bench of a simplified cable row machine with the feet on the platform, one hand pulling a single D-handle back to the side of the torso, the other hand resting on the knee, side view.
- `dumbbell-row`: Subject: a person performing a one-arm dumbbell row, one knee and one hand supported on a flat bench, the other arm rowing a dumbbell up to the hip, back flat, side view.
- `chest-supported-row`: Subject: a person performing a chest-supported dumbbell row, lying face down on a bench whose pad is thick, wide and clearly padded and is inclined about 45 degrees, the chest and stomach resting flat along the whole length of that pad and never floating above it, both feet planted on the floor behind, rowing a dumbbell in each hand up beside the ribs with both elbows driving back behind the torso, side view with the far arm and its dumbbell drawn just behind the near ones so that two separate dumbbells are visible, and the bench never drawn as a thin rail or bare tube.
- `inverted-row`: Subject: a person performing an inverted row, hanging face up under a barbell set at hip height in a rack with the heels on the floor and the body straight from heels to shoulders, pulling the chest up to the bar with an overhand grip, side view.
- `pendlay-row`: Subject: a person performing a Pendlay row, torso bent forward parallel to the floor with a flat back, rowing the barbell explosively from the floor up to the lower chest, side view.
- `t-bar-row`: Subject: a person performing a T-bar row, standing astride a barbell whose far end is anchored in a floor hinge and whose near end is loaded with plates, torso hinged forward near parallel to the floor with a flat back, both hands gripping a V-shaped double-D handle clamped under the bar just behind the plates, pulling that handle up to the chest, side view.
- `chest-supported-t-bar-row`: Subject: a person performing a chest-supported T-bar row, standing on the footplate of a simplified plate-loaded T-bar row machine with the chest against an inclined pad, gripping the handles below and rowing them up toward the chest, side view.
- `meadows-row`: Subject: a person performing a Meadows row, standing side-on to a barbell whose far end is anchored in a floor hinge and whose near end is loaded with plates, staggered stance and hinged forward, one hand gripping the end of the bar just behind the plates and rowing it up beside the hip, the other forearm resting on the front knee and that hand never touching the bar, side view.
- `machine-row`: Subject: a person performing a chest-supported machine row, seated with chest against the pad, pulling the handles back with bent elbows, side view.
- `high-row`: Subject: a person performing a machine high row, seated at a simplified plate-loaded machine with the chest against a vertical pad, both hands gripping handles mounted well above shoulder height, pulling them down and back toward the upper chest with the elbows driving behind the torso, side view.
- `low-row`: Subject: a person performing a machine low row, seated at a simplified low row machine with the chest against a vertical pad, the feet on a footplate and a weight stack behind the seat, pulling two handles at hip height back to the waist with the elbows close to the sides, side view.
- `barbell-shrug`: Subject: a person performing a barbell shrug, standing holding a barbell at thigh height with straight arms, shoulders shrugged up toward the ears, front view.
- `dumbbell-shrug`: Subject: a person performing a dumbbell shrug at the very top of the rep, standing upright holding a heavy dumbbell in each hand at the sides with the arms hanging straight, both shoulders lifted hard toward the ears so the traps bunch up and the neck is hidden between them, front view.
- `smith-machine-shrug`: Subject: a person performing a Smith machine shrug, standing between the two vertical guide rails of a simplified Smith machine, holding the fixed bar at thigh height with straight arms, shoulders shrugged up toward the ears, front view.
- `trap-bar-shrug`: Subject: a person performing a trap bar shrug, standing inside a hexagonal trap bar loaded with plates, gripping the two side handles with straight arms at the sides, shoulders shrugged up toward the ears, front view.
- `back-extension`: Subject: a person performing a back extension on a simplified 45-degree hyperextension bench, hips against the pad and ankles under the rollers, torso raised to a straight line with the legs and hands crossed on the chest, side view.

### Shoulders

- `overhead-press`: Subject: a person performing a standing barbell overhead press, the bar just above the head with arms almost extended, side view.
- `push-press`: Subject: a person performing a barbell push press, knees slightly bent at the bottom of a short dip, the barbell driving up off the front of the shoulders with the arms starting to extend overhead, side view.
- `seated-barbell-press`: Subject: a person performing a seated barbell overhead press, seated upright on a bench with a vertical back pad, pressing the barbell up overhead with the arms almost extended, side view.
- `smith-machine-shoulder-press`: Subject: a person performing a Smith machine shoulder press, seated upright on a bench with a vertical back pad set between the two guide rails of a simplified Smith machine, pressing the fixed bar up overhead from the front of the shoulders, side view.
- `landmine-press`: Subject: a person performing a single-arm landmine press, standing in a staggered stance facing a barbell whose far end is anchored in a floor hinge, one hand holding the near plate-loaded end at shoulder height and pressing it up and forward, side view.
- `machine-shoulder-press`: Subject: a person performing a machine shoulder press, seated at a simplified shoulder press machine, pressing the handles up overhead, side view.
- `seated-dumbbell-press`: Subject: a person performing a seated dumbbell shoulder press, pressing a dumbbell in each hand overhead with palms forward, front view.
- `arnold-press`: Subject: a person performing a seated Arnold press, holding two dumbbells in front of the shoulders with palms facing the body and elbows in front, starting to press upward, front three-quarter view.
- `upright-row`: Subject: a person performing a barbell upright row, standing holding a barbell with a narrow overhand grip, pulling it straight up to chest height with the elbows lifted high and wide above the hands, front view.
- `cable-upright-row`: Subject: a person performing a cable upright row, standing facing a low cable pulley, holding a straight bar attachment with a narrow overhand grip and pulling it straight up to chest height with the elbows lifted high and wide, front view.
- `front-raise`: Subject: a person performing a dumbbell front raise, standing upright with a dumbbell in each hand, the near arm raised straight out in front of the body to shoulder height with the palm facing down, the other arm hanging at the side, side view.
- `cable-front-raise`: Subject: a person performing a cable front raise, standing with the back to a low cable pulley and the cable running between the legs, both hands holding a straight bar attachment raised straight out in front to shoulder height, side view.
- `plate-front-raise`: Subject: a person performing a plate front raise, standing upright, both hands gripping the sides of a single weight plate, arms straight and raised out in front to shoulder height, side view.
- `lateral-raise`: Subject: a person performing a dumbbell lateral raise, standing, both arms raised straight out to the sides at shoulder height holding small dumbbells, front view.
- `cable-lateral-raise`: Subject: a person performing a cable lateral raise, standing upright beside a cable tower with the pulley set at floor level, the working arm the one farther from the tower so the cable runs diagonally up across the front of the body, that arm raised straight out to the side to shoulder height, the other arm hanging relaxed at the side, front view.
- `machine-lateral-raise`: Subject: a person performing a machine lateral raise, seated at a simplified lateral raise machine with the outer upper arms against the pads and the elbows bent, the pad arms pivoting level with the shoulders, lifting both elbows out sideways to shoulder height, front view.
- `band-lateral-raise`: Subject: a person performing a band lateral raise, standing with both feet on the middle of a long resistance band and one end of the band gripped in each hand, both arms raised straight out to the sides to shoulder height with the band stretched taut from the feet up to the hands, front view.
- `y-raise`: Subject: a person performing a dumbbell Y-raise, lying face down on a bench inclined about 30 degrees, both arms straight and raised up and out overhead in a Y shape holding small dumbbells with the thumbs up, front three-quarter view.
- `rear-delt-fly`: Subject: a person performing a bent-over dumbbell rear delt fly, torso bent forward near parallel to the floor with a flat back, raising a dumbbell in each hand out to the sides, side view.
- `reverse-pec-deck`: Subject: a person performing a reverse pec deck fly, seated facing the machine with chest against the pad, arms swept out wide behind the torso gripping the handles, viewed from behind.
- `cable-reverse-fly`: Subject: a person performing a cable reverse fly, standing between two simplified cable towers with the pulleys at shoulder height, each hand holding the handle from the opposite side so the cables cross in front of the chest, both arms sweeping out wide to the sides, front view.
- `band-pull-apart`: Subject: a person performing a band pull-apart, standing upright with both arms straight out in front at shoulder height, one end of a resistance band gripped in each hand, pulling the hands apart so the arms sweep out wide to the sides and the band is stretched taut across the front of the chest, front view.
- `face-pull`: Subject: a person performing a face pull, standing facing a high cable pulley, pulling a rope attachment toward the face with elbows high and wide, side view.
- `band-face-pull`: Subject: a person performing a band face pull, standing facing a resistance band anchored at head height in front, one end of the band gripped in each hand, pulling both ends toward the face with the elbows lifted high and wide and the band stretched taut, side view.

### Biceps


### "ez bar curl" moved off this entry when the EZ-bar curl became its own —


### the leg-curl precedent: the alias lands on the entry that earned it.

- `barbell-curl`: Subject: a person performing a standing barbell curl, elbows pinned at the sides, forearms at ninety degrees, side view.
- `ez-bar-curl`: Subject: a person performing a standing EZ-bar curl, gripping the angled cambered bar with palms up, elbows pinned at the sides, forearms at ninety degrees, front three-quarter view.
- `dumbbell-curl`: Subject: a person performing a standing dumbbell curl, curling a dumbbell in each hand with palms up, halfway through the rep, front view.
- `incline-dumbbell-curl`: Subject: a person performing an incline dumbbell curl, seated leaning back on an inclined bench with upper arms hanging behind the torso line, curling two dumbbells, side view.
- `hammer-curl`: Subject: a person performing a standing hammer curl, curling a dumbbell in each hand with a neutral thumbs-up grip, palms facing each other, front view.
- `concentration-curl`: Subject: a person performing a concentration curl, seated on a flat bench leaning forward, the back of the working upper arm braced against the inner thigh, curling a dumbbell up toward the shoulder, front view.
- `spider-curl`: Subject: a person performing a spider curl, lying face down on a bench inclined about 45 degrees with the chest on the pad, arms hanging straight down in front of the bench, curling a dumbbell in each hand up toward the shoulders, side view.
- `preacher-curl`: Subject: a person performing a preacher curl, seated at a preacher bench with upper arms resting on the sloped pad, curling an EZ-bar, side view.
- `dumbbell-preacher-curl`: Subject: a person performing a single-arm dumbbell preacher curl, seated at a preacher bench with the working upper arm resting on the sloped pad, curling one dumbbell up toward the shoulder, the other hand holding the top of the pad, side view.
- `cable-curl`: Subject: a person performing a cable curl, standing facing a low cable pulley, elbows at the sides, curling a bar attached to the low cable, side view.
- `cable-curl--ez`: Subject: a person performing a cable EZ-bar curl, standing facing a low cable pulley, elbows at the sides, curling an angled cambered EZ curl bar attached to the low cable with the palms up, front three-quarter view.
- `cable-curl--rope`: Subject: a person performing a cable rope hammer curl, standing facing a low cable pulley, elbows at the sides, one end of a rope attachment in each hand with a neutral thumbs-up grip, curling the rope up toward the shoulders, side view.
- `bayesian-curl`: Subject: a person performing a Bayesian cable curl, standing facing away from a low cable pulley in a staggered stance, one hand holding the only D-handle, whose cable runs back and down to the pulley behind, that upper arm angled back behind the torso and the elbow bent as the hand curls the handle up toward the shoulder, the other arm hanging relaxed at the side and holding nothing, side view.
- `machine-curl`: Subject: a person performing a machine biceps curl, seated at a simplified preacher curl machine with both upper arms resting on the angled pad, curling the handles up toward the shoulders, side view.

### Triceps

- `triceps-pushdown`: Subject: a person performing a cable triceps rope pushdown, standing at a high cable with elbows pinned at the sides, one end of a rope attachment in each hand, pushing the rope down and spreading its ends apart beside the thighs with forearms near full extension, side view.
- `triceps-pushdown--bar`: Subject: a person performing a cable triceps pushdown, standing at a high cable with elbows pinned at the sides, pushing a short bar down with forearms near full extension, side view.
- `triceps-pushdown--v-bar`: Subject: a person performing a cable triceps pushdown with a V-bar, standing at a high cable with elbows pinned at the sides, both hands on a small V-shaped bar attachment angled down from the cable, pushing it down with forearms near full extension, side view.
- `overhead-triceps-extension`: Subject: a person performing an overhead cable triceps extension, standing facing away from the cable tower and leaning slightly forward, both arms extending a rope attachment forward and overhead, side view.
- `overhead-triceps-extension--bar`: Subject: a person performing an overhead cable triceps extension with a straight bar, standing facing away from the cable tower and leaning slightly forward, both hands on a short straight bar attachment with an overhand grip, both arms extending the bar forward and overhead, side view.
- `dumbbell-overhead-extension`: Subject: a person performing a seated dumbbell overhead triceps extension, seated upright on a bench, both hands cupping the inner plate of a single dumbbell lowered behind the head, upper arms vertical beside the ears, elbows bent, side view.
- `ez-bar-overhead-extension`: Subject: a person performing a seated EZ-bar overhead triceps extension, seated upright on a bench, both hands holding an EZ curl bar lowered behind the head, upper arms vertical beside the ears, elbows bent, side view.
- `skull-crusher`: Subject: a person performing a skull crusher, lying flat on a bench with the knees bent and both feet planted on the floor, both upper arms held straight up vertical and perpendicular to the floor, elbows bent so a plate-loaded EZ-bar is lowered to just above the forehead, side view.
- `jm-press`: Subject: a person performing a JM press, lying flat on a bench holding a barbell with a close grip, elbows bent and pointing toward the feet as the bar lowers toward the upper chest and chin, side view.
- `triceps-kickback`: Subject: a person performing a dumbbell triceps kickback, one knee and one hand supported on a flat bench with the torso near parallel to the floor, the working upper arm held tight along the side and the forearm extended straight back holding a dumbbell, side view.
- `cable-triceps-kickback`: Subject: a person performing a cable triceps kickback, bent forward at the hips facing a low cable pulley, the working upper arm held tight along the side and the forearm extended straight back holding a single D-handle, the other hand on the machine frame, side view.
- `dip`: Subject: a person performing a triceps dip on parallel bars, torso upright, elbows bent behind the body, legs hanging straight down, side view.
- `dip--forward`: Subject: a person performing a chest dip on parallel bars, torso leaning well forward, elbows bent and flared slightly out, knees bent with the feet crossed behind, side view.
- `machine-dip`: Subject: a person performing a seated machine dip, seated upright in a simplified seated dip machine with the back against the pad, gripping the two handles beside the hips and pushing them down until the arms are straight, side view.
- `bench-dip`: Subject: a person performing a bench dip, hands on the edge of a flat bench behind the hips with the fingers forward, legs extended straight in front with the heels on the floor, elbows bent to lower the hips below the bench, side view.

### Forearms

- `wrist-curl`: Subject: a person performing a seated barbell wrist curl, seated on a bench with the forearms resting on the thighs and the palms up, hands hanging past the knees, curling the barbell up with the wrists only, side view.
- `dumbbell-wrist-curl`: Subject: a person performing a dumbbell wrist curl, seated on a flat bench with the forearms resting on the thighs, palms up and wrists just past the knees, curling a dumbbell in each hand up with the wrists alone, side view.
- `reverse-wrist-curl`: Subject: a person performing a reverse wrist curl, seated on a flat bench with the forearms resting on the thighs, palms down and wrists just past the knees, lifting a barbell with the wrists alone, side view.
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
- `sit-up`: Subject: a person performing a sit-up, lying on the floor with the knees bent and the feet flat, hands behind the head, torso raised up off the floor toward the knees, side view.
- `decline-sit-up`: Subject: a person performing a decline sit-up on a simplified decline bench with the ankles hooked under the pads at the high end, hands crossed on the chest, torso raised up off the bench toward the knees, side view.
- `ab-wheel-rollout`: Subject: a person performing an ab wheel rollout, kneeling on the floor gripping a small wheel with both hands, arms extended forward and the torso lowered near parallel to the floor with a flat back, side view.
- `russian-twist`: Subject: a person performing a Russian twist, seated on the floor leaning back with knees bent and feet lifted, holding a weight with both hands rotated to one side of the torso, three-quarter view.
- `dead-bug`: Subject: a person performing a dead bug, lying face up on the floor, one arm extended straight back overhead and the opposite leg extended straight out just above the floor, the other arm pointing straight up and the other knee bent over the hip, side view.
- `cable-crunch`: Subject: a person performing a kneeling cable crunch, kneeling below a high cable pulley, holding a rope attachment beside the head, crunching the torso down toward the floor, side view.
- `machine-ab-crunch`: Subject: a person performing a machine ab crunch, seated in a simplified abdominal crunch machine with the hips staying back in the seat and the lower back against the pad, both hands gripping the handles beside the head with the elbows pointing down and forward, the torso curling forward and down so the ribs come toward the hips and the stomach visibly compresses into a rounded crunch, side view.
- `pallof-press`: Subject: a person performing a Pallof press, standing side-on to a cable tower with the pulley at chest height and the feet shoulder-width apart, both hands holding a single D-handle pressed straight out in front of the chest against the cable's sideways pull, front view.
- `cable-woodchop`: Subject: a person performing a cable woodchop, standing side-on to a tall cable tower, both hands on a single D-handle pulled diagonally down across the body from high on the tower side to low beside the far hip, the torso rotating, front view.
- `hanging-leg-raise`: Subject: a person performing a hanging leg raise, hanging from a straight overhead bar with straight arms, both legs raised together straight in front to hip height forming an L shape, side view.
- `lying-leg-raise`: Subject: a person performing a lying leg raise, lying face up on the floor with the hands at the sides, legs straight and together raised to vertical above the hips, side view.

### Quads

- `squat`: Subject: a person performing a barbell back squat, at the bottom of the squat, barbell resting behind the neck across the upper traps, hands gripping the bar behind the shoulders, thighs parallel to the ground, chest up, side view.
- `front-squat`: Subject: a person performing a barbell front squat, at the bottom of the squat, barbell racked in front across the front of the shoulders with elbows lifted high, thighs parallel to the ground, side view.
- `goblet-squat`: Subject: a person performing a goblet squat, at the bottom of the squat, holding a single kettlebell against the chest with both hands under the horns, elbows tucked inside the knees, chest up, front three-quarter view.
- `smith-machine-squat`: Subject: a person performing a Smith machine squat, at the bottom of the squat, the fixed bar resting behind the neck across the upper traps and running on the vertical guide rails of a simplified Smith machine, thighs parallel to the ground, strict side view with the figure in full profile facing the edge of the frame, one shoulder and one hip visible, never a three-quarter or angled view.
- `hack-squat`: Subject: a person performing a hack squat on a simplified hack squat machine, back against the angled pad, shoulders under the pads, feet on the inclined platform, knees bent mid-squat, side view.
- `belt-squat`: Subject: a person performing a belt squat, standing on the raised platform of a simplified belt squat machine with a hip belt strapped to the machine's lever below, hands on the front rails, squatting down with the torso upright, side view.
- `pendulum-squat`: Subject: a person performing a pendulum squat, standing on the angled footplate of a simplified pendulum squat machine with the shoulders under the pads and the back against a pad that swings on an arc, squatting deep with the knees well forward, side view.
- `box-squat`: Subject: a person performing a barbell box squat, a barbell across the upper back, sitting back onto a low box behind the hips with the shins near vertical and the torso leaning slightly forward, side view.
- `safety-bar-squat`: Subject: a person performing a safety squat bar squat, a cambered yoke bar with padded shoulder pieces and two forward handles resting across the upper back, both hands holding the handles in front, squatting down to parallel, side view.
- `sissy-squat`: Subject: a person performing a sissy squat, up on the toes with one hand holding an upright post for balance, knees driven far forward and the body leaning back in a straight line from knees to head, side view.
- `leg-press`: Subject: a person performing a leg press, seated reclined in a simplified leg press machine, feet on the sled plate, knees bent at 90 degrees, side view.
- `horizontal-leg-press`: Subject: a person performing a horizontal leg press, seated upright on a simplified selectorized leg press machine with the back against the pad, feet on a vertical footplate in front, pressing it away until the legs are almost straight, side view.
- `single-leg-press`: Subject: a person performing a single-leg leg press, seated reclined in a simplified 45-degree leg press machine, one foot in the middle of the sled plate pressing it up, the other leg bent and resting off the plate, side view.
- `leg-extension`: Subject: a person performing a leg extension, seated on a simplified leg extension machine with shins behind the ankle pad, extending both legs straight out, side view.
- `bulgarian-split-squat`: Subject: a person performing a Bulgarian split squat, rear foot resting on a bench behind, front knee bent deep, a dumbbell in each hand at the sides, side view.
- `step-up`: Subject: a person performing a dumbbell step-up, one foot planted flat on a knee-high box with that knee bent and driving the body upward, the trailing foot still on the floor behind, torso upright with a dumbbell hanging in each hand at the sides, side view.
- `lunge`: Subject: a person performing a walking lunge mid-step, front knee bent at ninety degrees, rear knee just above the floor, torso upright, a dumbbell in each hand, side view.

### Hamstrings

- `romanian-deadlift`: Subject: a person performing a Romanian deadlift, standing hip hinge with only a slight knee bend, hips pushed far back, flat back, barbell lowered along the thighs to just above the knees, side view.
- `dumbbell-romanian-deadlift`: Subject: a person performing a dumbbell Romanian deadlift, standing hip hinge with only a slight knee bend, hips pushed far back, flat back, a dumbbell in each hand lowered along the front of the thighs to just below the knees, side view.
- `single-leg-romanian-deadlift`: Subject: a person performing a single-leg Romanian deadlift, standing on one leg with a slight knee bend, hinged forward at the hips with a flat back, the free leg extended straight back in line with the torso, a dumbbell hanging from the opposite hand, side view.
- `good-morning`: Subject: a person performing a barbell good morning, barbell resting behind the neck across the upper traps, torso hinged forward near parallel to the floor with a flat back and a slight knee bend, side view.

### The parent kept its slug when the bench angles were split out, because a


### slug is never deleted and this one carries every leg curl logged before


### the split. Its positional aliases moved to the entries that earned them:


### "seated leg curl" typed at the search box must land on the seated entry,


### not back here on the row that cannot say which machine it was.

- `leg-curl`: Subject: a person performing a lying leg curl, lying face down on a simplified leg curl machine, heels curling the ankle pad up toward the glutes, side view.
- `seated-leg-curl`: Subject: a person performing a seated leg curl, seated on a simplified leg curl machine with thighs under the top pad, curling the ankle pad down and under with bent knees, side view.
- `lying-leg-curl`: Subject: a person performing a lying leg curl, lying face down on a simplified leg curl machine, heels curling the ankle pad up toward the glutes, side view.
- `nordic-curl`: Subject: a person performing a Nordic curl, kneeling on a pad with the ankles held down behind by a fixed bar, the body straight from knees to head and leaning forward under control, hands ready in front of the chest, side view.
- `glute-ham-raise`: Subject: a person performing a glute-ham raise on a simplified glute-ham developer, thighs on the rounded pad and the ankles locked between the rollers behind, body straight from knees to head and raised up to vertical by curling the heels, side view.

### Glutes

- `hip-thrust`: Subject: a person performing a barbell hip thrust, upper back resting on a flat bench, feet flat on the floor, hips bridged up to full extension with a barbell across the hips, side view.
- `machine-hip-thrust`: Subject: a person performing a machine hip thrust, upper back against the pad of a simplified plate-loaded hip thrust machine with a padded lever across the hips, feet flat on the platform, hips bridged up to full extension, side view.
- `smith-machine-hip-thrust`: Subject: a person performing a Smith machine hip thrust, upper back on a flat bench placed between the two vertical guide rails of a simplified Smith machine, the fixed bar across the hips, feet flat on the floor, hips bridged up to full extension, side view.
- `glute-bridge`: Subject: a person performing a barbell glute bridge, lying face up on the floor with the knees bent and the feet flat, a barbell across the hips, hips bridged up so the body is straight from knees to shoulders, side view.
- `hip-abduction`: Subject: a person performing a seated hip abduction, seated on a simplified abduction machine with knees against the outer pads, pushing both legs apart, front view.
- `hip-adduction`: Subject: a person performing a seated hip adduction, seated on a simplified adduction machine with the knees spread wide against the inner pads, squeezing both legs together toward the midline, front view.
- `kettlebell-swing`: Subject: a person performing a kettlebell swing at the top of the swing, standing tall with the hips fully extended, both arms straight out in front at chest height gripping a single cast-iron kettlebell — a round ball-shaped weight with a flat base and a thick inverted-U loop handle across its top, both hands side by side inside the loop, the ball hanging below the hands — side view.
- `glute-kickback`: Subject: a person performing a cable glute kickback, standing facing a low cable pulley and leaning slightly forward with both hands on the machine frame, an ankle strap on one foot driving that leg straight back and up behind the body, side view.
- `machine-glute-kickback`: Subject: a person performing a machine glute kickback, forearms and chest on the pads of a simplified glute kickback machine, one foot pressing a footplate lever back and up behind the body until the leg is straight, side view.
- `cable-pull-through`: Subject: a person performing a cable pull-through, standing facing away from a low cable pulley with the feet wide, both hands holding a rope attachment between the legs with straight arms, hips hinged back with a flat back, side view.
- `reverse-hyper`: Subject: a person performing a reverse hyperextension, lying face down on the top pad of a simplified reverse hyper machine with the hips at its edge and the hands on the front handles, legs together and swung straight back and up level with the torso, side view.

### Calves

- `standing-calf-raise`: Subject: a person performing a standing calf raise, standing on the edge of a raised block with shoulders under machine pads, heels lifted high on the toes, side view.
- `single-leg-calf-raise`: Subject: a person performing a single-leg calf raise, standing on one foot on the edge of a raised step holding a dumbbell in the same-side hand and the other hand on a rail, heel raised high on the toes, the free foot hooked behind the working ankle, side view.
- `donkey-calf-raise`: Subject: a person performing a donkey calf raise on a simplified donkey calf raise machine, bent forward at the hips with the forearms on the front pad and the hip pad across the lower back, balls of the feet on the block, heels raised high, side view.
- `seated-calf-raise`: Subject: a person performing a seated calf raise on a simplified machine, pads on the lower thighs, balls of the feet on the platform, heels raised high, side view.
- `calf-press`: Subject: a person performing a calf press on a simplified leg press machine, seated reclined with the legs straight and locked out, only the balls of the feet touching the sled plate with the heels dropped well below the toes and the ankles pushed hard into a pointed-toe position, side view.
