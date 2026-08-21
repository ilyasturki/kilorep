import type { Exercise } from '$lib/domain/exercise';

export const catalog: Exercise[] = [
	{
		id: 'bench-press',
		name: 'Bench Press',
		aliases: ['bp', 'flat bench', 'flat bench press', 'barbell bench press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] }
	},
	{
		id: 'close-grip-bench-press',
		name: 'Close-Grip Bench Press',
		aliases: ['cgbp', 'close grip bench', 'narrow grip bench press', 'cg bench press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] },
		variantOf: 'bench-press'
	},
	{
		id: 'incline-bench-press',
		name: 'Incline Bench Press',
		aliases: ['incline barbell press', 'incline barbell bench press', 'incline press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		variantOf: 'bench-press'
	},
	{
		id: 'decline-bench-press',
		name: 'Decline Bench Press',
		aliases: ['decline barbell bench press', 'decline bench', 'decline press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps'] },
		variantOf: 'bench-press'
	},
	{
		id: 'dumbbell-bench-press',
		name: 'Dumbbell Bench Press',
		aliases: [
			'db bench',
			'dumbbell press',
			'db bench press',
			'db press',
			'flat dumbbell press',
			'dumbbell chest press'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] }
	},
	{
		id: 'incline-dumbbell-press',
		name: 'Incline DB Press',
		aliases: [
			'incline dumbbell press',
			'incline dumbbell bench press',
			'incline db bench press',
			'incline press'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		variantOf: 'dumbbell-bench-press'
	},
	{
		id: 'machine-chest-press',
		name: 'Machine Chest Press',
		aliases: [
			'chest press',
			'chest press machine',
			'seated chest press',
			'machine bench press',
			'hammer strength chest press'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		variantOf: 'bench-press'
	},
	{
		id: 'incline-machine-chest-press',
		name: 'Incline Machine Press',
		aliases: [
			'incline machine chest press',
			'incline chest press machine',
			'seated incline chest press'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		variantOf: 'bench-press'
	},
	{
		id: 'smith-machine-bench-press',
		name: 'Smith Machine Bench Press',
		aliases: ['smith bench', 'smith bench press', 'smith press'],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		variantOf: 'bench-press'
	},
	{
		id: 'cable-fly',
		name: 'Cable Fly',
		aliases: ['cable crossover', 'crossover', 'cable chest fly', 'standing cable fly'],
		equipment: 'Cable',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: [] }
	},
	{
		id: 'dumbbell-fly',
		name: 'Dumbbell Fly',
		aliases: ['db fly', 'chest fly', 'flyes', 'db flyes', 'dumbbell flyes', 'pec fly'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: [] }
	},
	{
		id: 'pec-deck',
		name: 'Pec Deck',
		aliases: ['butterfly', 'chest fly machine', 'machine fly', 'butterfly machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: [] }
	},
	{
		id: 'push-up',
		name: 'Push-Up',
		aliases: ['pushup', 'press up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.65,
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders', 'Core'] }
	},

	{
		id: 'deadlift',
		name: 'Deadlift',
		aliases: ['dl', 'conventional deadlift', 'barbell deadlift', 'deads'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings', 'Forearms', 'Core'] }
	},
	{
		id: 'sumo-deadlift',
		name: 'Sumo Deadlift',
		aliases: ['sumo', 'sumo dl', 'wide stance deadlift'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings', 'Back', 'Quads'] },
		variantOf: 'deadlift'
	},
	{
		id: 'pull-up',
		name: 'Pull-Up',
		aliases: ['pullup', 'overhand pull up', 'wide grip pull up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'chin-up',
		name: 'Chin-Up',
		aliases: ['chinup', 'supinated pull up', 'underhand pull up', 'reverse grip pull up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		variantOf: 'pull-up'
	},
	{
		id: 'lat-pulldown',
		name: 'Lat Pulldown',
		aliases: ['pulldown', 'lat pull down', 'front pulldown', 'cable pulldown'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] }
	},
	{
		id: 'close-grip-lat-pulldown',
		name: 'Close-Grip Lat Pulldown',
		aliases: [
			'close grip pulldown',
			'neutral grip pulldown',
			'narrow grip pulldown',
			'v bar pulldown'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		variantOf: 'lat-pulldown'
	},
	{
		id: 'wide-grip-lat-pulldown',
		name: 'Wide-Grip Lat Pulldown',
		aliases: ['wide grip pulldown', 'wide pulldown', 'wide grip pull down'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		variantOf: 'lat-pulldown'
	},
	{
		id: 'barbell-row',
		name: 'Barbell Row',
		aliases: ['bent over row', 'bor', 'bb row', 'bent row', 'bent over barbell row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'seated-cable-row',
		name: 'Seated Cable Row',
		aliases: ['cable row', 'low row', 'seated row'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] }
	},
	{
		id: 'dumbbell-row',
		name: 'Dumbbell Row',
		aliases: ['one arm row', 'db row', 'single arm row', 'one arm dumbbell row', 'db one arm row'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'chest-supported-row',
		name: 'Chest-Supported Row',
		aliases: [
			'incline bench row',
			'incline dumbbell row',
			'incline db row',
			'chest supported dumbbell row',
			'prone incline row'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		variantOf: 'dumbbell-row'
	},
	{
		id: 'pendlay-row',
		name: 'Pendlay Row',
		aliases: ['pendlay', 'dead stop row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		variantOf: 'barbell-row'
	},
	{
		id: 't-bar-row',
		name: 'T-Bar Row',
		aliases: ['tbar row', 'landmine row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'machine-row',
		name: 'Machine Row',
		aliases: ['seated machine row', 'hammer row', 'hammer strength row', 'plate loaded row'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] }
	},
	{
		id: 'barbell-shrug',
		name: 'Barbell Shrug',
		aliases: ['shrug', 'shrugs', 'trap shrug', 'bb shrug'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Forearms'] }
	},
	{
		id: 'back-extension',
		name: 'Back Extension',
		aliases: [
			'hyperextension',
			'back raise',
			'hyper extension',
			'hypers',
			'roman chair back extension'
		],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.45,
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings'] }
	},

	{
		id: 'overhead-press',
		name: 'Overhead Press',
		aliases: [
			'ohp',
			'military press',
			'shoulder press',
			'standing press',
			'strict press',
			'barbell shoulder press'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps', 'Core'] }
	},
	{
		id: 'machine-shoulder-press',
		name: 'Machine Shoulder Press',
		aliases: ['shoulder press machine', 'machine overhead press', 'seated shoulder press'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		variantOf: 'overhead-press'
	},
	{
		id: 'seated-dumbbell-press',
		name: 'Seated DB Press',
		aliases: [
			'db shoulder press',
			'seated dumbbell press',
			'dumbbell shoulder press',
			'dumbbell overhead press',
			'db overhead press',
			'seated shoulder press'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] }
	},
	{
		id: 'arnold-press',
		name: 'Arnold Press',
		aliases: ['arnold', 'arnold dumbbell press'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		variantOf: 'seated-dumbbell-press'
	},
	{
		id: 'upright-row',
		name: 'Upright Row',
		aliases: ['barbell upright row', 'bb upright row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back', 'Biceps'] }
	},
	{
		id: 'lateral-raise',
		name: 'Lateral Raise',
		aliases: [
			'side raise',
			'side lateral',
			'lat raise',
			'db lateral raise',
			'dumbbell lateral raise',
			'side delt raise',
			'laterals'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: [] }
	},
	{
		id: 'cable-lateral-raise',
		name: 'Cable Lateral Raise',
		aliases: ['cable side raise', 'cable side lateral', 'cable lat raise'],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Shoulders', secondary: [] },
		variantOf: 'lateral-raise'
	},
	{
		id: 'machine-lateral-raise',
		name: 'Machine Lateral Raise',
		aliases: [
			'lateral raise machine',
			'machine lateral raises',
			'machine side raise',
			'lat raise machine',
			'seated lateral raise machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: [] },
		variantOf: 'lateral-raise'
	},
	{
		id: 'rear-delt-fly',
		name: 'Rear Delt Fly',
		aliases: [
			'reverse fly',
			'rear delt raise',
			'bent over lateral raise',
			'rear fly',
			'db rear delt fly'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Back'] }
	},
	{
		id: 'reverse-pec-deck',
		name: 'Reverse Pec Deck',
		aliases: [
			'reverse fly machine',
			'rear delt machine',
			'reverse peck deck',
			'machine rear delt fly',
			'reverse butterfly'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		variantOf: 'rear-delt-fly'
	},
	{
		id: 'cable-reverse-fly',
		name: 'Cable Reverse Fly',
		aliases: [
			'unilateral cable reverse fly',
			'single arm cable reverse fly',
			'cable rear delt fly',
			'one arm cable rear delt fly',
			'cable rear delt raise'
		],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		variantOf: 'rear-delt-fly'
	},
	{
		id: 'face-pull',
		name: 'Face Pull',
		aliases: ['facepull', 'rope face pull', 'cable face pull'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] }
	},

	{
		id: 'barbell-curl',
		name: 'Barbell Curl',
		aliases: ['bb curl', 'straight bar curl', 'barbell bicep curl'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'ez-bar-curl',
		name: 'EZ-Bar Curl',
		aliases: ['ez curl', 'ez bar bicep curl'],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		variantOf: 'barbell-curl'
	},
	{
		id: 'dumbbell-curl',
		name: 'Dumbbell Curl',
		aliases: [
			'db curl',
			'bicep curl',
			'dumbbell bicep curl',
			'db bicep curl',
			'alternating dumbbell curl'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'incline-dumbbell-curl',
		name: 'Incline DB Curl',
		aliases: ['incline curl', 'incline dumbbell curl', 'incline bench curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		variantOf: 'dumbbell-curl'
	},
	{
		id: 'hammer-curl',
		name: 'Hammer Curl',
		aliases: ['neutral grip curl', 'dumbbell hammer curl', 'db hammer curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'preacher-curl',
		name: 'Preacher Curl',
		aliases: ['preacher', 'scott curl', 'ez bar preacher curl'],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: [] }
	},
	{
		id: 'cable-curl',
		name: 'Cable Curl',
		aliases: ['rope curl', 'cable bicep curl', 'standing cable curl'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] }
	},
	{
		id: 'machine-curl',
		name: 'Machine Curl',
		aliases: ['machine biceps curl', 'machine bicep curl', 'curl machine', 'seated machine curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: [] }
	},

	{
		id: 'triceps-pushdown',
		name: 'Triceps Pushdown',
		aliases: ['pushdown', 'rope pushdown', 'cable pushdown', 'pressdown', 'rope pressdown'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] }
	},
	{
		id: 'overhead-triceps-extension',
		name: 'Overhead Triceps Extension',
		aliases: [
			'overhead extension',
			'french press',
			'cable overhead extension',
			'rope overhead extension'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] }
	},
	{
		id: 'skull-crusher',
		name: 'Skull Crusher',
		aliases: ['lying triceps extension', 'skullcrusher', 'ez bar skull crusher', 'nose breaker'],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] }
	},
	{
		id: 'dip',
		name: 'Dip',
		aliases: ['dips', 'parallel bar dip', 'tricep dip', 'chest dip', 'bar dip'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] }
	},

	{
		id: 'wrist-curl',
		name: 'Wrist Curl',
		aliases: ['barbell wrist curl', 'forearm curl', 'dumbbell wrist curl', 'db wrist curl'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Forearms', secondary: [] }
	},
	{
		id: 'reverse-curl',
		name: 'Reverse Curl',
		aliases: [
			'reverse barbell curl',
			'overhand curl',
			'reverse grip curl',
			'ez bar reverse curl',
			'pronated curl'
		],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Forearms', secondary: ['Biceps'] }
	},
	{
		id: 'farmers-carry',
		name: "Farmer's Carry",
		aliases: ['farmers walk', 'farmers carry', 'farmer walk', 'loaded carry'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Forearms', secondary: ['Core'] }
	},

	{
		id: 'plank',
		name: 'Plank',
		aliases: ['front plank', 'forearm plank', 'elbow plank'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] }
	},
	{
		id: 'side-plank',
		name: 'Side Plank',
		aliases: ['side bridge', 'lateral plank', 'oblique plank'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		variantOf: 'plank'
	},
	{
		id: 'crunch',
		name: 'Crunch',
		aliases: ['ab crunch', 'floor crunch', 'abdominal crunch'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] }
	},
	{
		id: 'ab-wheel-rollout',
		name: 'Ab Wheel Rollout',
		aliases: ['ab wheel', 'ab rollout', 'ab roller', 'wheel rollout'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: ['Shoulders'] }
	},
	{
		id: 'russian-twist',
		name: 'Russian Twist',
		aliases: ['seated twist', 'oblique twist', 'trunk twist'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] }
	},
	{
		id: 'cable-crunch',
		name: 'Cable Crunch',
		aliases: ['kneeling crunch', 'rope crunch', 'kneeling cable crunch', 'cable ab crunch'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: [] }
	},
	{
		id: 'hanging-leg-raise',
		name: 'Hanging Leg Raise',
		aliases: ['leg raise', 'hanging knee raise', 'knee raise', 'hanging knee tuck'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Core', secondary: ['Forearms'] }
	},

	{
		id: 'squat',
		name: 'Squat',
		aliases: [
			'back squat',
			'barbell squat',
			'barbell back squat',
			'high bar squat',
			'low bar squat'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings', 'Core'] }
	},
	{
		id: 'front-squat',
		name: 'Front Squat',
		aliases: ['barbell front squat', 'front rack squat'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Core'] },
		variantOf: 'squat'
	},
	{
		id: 'goblet-squat',
		name: 'Goblet Squat',
		aliases: [
			'kb goblet squat',
			'dumbbell goblet squat',
			'db goblet squat',
			'kettlebell goblet squat'
		],
		equipment: 'Kettlebell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Core'] },
		variantOf: 'squat'
	},
	{
		id: 'smith-machine-squat',
		name: 'Smith Machine Squat',
		aliases: ['smith squat', 'smith machine back squat'],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes'] },
		variantOf: 'squat'
	},
	{
		id: 'hack-squat',
		name: 'Hack Squat',
		aliases: ['hack squat machine', 'machine squat', 'machine hack squat'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes'] }
	},
	{
		id: 'leg-press',
		name: 'Leg Press',
		aliases: ['seated leg press', '45 degree leg press', 'machine leg press'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] }
	},
	{
		id: 'leg-extension',
		name: 'Leg Extension',
		aliases: ['quad extension', 'knee extension', 'machine leg extension'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: [] }
	},
	{
		id: 'bulgarian-split-squat',
		name: 'Bulgarian Split Squat',
		aliases: ['bss', 'split squat', 'bulgarian squat', 'rear foot elevated split squat', 'rfess'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes'] }
	},
	{
		id: 'lunge',
		name: 'Lunge',
		aliases: [
			'walking lunge',
			'lunges',
			'dumbbell lunge',
			'db lunge',
			'forward lunge',
			'reverse lunge'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] }
	},

	{
		id: 'romanian-deadlift',
		name: 'Romanian Deadlift',
		aliases: [
			'rdl',
			'stiff leg deadlift',
			'stiff legged deadlift',
			'barbell rdl',
			'sldl',
			'romanian dl'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes', 'Back'] }
	},
	{
		id: 'dumbbell-romanian-deadlift',
		name: 'Dumbbell RDL',
		aliases: [
			'db rdl',
			'dumbbell romanian deadlift',
			'db romanian deadlift',
			'dumbbell stiff leg deadlift'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes'] },
		variantOf: 'romanian-deadlift'
	},
	{
		id: 'good-morning',
		name: 'Good Morning',
		aliases: ['goodmorning', 'barbell good morning'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes', 'Back'] }
	},
	{
		id: 'leg-curl',
		name: 'Leg Curl',
		aliases: ['hamstring curl', 'ham curl', 'machine leg curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] }
	},
	{
		id: 'seated-leg-curl',
		name: 'Seated Leg Curl',
		aliases: ['seated hamstring curl', 'seated ham curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] },
		variantOf: 'leg-curl'
	},
	{
		id: 'lying-leg-curl',
		name: 'Lying Leg Curl',
		aliases: ['prone leg curl', 'lying hamstring curl', 'lying ham curl', 'prone hamstring curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] },
		variantOf: 'leg-curl'
	},

	{
		id: 'hip-thrust',
		name: 'Hip Thrust',
		aliases: ['glute bridge', 'barbell hip thrust', 'bb hip thrust', 'glute thrust'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] }
	},
	{
		id: 'hip-abduction',
		name: 'Hip Abduction',
		aliases: [
			'abductor machine',
			'hip abductor',
			'glute abduction',
			'abduction machine',
			'seated hip abduction'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: [] }
	},
	{
		id: 'kettlebell-swing',
		name: 'Kettlebell Swing',
		aliases: ['kb swing', 'russian swing', 'two hand swing'],
		equipment: 'Kettlebell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings', 'Back', 'Core'] }
	},
	{
		id: 'glute-kickback',
		name: 'Glute Kickback',
		aliases: ['cable kickback', 'kickback', 'cable glute kickback', 'donkey kick'],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Glutes', secondary: [] }
	},

	{
		id: 'standing-calf-raise',
		name: 'Standing Calf Raise',
		aliases: ['calf raise', 'machine calf raise', 'calf raise machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] }
	},
	{
		id: 'seated-calf-raise',
		name: 'Seated Calf Raise',
		aliases: ['seated calves', 'soleus raise', 'seated machine calf raise'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] }
	},
	{
		id: 'calf-press',
		name: 'Calf Press',
		aliases: ['leg press calf raise', 'calf press machine', 'leg press calves'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] }
	}
];

export const catalogById: Record<string, Exercise> = Object.fromEntries(
	catalog.map((exercise) => [exercise.id, exercise])
);
